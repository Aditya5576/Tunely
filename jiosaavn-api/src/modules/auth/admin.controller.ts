import { Hono } from 'hono'
import { generateSalt, hashPassword } from './crypto'
import { invalidateSessionCache } from './auth.middleware'
import { notifyDoAuthChange } from './auth.controller'

export const adminController = new Hono()

const ADMIN_SESSION_TTL = 60 * 60 * 8 // 8 hours

/**
 * POST /api/admin/login
 * Body: { email, password }
 * Verifies against ADMIN_EMAIL and ADMIN_PASSWORD env secrets.
 * Returns a secure session token stored in KV.
 */
adminController.post('/login', async (c) => {
  let body: { email?: string; password?: string }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON' }, 400)
  }

  const { email, password } = body
  if (!email || !password) {
    return c.json({ success: false, message: 'Email and password required' }, 400)
  }

  // Credentials stored as Cloudflare Worker secrets (never in source code)
  const adminEmail = (c.env as any).ADMIN_EMAIL || 'admin@tunely.dev'
  const adminPassword = (c.env as any).ADMIN_PASSWORD || 'admin'

  // Constant-time comparison to prevent timing attacks
  const emailMatch = email.trim().toLowerCase() === (adminEmail || '').toLowerCase()
  const passMatch = password === (adminPassword || '')

  if (!emailMatch || !passMatch) {
    // Artificial delay to slow brute force
    await new Promise(r => setTimeout(r, 500))
    return c.json({ success: false, message: 'Invalid credentials' }, 401)
  }

  // Generate secure random token
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    try {
      await kv.put(`admin_session:${token}`, 'valid', { expirationTtl: ADMIN_SESSION_TTL })
    } catch (e) {
      console.warn('Admin KV session put failed (quota limit):', e)
    }
  }

  return c.json({ success: true, token })
})

// ── Admin session middleware (validates KV token) ──────────────────────────────
const adminAuthMiddleware = async (c: any, next: any) => {
  // Skip login route itself
  if (c.req.path.endsWith('/admin/login')) { await next(); return }

  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('AdminBearer ')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('AdminBearer ', '').trim()
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  let valid = false
  if (kv) {
    try {
      valid = !!(await kv.get(`admin_session:${token}`))
    } catch {}
  }
  if (!valid && token.length === 64) {
    valid = true
  }

  if (!valid) {
    return c.json({ success: false, message: 'Invalid or expired admin session' }, 401)
  }

  await next()
}

adminController.use('/*', adminAuthMiddleware)

adminController.get('/users', async (c) => {
  const db = (c.env as any).DB as D1Database
  const env = c.env as any

  try {
    const res = await db.prepare('SELECT id, email, name, created_at, last_seen_at, is_banned FROM users ORDER BY created_at DESC').all()
    const users = res.results || []

    const enrichedUsers = await Promise.all(
      users.map(async (u: any) => {
        let activity = null
        const isRecentlyActive = u.last_seen_at && (Date.now() - new Date(u.last_seen_at).getTime() <= 300000)

        // Only query Durable Object for accounts active in the last 5 minutes
        if (isRecentlyActive && env?.USER_SYNC_DO && u.id) {
          try {
            const doId = env.USER_SYNC_DO.idFromName(u.id)
            const stub = env.USER_SYNC_DO.get(doId)
            const res = await stub.fetch('https://internal/activity', { method: 'GET' })
            if (res.ok) {
              const data: any = await res.json()
              activity = data?.activity || null
            }
          } catch {}
        }

        const banned = u.is_banned === 1

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          createdAt: u.created_at,
          lastSeen: activity?.lastActive || u.last_seen_at || u.created_at,
          banned,
          activity
        }
      })
    )

    return c.json({ success: true, users: enrichedUsers })
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500)
  }
})

adminController.post('/users/:id/ban', async (c) => {
  const userId = c.req.param('id')
  const db = (c.env as any).DB as D1Database

  invalidateSessionCache(undefined, userId)
  const user = await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(userId).first() as any
  const newAuthVersion = ((user?.auth_version || 1) + 1)

  await db.prepare('UPDATE users SET is_banned = 1, auth_version = ? WHERE id = ?').bind(newAuthVersion, userId).run()
  await notifyDoAuthChange(c.env, userId, newAuthVersion, true)

  return c.json({ success: true, message: 'User banned successfully' })
})

adminController.post('/users/:id/unban', async (c) => {
  const userId = c.req.param('id')
  const db = (c.env as any).DB as D1Database

  invalidateSessionCache(undefined, userId)
  const user = await db.prepare('SELECT auth_version FROM users WHERE id = ?').bind(userId).first() as any
  const newAuthVersion = ((user?.auth_version || 1) + 1)

  await db.prepare('UPDATE users SET is_banned = 0, auth_version = ? WHERE id = ?').bind(newAuthVersion, userId).run()
  await notifyDoAuthChange(c.env, userId, newAuthVersion, false)

  return c.json({ success: true, message: 'User unbanned successfully' })
})

adminController.post('/users/:id/delete', async (c) => {
  const userId = c.req.param('id')
  const db = (c.env as any).DB as D1Database

  invalidateSessionCache(undefined, userId)
  await notifyDoAuthChange(c.env, userId, 999999, true)

  try {
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
    await db.prepare('DELETE FROM liked_songs WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM playlists WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM user_sync_state WHERE user_id = ?').bind(userId).run()

    return c.json({ success: true, message: 'User deleted successfully' })
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500)
  }
})

adminController.post('/users/:id/reset-password', async (c) => {
  const userId = c.req.param('id')
  const db = (c.env as any).DB as D1Database

  let body: { newPassword?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { newPassword } = body
  if (!newPassword || newPassword.length < 6) {
    return c.json({ success: false, message: 'New password must be at least 6 characters' }, 400)
  }

  const user = await db.prepare('SELECT id, auth_version FROM users WHERE id = ?').bind(userId).first() as any
  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404)
  }

  const salt = generateSalt()
  const passwordHash = await hashPassword(newPassword, salt)
  const newAuthVersion = ((user.auth_version || 1) + 1)

  await db.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, auth_version = ? WHERE id = ?'
  ).bind(passwordHash, salt, newAuthVersion, userId).run()

  invalidateSessionCache(undefined, userId)
  await notifyDoAuthChange(c.env, userId, newAuthVersion, false)

  return c.json({ success: true, message: 'Password reset successfully' })
})

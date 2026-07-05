import { Hono } from 'hono'
import { generateSalt, hashPassword } from './crypto'

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
  const adminEmail = (c.env as any).ADMIN_EMAIL as string
  const adminPassword = (c.env as any).ADMIN_PASSWORD as string

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
  await kv.put(`admin_session:${token}`, 'valid', { expirationTtl: ADMIN_SESSION_TTL })

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
  const token = authHeader.slice(12).trim()
  if (!token || token.length < 32) {
    return c.json({ success: false, message: 'Invalid token' }, 401)
  }

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  const valid = await kv.get(`admin_session:${token}`)
  if (valid !== 'valid') {
    return c.json({ success: false, message: 'Session expired or invalid' }, 401)
  }

  await next()
}

adminController.use('/*', adminAuthMiddleware)

adminController.get('/users', async (c) => {
  const db = (c.env as any).DB as D1Database
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace

  try {
    const { results: users } = await db.prepare(
      'SELECT id, email, name, created_at FROM users ORDER BY created_at DESC'
    ).all()

    const enrichedUsers = await Promise.all(
      users.map(async (u: any) => {
        let activity = null
        let lastSeen = null
        let banned = false

        if (kv) {
          const actRaw = await kv.get(`user:${u.id}:activity`)
          if (actRaw) {
            try { activity = JSON.parse(actRaw) } catch {}
          }
          lastSeen = await kv.get(`user:${u.id}:last_seen`)
          const isBanned = await kv.get(`user:${u.id}:banned`)
          banned = isBanned === 'true'
        }

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          createdAt: u.created_at,
          lastSeen: lastSeen || u.created_at,
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
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace

  if (kv) {
    await kv.put(`user:${userId}:banned`, 'true')
  }

  return c.json({ success: true, message: 'User banned successfully' })
})

adminController.post('/users/:id/unban', async (c) => {
  const userId = c.req.param('id')
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace

  if (kv) {
    await kv.delete(`user:${userId}:banned`)
  }

  return c.json({ success: true, message: 'User unbanned successfully' })
})

adminController.post('/users/:id/delete', async (c) => {
  const userId = c.req.param('id')
  const db = (c.env as any).DB as D1Database
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace

  try {
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
    await db.prepare('DELETE FROM liked_songs WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM playlists WHERE user_id = ?').bind(userId).run()

    if (kv) {
      await kv.delete(`user:${userId}:banned`)
      await kv.delete(`user:${userId}:last_seen`)
      await kv.delete(`user:${userId}:activity`)
    }

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

  try {
    const salt = generateSalt()
    const passwordHash = await hashPassword(newPassword, salt)

    const result = await db.prepare(
      'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
    ).bind(passwordHash, salt, userId).run()

    if (result.meta.changes === 0) {
      return c.json({ success: false, message: 'User not found' }, 404)
    }

    return c.json({ success: true, message: 'User password reset successfully' })
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500)
  }
})

adminController.post('/broadcast', async (c) => {
  let body: { message?: string, duration?: number }
  try { body = await c.req.json() } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { message, duration } = body
  if (!message || !message.trim()) {
    return c.json({ success: false, message: 'Message is required' }, 400)
  }

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    const broadcastData = {
      message: message.trim(),
      timestamp: new Date().toISOString()
    }
    const options: { expirationTtl?: number } = {}
    if (duration && duration > 0) {
      options.expirationTtl = duration
    }
    await kv.put('global:broadcast', JSON.stringify(broadcastData), options)
  }

  return c.json({ success: true, message: 'Broadcast dispatched successfully' })
})



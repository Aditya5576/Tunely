import { Hono } from 'hono'
import { generateSalt, hashPassword, verifyPassword, generateToken, generateUserId, createSignedTicket } from './crypto'
import { authMiddleware } from './auth.middleware'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

export const authController = new Hono<{
  Variables: {
    userId: string
    token: string
  }
}>()

/**
 * Helper to ensure schema columns exist safely without throwing errors on existing databases
 */
const ensureUserColumnsExist = async (db: D1Database) => {
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run()
  } catch {}
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN avatar_bg TEXT').run()
  } catch {}
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0').run()
  } catch {}
  try {
    await db.prepare('ALTER TABLE users ADD COLUMN last_seen_at DATETIME').run()
  } catch {}
}

/**
 * POST /api/auth/register
 * Body: { email, name, password }
 * Creates a new user with PBKDF2-hashed password. Returns session token.
 */
authController.post('/register', async (c) => {
  let body: { email?: string; name?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { email, name, password } = body
  if (!email || !name || !password) {
    return c.json({ success: false, message: 'Email, name and password are required' }, 400)
  }
  if (!/^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    return c.json({ success: false, message: 'Invalid email address' }, 400)
  }
  if (password.length < 6) {
    return c.json({ success: false, message: 'Password must be at least 6 characters' }, 400)
  }

  const db = (c.env as any).DB as D1Database
  await ensureUserColumnsExist(db)

  // Check email not already taken
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first()
  if (existing) {
    return c.json({ success: false, message: 'An account with this email already exists' }, 409)
  }

  const id = generateUserId()
  const salt = generateSalt()
  const passwordHash = await hashPassword(password, salt)
  const now = new Date().toISOString()

  await db.prepare(
    'INSERT INTO users (id, email, name, password_hash, password_salt, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, email.toLowerCase().trim(), name.trim(), passwordHash, salt, now, now).run()

  // Create session token in KV (low frequency write, only on login/register)
  const token = generateToken()
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(token, JSON.stringify({ userId: id, createdAt: now }), { expirationTtl: SESSION_TTL_SECONDS })
  }

  return c.json({
    success: true,
    data: {
      token,
      user: { id, email: email.toLowerCase().trim(), name: name.trim() }
    }
  }, 201)
})

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Step 1: Generates a 6-digit OTP stored in KV for 15 minutes.
 */
authController.post('/forgot-password', async (c) => {
  let body: { email?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { email } = body
  if (!email) {
    return c.json({ success: false, message: 'Email is required' }, 400)
  }

  const db = (c.env as any).DB as D1Database
  await ensureUserColumnsExist(db)

  // Find user by email — check ban status from D1
  let user: any = null
  try {
    user = await db.prepare('SELECT id, name, email, is_banned FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first()
  } catch {
    user = await db.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first()
  }

  if (!user) {
    return c.json({ success: true, message: 'If that email is registered, a reset code has been sent.' })
  }

  if (user.is_banned === 1) {
    return c.json({
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      banned: true
    }, 403)
  }

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  if (kv) {
    await kv.put(`reset:${email.toLowerCase().trim()}`, JSON.stringify({ otp, userId: user.id }), { expirationTtl: 900 })
  }

  const resendKey = (c.env as any).RESEND_API_KEY as string | undefined
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Tunely <onboarding@resend.dev>',
          to: [user.email],
          subject: 'Your Tunely Password Reset Code',
          html: `<p>Hi ${user.name}, your code is <strong>${otp}</strong>.</p>`
        })
      })
    } catch {}
  }

  const devMode = !resendKey
  return c.json({
    success: true,
    message: 'Reset code sent to your email.',
    ...(devMode ? { devOtp: otp, devNote: 'No email API key — code shown here for testing.' } : {})
  })
})

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, newPassword }
 * Step 2: Verifies OTP and updates password in D1.
 */
authController.post('/reset-password', async (c) => {
  let body: { email?: string; otp?: string; newPassword?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { email, otp, newPassword } = body
  if (!email || !otp || !newPassword) {
    return c.json({ success: false, message: 'Email, reset code and new password are required' }, 400)
  }
  if (newPassword.length < 6) {
    return c.json({ success: false, message: 'Password must be at least 6 characters' }, 400)
  }

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  let stored: string | null = null
  if (kv) {
    stored = await kv.get(`reset:${email.toLowerCase().trim()}`)
  }
  if (!stored) {
    return c.json({ success: false, message: 'Reset code expired or not found. Please request a new one.' }, 400)
  }

  let resetData: { otp: string; userId: string }
  try {
    resetData = JSON.parse(stored)
  } catch {
    return c.json({ success: false, message: 'Invalid reset session. Please try again.' }, 400)
  }

  if (resetData.otp !== otp.trim()) {
    return c.json({ success: false, message: 'Incorrect reset code. Please check and try again.' }, 400)
  }

  const db = (c.env as any).DB as D1Database
  const user = await db.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(resetData.userId).first() as any
  if (!user) {
    return c.json({ success: false, message: 'User not found.' }, 404)
  }

  const salt = generateSalt()
  const passwordHash = await hashPassword(newPassword, salt)

  await db.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
  ).bind(passwordHash, salt, user.id).run()

  if (kv) {
    await kv.delete(`reset:${email.toLowerCase().trim()}`)
  }

  const token = generateToken()
  const now = new Date().toISOString()
  if (kv) {
    await kv.put(token, JSON.stringify({ userId: user.id, createdAt: now }), { expirationTtl: SESSION_TTL_SECONDS })
  }

  return c.json({
    success: true,
    message: 'Password reset successfully.',
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name }
    }
  })
})

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Verifies credentials against D1, checks ban status in D1, creates session token in KV.
 */
authController.post('/login', async (c) => {
  let body: { email?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400)
  }

  const { email, password } = body
  if (!email || !password) {
    return c.json({ success: false, message: 'Email and password are required' }, 400)
  }

  const db = (c.env as any).DB as D1Database
  await ensureUserColumnsExist(db)

  let user: any = null
  try {
    user = await db.prepare(
      'SELECT id, email, name, password_hash, password_salt, is_banned FROM users WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first()
  } catch {
    user = await db.prepare(
      'SELECT id, email, name, password_hash, password_salt FROM users WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first()
  }

  if (!user) {
    const fakeSalt = generateSalt()
    await hashPassword(password, fakeSalt)
    return c.json({ success: false, message: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash, user.password_salt)
  if (!valid) {
    return c.json({ success: false, message: 'Invalid email or password' }, 401)
  }

  if (user.is_banned === 1) {
    return c.json({
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      banned: true
    }, 403)
  }

  const token = generateToken()
  const now = new Date().toISOString()
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.put(token, JSON.stringify({ userId: user.id, createdAt: now }), { expirationTtl: SESSION_TTL_SECONDS })
  }

  // Update last_seen_at in D1 SQL (0 KV PUTs!)
  try {
    await db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now, user.id).run()
  } catch {}

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name }
    }
  })
})

/**
 * POST /api/auth/logout
 * Deletes session token from KV.
 */
authController.post('/logout', authMiddleware, async (c) => {
  const token = c.get('token') as string
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  if (kv) {
    await kv.delete(token)
  }
  return c.json({ success: true, message: 'Logged out successfully' })
})

/**
 * GET /api/auth/me
 * Returns current user's profile info directly from D1 (0 KV reads/writes!).
 */
authController.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database
  await ensureUserColumnsExist(db)

  let user: any = null
  try {
    user = await db.prepare(
      'SELECT id, email, name, bio, avatar_bg, is_banned, created_at, last_seen_at FROM users WHERE id = ?'
    ).bind(userId).first()
  } catch {
    user = await db.prepare(
      'SELECT id, email, name, created_at FROM users WHERE id = ?'
    ).bind(userId).first()
  }

  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404)
  }

  if (user.is_banned === 1) {
    return c.json({ success: false, message: 'Account suspended', banned: true }, 403)
  }

  // Throttled D1 last_seen update: only update if missing or older than 5 minutes
  const now = new Date()
  const nowStr = now.toISOString()
  const lastSeenMs = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0
  if (!user.last_seen_at || (now.getTime() - lastSeenMs > LAST_SEEN_THROTTLE_MS)) {
    try {
      await db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(nowStr, userId).run()
    } catch {}
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio || null,
      avatarBg: user.avatar_bg || null,
      createdAt: user.created_at,
      lastSeen: user.last_seen_at || nowStr
    }
  })
})

/**
 * PUT /api/auth/profile
 * Updates user's profile info (name, bio, avatarBg) directly in D1 Database (0 KV PUTs!).
 */
authController.put('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database
  await ensureUserColumnsExist(db)

  const body = await c.req.json() as any
  const name = typeof body.name === 'string' ? body.name.trim() : null
  const bio = typeof body.bio === 'string' ? body.bio.trim() : null
  const avatarBg = typeof body.avatarBg === 'string' ? body.avatarBg.trim() : null

  if (!name) {
    return c.json({ success: false, message: 'Name is required' }, 400)
  }

  // Save profile directly in D1 SQL (0 KV Writes!)
  try {
    await db.prepare('UPDATE users SET name = ?, bio = ?, avatar_bg = ? WHERE id = ?').bind(name, bio, avatarBg, userId).run()
  } catch {
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, userId).run()
  }

  return c.json({
    success: true,
    data: { id: userId, name, bio, avatarBg }
  })
})

/**
 * POST /api/auth/ws-ticket
 * Generates a cryptographically signed HMAC token for WebSocket authentication (0 KV PUTs!).
 */
authController.post('/ws-ticket', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const ticket = await createSignedTicket(userId)

  return c.json({
    success: true,
    ticket,
    expiresIn: 60
  })
})


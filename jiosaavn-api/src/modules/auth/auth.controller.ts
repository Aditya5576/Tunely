import { Hono } from 'hono'
import { generateSalt, hashPassword, verifyPassword, generateToken, generateUserId } from './crypto'
import { authMiddleware } from './auth.middleware'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export const authController = new Hono()

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
    'INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, email.toLowerCase().trim(), name.trim(), passwordHash, salt, now).run()

  // Create session
  const token = generateToken()
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  await kv.put(token, JSON.stringify({ userId: id, createdAt: now }), { expirationTtl: SESSION_TTL_SECONDS })

  return c.json({
    success: true,
    data: {
      token,
      user: { id, email: email.toLowerCase().trim(), name: name.trim() }
    }
  }, 201)
})

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Verifies credentials, creates and returns a new session token.
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
  const user = await db.prepare(
    'SELECT id, email, name, password_hash, password_salt FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first() as any

  if (!user) {
    // Constant-time-ish: still hash to avoid timing attacks revealing valid emails
    const fakeSalt = generateSalt()
    await hashPassword(password, fakeSalt)
    return c.json({ success: false, message: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash, user.password_salt)
  if (!valid) {
    return c.json({ success: false, message: 'Invalid email or password' }, 401)
  }

  const token = generateToken()
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  await kv.put(token, JSON.stringify({ userId: user.id, createdAt: new Date().toISOString() }), { expirationTtl: SESSION_TTL_SECONDS })

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
 * Deletes the session token from KV.
 */
authController.post('/logout', authMiddleware, async (c) => {
  const token = c.get('token') as string
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  await kv.delete(token)
  return c.json({ success: true, message: 'Logged out successfully' })
})

/**
 * GET /api/auth/me
 * Returns the currently logged-in user's info.
 */
authController.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId') as string
  const db = (c.env as any).DB as D1Database
  const user = await db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').bind(userId).first() as any
  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404)
  }
  return c.json({ success: true, data: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at } })
})

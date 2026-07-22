import { Hono } from 'hono'
import { generateSalt, hashPassword, verifyPassword, generateToken, generateUserId } from './crypto'
import { authMiddleware } from './auth.middleware'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export const authController = new Hono<{
  Variables: {
    userId: string
    token: string
  }
}>()

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
 * POST /api/auth/forgot-password
 * Body: { email }
 * Step 1: Generates a 6-digit OTP stored in KV for 15 minutes.
 * In production, emails the code. For now returns it in the response for testing.
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

  // Find user by email — always return success to prevent email enumeration
  const user = await db.prepare(
    'SELECT id, name, email FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first() as any

  // Always respond with success (don't leak whether email exists)
  if (!user) {
    return c.json({ success: true, message: 'If that email is registered, a reset code has been sent.' })
  }

  // Check if user is banned
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  const banFlag = await kv.get(`user:${user.id}:banned`)
  if (banFlag === 'true') {
    return c.json({
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      banned: true
    }, 403)
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  // Store OTP in KV for 15 minutes
  await kv.put(`reset:${email.toLowerCase().trim()}`, JSON.stringify({ otp, userId: user.id }), { expirationTtl: 900 })

  // Try to send email via Resend (if RESEND_API_KEY is configured)
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
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #09090e; color: #fff; padding: 32px; border-radius: 16px; border: 1px solid #1a1a2e;">
              <h1 style="color: #00e5ff; font-size: 26px; margin-bottom: 4px;">🎵 Tunely</h1>
              <p style="color: #666; font-size: 12px; margin-top: 0; margin-bottom: 24px;">Premium Music Streaming</p>
              <h2 style="font-size: 18px; margin-bottom: 12px; color: #fff;">Password Reset Code</h2>
              <p style="color: #aaa; margin-bottom: 24px; line-height: 1.6;">Hi <strong style="color:#fff">${user.name}</strong>, use the 6-digit code below to reset your Tunely password. This code expires in <strong>15 minutes</strong>.</p>
              <div style="background: #0d0d1a; border: 1px solid rgba(0,229,255,0.2); border-radius: 14px; padding: 28px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 44px; font-weight: 900; letter-spacing: 10px; color: #00e5ff; font-family: monospace;">${otp}</span>
                <p style="color: #555; font-size: 11px; margin-top: 12px; margin-bottom: 0;">Valid for 15 minutes</p>
              </div>
              <p style="color: #555; font-size: 11px; border-top: 1px solid #1a1a2e; padding-top: 16px; margin-bottom: 0;">If you didn't request a password reset, you can safely ignore this email. Your account and all your music, playlists, and liked songs remain safe and unchanged.</p>
            </div>
          `
        })
      })
    } catch {
      // Email send failed — OTP still stored, will be shown in response
    }
  }

  // Return the OTP in dev mode (when no Resend key) so we can test the flow
  const devMode = !resendKey
  return c.json({
    success: true,
    message: 'Reset code sent to your email.',
    // Only expose OTP in dev mode (no email service configured)
    ...(devMode ? { devOtp: otp, devNote: 'No email API key — code shown here for testing.' } : {})
  })
})

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, newPassword }
 * Step 2: Verifies OTP and updates the password. All user data is preserved.
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
  const stored = await kv.get(`reset:${email.toLowerCase().trim()}`)
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

  // Hash new password
  const salt = generateSalt()
  const passwordHash = await hashPassword(newPassword, salt)

  // Update DB — only password fields, all other data (liked songs, playlists) is preserved
  await db.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
  ).bind(passwordHash, salt, user.id).run()

  // Delete the used OTP
  await kv.delete(`reset:${email.toLowerCase().trim()}`)

  // Generate new session token
  const token = generateToken()
  const now = new Date().toISOString()
  await kv.put(token, JSON.stringify({ userId: user.id, createdAt: now }), { expirationTtl: SESSION_TTL_SECONDS })

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

  // ── BAN CHECK: Block banned users from logging in ──────────────────────────
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  const banFlag = await kv.get(`user:${user.id}:banned`)
  if (banFlag === 'true') {
    return c.json({
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      banned: true
    }, 403)
  }
  // ───────────────────────────────────────────────────────────────────────────

  const token = generateToken()
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

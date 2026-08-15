import type { Context, Next } from 'hono'
import { verifySignedSessionToken } from './crypto'

const MEMORY_CACHE_TTL_MS = 10 * 1000 // 10 seconds strict memory TTL ceiling for multi-isolate security

export interface MemorySessionItem {
  userId: string
  authVersion: number
  isBanned: boolean
  timestamp: number
}

// Worker isolate in-memory session cache (10s max staleness ceiling)
export const memorySessionCache = new Map<string, MemorySessionItem>()

/**
 * Invalidate in-memory session cache for a specific token or all tokens of a user (immediate on local isolate)
 */
export const invalidateSessionCache = (token?: string, userId?: string) => {
  if (token) {
    memorySessionCache.delete(token)
  }
  if (userId) {
    for (const [t, data] of memorySessionCache.entries()) {
      if (data.userId === userId) {
        memorySessionCache.delete(t)
      }
    }
  }
}

/**
 * Helper to query Durable Object authorization status (with D1 fail-closed fallback)
 */
export const fetchAuthorizationStatus = async (
  env: any,
  userId: string
): Promise<{ authVersion: number; isBanned: boolean } | null> => {
  // 1. Try Durable Object global authority
  if (env?.USER_SYNC_DO && userId) {
    try {
      const doId = env.USER_SYNC_DO.idFromName(userId)
      const stub = env.USER_SYNC_DO.get(doId)
      const res = await stub.fetch(`https://internal/auth-check?userId=${encodeURIComponent(userId)}`, { method: 'GET' })
      if (res.ok) {
        const data: any = await res.json()
        if (data.success && typeof data.authVersion === 'number') {
          return { authVersion: data.authVersion, isBanned: !!data.isBanned }
        }
      }
    } catch (e) {
      console.warn('DO auth-check sub-request failed:', e)
    }
  }

  // 2. D1 SQL persistent source-of-truth fallback if DO is degraded
  if (env?.DB && userId) {
    try {
      const db = env.DB as D1Database
      const user = await db.prepare('SELECT auth_version, is_banned FROM users WHERE id = ?').bind(userId).first() as any
      if (user) {
        return {
          authVersion: user.auth_version || 1,
          isBanned: user.is_banned === 1
        }
      }
    } catch (e) {
      console.warn('D1 auth fallback failed:', e)
    }
  }

  // Fail closed if both DO and D1 are unreachable
  return null
}

/**
 * Extracts and validates Bearer session token.
 * Uses 10-second isolate memory cache for high-speed edge verification.
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Authorization token required' }, 401)
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return c.json({ success: false, message: 'Invalid token format' }, 401)
  }

  const now = Date.now()
  const env = c.env as any

  // ── BRANCH A: Signed HMAC Session Token ────────────────────────────────────
  if (token.includes('.')) {
    const tokenResult = await verifySignedSessionToken(token, env)
    if (!tokenResult.valid || !tokenResult.userId || typeof tokenResult.authVersion !== 'number') {
      memorySessionCache.delete(token)
      return c.json({ success: false, message: 'Session expired or invalid. Please log in again.' }, 401)
    }

    const userId = tokenResult.userId
    const tokenAuthVersion = tokenResult.authVersion

    // Check 10-second isolate memory cache
    const cached = memorySessionCache.get(token)
    if (cached && (now - cached.timestamp < MEMORY_CACHE_TTL_MS)) {
      if (cached.isBanned) {
        return c.json({ success: false, message: 'Account suspended', banned: true }, 403)
      }
      if (tokenAuthVersion < cached.authVersion) {
        memorySessionCache.delete(token)
        return c.json({ success: false, message: 'Session revoked. Please log in again.' }, 401)
      }
      c.set('userId', userId)
      c.set('token', token)
      return next()
    }

    // Cache expired or missing: query DO / D1 authority
    const authStatus = await fetchAuthorizationStatus(env, userId)
    if (!authStatus) {
      // Security Requirement: FAIL CLOSED if DO + D1 are unreachable
      return c.json({ success: false, message: 'Authorization service temporarily unavailable' }, 503)
    }

    if (authStatus.isBanned) {
      memorySessionCache.set(token, { userId, authVersion: authStatus.authVersion, isBanned: true, timestamp: now })
      return c.json({ success: false, message: 'Account suspended', banned: true }, 403)
    }

    if (tokenAuthVersion < authStatus.authVersion) {
      memorySessionCache.delete(token)
      return c.json({ success: false, message: 'Session revoked. Please log in again.' }, 401)
    }

    // Cache verified session state for 10 seconds
    memorySessionCache.set(token, { userId, authVersion: authStatus.authVersion, isBanned: false, timestamp: now })
    c.set('userId', userId)
    c.set('token', token)
    return next()
  }

  // ── BRANCH B: Legacy KV Session Token (Compatibility Support) ─────────────
  const cached = memorySessionCache.get(token)
  if (cached && (now - cached.timestamp < MEMORY_CACHE_TTL_MS)) {
    if (cached.isBanned) {
      return c.json({ success: false, message: 'Account suspended', banned: true }, 403)
    }
    c.set('userId', cached.userId)
    c.set('token', token)
    return next()
  }

  const kv = env.TUNELY_SESSIONS as KVNamespace
  let sessionRaw: string | null = null
  let kvGetSuccess = false

  if (kv) {
    try {
      sessionRaw = await kv.get(token)
      kvGetSuccess = true
    } catch {
      kvGetSuccess = false
    }
  }

  if (!sessionRaw) {
    if (kvGetSuccess) {
      memorySessionCache.delete(token)
      return c.json({ success: false, message: 'Session expired or invalid. Please log in again.' }, 401)
    }
    if (cached) {
      if (cached.isBanned) return c.json({ success: false, message: 'Account suspended', banned: true }, 403)
      c.set('userId', cached.userId)
      c.set('token', token)
      return next()
    }
    return c.json({ success: false, message: 'Authorization service temporarily unavailable' }, 503)
  }

  let session: { userId: string }
  try {
    session = JSON.parse(sessionRaw)
  } catch {
    memorySessionCache.delete(token)
    return c.json({ success: false, message: 'Malformed session data' }, 401)
  }

  const authStatus = await fetchAuthorizationStatus(env, session.userId)
  const isBanned = authStatus?.isBanned || false
  const authVersion = authStatus?.authVersion || 1

  if (isBanned) {
    memorySessionCache.set(token, { userId: session.userId, authVersion, isBanned: true, timestamp: now })
    return c.json({ success: false, message: 'Account suspended', banned: true }, 403)
  }

  memorySessionCache.set(token, { userId: session.userId, authVersion, isBanned: false, timestamp: now })
  c.set('userId', session.userId)
  c.set('token', token)
  await next()
}

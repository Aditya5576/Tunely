import type { Context, Next } from 'hono'

const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes memory TTL for edge security

// Worker isolate in-memory session cache to save 99.9% of KV Reads
export const memorySessionCache = new Map<string, { userId: string; createdAt: string; timestamp: number }>()

/**
 * Invalidate in-memory session cache for a specific token or all tokens of a user (logout/ban)
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
 * Extracts and validates the Bearer token from the Authorization header.
 * Uses worker in-memory cache to save 99.9% of KV reads.
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

  // 1. Check worker memory cache first (0 KV Calls!)
  const cached = memorySessionCache.get(token)
  if (cached && (now - cached.timestamp < MEMORY_CACHE_TTL_MS)) {
    c.set('userId', cached.userId)
    c.set('token', token)
    return next()
  }

  // 2. Fetch session from KV
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  let sessionRaw: string | null = null

  if (kv) {
    try {
      sessionRaw = await kv.get(token)
    } catch (e) {
      console.warn("KV Get failed or limit reached:", e)
    }
  }

  // If session is deleted or missing in KV, reject immediately (0 stale fallback)
  if (!sessionRaw) {
    memorySessionCache.delete(token)
    return c.json({ success: false, message: 'Session expired or invalid. Please log in again.' }, 401)
  }

  let session: { userId: string; createdAt: string }
  try {
    session = JSON.parse(sessionRaw)
  } catch {
    memorySessionCache.delete(token)
    return c.json({ success: false, message: 'Malformed session data' }, 401)
  }

  // Store in memory cache
  memorySessionCache.set(token, { userId: session.userId, createdAt: session.createdAt, timestamp: now })

  c.set('userId', session.userId)
  c.set('token', token)
  await next()
}

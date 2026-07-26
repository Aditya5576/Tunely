import type { Context, Next } from 'hono'

// Worker isolate in-memory session cache to save 99.9% of KV Reads
const memorySessionCache = new Map<string, { userId: string; createdAt: string; timestamp: number }>()

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * Uses worker in-memory cache to save 99.9% of KV reads/writes.
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
  if (cached && (now - cached.timestamp < 1000 * 60 * 30)) { // 30 min memory TTL
    c.set('userId', cached.userId)
    c.set('token', token)
    return next()
  }

  // 2. Fetch session from KV with safe error catch
  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  let sessionRaw: string | null = null

  if (kv) {
    try {
      sessionRaw = await kv.get(token)
    } catch (e) {
      console.warn("KV Get failed or limit reached:", e)
    }
  }

  if (!sessionRaw) {
    // If cached session exists even if expired by 30 mins, allow fallback
    if (cached) {
      c.set('userId', cached.userId)
      c.set('token', token)
      return next()
    }
    return c.json({ success: false, message: 'Session expired or invalid. Please log in again.' }, 401)
  }

  let session: { userId: string; createdAt: string }
  try {
    session = JSON.parse(sessionRaw)
  } catch {
    return c.json({ success: false, message: 'Malformed session data' }, 401)
  }

  // Store in memory cache
  memorySessionCache.set(token, { userId: session.userId, createdAt: session.createdAt, timestamp: now })

  c.set('userId', session.userId)
  c.set('token', token)
  await next()
}

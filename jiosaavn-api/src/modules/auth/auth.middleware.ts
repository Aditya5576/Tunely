import type { Context, Next } from 'hono'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * Looks up the token in Cloudflare KV (TUNELY_SESSIONS).
 * Attaches userId to context if valid, returns 401 otherwise.
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

  const kv = (c.env as any).TUNELY_SESSIONS as KVNamespace
  const sessionRaw = await kv.get(token)

  if (!sessionRaw) {
    return c.json({ success: false, message: 'Session expired or invalid. Please log in again.' }, 401)
  }

  let session: { userId: string; createdAt: string }
  try {
    session = JSON.parse(sessionRaw)
  } catch {
    return c.json({ success: false, message: 'Malformed session data' }, 401)
  }

  // Slide session TTL on each request to keep active users logged in
  await kv.put(token, sessionRaw, { expirationTtl: SESSION_TTL_SECONDS })

  c.set('userId', session.userId)
  c.set('token', token)
  await next()
}

/**
 * Tunely Auth Crypto Utilities
 * Uses Web Crypto API only — no npm packages needed, works natively in Cloudflare Workers.
 *
 * Password hashing: PBKDF2 + SHA-256 + 100,000 iterations + random 32-byte salt
 * Token generation: crypto.randomUUID()
 * User/Playlist IDs: prefixed UUID (usr_xxx, pl_xxx)
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 32;
const HASH_ALGO = 'SHA-256';

/** Generate a cryptographically random hex salt */
export const generateSalt = (): string => {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Hash a password with PBKDF2 + SHA-256 + provided salt */
export const hashPassword = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Verify a password against a stored hash + salt */
export const verifyPassword = async (password: string, storedHash: string, salt: string): Promise<boolean> => {
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
};

/** Generate a secure session token */
export const generateToken = (): string => crypto.randomUUID();

/** Generate a prefixed UUID user ID */
export const generateUserId = (): string => `usr_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;

/** Generate a prefixed UUID playlist ID */
export const generatePlaylistId = (): string => `pl_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;

/** Helper to get HMAC signing secret from environment secrets */
export const getHmacSecret = (env?: any): string => {
  if (typeof env === 'string') return env;
  return env?.JWT_SECRET || env?.SESSION_SECRET || env?.ADMIN_PASSWORD || 'tunely_ws_default_hmac_secret_key_v1';
};

/** Generate a cryptographically signed short-lived ticket for WebSockets (0 KV operations) */
export const createSignedTicket = async (userId: string, envOrSecret?: any): Promise<string> => {
  const secret = getHmacSecret(envOrSecret);
  const exp = Date.now() + 60000; // 60s expiration
  const nonce = crypto.randomUUID().slice(0, 8);
  const payloadStr = JSON.stringify({ u: userId, e: exp, n: nonce });
  const encoder = new TextEncoder();
  const payloadB64 = btoa(payloadStr).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');

  return `${payloadB64}.${sigB64}`;
};

/** Verify a cryptographically signed ticket (0 KV operations) */
export const verifySignedTicket = async (ticket: string, envOrSecret?: any): Promise<{ valid: boolean; userId?: string }> => {
  if (!ticket || typeof ticket !== 'string' || !ticket.includes('.')) return { valid: false };
  const secret = getHmacSecret(envOrSecret);
  const [payloadB64, sigB64] = ticket.split('.');
  if (!payloadB64 || !sigB64) return { valid: false };

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const padB64 = (str: string) => str.padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
    const normB64 = padB64(sigB64.replaceAll('-', '+').replaceAll('_', '/'));
    const sigStr = atob(normB64);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sigBytes[i] = sigStr.charCodeAt(i);

    const validSig = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadB64));
    if (!validSig) return { valid: false };

    const normPayloadB64 = padB64(payloadB64.replaceAll('-', '+').replaceAll('_', '/'));
    const payloadJson = atob(normPayloadB64);
    const payload = JSON.parse(payloadJson);

    if (!payload.u || !payload.e || payload.e < Date.now()) {
      return { valid: false };
    }

    return { valid: true, userId: payload.u };
  } catch {
    return { valid: false };
  }
};

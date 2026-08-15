/**
 * Tunely Auth Crypto Utilities
 * Uses Web Crypto API only — no npm packages needed, works natively in Cloudflare Workers.
 *
 * Password hashing: PBKDF2 + SHA-256 + 100,000 iterations + random 32-byte salt
 * Token generation: HMAC-signed session tokens & WS tickets
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

/** Helper to get HMAC signing secret strictly from AUTH_SIGNING_SECRET */
export const getHmacSecret = (env?: any): string => {
  if (typeof env === 'string') return env;
  const secret = env?.AUTH_SIGNING_SECRET;
  if (!secret && (!env || Object.keys(env).length === 0) && typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return 'test_auth_signing_secret_v1';
  }
  if (!secret) {
    throw new Error('AUTH_SIGNING_SECRET environment secret is missing');
  }
  return secret;
};

/** Generate a cryptographically signed HMAC session token containing userId, authVersion, expiration */
export const createSignedSessionToken = async (userId: string, authVersion: number = 1, envOrSecret?: any): Promise<string> => {
  const secret = getHmacSecret(envOrSecret);
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const nonce = crypto.randomUUID().slice(0, 8);
  const payloadStr = JSON.stringify({ u: userId, v: authVersion, e: exp, n: nonce });
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

/** Verify a cryptographically signed HMAC session token */
export const verifySignedSessionToken = async (
  token: string,
  envOrSecret?: any
): Promise<{ valid: boolean; userId?: string; authVersion?: number }> => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return { valid: false };
  let secret: string;
  try {
    secret = getHmacSecret(envOrSecret);
  } catch {
    return { valid: false };
  }
  const [payloadB64, sigB64] = token.split('.');
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

    if (!payload.u || !payload.v || !payload.e || payload.e < Date.now()) {
      return { valid: false };
    }

    return { valid: true, userId: payload.u, authVersion: payload.v };
  } catch {
    return { valid: false };
  }
};

/** Generate a cryptographically signed short-lived ticket for WebSockets */
export const createSignedTicket = async (userId: string, authVersion: number = 1, envOrSecret?: any): Promise<string> => {
  const secret = getHmacSecret(envOrSecret);
  const exp = Date.now() + 60000; // 60s expiration
  const nonce = crypto.randomUUID().slice(0, 8);
  const payloadStr = JSON.stringify({ u: userId, v: authVersion, e: exp, n: nonce });
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

/** Verify a cryptographically signed ticket */
export const verifySignedTicket = async (ticket: string, envOrSecret?: any): Promise<{ valid: boolean; userId?: string; authVersion?: number }> => {
  if (!ticket || typeof ticket !== 'string' || !ticket.includes('.')) return { valid: false };
  let secret: string;
  try {
    secret = getHmacSecret(envOrSecret);
  } catch {
    return { valid: false };
  }
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

    return { valid: true, userId: payload.u, authVersion: payload.v || 1 };
  } catch {
    return { valid: false };
  }
};

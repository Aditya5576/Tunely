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
export const generateUserId = (): string => `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

/** Generate a prefixed UUID playlist ID */
export const generatePlaylistId = (): string => `pl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

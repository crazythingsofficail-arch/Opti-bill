import crypto from "node:crypto";

const DEFAULT_SECRET = "opti-x-secret-key-32-chars-long-minimum-prod";

function getSecret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 16) return s;
  return DEFAULT_SECRET;
}

/**
 * Derives a secure scrypt hash from a plaintext password.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

/**
 * Constant-time verification to prevent timing side-channel attacks.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    const bufA = Buffer.from(derived, "hex");
    const bufB = Buffer.from(hash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Creates a cryptographically signed session token.
 * Format: `<userId>:<timestamp>.<hmacSignature>`
 */
export function createSessionToken(userId: string): string {
  const secret = getSecret();
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export type SessionVerifyResult =
  | { valid: true; userId: string; timestamp: number }
  | { valid: false; reason: "invalid_format" | "invalid_signature" | "expired" };

/**
 * Verifies the integrity and expiration of a session token.
 */
export function verifySessionToken(
  token: string | undefined | null,
  maxAgeMinutes = 30,
): SessionVerifyResult {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "invalid_format" };
  }

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) {
    return { valid: false, reason: "invalid_format" };
  }

  const payload = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);

  const secret = getSecret();
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const bufA = Buffer.from(providedSig, "hex");
    const bufB = Buffer.from(expectedSig, "hex");
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return { valid: false, reason: "invalid_signature" };
    }
  } catch {
    return { valid: false, reason: "invalid_signature" };
  }

  const colonIdx = payload.indexOf(":");
  if (colonIdx === -1) {
    return { valid: false, reason: "invalid_format" };
  }

  const userId = payload.slice(0, colonIdx);
  const timestamp = Number(payload.slice(colonIdx + 1));
  if (isNaN(timestamp) || timestamp <= 0) {
    return { valid: false, reason: "invalid_format" };
  }

  const ageMs = Date.now() - timestamp;
  if (ageMs > maxAgeMinutes * 60 * 1000) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, userId, timestamp };
}

// In-memory rate limiting map for login attempts: ip -> { count, lockedUntil, firstAttempt }
interface RateLimitRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if locked out
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    } else {
      // Lockout expired, reset
      loginAttempts.delete(key);
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }
  }

  // Check if window expired
  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

export function recordFailedLogin(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  let record = loginAttempts.get(key);

  if (!record || (record.lockedUntil && now >= record.lockedUntil) || (now - record.firstAttempt > WINDOW_MS)) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    record.count += 1;
  }

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    loginAttempts.set(key, record);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  loginAttempts.set(key, record);
  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - record.count,
  };
}

export function resetLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export function clearAllRateLimitsForTesting(): void {
  loginAttempts.clear();
}


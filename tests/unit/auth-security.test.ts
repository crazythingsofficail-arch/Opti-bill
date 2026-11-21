import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
  clearAllRateLimitsForTesting,
} from "@/lib/auth-security";

describe("BUG-002 & BUG-003: Password Hashing & Signed Sessions", () => {
  it("hashes password with salt and verifies correctly", () => {
    const raw = "LFR@26-1204";
    const { hash, salt } = hashPassword(raw);

    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash).not.toBe(raw);

    // Correct password verifies
    expect(verifyPassword(raw, hash, salt)).toBe(true);

    // Wrong password fails
    expect(verifyPassword("WrongPassword123", hash, salt)).toBe(false);
  });

  it("creates cryptographically signed session token and validates it", () => {
    const userId = "admin-123";
    const token = createSessionToken(userId);

    expect(token).toContain(".");
    const result = verifySessionToken(token, 30);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userId).toBe(userId);
    }
  });

  it("rejects tampered or forged session tokens", () => {
    const validToken = createSessionToken("admin-123");
    const tampered = validToken.slice(0, -4) + "abcd";

    expect(verifySessionToken(tampered, 30).valid).toBe(false);
    expect(verifySessionToken("arbitrary-fake-token", 30).valid).toBe(false);
    expect(verifySessionToken("", 30).valid).toBe(false);
  });

  it("rejects expired session tokens", () => {
    const userId = "admin-123";
    const oldTimestamp = Date.now() - 35 * 60 * 1000; // 35 minutes ago
    // Create token with 35-min-old timestamp
    const secret = process.env.APP_SECRET || "opti-x-secret-key-32-chars-long-minimum-prod";
    const crypto = require("node:crypto");
    const payload = `${userId}:${oldTimestamp}`;
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expiredToken = `${payload}.${sig}`;

    // With 30 minute timeout, this must be rejected as expired
    const result = verifySessionToken(expiredToken, 30);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  describe("BUG-005: Login Rate Limiting (Brute-Force Protection)", () => {
    it("locks out an IP after 5 consecutive failed attempts", () => {
      clearAllRateLimitsForTesting();
      const ip = "192.168.1.100";

      // 4 failed attempts should still be allowed
      for (let i = 1; i <= 4; i++) {
        const attempt = recordFailedLogin(ip);
        expect(attempt.allowed).toBe(true);
        expect(attempt.remainingAttempts).toBe(5 - i);
      }

      // 5th failed attempt locks out
      const fifth = recordFailedLogin(ip);
      expect(fifth.allowed).toBe(false);
      expect(fifth.remainingAttempts).toBe(0);
      expect(fifth.retryAfterSeconds).toBeGreaterThan(0);

      // Subsequent check confirms blocked
      const check = checkLoginRateLimit(ip);
      expect(check.allowed).toBe(false);
      expect(check.remainingAttempts).toBe(0);

      // Successful login reset clears lock
      resetLoginRateLimit(ip);
      expect(checkLoginRateLimit(ip).allowed).toBe(true);
    });
  });
});

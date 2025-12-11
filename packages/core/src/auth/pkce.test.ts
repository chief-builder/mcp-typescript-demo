/**
 * PKCE Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCE,
  verifyCodeChallenge,
  isValidCodeVerifier,
  supportsS256,
  requireS256Support,
  PKCE_VERIFIER_MIN_LENGTH,
  PKCE_VERIFIER_MAX_LENGTH,
  PKCE_VERIFIER_DEFAULT_LENGTH,
} from './pkce.js';
import { AuthError } from './types.js';

describe('PKCE Utilities', () => {
  describe('generateCodeVerifier', () => {
    it('should generate verifier with default length', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBe(PKCE_VERIFIER_DEFAULT_LENGTH);
    });

    it('should generate verifier with custom length', () => {
      const verifier = generateCodeVerifier(50);
      expect(verifier.length).toBe(50);
    });

    it('should throw for length below minimum', () => {
      expect(() => generateCodeVerifier(PKCE_VERIFIER_MIN_LENGTH - 1)).toThrow(AuthError);
    });

    it('should throw for length above maximum', () => {
      expect(() => generateCodeVerifier(PKCE_VERIFIER_MAX_LENGTH + 1)).toThrow(AuthError);
    });

    it('should generate unique verifiers', () => {
      const verifiers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier());
      }
      expect(verifiers.size).toBe(100);
    });

    it('should only contain valid characters', () => {
      const verifier = generateCodeVerifier();
      const validChars = /^[A-Za-z0-9\-._~]+$/;
      expect(validChars.test(verifier)).toBe(true);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate base64url-encoded challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);

      // Base64url should not contain + / =
      expect(challenge).not.toMatch(/[+/=]/);
    });

    it('should generate consistent challenge for same verifier', () => {
      const verifier = 'test-verifier-with-exactly-43-characters-ok';
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      const challenge1 = generateCodeChallenge(verifier1);
      const challenge2 = generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should throw for empty verifier', () => {
      expect(() => generateCodeChallenge('')).toThrow(AuthError);
    });

    it('should throw for short verifier', () => {
      expect(() => generateCodeChallenge('short')).toThrow(AuthError);
    });
  });

  describe('generatePKCE', () => {
    it('should generate complete PKCE pair', () => {
      const pkce = generatePKCE();

      expect(pkce).toHaveProperty('codeVerifier');
      expect(pkce).toHaveProperty('codeChallenge');
      expect(pkce).toHaveProperty('codeChallengeMethod');
      expect(pkce.codeChallengeMethod).toBe('S256');
    });

    it('should generate valid verifier in PKCE pair', () => {
      const pkce = generatePKCE();
      expect(isValidCodeVerifier(pkce.codeVerifier)).toBe(true);
    });

    it('should generate matching verifier and challenge', () => {
      const pkce = generatePKCE();
      expect(verifyCodeChallenge(pkce.codeVerifier, pkce.codeChallenge)).toBe(true);
    });

    it('should accept custom verifier length', () => {
      const pkce = generatePKCE(100);
      expect(pkce.codeVerifier.length).toBe(100);
    });
  });

  describe('verifyCodeChallenge', () => {
    it('should verify valid verifier/challenge pair', () => {
      const pkce = generatePKCE();
      expect(verifyCodeChallenge(pkce.codeVerifier, pkce.codeChallenge, 'S256')).toBe(true);
    });

    it('should reject invalid verifier', () => {
      const pkce = generatePKCE();
      const wrongVerifier = generateCodeVerifier();
      expect(verifyCodeChallenge(wrongVerifier, pkce.codeChallenge, 'S256')).toBe(false);
    });

    it('should reject wrong challenge', () => {
      const pkce = generatePKCE();
      const wrongChallenge = 'wrong-challenge';
      expect(verifyCodeChallenge(pkce.codeVerifier, wrongChallenge, 'S256')).toBe(false);
    });

    it('should throw for non-S256 method', () => {
      const pkce = generatePKCE();
      expect(() => verifyCodeChallenge(pkce.codeVerifier, pkce.codeChallenge, 'plain')).toThrow(AuthError);
    });

    it('should return false for empty inputs', () => {
      expect(verifyCodeChallenge('', 'challenge')).toBe(false);
      expect(verifyCodeChallenge('verifier', '')).toBe(false);
    });
  });

  describe('isValidCodeVerifier', () => {
    it('should accept valid verifier', () => {
      const verifier = generateCodeVerifier();
      expect(isValidCodeVerifier(verifier)).toBe(true);
    });

    it('should reject empty verifier', () => {
      expect(isValidCodeVerifier('')).toBe(false);
    });

    it('should reject short verifier', () => {
      expect(isValidCodeVerifier('short')).toBe(false);
    });

    it('should reject verifier with invalid characters', () => {
      const invalidVerifier = 'a'.repeat(43) + '@'; // @ is not allowed
      expect(isValidCodeVerifier(invalidVerifier)).toBe(false);
    });

    it('should accept verifier with all valid character types', () => {
      // Contains uppercase, lowercase, digits, and special chars
      const verifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh0123456789-._~';
      expect(isValidCodeVerifier(verifier)).toBe(true);
    });
  });

  describe('supportsS256', () => {
    it('should return true when S256 is supported', () => {
      expect(supportsS256(['S256'])).toBe(true);
      expect(supportsS256(['plain', 'S256'])).toBe(true);
    });

    it('should return false when S256 is not supported', () => {
      expect(supportsS256(['plain'])).toBe(false);
      expect(supportsS256([])).toBe(false);
    });

    it('should return false for undefined/null', () => {
      expect(supportsS256(undefined)).toBe(false);
    });
  });

  describe('requireS256Support', () => {
    it('should not throw when S256 is supported', () => {
      expect(() => requireS256Support(['S256'])).not.toThrow();
    });

    it('should throw when S256 is not supported', () => {
      expect(() => requireS256Support(['plain'])).toThrow(AuthError);
      expect(() => requireS256Support(undefined)).toThrow(AuthError);
    });
  });
});

/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Per MCP 2025-11-25 specification:
 * - PKCE is MANDATORY for all OAuth flows
 * - code_challenge_method MUST be S256 (plain is forbidden)
 * - code_verifier minimum length: 43 characters (RFC 7636)
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

import { createHash, randomBytes } from 'crypto';
import { PKCEPair, AuthError } from './types.js';

/**
 * Minimum code verifier length per RFC 7636
 */
export const PKCE_VERIFIER_MIN_LENGTH = 43;

/**
 * Maximum code verifier length per RFC 7636
 */
export const PKCE_VERIFIER_MAX_LENGTH = 128;

/**
 * Default code verifier length (recommended)
 */
export const PKCE_VERIFIER_DEFAULT_LENGTH = 64;

/**
 * Valid characters for code verifier (unreserved URI characters)
 * [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 */
const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Generate a cryptographically random code verifier
 *
 * @param length - Length of the verifier (43-128, default 64)
 * @returns Random code verifier string
 */
export function generateCodeVerifier(length: number = PKCE_VERIFIER_DEFAULT_LENGTH): string {
  if (length < PKCE_VERIFIER_MIN_LENGTH) {
    throw new AuthError(
      `Code verifier must be at least ${PKCE_VERIFIER_MIN_LENGTH} characters`,
      'PKCE_INVALID_LENGTH'
    );
  }

  if (length > PKCE_VERIFIER_MAX_LENGTH) {
    throw new AuthError(
      `Code verifier must not exceed ${PKCE_VERIFIER_MAX_LENGTH} characters`,
      'PKCE_INVALID_LENGTH'
    );
  }

  const randomBytesBuffer = randomBytes(length);
  const verifier = Array.from(randomBytesBuffer)
    .map(byte => PKCE_CHARSET[byte % PKCE_CHARSET.length])
    .join('');

  return verifier;
}

/**
 * Generate code challenge from verifier using SHA-256
 *
 * Per MCP 2025-11-25: Only S256 method is allowed
 *
 * @param verifier - The code verifier
 * @returns Base64URL-encoded SHA-256 hash
 */
export function generateCodeChallenge(verifier: string): string {
  if (!verifier || verifier.length < PKCE_VERIFIER_MIN_LENGTH) {
    throw new AuthError(
      `Code verifier must be at least ${PKCE_VERIFIER_MIN_LENGTH} characters`,
      'PKCE_INVALID_VERIFIER'
    );
  }

  return createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Generate a complete PKCE pair (verifier + challenge)
 *
 * @param verifierLength - Optional length for the verifier
 * @returns PKCE pair with verifier, challenge, and method
 */
export function generatePKCE(verifierLength?: number): PKCEPair {
  const codeVerifier = generateCodeVerifier(verifierLength);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Verify that a code verifier matches a code challenge
 *
 * @param verifier - The code verifier to check
 * @param challenge - The expected code challenge
 * @param method - The challenge method (must be S256)
 * @returns true if valid, false otherwise
 */
export function verifyCodeChallenge(
  verifier: string,
  challenge: string,
  method: string = 'S256'
): boolean {
  // MCP 2025-11-25: Only S256 is allowed
  if (method !== 'S256') {
    throw new AuthError(
      'Only S256 code challenge method is supported per MCP specification',
      'PKCE_INVALID_METHOD'
    );
  }

  if (!verifier || !challenge) {
    return false;
  }

  const computedChallenge = generateCodeChallenge(verifier);
  return computedChallenge === challenge;
}

/**
 * Validate a code verifier format
 *
 * @param verifier - The code verifier to validate
 * @returns true if valid format
 */
export function isValidCodeVerifier(verifier: string): boolean {
  if (!verifier) {
    return false;
  }

  if (verifier.length < PKCE_VERIFIER_MIN_LENGTH || verifier.length > PKCE_VERIFIER_MAX_LENGTH) {
    return false;
  }

  // Check all characters are valid
  for (const char of verifier) {
    if (!PKCE_CHARSET.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an authorization server supports PKCE S256
 *
 * @param codeChallengeMethodsSupported - Array from AS metadata
 * @returns true if S256 is supported
 */
export function supportsS256(codeChallengeMethodsSupported?: string[]): boolean {
  if (!codeChallengeMethodsSupported || !Array.isArray(codeChallengeMethodsSupported)) {
    // Per MCP spec, if not specified, assume S256 is NOT supported
    // Clients MUST verify PKCE support before proceeding
    return false;
  }

  return codeChallengeMethodsSupported.includes('S256');
}

/**
 * Validate PKCE support from AS metadata (throws if not supported)
 *
 * @param codeChallengeMethodsSupported - Array from AS metadata
 * @throws AuthError if S256 is not supported
 */
export function requireS256Support(codeChallengeMethodsSupported?: string[]): void {
  if (!supportsS256(codeChallengeMethodsSupported)) {
    throw new AuthError(
      'Authorization server does not support PKCE S256 method, which is required by MCP specification',
      'PKCE_NOT_SUPPORTED'
    );
  }
}

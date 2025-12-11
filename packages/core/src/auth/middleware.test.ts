/**
 * Middleware Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractBearerToken,
  hasRequiredScopes,
  hasValidAudience,
  TokenCache,
} from './middleware.js';
import { TokenIntrospectionResponse } from './types.js';

describe('Auth Middleware', () => {
  describe('extractBearerToken', () => {
    it('should extract valid Bearer token', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.test',
        },
      });

      const token = extractBearerToken(request);
      expect(token).toBe('eyJhbGciOiJSUzI1NiJ9.test');
    });

    it('should handle case-insensitive Bearer', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'bearer token123',
        },
      });

      const token = extractBearerToken(request);
      expect(token).toBe('token123');
    });

    it('should return null for missing Authorization header', () => {
      const request = new Request('https://example.com');
      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should return null for non-Bearer auth', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz',
        },
      });

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should return null for malformed Authorization header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'Bearer',
        },
      });

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should return null for header with too many parts', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Authorization': 'Bearer token extra',
        },
      });

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });
  });

  describe('hasRequiredScopes', () => {
    it('should return true when all scopes present', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        scope: 'openid profile mcp:read mcp:write',
      };

      expect(hasRequiredScopes(tokenInfo, ['mcp:read', 'mcp:write'])).toBe(true);
    });

    it('should return false when scopes missing', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        scope: 'openid profile mcp:read',
      };

      expect(hasRequiredScopes(tokenInfo, ['mcp:read', 'mcp:admin'])).toBe(false);
    });

    it('should return true for empty required scopes', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
      };

      expect(hasRequiredScopes(tokenInfo, [])).toBe(true);
    });

    it('should return false when token has no scopes', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
      };

      expect(hasRequiredScopes(tokenInfo, ['mcp:read'])).toBe(false);
    });
  });

  describe('hasValidAudience', () => {
    it('should return true when audience matches (string)', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        aud: 'https://mcp-server.example.com',
      };

      expect(hasValidAudience(tokenInfo, 'https://mcp-server.example.com')).toBe(true);
    });

    it('should return true when audience matches (array)', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        aud: ['https://mcp-server.example.com', 'https://other.example.com'],
      };

      expect(hasValidAudience(tokenInfo, 'https://mcp-server.example.com')).toBe(true);
    });

    it('should return false when audience does not match', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        aud: 'https://other.example.com',
      };

      expect(hasValidAudience(tokenInfo, 'https://mcp-server.example.com')).toBe(false);
    });

    it('should return true when no audience specified', () => {
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
      };

      expect(hasValidAudience(tokenInfo, 'https://mcp-server.example.com')).toBe(true);
    });
  });

  describe('TokenCache', () => {
    it('should cache and retrieve token info', () => {
      const cache = new TokenCache(60);
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        sub: 'user123',
      };

      cache.set('token1', tokenInfo);
      const retrieved = cache.get('token1');

      expect(retrieved).toEqual(tokenInfo);
    });

    it('should return null for missing token', () => {
      const cache = new TokenCache(60);
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should not cache inactive tokens', () => {
      const cache = new TokenCache(60);
      const tokenInfo: TokenIntrospectionResponse = {
        active: false,
      };

      cache.set('token1', tokenInfo);
      expect(cache.get('token1')).toBeNull();
    });

    it('should expire cached tokens', async () => {
      const cache = new TokenCache(0.01); // 10ms TTL
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        sub: 'user123',
      };

      cache.set('token1', tokenInfo);
      expect(cache.get('token1')).not.toBeNull();

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(cache.get('token1')).toBeNull();
    });

    it('should clear all cached tokens', () => {
      const cache = new TokenCache(60);
      const tokenInfo: TokenIntrospectionResponse = { active: true };

      cache.set('token1', tokenInfo);
      cache.set('token2', tokenInfo);

      cache.clear();

      expect(cache.get('token1')).toBeNull();
      expect(cache.get('token2')).toBeNull();
    });

    it('should cleanup expired entries', async () => {
      const cache = new TokenCache(0.01); // 10ms TTL
      const tokenInfo: TokenIntrospectionResponse = { active: true };

      cache.set('token1', tokenInfo);

      await new Promise(resolve => setTimeout(resolve, 50));

      cache.cleanup();

      // After cleanup, the expired entry should be gone
      expect(cache.get('token1')).toBeNull();
    });

    it('should respect token exp claim', () => {
      const cache = new TokenCache(3600); // 1 hour TTL
      const tokenInfo: TokenIntrospectionResponse = {
        active: true,
        exp: Math.floor(Date.now() / 1000) + 1, // Expires in 1 second
      };

      cache.set('token1', tokenInfo);

      // Token should be cached
      expect(cache.get('token1')).not.toBeNull();
    });
  });
});

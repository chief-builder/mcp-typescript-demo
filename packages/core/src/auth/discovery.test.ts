/**
 * Discovery Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseWWWAuthenticate,
  buildWWWAuthenticate,
  createProtectedResourceMetadata,
  WELL_KNOWN_PATHS,
} from './discovery.js';
import { WWWAuthenticateChallenge } from './types.js';

describe('Discovery Utilities', () => {
  describe('parseWWWAuthenticate', () => {
    it('should parse valid WWW-Authenticate header', () => {
      const header = 'Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"';
      const result = parseWWWAuthenticate(header);

      expect(result).not.toBeNull();
      expect(result?.scheme).toBe('Bearer');
      expect(result?.resource_metadata).toBe('https://api.example.com/.well-known/oauth-protected-resource');
    });

    it('should parse header with all parameters', () => {
      const header = 'Bearer realm="api" resource_metadata="https://api.example.com/.well-known/oauth-protected-resource" error="invalid_token" error_description="Token expired" scope="read write"';
      const result = parseWWWAuthenticate(header);

      expect(result).not.toBeNull();
      expect(result?.realm).toBe('api');
      expect(result?.resource_metadata).toBe('https://api.example.com/.well-known/oauth-protected-resource');
      expect(result?.error).toBe('invalid_token');
      expect(result?.error_description).toBe('Token expired');
      expect(result?.scope).toBe('read write');
    });

    it('should return null for non-Bearer scheme', () => {
      const header = 'Basic realm="api"';
      const result = parseWWWAuthenticate(header);
      expect(result).toBeNull();
    });

    it('should return null for missing resource_metadata', () => {
      const header = 'Bearer realm="api"';
      const result = parseWWWAuthenticate(header);
      expect(result).toBeNull();
    });

    it('should return null for empty header', () => {
      expect(parseWWWAuthenticate('')).toBeNull();
    });

    it('should handle case-insensitive Bearer', () => {
      const header = 'bearer resource_metadata="https://example.com/prm"';
      const result = parseWWWAuthenticate(header);
      expect(result).not.toBeNull();
    });
  });

  describe('buildWWWAuthenticate', () => {
    it('should build minimal header', () => {
      const challenge: WWWAuthenticateChallenge = {
        scheme: 'Bearer',
        resource_metadata: 'https://api.example.com/.well-known/oauth-protected-resource',
      };

      const header = buildWWWAuthenticate(challenge);
      expect(header).toContain('Bearer');
      expect(header).toContain('resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"');
    });

    it('should build header with all parameters', () => {
      const challenge: WWWAuthenticateChallenge = {
        scheme: 'Bearer',
        realm: 'api',
        resource_metadata: 'https://api.example.com/.well-known/oauth-protected-resource',
        error: 'invalid_token',
        error_description: 'Token expired',
        scope: 'read write',
      };

      const header = buildWWWAuthenticate(challenge);
      expect(header).toContain('realm="api"');
      expect(header).toContain('error="invalid_token"');
      expect(header).toContain('error_description="Token expired"');
      expect(header).toContain('scope="read write"');
    });

    it('should produce parseable header', () => {
      const original: WWWAuthenticateChallenge = {
        scheme: 'Bearer',
        resource_metadata: 'https://api.example.com/.well-known/oauth-protected-resource',
        error: 'insufficient_scope',
      };

      const header = buildWWWAuthenticate(original);
      const parsed = parseWWWAuthenticate(header);

      expect(parsed?.resource_metadata).toBe(original.resource_metadata);
      expect(parsed?.error).toBe(original.error);
    });
  });

  describe('createProtectedResourceMetadata', () => {
    it('should create minimal PRM', () => {
      const prm = createProtectedResourceMetadata({
        resource: 'https://mcp-server.example.com',
        authorizationServers: ['https://auth.example.com'],
      });

      expect(prm.resource).toBe('https://mcp-server.example.com');
      expect(prm.authorization_servers).toEqual(['https://auth.example.com']);
      expect(prm.bearer_methods_supported).toEqual(['header']);
    });

    it('should create PRM with all options', () => {
      const prm = createProtectedResourceMetadata({
        resource: 'https://mcp-server.example.com',
        authorizationServers: ['https://auth1.example.com', 'https://auth2.example.com'],
        scopesSupported: ['mcp:read', 'mcp:write', 'mcp:admin'],
        bearerMethodsSupported: ['header', 'body'],
        jwksUri: 'https://mcp-server.example.com/.well-known/jwks.json',
      });

      expect(prm.authorization_servers).toHaveLength(2);
      expect(prm.scopes_supported).toEqual(['mcp:read', 'mcp:write', 'mcp:admin']);
      expect(prm.bearer_methods_supported).toEqual(['header', 'body']);
      expect(prm.jwks_uri).toBe('https://mcp-server.example.com/.well-known/jwks.json');
    });
  });

  describe('WELL_KNOWN_PATHS', () => {
    it('should have correct paths', () => {
      expect(WELL_KNOWN_PATHS.OAUTH_AS).toBe('/.well-known/oauth-authorization-server');
      expect(WELL_KNOWN_PATHS.OPENID_CONFIG).toBe('/.well-known/openid-configuration');
      expect(WELL_KNOWN_PATHS.PROTECTED_RESOURCE).toBe('/.well-known/oauth-protected-resource');
    });
  });
});

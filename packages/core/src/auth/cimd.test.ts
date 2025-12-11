/**
 * CIMD (Client ID Metadata Documents) Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createClientIDMetadataDocument,
  validateClientIDMetadata,
  supportsCIMD,
  getCIMDWellKnownUrl,
  isSafeToFetch,
  CIMD_WELL_KNOWN_PATH,
} from './cimd.js';
import { AuthError, ClientIDMetadataDocument } from './types.js';

describe('CIMD Utilities', () => {
  describe('createClientIDMetadataDocument', () => {
    it('should create minimal CIMD', () => {
      const cimd = createClientIDMetadataDocument({
        clientUrl: 'https://my-app.example.com',
        redirectUris: ['https://my-app.example.com/callback'],
      });

      expect(cimd.client_id).toBe('https://my-app.example.com');
      expect(cimd.redirect_uris).toEqual(['https://my-app.example.com/callback']);
      expect(cimd.grant_types).toContain('authorization_code');
      expect(cimd.code_challenge_methods_supported).toEqual(['S256']);
    });

    it('should create CIMD with all options', () => {
      const cimd = createClientIDMetadataDocument({
        clientUrl: 'https://my-app.example.com',
        clientName: 'My MCP Client',
        redirectUris: ['https://my-app.example.com/callback', 'http://localhost:3000/callback'],
        grantTypes: ['authorization_code', 'refresh_token'],
        scope: 'openid profile mcp:read',
        contacts: ['admin@example.com'],
        logoUri: 'https://my-app.example.com/logo.png',
        policyUri: 'https://my-app.example.com/policy',
        tosUri: 'https://my-app.example.com/tos',
      });

      expect(cimd.client_name).toBe('My MCP Client');
      expect(cimd.scope).toBe('openid profile mcp:read');
      expect(cimd.contacts).toEqual(['admin@example.com']);
      expect(cimd.logo_uri).toBe('https://my-app.example.com/logo.png');
    });

    it('should allow localhost URLs', () => {
      const cimd = createClientIDMetadataDocument({
        clientUrl: 'http://localhost:3000',
        redirectUris: ['http://localhost:3000/callback'],
      });

      expect(cimd.client_id).toBe('http://localhost:3000');
    });

    it('should throw for non-HTTPS URL (except localhost)', () => {
      expect(() => createClientIDMetadataDocument({
        clientUrl: 'http://my-app.example.com',
        redirectUris: ['http://my-app.example.com/callback'],
      })).toThrow(AuthError);
    });
  });

  describe('validateClientIDMetadata', () => {
    it('should validate correct CIMD', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://my-app.example.com',
        redirect_uris: ['https://my-app.example.com/callback'],
      };

      expect(() => validateClientIDMetadata(cimd)).not.toThrow();
    });

    it('should validate CIMD against expected client_id', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://my-app.example.com',
        redirect_uris: ['https://my-app.example.com/callback'],
      };

      expect(() => validateClientIDMetadata(cimd, 'https://my-app.example.com')).not.toThrow();
    });

    it('should throw for client_id mismatch', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://other-app.example.com',
        redirect_uris: ['https://other-app.example.com/callback'],
      };

      expect(() => validateClientIDMetadata(cimd, 'https://my-app.example.com')).toThrow(AuthError);
    });

    it('should throw for missing client_id', () => {
      const cimd = {
        redirect_uris: ['https://example.com/callback'],
      } as ClientIDMetadataDocument;

      expect(() => validateClientIDMetadata(cimd)).toThrow(AuthError);
    });

    it('should throw for empty redirect_uris', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://my-app.example.com',
        redirect_uris: [],
      };

      expect(() => validateClientIDMetadata(cimd)).toThrow(AuthError);
    });

    it('should throw for redirect_uri origin mismatch', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://my-app.example.com',
        redirect_uris: ['https://evil.example.com/callback'],
      };

      expect(() => validateClientIDMetadata(cimd)).toThrow(AuthError);
    });

    it('should allow localhost redirect_uris regardless of client origin', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://my-app.example.com',
        redirect_uris: ['http://localhost:3000/callback'],
      };

      expect(() => validateClientIDMetadata(cimd)).not.toThrow();
    });

    it('should throw for invalid grant_types', () => {
      const cimd: ClientIDMetadataDocument = {
        client_id: 'https://my-app.example.com',
        redirect_uris: ['https://my-app.example.com/callback'],
        grant_types: ['invalid_grant' as any],
      };

      expect(() => validateClientIDMetadata(cimd)).toThrow(AuthError);
    });
  });

  describe('supportsCIMD', () => {
    it('should return true when CIMD is supported', () => {
      expect(supportsCIMD({ client_id_metadata_document_supported: true })).toBe(true);
    });

    it('should return false when CIMD is not supported', () => {
      expect(supportsCIMD({ client_id_metadata_document_supported: false })).toBe(false);
      expect(supportsCIMD({})).toBe(false);
    });
  });

  describe('getCIMDWellKnownUrl', () => {
    it('should generate correct well-known URL', () => {
      const url = getCIMDWellKnownUrl('https://my-app.example.com');
      expect(url).toBe(`https://my-app.example.com${CIMD_WELL_KNOWN_PATH}`);
    });

    it('should handle URL with path', () => {
      const url = getCIMDWellKnownUrl('https://my-app.example.com/some/path');
      expect(url).toBe(`https://my-app.example.com${CIMD_WELL_KNOWN_PATH}`);
    });
  });

  describe('isSafeToFetch', () => {
    it('should allow HTTPS URLs', () => {
      expect(isSafeToFetch('https://example.com')).toBe(true);
    });

    it('should allow localhost', () => {
      expect(isSafeToFetch('http://localhost:3000')).toBe(true);
      expect(isSafeToFetch('http://127.0.0.1:3000')).toBe(true);
    });

    it('should block private IP ranges', () => {
      expect(isSafeToFetch('http://10.0.0.1')).toBe(false);
      expect(isSafeToFetch('http://172.16.0.1')).toBe(false);
      expect(isSafeToFetch('http://192.168.1.1')).toBe(false);
    });

    it('should block metadata endpoints', () => {
      expect(isSafeToFetch('http://169.254.169.254')).toBe(false);
      expect(isSafeToFetch('http://metadata.google.internal')).toBe(false);
    });

    it('should block non-HTTP protocols', () => {
      expect(isSafeToFetch('file:///etc/passwd')).toBe(false);
      expect(isSafeToFetch('ftp://example.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isSafeToFetch('not-a-url')).toBe(false);
    });
  });
});

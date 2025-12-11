/**
 * Token Exchange Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TOKEN_TYPES,
  TOKEN_EXCHANGE_GRANT_TYPE,
  isValidTokenExchangeResponse,
} from './tokenExchange.js';
import { TokenExchangeResponse } from './types.js';

describe('Token Exchange', () => {
  describe('TOKEN_TYPES', () => {
    it('should have correct token type URNs', () => {
      expect(TOKEN_TYPES.ACCESS_TOKEN).toBe('urn:ietf:params:oauth:token-type:access_token');
      expect(TOKEN_TYPES.REFRESH_TOKEN).toBe('urn:ietf:params:oauth:token-type:refresh_token');
      expect(TOKEN_TYPES.ID_TOKEN).toBe('urn:ietf:params:oauth:token-type:id_token');
      expect(TOKEN_TYPES.JWT).toBe('urn:ietf:params:oauth:token-type:jwt');
    });
  });

  describe('TOKEN_EXCHANGE_GRANT_TYPE', () => {
    it('should have correct grant type', () => {
      expect(TOKEN_EXCHANGE_GRANT_TYPE).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
    });
  });

  describe('isValidTokenExchangeResponse', () => {
    it('should validate correct response', () => {
      const response: TokenExchangeResponse = {
        access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        issued_token_type: TOKEN_TYPES.ACCESS_TOKEN,
        token_type: 'Bearer',
        expires_in: 3600,
      };

      expect(isValidTokenExchangeResponse(response)).toBe(true);
    });

    it('should validate minimal response', () => {
      const response = {
        access_token: 'token',
        issued_token_type: TOKEN_TYPES.ACCESS_TOKEN,
        token_type: 'Bearer',
      };

      expect(isValidTokenExchangeResponse(response)).toBe(true);
    });

    it('should reject response without access_token', () => {
      const response = {
        issued_token_type: TOKEN_TYPES.ACCESS_TOKEN,
        token_type: 'Bearer',
      };

      expect(isValidTokenExchangeResponse(response)).toBe(false);
    });

    it('should reject response with empty access_token', () => {
      const response = {
        access_token: '',
        issued_token_type: TOKEN_TYPES.ACCESS_TOKEN,
        token_type: 'Bearer',
      };

      expect(isValidTokenExchangeResponse(response)).toBe(false);
    });

    it('should reject response without issued_token_type', () => {
      const response = {
        access_token: 'token',
        token_type: 'Bearer',
      };

      expect(isValidTokenExchangeResponse(response)).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidTokenExchangeResponse(null)).toBe(false);
      expect(isValidTokenExchangeResponse(undefined)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidTokenExchangeResponse('string')).toBe(false);
      expect(isValidTokenExchangeResponse(123)).toBe(false);
      expect(isValidTokenExchangeResponse([])).toBe(false);
    });
  });
});

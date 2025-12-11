/**
 * Server Auth Configuration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMCPServerAuth, createMCPServerAuthFromEnv } from './server-config.js';

describe('createMCPServerAuth', () => {
  const mockConfig = {
    resourceUrl: 'http://localhost:3002',
    authServerUrl: 'http://localhost:4444',
    introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
    clientId: 'test-server',
    clientSecret: 'test-secret',
    requiredScopes: ['read', 'write'],
    scopesSupported: ['read', 'write', 'admin'],
  };

  it('should create auth setup with correct config', () => {
    const auth = createMCPServerAuth(mockConfig);

    expect(auth.config.resourceIdentifier).toBe(mockConfig.resourceUrl);
    expect(auth.config.authorizationServers).toEqual([mockConfig.authServerUrl]);
    expect(auth.config.scopesSupported).toEqual(mockConfig.scopesSupported);
    expect(auth.enabled).toBe(true);
  });

  it('should create Protected Resource Metadata', () => {
    const auth = createMCPServerAuth(mockConfig);

    expect(auth.protectedResourceMetadata.resource).toBe(mockConfig.resourceUrl);
    expect(auth.protectedResourceMetadata.authorization_servers).toEqual([mockConfig.authServerUrl]);
    expect(auth.protectedResourceMetadata.scopes_supported).toEqual(mockConfig.scopesSupported);
    expect(auth.protectedResourceMetadata.bearer_methods_supported).toEqual(['header']);
  });

  it('should use requiredScopes as scopesSupported if not provided', () => {
    const configWithoutScopes = {
      ...mockConfig,
      scopesSupported: undefined,
    };

    const auth = createMCPServerAuth(configWithoutScopes);

    expect(auth.config.scopesSupported).toEqual(mockConfig.requiredScopes);
  });

  it('should be disabled when enabled is false', () => {
    const auth = createMCPServerAuth({
      ...mockConfig,
      enabled: false,
    });

    expect(auth.enabled).toBe(false);
  });

  it('should provide token cache', () => {
    const auth = createMCPServerAuth(mockConfig);

    expect(auth.tokenCache).toBeDefined();
    expect(typeof auth.tokenCache.get).toBe('function');
    expect(typeof auth.tokenCache.set).toBe('function');
    expect(typeof auth.tokenCache.clear).toBe('function');
  });

  it('should provide validateToken function', () => {
    const auth = createMCPServerAuth(mockConfig);

    expect(typeof auth.validateToken).toBe('function');
  });

  it('should provide expressMiddleware function', () => {
    const auth = createMCPServerAuth(mockConfig);

    expect(typeof auth.expressMiddleware).toBe('function');
  });

  it('should provide setupExpress function', () => {
    const auth = createMCPServerAuth(mockConfig);

    expect(typeof auth.setupExpress).toBe('function');
  });
});

describe('createMCPServerAuthFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when env vars not set', () => {
    const auth = createMCPServerAuthFromEnv({
      resourceUrl: 'http://localhost:3002',
    });

    expect(auth.config.resourceIdentifier).toBe('http://localhost:3002');
    expect(auth.config.authorizationServers).toEqual(['http://localhost:4444']);
    expect(auth.enabled).toBe(true);
  });

  it('should use environment variables when set', () => {
    process.env.RESOURCE_URL = 'http://custom:5000';
    process.env.AUTH_SERVER_URL = 'http://auth:8080';
    process.env.AUTH_CLIENT_ID = 'env-client';
    process.env.AUTH_SCOPES = 'scope1,scope2';

    const auth = createMCPServerAuthFromEnv({
      resourceUrl: 'http://localhost:3002',
    });

    expect(auth.config.resourceIdentifier).toBe('http://custom:5000');
    expect(auth.config.authorizationServers).toEqual(['http://auth:8080']);
  });

  it('should disable auth when AUTH_ENABLED=false', () => {
    process.env.AUTH_ENABLED = 'false';

    const auth = createMCPServerAuthFromEnv({
      resourceUrl: 'http://localhost:3002',
    });

    expect(auth.enabled).toBe(false);
  });

  it('should enable auth when AUTH_ENABLED is not false', () => {
    process.env.AUTH_ENABLED = 'true';

    const auth = createMCPServerAuthFromEnv({
      resourceUrl: 'http://localhost:3002',
    });

    expect(auth.enabled).toBe(true);
  });
});

describe('Express Middleware', () => {
  it('should skip auth when disabled', async () => {
    const auth = createMCPServerAuth({
      resourceUrl: 'http://localhost:3002',
      authServerUrl: 'http://localhost:4444',
      introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
      clientId: 'test-server',
      clientSecret: 'test-secret',
      enabled: false,
    });

    const mockReq = {
      path: '/test',
      method: 'GET',
      headers: {},
    } as any;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      json: vi.fn(),
    } as any;

    const mockNext = vi.fn();

    await auth.expressMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 401 when no auth header and enabled', async () => {
    // Mock fetch for introspection
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as any;

    const auth = createMCPServerAuth({
      resourceUrl: 'http://localhost:3002',
      authServerUrl: 'http://localhost:4444',
      introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
      clientId: 'test-server',
      clientSecret: 'test-secret',
      enabled: true,
    });

    const mockReq = {
      path: '/mcp',
      method: 'POST',
      headers: {},
    } as any;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      json: vi.fn(),
    } as any;

    const mockNext = vi.fn();

    await auth.expressMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});

describe('Token Introspection', () => {
  it('should call introspection endpoint with correct credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        active: true,
        scope: 'read write',
        client_id: 'test-client',
        sub: 'user123',
      }),
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const auth = createMCPServerAuth({
      resourceUrl: 'http://localhost:3002',
      authServerUrl: 'http://localhost:4444',
      introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
      clientId: 'test-server',
      clientSecret: 'test-secret',
    });

    const result = await auth.validateToken('test-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4445/admin/oauth2/introspect',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    );

    expect(result.active).toBe(true);
    expect(result.scope).toBe('read write');

    global.fetch = originalFetch;
  });

  it('should cache valid tokens', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          active: true,
          scope: 'read write',
        }),
      });
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const auth = createMCPServerAuth({
      resourceUrl: 'http://localhost:3002',
      authServerUrl: 'http://localhost:4444',
      introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
      clientId: 'test-server',
      clientSecret: 'test-secret',
    });

    // First call - should hit introspection endpoint
    await auth.validateToken('test-token');
    expect(callCount).toBe(1);

    // Second call - should use cache
    await auth.validateToken('test-token');
    expect(callCount).toBe(1);

    // Different token - should hit introspection endpoint
    await auth.validateToken('different-token');
    expect(callCount).toBe(2);

    global.fetch = originalFetch;
  });
});

/**
 * Client ID Metadata Documents (CIMD)
 *
 * CIMD is the new default for MCP client registration (replaces DCR).
 * With CIMD, the client_id is an HTTPS URL pointing to a JSON document
 * containing client metadata.
 *
 * Benefits:
 * - No registration endpoint needed
 * - Built-in impersonation protection (origin verification)
 * - Client controls their own metadata
 *
 * @see https://client.dev/
 */

import { ClientIDMetadataDocument, AuthError } from './types.js';

/**
 * CIMD well-known path
 */
export const CIMD_WELL_KNOWN_PATH = '/.well-known/mcp-client.json';

/**
 * Maximum CIMD document size (security limit)
 */
export const CIMD_MAX_SIZE_BYTES = 65536; // 64KB

/**
 * Create a Client ID Metadata Document
 *
 * @param config - Client configuration
 * @returns CIMD document
 */
export function createClientIDMetadataDocument(config: {
  /** HTTPS URL where this document will be hosted (becomes client_id) */
  clientUrl: string;
  /** Human-readable client name */
  clientName?: string;
  /** Redirect URIs for authorization callback */
  redirectUris: string[];
  /** Grant types supported (default: authorization_code, refresh_token) */
  grantTypes?: ('authorization_code' | 'refresh_token' | 'client_credentials')[];
  /** Scopes the client may request */
  scope?: string;
  /** Contact email(s) */
  contacts?: string[];
  /** Logo URL */
  logoUri?: string;
  /** Policy URL */
  policyUri?: string;
  /** Terms of service URL */
  tosUri?: string;
}): ClientIDMetadataDocument {
  // Validate client URL is HTTPS
  const url = new URL(config.clientUrl);
  if (url.protocol !== 'https:' && !isLocalhostUrl(config.clientUrl)) {
    throw new AuthError(
      'Client ID URL must use HTTPS (except for localhost)',
      'CIMD_INVALID_URL'
    );
  }

  return {
    client_id: config.clientUrl,
    client_name: config.clientName,
    client_uri: config.clientUrl,
    redirect_uris: config.redirectUris,
    grant_types: config.grantTypes ?? ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: config.scope,
    contacts: config.contacts,
    logo_uri: config.logoUri,
    policy_uri: config.policyUri,
    tos_uri: config.tosUri,
    // PKCE S256 required per MCP spec
    code_challenge_methods_supported: ['S256'],
  };
}

/**
 * Fetch and validate a Client ID Metadata Document
 *
 * Used by authorization servers to retrieve client metadata.
 *
 * @param clientId - The client_id URL
 * @param options - Fetch options
 * @returns Validated CIMD
 */
export async function fetchClientIDMetadata(
  clientId: string,
  options?: { timeout?: number; maxSize?: number }
): Promise<ClientIDMetadataDocument> {
  const timeout = options?.timeout ?? 10000;
  const maxSize = options?.maxSize ?? CIMD_MAX_SIZE_BYTES;

  // Validate URL format
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    throw new AuthError('Invalid client_id URL', 'CIMD_INVALID_URL');
  }

  // Security: Require HTTPS (except localhost for development)
  if (url.protocol !== 'https:' && !isLocalhostUrl(clientId)) {
    throw new AuthError(
      'Client ID URL must use HTTPS',
      'CIMD_INSECURE_URL'
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(clientId, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AuthError(
        `Failed to fetch CIMD: ${response.status}`,
        'CIMD_FETCH_FAILED'
      );
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      throw new AuthError(
        `CIMD exceeds maximum size of ${maxSize} bytes`,
        'CIMD_TOO_LARGE'
      );
    }

    const text = await response.text();

    // Double-check size after receiving
    if (text.length > maxSize) {
      throw new AuthError(
        `CIMD exceeds maximum size of ${maxSize} bytes`,
        'CIMD_TOO_LARGE'
      );
    }

    const cimd = JSON.parse(text) as ClientIDMetadataDocument;

    // Validate the CIMD
    validateClientIDMetadata(cimd, clientId);

    return cimd;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      `Failed to fetch CIMD: ${error}`,
      'CIMD_FETCH_FAILED',
      error
    );
  }
}

/**
 * Validate a Client ID Metadata Document
 *
 * @param cimd - The document to validate
 * @param expectedClientId - Expected client_id URL
 */
export function validateClientIDMetadata(
  cimd: ClientIDMetadataDocument,
  expectedClientId?: string
): void {
  // Required: client_id
  if (!cimd.client_id) {
    throw new AuthError('CIMD missing client_id', 'CIMD_INVALID');
  }

  // client_id must be a valid URL
  try {
    new URL(cimd.client_id);
  } catch {
    throw new AuthError('CIMD client_id is not a valid URL', 'CIMD_INVALID');
  }

  // If expected client_id provided, verify match
  if (expectedClientId && cimd.client_id !== expectedClientId) {
    throw new AuthError(
      `CIMD client_id mismatch: expected ${expectedClientId}, got ${cimd.client_id}`,
      'CIMD_CLIENT_ID_MISMATCH'
    );
  }

  // Required: redirect_uris (at least one)
  if (!cimd.redirect_uris || !Array.isArray(cimd.redirect_uris) || cimd.redirect_uris.length === 0) {
    throw new AuthError('CIMD must have at least one redirect_uri', 'CIMD_INVALID');
  }

  // Validate redirect URIs
  for (const uri of cimd.redirect_uris) {
    try {
      const redirectUrl = new URL(uri);

      // Security: Validate redirect URI origin matches client_id origin
      // (except for localhost which can have any port)
      const clientUrl = new URL(cimd.client_id);

      if (!isLocalhostUrl(uri)) {
        if (redirectUrl.origin !== clientUrl.origin) {
          // Allow same host with different path
          if (redirectUrl.host !== clientUrl.host) {
            throw new AuthError(
              `Redirect URI origin ${redirectUrl.origin} does not match client_id origin ${clientUrl.origin}`,
              'CIMD_REDIRECT_ORIGIN_MISMATCH'
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(`Invalid redirect_uri: ${uri}`, 'CIMD_INVALID');
    }
  }

  // Validate grant_types if present
  if (cimd.grant_types) {
    const validGrantTypes = ['authorization_code', 'refresh_token', 'client_credentials'];
    for (const grantType of cimd.grant_types) {
      if (!validGrantTypes.includes(grantType)) {
        throw new AuthError(`Invalid grant_type: ${grantType}`, 'CIMD_INVALID');
      }
    }
  }
}

/**
 * Check if authorization server supports CIMD
 *
 * @param asMetadata - Authorization server metadata
 * @returns true if CIMD is supported
 */
export function supportsCIMD(asMetadata: { client_id_metadata_document_supported?: boolean }): boolean {
  return asMetadata.client_id_metadata_document_supported === true;
}

/**
 * Generate the well-known URL for a CIMD
 *
 * @param clientBaseUrl - The client's base URL
 * @returns The CIMD well-known URL
 */
export function getCIMDWellKnownUrl(clientBaseUrl: string): string {
  const url = new URL(clientBaseUrl);
  return `${url.origin}${CIMD_WELL_KNOWN_PATH}`;
}

/**
 * Check if a URL is localhost (for development)
 */
function isLocalhostUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

/**
 * SSRF protection: Validate that a client_id URL is safe to fetch
 *
 * @param clientId - The client_id URL to validate
 * @returns true if safe to fetch
 */
export function isSafeToFetch(clientId: string): boolean {
  try {
    const url = new URL(clientId);

    // Must be HTTP or HTTPS
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }

    // Block internal/private IPs (basic SSRF protection)
    const hostname = url.hostname.toLowerCase();

    // Allow localhost for development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return true;
    }

    // Block private IP ranges
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^fc00:/i,
      /^fd00:/i,
      /^fe80:/i,
    ];

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    // Block common internal hostnames
    const blockedHostnames = [
      'metadata',
      'metadata.google.internal',
      'metadata.google',
      '169.254.169.254', // AWS/GCP metadata
    ];

    if (blockedHostnames.includes(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

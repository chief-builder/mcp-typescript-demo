/**
 * MCP Demo Consent App
 *
 * Simple consent application for Ory Hydra OAuth 2.1 flows.
 * Handles login and consent challenges automatically for testing.
 *
 * In production, you would:
 * - Implement real user authentication
 * - Show actual consent screens
 * - Store user sessions
 */

const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';
const PORT = process.env.PORT || 3000;

// Test users for demo (in production, use real auth)
const TEST_USERS = {
  'demo': { password: 'demo', name: 'Demo User', email: 'demo@example.com' },
  'admin': { password: 'admin', name: 'Admin User', email: 'admin@example.com' },
};

/**
 * Login endpoint - Hydra redirects here for authentication
 */
app.get('/login', async (req, res) => {
  const challenge = req.query.login_challenge;

  if (!challenge) {
    return res.status(400).send('Missing login_challenge');
  }

  try {
    // Get login request details from Hydra
    const loginRequest = await fetch(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login?login_challenge=${challenge}`
    ).then(r => r.json());

    // If user is already authenticated, skip login
    if (loginRequest.skip) {
      const acceptResponse = await fetch(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${challenge}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: loginRequest.subject }),
        }
      ).then(r => r.json());

      return res.redirect(acceptResponse.redirect_to);
    }

    // Show login form
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MCP Demo Login</title>
        <style>
          body { font-family: system-ui; max-width: 400px; margin: 100px auto; padding: 20px; }
          h1 { color: #333; }
          form { display: flex; flex-direction: column; gap: 15px; }
          input { padding: 10px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; }
          button { padding: 12px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #0056b3; }
          .info { background: #e7f3ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
          .client { font-weight: bold; color: #007bff; }
        </style>
      </head>
      <body>
        <h1>MCP Demo Login</h1>
        <div class="info">
          <p>Client: <span class="client">${loginRequest.client?.client_name || loginRequest.client?.client_id || 'Unknown'}</span></p>
          <p>Test credentials: <code>demo/demo</code> or <code>admin/admin</code></p>
        </div>
        <form method="POST" action="/login?login_challenge=${challenge}">
          <input type="text" name="username" placeholder="Username" required autofocus />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Sign In</button>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

/**
 * Login form submission
 */
app.post('/login', async (req, res) => {
  const challenge = req.query.login_challenge;
  const { username, password } = req.body;

  if (!challenge) {
    return res.status(400).send('Missing login_challenge');
  }

  // Validate credentials
  const user = TEST_USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Login Failed</title></head>
      <body>
        <h1>Invalid credentials</h1>
        <p><a href="/login?login_challenge=${challenge}">Try again</a></p>
      </body>
      </html>
    `);
  }

  try {
    // Accept the login request
    const acceptResponse = await fetch(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/login/accept?login_challenge=${challenge}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: username,
          remember: true,
          remember_for: 3600,
          context: {
            name: user.name,
            email: user.email,
          },
        }),
      }
    ).then(r => r.json());

    res.redirect(acceptResponse.redirect_to);
  } catch (error) {
    console.error('Login accept error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

/**
 * Consent endpoint - Hydra redirects here for scope approval
 */
app.get('/consent', async (req, res) => {
  const challenge = req.query.consent_challenge;

  if (!challenge) {
    return res.status(400).send('Missing consent_challenge');
  }

  try {
    // Get consent request details
    const consentRequest = await fetch(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent?consent_challenge=${challenge}`
    ).then(r => r.json());

    // If consent can be skipped (already granted), accept immediately
    if (consentRequest.skip || consentRequest.client?.skip_consent) {
      const acceptResponse = await fetch(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${challenge}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_scope: consentRequest.requested_scope,
            grant_access_token_audience: consentRequest.requested_access_token_audience,
            remember: true,
            remember_for: 3600,
          }),
        }
      ).then(r => r.json());

      return res.redirect(acceptResponse.redirect_to);
    }

    // Show consent form
    const scopes = consentRequest.requested_scope || [];
    const scopeDescriptions = {
      'openid': 'Access your identity',
      'offline_access': 'Stay logged in (refresh tokens)',
      'mcp:read': 'Read MCP resources',
      'mcp:write': 'Write MCP resources',
      'analytics:read': 'Read analytics data',
      'analytics:write': 'Write analytics data',
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>MCP Demo Consent</title>
        <style>
          body { font-family: system-ui; max-width: 500px; margin: 100px auto; padding: 20px; }
          h1 { color: #333; }
          .client { font-weight: bold; color: #007bff; }
          .scopes { list-style: none; padding: 0; }
          .scopes li { padding: 10px; background: #f8f9fa; margin: 5px 0; border-radius: 4px; }
          .scopes code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
          .buttons { display: flex; gap: 10px; margin-top: 20px; }
          button { padding: 12px 24px; font-size: 16px; border: none; border-radius: 4px; cursor: pointer; }
          .allow { background: #28a745; color: white; }
          .deny { background: #dc3545; color: white; }
        </style>
      </head>
      <body>
        <h1>Authorize Application</h1>
        <p><span class="client">${consentRequest.client?.client_name || consentRequest.client?.client_id}</span> wants to access your account.</p>

        <h3>Requested permissions:</h3>
        <ul class="scopes">
          ${scopes.map(s => `<li><code>${s}</code> - ${scopeDescriptions[s] || 'Unknown scope'}</li>`).join('')}
        </ul>

        <form method="POST" action="/consent?consent_challenge=${challenge}">
          <div class="buttons">
            <button type="submit" name="action" value="allow" class="allow">Allow</button>
            <button type="submit" name="action" value="deny" class="deny">Deny</button>
          </div>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Consent error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

/**
 * Consent form submission
 */
app.post('/consent', async (req, res) => {
  const challenge = req.query.consent_challenge;
  const { action } = req.body;

  if (!challenge) {
    return res.status(400).send('Missing consent_challenge');
  }

  try {
    // Get consent request for scopes
    const consentRequest = await fetch(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent?consent_challenge=${challenge}`
    ).then(r => r.json());

    if (action === 'deny') {
      const rejectResponse = await fetch(
        `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/reject?consent_challenge=${challenge}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'access_denied',
            error_description: 'User denied consent',
          }),
        }
      ).then(r => r.json());

      return res.redirect(rejectResponse.redirect_to);
    }

    // Accept consent
    const acceptResponse = await fetch(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${challenge}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_scope: consentRequest.requested_scope,
          grant_access_token_audience: consentRequest.requested_access_token_audience,
          remember: true,
          remember_for: 3600,
          session: {
            id_token: {
              name: consentRequest.context?.name,
              email: consentRequest.context?.email,
            },
          },
        }),
      }
    ).then(r => r.json());

    res.redirect(acceptResponse.redirect_to);
  } catch (error) {
    console.error('Consent accept error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

/**
 * Logout endpoint
 */
app.get('/logout', async (req, res) => {
  const challenge = req.query.logout_challenge;

  if (!challenge) {
    return res.status(400).send('Missing logout_challenge');
  }

  try {
    const acceptResponse = await fetch(
      `${HYDRA_ADMIN_URL}/admin/oauth2/auth/requests/logout/accept?logout_challenge=${challenge}`,
      { method: 'PUT' }
    ).then(r => r.json());

    res.redirect(acceptResponse.redirect_to);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`MCP Consent App running on http://localhost:${PORT}`);
  console.log(`Hydra Admin URL: ${HYDRA_ADMIN_URL}`);
});

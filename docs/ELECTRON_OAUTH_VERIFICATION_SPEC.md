# Electron OAuth Email Verification Integration Specification

## Problem Statement

The Electron desktop app uses a **polling-based OAuth flow** where authentication tokens are retrieved via the `state` parameter. Currently, new users who require email verification get stuck because:

1. ✅ User authenticates successfully in browser
2. ✅ Email verification code is sent
3. ✅ User completes verification on your web page
4. ❌ **Tokens are NOT stored with the original `state` parameter**
5. ❌ Electron app polls `/api/auth/workos/token` with `state` but receives no tokens
6. ❌ Authentication times out after 5 minutes

**Existing users work** because they skip verification and tokens are stored immediately.

## Current Electron OAuth Flow (PKCE)

### Step 1: Start Authentication
```
POST /api/auth/workos/start
Body: {
  "code_challenge": "abc123...",
  "state": "xyz789...",
  "force_reauth": false
}

Response: {
  "auth_url": "https://workos.com/authorize?..."
}
```

### Step 2: User Authenticates in Browser
- Electron opens system browser to `auth_url`
- User authenticates via WorkOS → GitHub
- WorkOS redirects to `/api/auth/workos/callback?code=...&state=xyz789...`

### Step 3: Electron App Polls for Tokens
```
POST /api/auth/workos/token (every 5 seconds)
Body: {
  "state": "xyz789...",
  "code_verifier": "def456..."
}

Expected Response (when ready):
{
  "access_token": "gho_...",
  "github_access_token": "gho_...",
  "refresh_token": "...",
  "expires_in": 3600,
  "user": {
    "login": "username",
    "email": "user@example.com",
    "name": "User Name",
    "id": 12345
  }
}

Or (while waiting):
Status: 400
{
  "error": "Authorization pending"
}
```

## Required Changes for Email Verification Support

### Overview

The landing page needs to **preserve the `state` parameter throughout the verification flow** and only store tokens (keyed by `state`) after verification completes.

---

### Change 1: Modify `/api/auth/workos/callback`

**Current Behavior (assumption):**
```javascript
// Receives OAuth callback
// Exchanges code for tokens
// Stores tokens somehow
// Shows success page
```

**Required Behavior:**

```javascript
app.get('/api/auth/workos/callback', async (req, res) => {
  const { code, state } = req.query;

  console.log('[OAuth Callback] Received for state:', state);

  try {
    // Exchange OAuth code with WorkOS
    const authResult = await workos.authenticateWithCode({
      code,
      // ... your existing WorkOS config
    });

    // ⭐ CHECK IF EMAIL VERIFICATION IS REQUIRED
    const requiresVerification =
      authResult.email_verification_required ||
      authResult.user.email_verified === false ||
      // Whatever property WorkOS uses to indicate verification needed
      !authResult.user.email_verified;

    if (requiresVerification) {
      console.log('[OAuth Callback] Email verification required');

      // Store PARTIAL auth data (NOT tokens yet) keyed by state
      // This allows verification page to look up the session
      await redis.set(`auth:pending:${state}`, JSON.stringify({
        workosUserId: authResult.user.id,
        email: authResult.user.email,
        code: code, // May need this for later token exchange
        timestamp: Date.now()
      }), 'EX', 600); // 10 minute expiry

      // Redirect to YOUR verification page, preserving state
      return res.redirect(`/auth/verify?state=${state}&email=${encodeURIComponent(authResult.user.email)}`);
    }

    // ✅ NO VERIFICATION NEEDED (existing users)
    // Get tokens from WorkOS
    const tokens = {
      access_token: authResult.access_token,
      github_access_token: authResult.oauth_tokens?.github?.access_token,
      refresh_token: authResult.refresh_token,
      expires_in: authResult.expires_in || 3600,
      user: {
        login: authResult.user.username || authResult.user.login,
        email: authResult.user.email,
        name: authResult.user.name,
        id: authResult.user.id
      }
    };

    // ⭐ CRITICAL: Store tokens keyed by state for Electron polling
    await redis.set(`auth:${state}`, JSON.stringify(tokens), 'EX', 300); // 5 min expiry

    console.log('[OAuth Callback] Tokens stored for state:', state);

    // Show success page
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Successful</title></head>
        <body>
          <h1>✓ Authentication Successful</h1>
          <p>You can close this window and return to the app.</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('[OAuth Callback] Error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Failed</title></head>
        <body>
          <h1>✗ Authentication Failed</h1>
          <p>${error.message}</p>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
});
```

---

### Change 2: Update Verification Page `/auth/verify`

**Requirements:**
- Must accept `state` parameter from URL
- Must pass `state` to verification endpoint
- User-friendly UI for entering code

**Example Implementation:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Verify Your Email</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 500px;
      margin: 100px auto;
      padding: 20px;
      text-align: center;
    }
    input {
      font-size: 18px;
      padding: 12px;
      width: 100%;
      max-width: 300px;
      margin: 20px 0;
      text-align: center;
      letter-spacing: 4px;
    }
    button {
      font-size: 16px;
      padding: 12px 24px;
      margin: 10px;
      cursor: pointer;
    }
    .primary { background: #0070f3; color: white; border: none; border-radius: 4px; }
    .secondary { background: transparent; border: 1px solid #ccc; border-radius: 4px; }
    .error { color: red; margin: 10px 0; }
    .success { color: green; }
  </style>
</head>
<body>
  <h1>Verify Your Email</h1>
  <p>We sent a verification code to:</p>
  <p><strong id="email"></strong></p>

  <form id="verifyForm">
    <input
      type="text"
      id="code"
      name="code"
      placeholder="000000"
      maxlength="6"
      pattern="[0-9]{6}"
      required
      autofocus
    />
    <br>
    <button type="submit" class="primary">Verify</button>
    <button type="button" id="resendBtn" class="secondary">Resend Code</button>
  </form>

  <div id="message"></div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const state = urlParams.get('state');
    const email = urlParams.get('email');

    if (!state) {
      document.body.innerHTML = '<h1>Error</h1><p>Invalid verification link</p>';
    }

    document.getElementById('email').textContent = email || 'your email';

    // Handle verification form submission
    document.getElementById('verifyForm').onsubmit = async (e) => {
      e.preventDefault();

      const code = document.getElementById('code').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const messageDiv = document.getElementById('message');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';
      messageDiv.innerHTML = '';

      try {
        const response = await fetch('/api/auth/workos/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, code })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          document.body.innerHTML = `
            <h1 class="success">✓ Email Verified!</h1>
            <p>Authentication complete.</p>
            <p><strong>You can close this window and return to the app.</strong></p>
          `;
        } else {
          messageDiv.innerHTML = `<p class="error">${result.error || 'Invalid code. Please try again.'}</p>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Verify';
          document.getElementById('code').value = '';
          document.getElementById('code').focus();
        }
      } catch (error) {
        messageDiv.innerHTML = '<p class="error">Network error. Please try again.</p>';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify';
      }
    };

    // Handle resend code
    document.getElementById('resendBtn').onclick = async () => {
      const btn = document.getElementById('resendBtn');
      const messageDiv = document.getElementById('message');

      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        const response = await fetch('/api/auth/workos/resend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state })
        });

        if (response.ok) {
          messageDiv.innerHTML = '<p class="success">Code resent! Check your email.</p>';
        } else {
          messageDiv.innerHTML = '<p class="error">Failed to resend code.</p>';
        }
      } catch (error) {
        messageDiv.innerHTML = '<p class="error">Network error.</p>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Resend Code';
      }
    };
  </script>
</body>
</html>
```

---

### Change 3: Create Verification Endpoint `/api/auth/workos/verify`

**This is the critical endpoint** that completes verification and stores tokens for polling.

```javascript
app.post('/api/auth/workos/verify', async (req, res) => {
  const { state, code } = req.body;

  console.log('[Verify] Received verification for state:', state);

  if (!state || !code) {
    return res.status(400).json({
      success: false,
      error: 'Missing state or verification code'
    });
  }

  try {
    // Retrieve pending auth data
    const pendingData = await redis.get(`auth:pending:${state}`);

    if (!pendingData) {
      console.log('[Verify] No pending auth found for state:', state);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification session. Please try logging in again.'
      });
    }

    const { workosUserId, email, code: oauthCode } = JSON.parse(pendingData);

    // ⭐ VERIFY THE CODE WITH WORKOS
    // This depends on your WorkOS setup - examples:

    // Option A: If WorkOS has a direct verification API
    const verificationResult = await workos.verifyEmailCode({
      userId: workosUserId,
      code: code
    });

    // Option B: If verification is automatic and you just need to fetch tokens
    // const verificationResult = await workos.getUser(workosUserId);
    // if (!verificationResult.email_verified) throw new Error('Not verified');

    if (!verificationResult.success && !verificationResult.email_verified) {
      console.log('[Verify] Invalid code for user:', workosUserId);
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    console.log('[Verify] Code verified successfully for:', email);

    // ⭐ NOW GET THE TOKENS
    // This depends on whether you stored the OAuth code or need to re-fetch
    const tokens = await workos.getTokensWithCode(oauthCode);
    // Or: const tokens = await workos.getTokensForUser(workosUserId);

    const tokenData = {
      access_token: tokens.access_token,
      github_access_token: tokens.oauth_tokens?.github?.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in || 3600,
      user: {
        login: tokens.user.username || tokens.user.login,
        email: tokens.user.email,
        name: tokens.user.name,
        id: tokens.user.id
      }
    };

    // ⭐ CRITICAL: Store tokens keyed by state for Electron polling
    await redis.set(`auth:${state}`, JSON.stringify(tokenData), 'EX', 300);

    console.log('[Verify] Tokens stored for state:', state);

    // Clean up pending auth
    await redis.del(`auth:pending:${state}`);

    res.json({ success: true });

  } catch (error) {
    console.error('[Verify] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Verification failed'
    });
  }
});
```

---

### Change 4: Create Resend Code Endpoint `/api/auth/workos/resend`

**Optional but recommended** for better UX:

```javascript
app.post('/api/auth/workos/resend', async (req, res) => {
  const { state } = req.body;

  console.log('[Resend] Resending code for state:', state);

  if (!state) {
    return res.status(400).json({
      success: false,
      error: 'Missing state parameter'
    });
  }

  try {
    // Retrieve pending auth data
    const pendingData = await redis.get(`auth:pending:${state}`);

    if (!pendingData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }

    const { workosUserId } = JSON.parse(pendingData);

    // Resend verification code via WorkOS
    await workos.resendVerificationEmail(workosUserId);
    // Or: await workos.sendVerificationCode({ userId: workosUserId });

    console.log('[Resend] Code resent for user:', workosUserId);

    res.json({ success: true });

  } catch (error) {
    console.error('[Resend] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend code'
    });
  }
});
```

---

### Change 5: Ensure `/api/auth/workos/token` Remains Unchanged

**No changes needed** to the polling endpoint. It should continue to:

```javascript
app.post('/api/auth/workos/token', async (req, res) => {
  const { state, code_verifier } = req.body;

  // Retrieve tokens by state
  const tokens = await redis.get(`auth:${state}`);

  if (!tokens) {
    // Still pending - user hasn't completed auth/verification yet
    return res.status(400).json({ error: 'Authorization pending' });
  }

  // Verify PKCE code_verifier (your existing logic)
  // ...

  // Return tokens to Electron app
  res.json(JSON.parse(tokens));
});
```

---

## Data Flow Diagram

```
┌─────────────────┐
│ Electron App    │
│ 1. POST /start  │────────┐
│    state=xyz    │        │
└─────────────────┘        │
                           ▼
                    ┌──────────────┐
                    │ Landing Page │
                    │ Server       │
                    └──────────────┘
                           │
                           │ 2. Returns auth_url
                           ▼
┌─────────────────┐
│ Browser Opens   │
│ 3. User auths   │────────┐
│    via WorkOS   │        │
└─────────────────┘        │
                           ▼
                    ┌──────────────┐
                    │ /callback    │
                    │ 4. Checks if │
                    │   verified   │
                    └──────────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
          YES (existing)     NO (new user)
                  │                 │
                  ▼                 ▼
          ┌──────────────┐   ┌──────────────┐
          │ Store tokens │   │ Store pending│
          │ redis.set    │   │ redis.set    │
          │ auth:xyz     │   │ pending:xyz  │
          └──────────────┘   └──────────────┘
                  │                 │
                  │                 │ 5. Redirect to
                  │                 │    /verify?state=xyz
                  │                 ▼
                  │          ┌──────────────┐
                  │          │ User enters  │
                  │          │ code         │
                  │          └──────────────┘
                  │                 │
                  │                 │ 6. POST /verify
                  │                 │    {state:xyz, code:123456}
                  │                 ▼
                  │          ┌──────────────┐
                  │          │ Verify code  │
                  │          │ Get tokens   │
                  │          │ Store tokens │
                  │          │ redis.set    │
                  │          │ auth:xyz     │
                  │          └──────────────┘
                  │                 │
                  └────────┬────────┘
                           │
                           │ 7. Tokens ready
                           ▼
                    ┌──────────────┐
                    │ Electron app │
                    │ polls /token │
                    │ with state   │
                    │ Gets tokens! │
                    └──────────────┘
```

---

## Redis Key Structure

```
# Tokens ready for polling (existing users OR after verification)
auth:{state} → JSON token data (5 min TTL)

# Pending verification (new users)
auth:pending:{state} → JSON with {workosUserId, email, code} (10 min TTL)
```

---

## Testing Checklist

### Existing User (Already Verified)
- [ ] Can log in successfully
- [ ] No verification page shown
- [ ] Tokens stored immediately after callback
- [ ] Electron app receives tokens within 5 seconds

### New User (Needs Verification)
- [ ] Gets redirected to `/auth/verify` page
- [ ] Can see their email address
- [ ] Receives verification code via email
- [ ] Can enter code and verify successfully
- [ ] Verification endpoint stores tokens with correct `state`
- [ ] Electron app receives tokens after verification
- [ ] "Resend code" button works

### Error Cases
- [ ] Invalid verification code shows error message
- [ ] Expired `state` shows appropriate error
- [ ] User can retry verification
- [ ] Network errors handled gracefully

---

## Critical Requirements Summary

1. **MUST preserve `state` parameter** through entire flow
2. **MUST store tokens keyed by `state`** only AFTER verification completes
3. **MUST use Redis** (or similar) with TTL for token storage
4. **MUST redirect** to verification page (not show in iframe)
5. **MUST return 400** with `{"error": "Authorization pending"}` when tokens not ready

---

## Questions for Landing Page Team

1. What property does WorkOS use to indicate email verification is required?
   - `email_verification_required`?
   - `user.email_verified === false`?
   - Something else?

2. How do you verify email codes with WorkOS?
   - Is there a `verifyEmailCode()` API?
   - Does verification happen automatically in their dashboard?

3. Do you already have a verification page we can adapt?
   - If yes, we just need to add `state` parameter handling
   - If no, we can use the example HTML above

4. How long are verification codes valid?
   - This determines `auth:pending:{state}` TTL

5. What happens to the original OAuth `code` after callback?
   - Do we need to store it to exchange for tokens after verification?
   - Or can we get tokens directly from WorkOS user ID?

---

## Contact

For questions about this spec, contact: [Your Name/Team]

Electron app repository: [Your repo link]
Landing page repository: [Their repo link]

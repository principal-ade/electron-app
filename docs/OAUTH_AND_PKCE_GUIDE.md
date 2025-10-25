# WorkOS Authentication and PKCE Configuration Guide

This document explains how the WorkOS authentication with PKCE (Proof Key for Code Exchange) is configured in this project.

## Authentication Architecture

The application uses **WorkOS** as the authentication provider, with **GitHub as the identity provider**. This means:
- Users authenticate through their GitHub accounts
- WorkOS manages the OAuth flow and security
- The application receives a GitHub access token that can be used with the GitHub API

## Server-Side Configuration

### Environment Variables

The authentication server (landing-page) requires these WorkOS environment variables:

```bash
WORKOS_CLIENT_ID=<your_workos_client_id>
WORKOS_API_KEY=<your_workos_api_key>
```

These are set on the server side and never exposed to the client.

**Important**: The WorkOS dashboard must be configured to "Return OAuth tokens" so that the GitHub access token is included in the authentication response.

## Client-Side Configuration

### Redirect URI Configuration

The client-side application uses the `src/main/services/AuthProvider.ts` file to configure the WorkOS endpoints:

```typescript
export function getAuthEndpoints(baseUrl: string): AuthEndpoints {
  return {
    start: `${baseUrl}/api/auth/workos/start`,
    callback: `${baseUrl}/api/auth/workos/callback`,
    token: `${baseUrl}/api/auth/workos/token`,
  };
}
```

The `baseUrl` is determined by the `AUTH_SERVER_URL` environment variable, which defaults to `https://principal-ade.com` in production and can be set to `http://localhost:3000` for local development.

## PKCE (Proof Key for Code Exchange)

### What is PKCE?

PKCE adds an extra layer of security to the OAuth flow by ensuring that the application exchanging the authorization code is the same one that initiated the flow. This is especially important for desktop and mobile applications.

### Implementation

The PKCE implementation is handled in `src/main/services/OAuthServerClient.ts`:

```typescript
// Generate PKCE challenge/verifier pair
this.codeVerifier = crypto.randomBytes(32).toString('base64url');
this.codeChallenge = crypto
  .createHash('sha256')
  .update(this.codeVerifier)
  .digest('base64url');
```

### Flow Details

1. **Client generates PKCE pair**:
   - Creates a random `code_verifier`
   - Hashes it to create a `code_challenge`

2. **Start authentication**:
   - Sends `code_challenge` to server
   - Server stores it and redirects to WorkOS

3. **User authorizes**:
   - WorkOS handles GitHub OAuth flow
   - Server receives authorization code from WorkOS

4. **Exchange for token**:
   - Client sends authorization code + `code_verifier`
   - Server verifies the verifier matches the challenge
   - Server exchanges code with WorkOS for tokens
   - Server returns GitHub access token to client

## Authentication Flow

```
┌─────────────┐
│   Electron  │
│     App     │
└──────┬──────┘
       │ 1. Login request
       ▼
┌─────────────┐
│  Auth       │
│  Server     │
│ (WorkOS)    │
└──────┬──────┘
       │ 2. Redirect to WorkOS
       ▼
┌─────────────┐
│   WorkOS    │
│  (GitHub    │
│  Provider)  │
└──────┬──────┘
       │ 3. User authorizes
       ▼
┌─────────────┐
│   GitHub    │
│    OAuth    │
└──────┬──────┘
       │ 4. Authorization code
       ▼
┌─────────────┐
│  Auth       │
│  Server     │
└──────┬──────┘
       │ 5. Exchange code for GitHub token + refresh token
       ▼
┌─────────────┐
│   Electron  │
│     App     │
│ (GitHub API)│
└─────────────┘
```

## Token Refresh

The application supports automatic token refresh to maintain continuous authentication without requiring users to re-login.

### How Token Refresh Works

1. **Initial Authentication**: When a user logs in, the server returns:
   - `access_token`: GitHub access token for API calls
   - `refresh_token`: Long-lived token for obtaining new access tokens
   - `expires_in`: Token lifetime in seconds (typically 3600 for 1 hour)

2. **Token Storage**: All token information is stored securely:
   - Access token is encrypted and stored in the system keychain
   - Refresh token is stored in metadata alongside the access token
   - Expiry timestamp is calculated and stored for automatic refresh

3. **Automatic Refresh**: The AuthService automatically refreshes tokens:
   - Tokens are checked for expiry whenever accessed
   - Refresh is triggered if token expires within 5 minutes
   - New tokens are automatically stored and state is updated
   - If refresh fails, user is logged out and must re-authenticate

4. **Refresh Flow**:
   ```
   ┌─────────────┐
   │  AuthService│
   │  (checks    │
   │   expiry)   │
   └──────┬──────┘
          │ Token expiring soon?
          ▼
   ┌─────────────┐
   │ POST /api/  │
   │ auth/workos/│
   │   refresh   │
   └──────┬──────┘
          │ refresh_token
          ▼
   ┌─────────────┐
   │  WorkOS     │
   │  Server     │
   └──────┬──────┘
          │ New access_token + refresh_token
          ▼
   ┌─────────────┐
   │  Store new  │
   │   tokens    │
   └─────────────┘
   ```

### Implementation Details

**OAuthServerClient** (`src/main/services/OAuthServerClient.ts`):
- `authenticate()`: Returns `AuthResult` with access token, refresh token, and expiry
- `refreshAccessToken(refreshToken)`: Exchanges refresh token for new access token

**AuthService** (`src/main/services/AuthService.ts`):
- Stores refresh token and expiry in secure storage metadata
- Automatically checks token expiry on every access
- Triggers refresh if token expires within 5 minutes
- Clears auth if refresh fails

**UnifiedSecureStorage** (`src/main/services/UnifiedSecureStorage.ts`):
- Encrypts and stores tokens with metadata
- Metadata includes: user info, refresh token, expiry timestamp

### Server Requirements

The authentication server must provide:
- `POST /api/auth/workos/refresh` endpoint
- Accept `refresh_token` in request body
- Return new `access_token`, `refresh_token`, and `expires_in`

## Security Considerations

### Why WorkOS?

1. **Centralized Auth Management**: All authentication flows managed in one place
2. **Enhanced Security**: WorkOS handles security best practices
3. **Multiple Providers**: Easy to add other identity providers (Google, Microsoft, etc.)
4. **Enterprise Features**: SSO, SAML, and other enterprise auth methods

### Token Storage

- GitHub access tokens are encrypted using Electron's `safeStorage` API
- On macOS, tokens are stored in the system keychain
- On Windows, tokens use the Credential Manager
- See `AUTHENTICATION_SERVICES.md` for details on secure storage

## Local Development

For local development:

1. Set `AUTH_SERVER_URL` environment variable:
   ```bash
   AUTH_SERVER_URL=http://localhost:3000
   ```

2. Ensure the landing-page server is running locally with WorkOS configured

3. The OAuth flow will use `http://localhost:3000/api/auth/workos/*` endpoints

## Troubleshooting

### "Authentication failed" error

- Check that `AUTH_SERVER_URL` is correctly set
- Verify the landing-page server is running
- Ensure WorkOS credentials are configured on the server

### "No GitHub token returned" error

- Verify WorkOS dashboard has "Return OAuth tokens" enabled
- Check server logs for WorkOS API errors
- Confirm the GitHub connection is properly configured in WorkOS

### Token permissions issues

- The GitHub token permissions are determined by the WorkOS GitHub connection configuration
- Update the requested scopes in the WorkOS dashboard if needed
- Users may need to re-authenticate after scope changes

## Related Documentation

- `AUTHENTICATION_SERVICES.md` - Detailed auth service architecture
- `AUTHENTICATION_AND_ROOMS_STATE.md` - Current authentication state
- `WORKOS_SETUP_GUIDE.md` - Server-side WorkOS setup (in landing-page repo)
- `requests/workos-github-token-requirement.md` - Migration requirements

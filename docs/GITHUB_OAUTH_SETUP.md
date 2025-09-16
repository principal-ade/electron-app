# GitHub OAuth Application Setup

## The Error
When you see **"The redirect_uri is not associated with this application"**, it means the GitHub OAuth app needs to be configured with the correct callback URL.

## Required GitHub OAuth Settings

The GitHub OAuth application needs to be configured with these **exact** URLs:

### For Production (principle-md.com)
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Find or create the OAuth app for Orbit
3. Set these values:
   - **Homepage URL**: `https://principle-md.com`
   - **Authorization callback URL**: `https://principle-md.com/api/orbit/auth/github/callback`

### For Local Development
If you have a separate OAuth app for development:
- **Homepage URL**: `http://localhost:3002`
- **Authorization callback URL**: `http://localhost:3002/api/orbit/auth/github/callback`

## Important Notes

⚠️ **The callback URL must match EXACTLY** - GitHub will reject any request with a different redirect_uri.

The correct callback URL is:
```
https://principle-md.com/api/orbit/auth/github/callback
```

NOT:
- ❌ `https://principle-md.com/callback`
- ❌ `https://principle-md.com/orbit/callback`
- ❌ `https://principle-md.com/auth/github/callback`

## Server Configuration

The server expects these environment variables:
```bash
GITHUB_CLIENT_ID=<your_oauth_app_client_id>
GITHUB_CLIENT_SECRET=<your_oauth_app_client_secret>
GITHUB_REDIRECT_URI=https://principle-md.com/api/orbit/auth/github/callback
```

## Testing the Fix

After updating the GitHub OAuth app:

1. Clear your browser cache/cookies for GitHub
2. Try the authentication flow again
3. The OAuth flow should now work correctly

## Multiple Redirect URIs

GitHub OAuth apps only support **one** callback URL. If you need both local and production:

### Option 1: Two OAuth Apps
- Create separate OAuth apps for development and production
- Use different client IDs/secrets for each environment

### Option 2: Use Production Only
- Always test against the production server
- Set `ORBIT_USE_LOCAL=false` in your environment

### Option 3: Proxy/Tunnel for Local
- Use ngrok or similar to expose your local server
- Update OAuth app with the ngrok URL temporarily

## Verifying Configuration

Check your OAuth app settings at:
https://github.com/settings/developers

Look for your OAuth app and verify the "Authorization callback URL" field.
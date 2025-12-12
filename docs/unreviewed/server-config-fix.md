# Server Configuration Fix Required

## The Issue

The production server at `https://principle-md.com` is using the wrong redirect URI for GitHub OAuth.

### Current Behavior:
The server is redirecting to:
```
http://localhost:3002/api/orbit/auth/github/callback
```

### Expected Behavior:
The server should redirect to:
```
https://principle-md.com/api/orbit/auth/github/callback
```

## Root Cause

In the server code (`code-city-landing/src/app/api/orbit/auth/github/route.ts`), line 6:

```typescript
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3002/api/orbit/auth/github/callback';
```

The production server doesn't have the `GITHUB_REDIRECT_URI` environment variable set, so it's falling back to the localhost default.

## Solution

### On the Production Server

Set the environment variable:

```bash
GITHUB_REDIRECT_URI=https://principle-md.com/api/orbit/auth/github/callback
```

This needs to be set wherever the production server is deployed (Vercel, AWS, Docker, etc.)

### For Vercel Deployment:

1. Go to Vercel Dashboard
2. Select the project
3. Go to Settings → Environment Variables
4. Add:
   ```
   GITHUB_REDIRECT_URI = https://principle-md.com/api/orbit/auth/github/callback
   ```
5. Redeploy the application

### For Docker Deployment:

Add to your docker-compose or docker run command:
```yaml
environment:
  GITHUB_REDIRECT_URI: https://principle-md.com/api/orbit/auth/github/callback
```

### For PM2 or Direct Node:

```bash
GITHUB_REDIRECT_URI=https://principle-md.com/api/orbit/auth/github/callback npm start
```

## GitHub OAuth App Configuration

Also ensure the GitHub OAuth app has the matching callback URL:

1. Go to https://github.com/settings/developers
2. Find your OAuth app
3. Set **Authorization callback URL** to:
   ```
   https://principle-md.com/api/orbit/auth/github/callback
   ```

## Testing After Fix

1. Clear browser cache/cookies
2. Try the OAuth flow again
3. The URL should now correctly redirect to the production callback URL

## Quick Verification

You can verify the current server configuration by checking what redirect_uri it's using:

1. Open browser developer tools
2. Try to authenticate
3. Look at the GitHub OAuth URL
4. Check the `redirect_uri` parameter - it should be the production URL, not localhost
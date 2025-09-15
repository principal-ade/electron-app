# OAuth Flow - Important Understanding

## The Problem You Encountered

When you saw the URL:
```
https://principle-md.com/api/orbit/auth/github/callback?code=6a33896c270c9bbe7fd1
```

And tried to paste the code `6a33896c270c9bbe7fd1`, you got "The code passed is incorrect or expired."

## Why This Happened

**GitHub OAuth codes are single-use and expire within 10 minutes!**

Here's what actually happened:

1. ✅ You authorized the app on GitHub
2. ✅ GitHub redirected to: `/api/orbit/auth/github/callback?code=XXX`
3. ✅ The server **immediately used the code** to get an access token
4. ❌ When you tried to use the code again, it was already consumed

## The Correct Flow

### Option 1: Direct Token Flow (What We Implemented)

1. **User clicks "Sign in with GitHub"**
2. **Browser opens to GitHub OAuth**
3. **User authorizes the app**
4. **GitHub redirects to callback endpoint**
5. **Server exchanges code for token** (happens automatically)
6. **Server redirects to success page** showing the token
7. **User copies the TOKEN (not the code)**
8. **User pastes TOKEN in the app**

The success page shows:
```
https://principle-md.com/orbit-success?status=approved&handle=username&token=gho_xxxxx
```

**Copy the `token` parameter value, NOT the code from the callback URL!**

### Option 2: Automated Flow (Future Enhancement)

We could implement:
- Deep linking to return to the Electron app
- Local server to catch the callback
- PostMessage communication between windows

## Key Points

- **OAuth codes** are temporary and single-use
- **Access tokens** are what you need for API calls
- The callback URL with the code is handled by the server automatically
- You should copy the token from the success page, not the code from the callback

## Testing the Fixed Flow

1. **Clear localStorage** to remove any bad tokens:
   ```javascript
   localStorage.removeItem('orbit_auth')
   ```

2. **Click "Sign in with GitHub"**

3. **Authorize on GitHub**

4. **On the success page**, look for:
   - Your username
   - Your status (approved/waitlisted)
   - **Your token** (if approved)

5. **Copy the TOKEN** (starts with `gho_` for GitHub tokens)

6. **Paste the TOKEN** in the modal

7. **Success!** You're now authenticated

## Security Notes

⚠️ **Current implementation passes token in URL** - This is NOT secure for production!

Better approaches:
- Store token in secure session cookie
- Use postMessage for cross-window communication
- Implement deep linking back to Electron app
- Use local callback server in Electron

## Server-Side Code

The callback endpoint (`/api/orbit/auth/github/callback`) does:
1. Receives the OAuth code
2. Exchanges it with GitHub for an access token
3. Gets user info from GitHub API
4. Stores user in S3
5. Redirects to success page with token

## Client-Side Code

The `GitHubAuthDirect` service:
1. Opens OAuth URL
2. Waits for user to paste TOKEN (not code)
3. Verifies token with server
4. Stores token locally
5. Uses token for all API calls
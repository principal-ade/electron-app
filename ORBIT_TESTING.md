# Orbit P2P Collaboration - Testing Guide

## Configuration

The Orbit system is now configured to use the **production server** at `https://principle-md.com`.

### Server Endpoints:
- **API URL**: `https://principle-md.com`
- **WebSocket**: `wss://principle-md.com/orbit/signal`
- **OAuth Callback**: `https://principle-md.com/api/orbit/auth/github/callback`

### To Switch to Local Development:

1. **Option 1: Environment Variable**
   ```bash
   ORBIT_USE_LOCAL=true npm run start
   ```

2. **Option 2: Create .env.orbit file**
   ```bash
   cp .env.orbit.example .env.orbit
   # Edit .env.orbit and set ORBIT_USE_LOCAL=true
   ```

3. **Option 3: Edit config file**
   Edit `src/renderer/config/orbit.config.ts` and change:
   ```typescript
   const useLocalServer = true; // Force local server
   ```

## Testing Steps

### 1. Start the Application
```bash
npm run start
```

### 2. Open a Repository
1. Select or add a repository
2. Switch to "Develop" mode
3. Select a local clone

### 3. Enable Collaboration
1. Click the **"Orbit"** button in the repository header
2. Click **"Sign in with GitHub"**
3. A browser window will open to GitHub OAuth
4. After authorizing, copy the code from the redirect URL
5. Paste the code in the modal dialog
6. Click **"Authorize"**

### 4. Check Connection Status
- The Orbit button should turn green when connected
- It will show the number of connected users
- Click to expand and see peer details

### 5. Test Git Sync
1. Make a change to a file
2. Commit the change
3. Click **"Broadcast"** to notify peers
4. Other peers will see you're "1 ahead"
5. They can click **"Sync"** to merge your changes

## Troubleshooting

### Authentication Issues
- **Browser didn't open?** Copy the URL from the modal and open manually
- **Can't find the code?** Look for `?code=` in the redirect URL
- **Authentication failed?** Check console for errors

### Connection Issues
- **Not connecting?** Check browser console for WebSocket errors
- **No peers visible?** Ensure both users are in the same repository
- **Can't sync?** Verify both users have push/pull access to the repository

### Server Status
Check if the production server is running:
```bash
curl https://principle-md.com/api/orbit/auth/status
```

### Debug Mode
Enable debug logging:
```javascript
// In browser console
localStorage.setItem('orbit_debug', 'true');
location.reload();
```

## Production Server Details

The production server at `https://principle-md.com` includes:
- GitHub OAuth integration
- WebSocket signaling server
- S3-based user management
- Waitlist system with admin approval

## Security Notes

- All P2P connections are encrypted via WebRTC
- GitHub OAuth ensures only authenticated users can join
- Repository access is verified server-side
- No repository data passes through the server (pure P2P)

## Known Limitations

1. **Manual OAuth Code Entry**: Currently requires copying the code from the redirect URL
2. **Shared Remote Required**: Git sync uses the shared remote (not pure P2P file transfer yet)
3. **Same Branch**: All users must be on the same branch
4. **Manual Sync**: Requires clicking sync button (not automatic)

## Future Improvements

- [ ] Deep link handling for OAuth callback
- [ ] Automatic sync on changes
- [ ] Pure P2P file transfer via WebRTC data channels
- [ ] Conflict resolution UI
- [ ] Branch switching support
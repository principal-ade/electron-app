# Testing Git Sync Collaboration

## Prerequisites

1. **Code-city-landing server running**:
   ```bash
   cd ../code-city-landing
   npm run dev
   # Server should be running on http://localhost:3002
   ```

2. **Environment variables configured** (in code-city-landing):
   - `GITHUB_CLIENT_ID` - GitHub OAuth App Client ID
   - `GITHUB_CLIENT_SECRET` - GitHub OAuth App Client Secret
   - `AWS_ACCESS_KEY_ID` - AWS credentials for S3
   - `AWS_SECRET_ACCESS_KEY` - AWS credentials for S3
   - `FEEDBACK_S3_BUCKET` - S3 bucket name (default: codecity-feedback)
   - `ORBIT_ADMIN_SECRET` - Admin secret for waitlist management

3. **Two instances of electron-react** running (to simulate two users):
   ```bash
   # Terminal 1
   npm run start
   
   # Terminal 2 (different user profile)
   npm run start -- --user-data-dir=/tmp/electron-user2
   ```

## Test Steps

### 1. Initial Setup

1. Open a repository in both electron instances
2. Select a local clone in Develop mode
3. Ensure both instances are on the same Git branch and commit

### 2. Enable Collaboration

In **User 1**:
1. Click the "Orbit" button in the repository header
2. Click "Sign in with GitHub"
3. Complete OAuth flow (enter code if prompted)
4. Wait for approval or check waitlist status

In **User 2**:
1. Repeat the same steps
2. Both users should be approved (or manually approve via admin API)

### 3. Test Connection

1. Both users should automatically connect to the same repository room
2. The Orbit button should show green with "2 users" connected
3. Expanding the panel should show the other peer

### 4. Test Git Sync

In **User 1**:
1. Make a change to a file
2. Commit the change locally
3. Click "Broadcast" to notify peers

In **User 2**:
1. Should see User 1 is "1 ahead"
2. Click "Sync" button next to User 1
3. Changes should be fetched and merged
4. Both users should show as "synced"

### 5. Test Conflict Detection

In **User 1**:
1. Edit `file1.txt`
2. Don't commit yet

In **User 2**:
1. Edit the same `file1.txt`
2. Commit the change
3. Click "Broadcast"

In **User 1**:
1. Should see conflict warning
2. Sync button should be disabled
3. Must resolve conflict manually

## Troubleshooting

### Connection Issues
- Check WebSocket connection in browser DevTools
- Verify signaling server is running (port 3003)
- Check CORS settings if different origins

### Authentication Issues
- Verify GitHub OAuth app settings
- Check redirect URI matches server configuration
- Ensure tokens are being stored in localStorage

### Sync Issues
- Verify both users have push/pull access to the repository
- Check Git remote configuration
- Ensure no uncommitted changes blocking sync

## Admin Commands

### Approve a user (via curl):
```bash
curl -X POST http://localhost:3002/api/orbit/admin/waitlist/approve \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"githubHandle": "username"}'
```

### Check waitlist:
```bash
curl http://localhost:3002/api/orbit/admin/waitlist \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

## Expected Behavior

1. **Connection**: Real-time P2P connection via WebRTC
2. **Status Updates**: Live sync status for all peers
3. **One-click Sync**: Simple button to merge changes
4. **Conflict Detection**: Warns before sync if files overlap
5. **Auto-commit**: Preserves local work before syncing
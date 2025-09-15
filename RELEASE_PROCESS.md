# Release Process for Auto-Updates

This guide outlines the process for releasing updates that users can receive automatically through your custom update server.

## Prerequisites

1. Access to your update server at principlemd.com
2. Code signing certificates configured
3. Server endpoint configured at `https://principlemd.com/api/updates`

## Release Steps

### 1. Update Version

Update the version in `package.json`:
```json
{
  "version": "0.0.2"
}
```

### 2. Build and Package

```bash
# macOS
pnpm run package:mac:npm

# Windows
pnpm run package:windows

# Linux
pnpm run package:linux
```

### 3. Prepare Release Assets

The build process creates these files in `release/build/`:

**macOS:**
- `principle.md-{version}-arm64.dmg`
- `principle.md-{version}-x64.dmg`
- `latest-mac.yml`

**Windows:**
- `principle.md Setup {version}.exe`
- `latest.yml`

**Linux:**
- `principle.md-{version}.AppImage`
- `latest-linux.yml`

### 4. Upload to Update Server

1. Calculate SHA512 hashes for all built files:
   ```bash
   # macOS example
   shasum -a 512 release/build/principle.md-0.0.2-arm64.dmg | xxd -r -p | base64
   ```

2. Upload files to your server/CDN:
   - Platform-specific installers (.dmg, .exe, .AppImage)
   - Store file metadata (version, size, hash, platform)

3. Update your server's database with:
   - Version number
   - File URLs
   - SHA512 hashes
   - File sizes
   - Release date
   - Release notes

4. Ensure your server responds correctly at:
   - `https://principlemd.com/api/updates/{platform}-{arch}/latest.yml`
   - `https://principlemd.com/api/updates/download/{filename}`

### 5. Testing Auto-Updates

1. Install the previous version of the app
2. Launch the app
3. Check for updates (automatically or manually)
4. Verify update notification appears
5. Download and install update
6. Confirm app restarts with new version

## Update Channels

Configure different release channels:

- **Latest/Stable**: Default channel for all users
- **Beta**: Pre-release testing (tag as pre-release on GitHub)
- **Alpha**: Early development builds

## Troubleshooting

### Update Not Detected
- Verify server is responding at `https://principlemd.com/api/updates`
- Check YAML response format matches electron-updater requirements
- Ensure version number is higher than current
- Check server logs for authentication issues

### Signature Errors
- Confirm code signing is properly configured
- Check notarization status for macOS
- Verify Windows certificate is valid

### Download Failures
- Check user's internet connection
- Verify release assets are publicly accessible
- Check for firewall/proxy issues

## Environment Variables

Required for publishing:
```bash
# macOS notarization
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password

# Your update server credentials (if needed)
export UPDATE_SERVER_TOKEN=your_server_token
```

## Auto-Update Configuration

The updater is configured to check your custom endpoint at:
`https://principlemd.com/api/updates`

Update checks occur:
- On app startup
- Every hour while running
- When manually triggered by user

Updates are downloaded in the background and users are prompted to restart when ready.

## Server Requirements

Your update server must provide:
1. Version check endpoint returning YAML metadata
2. Binary download endpoint for installer files
3. Optional authentication for premium/licensed users

See CUSTOM_UPDATE_SERVER.md for detailed implementation guide.
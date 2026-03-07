# App Updates System

The electron app uses **electron-updater** with GitHub Releases to provide automatic updates to users.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  UpdatesSettings │ --> │ AppVersionManager │ --> │  GitHub Releases   │
│  (React UI)      │     │  Service (IPC)   │     │  (landing-page)    │
└─────────────────┘     └──────────────────┘     └────────────────────┘
         ↑                       ↑
         │                       │
         └───── IPC Events ──────┘
```

## Key Components

### Renderer (UI)

| File | Purpose |
|------|---------|
| `UpdatesSettings.tsx` | Settings panel UI for viewing version, checking updates, downloading, installing |
| `AppVersionManagerService.ts` | Service wrapper for IPC calls from React components |
| `App.tsx` | Triggers silent update check on startup |

### Main Process

| File | Purpose |
|------|---------|
| `AppVersionManager.ts` | Core update logic - configures electron-updater, handles IPC, manages update lifecycle |
| `appVersionManagerApi.ts` | IPC bridge - defines channels and message handlers |

## Update Flow

### 1. Check for Updates

Updates are checked:
- **On startup** - Silent check when app launches
- **Periodically** - Every 60 minutes while app is running
- **Manually** - When user clicks "Check for Updates" button

### 2. Update Available

When a new version is found:
1. `update-available` event fires with version info
2. UI shows "New Version Available!" banner
3. User sees current → available version comparison
4. Download button becomes available

### 3. Download Update

When user clicks "Download Update":
1. `downloadUpdate()` fetches installer from GitHub
2. Progress events update the UI progress bar
3. `update-downloaded` event fires when complete
4. "Install & Restart" button appears

### 4. Install Update

When user clicks "Install & Restart":
1. `quitAndInstall()` is called
2. App closes gracefully
3. Installer runs and updates the app
4. App relaunches with new version

## Configuration

### Production Mode
```typescript
autoUpdater.autoDownload = false;      // User controls downloads
autoUpdater.autoInstallOnAppQuit = false; // User controls installation
```

### Development Mode
```typescript
autoUpdater.forceDevUpdateConfig = true;
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = true;     // Allow testing any version
```

## Error Handling

The UI provides user-friendly messages for common errors:

| Error Type | User Message |
|------------|--------------|
| `ECONNREFUSED` | Cannot connect to update server |
| `ENOENT` | Update file not found |
| `ETIMEDOUT` | Update server timeout |
| `403/404` | Access denied / Not found |
| `CERT` | Certificate error |
| `sha512` | Update verification failed |

## GitHub Releases Integration

Updates are served from:
- **Repository**: `principal-ade/landing-page`
- **Provider**: GitHub Releases
- **Manifest**: `latest-mac.yml`, `latest.yml`

The electron-updater library automatically:
1. Fetches the appropriate `.yml` manifest
2. Compares versions using semver
3. Downloads the platform-specific installer
4. Verifies SHA512 checksums

## IPC Channels

### Renderer → Main
- `DOWNLOAD_UPDATE` - Start downloading
- `INSTALL_UPDATE` - Install and restart
- `CHECK_FOR_UPDATE_MANUALLY` - User-triggered check
- `CHECK_FOR_UPDATE_SILENTLY` - Background check
- `TEST_DOWNLOAD_UPDATE` - Dev mode test download

### Main → Renderer
- `ON_UPDATE_AVAILABLE` - New version found
- `ON_UPDATE_NOT_AVAILABLE` - Already on latest
- `ON_UPDATE_DOWNLOAD_PROGRESS` - Download percentage
- `ON_UPDATE_DOWNLOADED` - Ready to install
- `update-error` - Error occurred
- `update-check-complete` - Check finished

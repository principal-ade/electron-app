# macOS Notarization Guide

## Checking Notarization Status

### View Recent Submissions
```bash
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD"
```

### Check Specific Submission
```bash
xcrun notarytool info <submission-id> \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD"
```

### Get Detailed Log (for completed submissions)
```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD"
```

## Environment Variables

```bash
export APPLE_ID="laguna.loire.2024@gmail.com"
export APPLE_TEAM_ID="4TNFXHR5WN"
export APPLE_APP_SPECIFIC_PASSWORD="<app-specific-password>"
```

Generate app-specific passwords at: https://appleid.apple.com > Sign-In and Security > App-Specific Passwords

## Common Issues

### Submissions Stuck "In Progress"

If submissions stay "In Progress" for more than 15-30 minutes:

1. **Apple server backlog** - Most common cause. Check https://developer.apple.com/system-status/
2. **Large app size** - Apps over 1GB take longer to scan
3. **Network issues** - Upload may have been incomplete; resubmit

### Troubleshooting Steps

1. Check if previous submissions succeeded (compare to recent "Accepted" entries)
2. Verify code signing: `codesign --verify --deep --strict --verbose=2 "App.app"`
3. Check Gatekeeper: `spctl --assess --type execute --verbose "App.app"`

## Build Optimizations

Current app size: ~3.4GB. The following optimizations could reduce size and notarization time:

### 1. Exclude Non-macOS Binaries (DONE)

Already added to `package.json`:
```json
"files": [
  "!**/node_modules/**/prebuilds/win32-*/**",
  "!**/node_modules/**/prebuilds/linux-*/**"
]
```

### 2. Exclude Source Maps (TODO)

47,588 source map files (~141MB). Add to `files` in `package.json`:
```json
"!**/*.map"
```

Note: This will make production debugging harder. Consider keeping them but excluding from asar.

### 3. Move typescript to devDependencies (TODO)

`typescript` (19MB) is bundled in production but only needed for development.

### 4. Deduplicate monaco-editor (TODO)

Multiple builds included (esm, dev, min). Configure to include only the minified version.

### 5. Large Packages Audit

| Package | Size | Notes |
|---------|------|-------|
| @industry-theme | 512MB | All panels bundled |
| @principal-ai | 234MB | |
| monaco-editor | 96MB | Multiple copies |
| pixi.js | 71MB | |
| mermaid | 70MB | Also nested in @excalidraw |
| @excalidraw | 69MB | |
| @codesandbox | 66MB | |

## Verify App Before Submission

```bash
# Check code signing
codesign -dv --verbose=4 "Principal ADE.app"

# Verify all embedded components
codesign --verify --deep --strict --verbose=2 "Principal ADE.app"

# Check entitlements
codesign -d --entitlements - "Principal ADE.app"

# Count native binaries
find "Principal ADE.app" -name "*.node" | wc -l

# Check for non-macOS binaries (should be 0)
find "Principal ADE.app" -name "*.node" | grep -E "(win32|linux)" | wc -l
```

## References

- [Apple Notarization Docs](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder Notarization](https://www.electron.build/configuration/mac#notarization)
- [Apple System Status](https://developer.apple.com/system-status/)

# Multi-Platform Release Workflow for PrincipleMD

This document outlines the process for building and releasing PrincipleMD for Mac, Linux, and Windows platforms.

## Prerequisites

1. **GitHub Personal Access Token**: Required for publishing releases
   - Create a token at https://github.com/settings/tokens
   - Grant `repo` scope permissions
   - Set as environment variable: `export GH_TOKEN=your_token_here`

2. **Docker**: Required for Windows builds (when building on Mac/Linux)
   - Install Docker Desktop from https://www.docker.com/products/docker-desktop

3. **Dependencies**: Ensure all dependencies are installed
   ```bash
   npm install
   cd ../core && npm run build:agents
   cd ../electron-react
   ```

## Building for Different Platforms

### Mac Build (on Mac)
```bash
npm run package:mac:npm
```
Creates: `release/build/principle-md-electron-*.dmg`

### Linux Build (on Mac/Linux)
```bash
npm run package:linux
```
Creates: `release/build/principle-md-electron-*.AppImage`

### Windows Build (using Docker)
```bash
# Build Windows package using Docker
docker-compose -f docker-compose.windows.yml run --rm electron-win npm run package:windows

# Or use the helper script
./build-windows.sh
```
Creates: `release/build/principle-md-electron-*.exe`

## Automated Release Script

Create a script `release-all-platforms.sh`:

```bash
#!/bin/bash
set -e

# Check for required environment variables
if [ -z "$GH_TOKEN" ]; then
    echo "Error: GH_TOKEN environment variable is not set"
    echo "Please set it with: export GH_TOKEN=your_github_token"
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Building version $VERSION for all platforms..."

# Clean previous builds
rm -rf release/build/*

# Build for Mac (if on Mac)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building for Mac..."
    npm run package:mac:npm
fi

# Build for Linux
echo "Building for Linux..."
npm run package:linux

# Build for Windows using Docker
echo "Building for Windows using Docker..."
docker-compose -f docker-compose.windows.yml run --rm electron-win npm run package:windows

echo "All builds completed successfully!"
echo "Build artifacts:"
ls -la release/build/

# Optional: Create GitHub release
read -p "Do you want to create a GitHub release? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run publish
fi
```

## Publishing to GitHub Releases

### Automatic Publishing
Use electron-builder's built-in publishing:

```bash
# Publish all built artifacts
GH_TOKEN=your_token npm run publish
```

### Manual Publishing with GitHub CLI
If you prefer more control:

```bash
# Install GitHub CLI if not already installed
brew install gh  # Mac
# or
sudo apt install gh  # Linux

# Authenticate
gh auth login

# Create release with all artifacts
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" \
  --title "PrincipleMD v$VERSION" \
  --notes "Release notes here" \
  release/build/*.dmg \
  release/build/*.AppImage \
  release/build/*.exe \
  release/build/latest*.yml
```

## CI/CD with GitHub Actions

Create `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: cd ../core && npm ci && npm run build:agents
      - run: cd electron-react && npm run package:mac:npm
      - uses: actions/upload-artifact@v3
        with:
          name: mac-build
          path: release/build/*.dmg

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: cd ../core && npm ci && npm run build:agents
      - run: cd electron-react && npm run package:linux
      - uses: actions/upload-artifact@v3
        with:
          name: linux-build
          path: release/build/*.AppImage

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: cd ../core && npm ci && npm run build:agents
      - run: cd electron-react && npm run package:windows
      - uses: actions/upload-artifact@v3
        with:
          name: windows-build
          path: release/build/*.exe

  release:
    needs: [build-mac, build-linux, build-windows]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/download-artifact@v3
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            mac-build/*.dmg
            linux-build/*.AppImage
            windows-build/*.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Version Management

Before creating a release:

1. Update version in `package.json`:
   ```bash
   npm version patch  # or minor/major
   ```

2. Commit and tag:
   ```bash
   git add package.json package-lock.json
   git commit -m "Bump version to $(node -p "require('./package.json').version")"
   git tag "v$(node -p "require('./package.json').version")"
   git push && git push --tags
   ```

## Troubleshooting

### Windows Build Issues

1. **globalThis errors**: The Windows build uses separate webpack configs (`*.windows.ts`) that include the globalThis polyfill.

2. **Docker space issues**: Clean Docker cache if builds fail:
   ```bash
   docker system prune -a
   ```

3. **Wine performance**: Windows builds in Docker may be slow due to Wine emulation. Consider using a Windows VM or CI/CD for production builds.

### Mac Code Signing

For distribution outside the Mac App Store:
```bash
# Set Apple ID credentials
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with code signing
npm run package:mac:npm
```

### Auto-Update Configuration

The app is configured to check for updates from GitHub releases. Ensure:
1. The repository is public or users have access
2. Update URLs in `package.json` match your GitHub repository
3. Release assets include the `latest-*.yml` files for auto-update

## Best Practices

1. **Test locally** before publishing
2. **Create draft releases** first to review artifacts
3. **Include changelogs** in release notes
4. **Sign builds** for production releases
5. **Test auto-update** flow after publishing
#!/bin/bash

# Clean install script for electron-react in monorepo
# This ensures proper build order and Electron installation

echo "🧹 Starting clean install process..."

# Get the monorepo root (parent directory)
MONOREPO_ROOT="$(dirname "$(pwd)")"
ELECTRON_APP_DIR="$(pwd)"

echo "📍 Monorepo root: $MONOREPO_ROOT"
echo "📍 Electron app: $ELECTRON_APP_DIR"

# Step 1: Clean all node_modules and lock files
echo "🗑️  Cleaning node_modules and lock files..."
rm -rf "$MONOREPO_ROOT/node_modules"
rm -rf "$MONOREPO_ROOT/core/node_modules"
rm -rf "$ELECTRON_APP_DIR/node_modules"
rm -rf "$ELECTRON_APP_DIR/release/app/node_modules"
rm -f "$MONOREPO_ROOT/pnpm-lock.yaml"

# Step 2: Install and build core
echo "📦 Installing and building core..."
cd "$MONOREPO_ROOT/core"
npm install
npm run build

# Step 3: Install electron-react dependencies
echo "📦 Installing electron-react dependencies..."
cd "$ELECTRON_APP_DIR"
npm install

# Step 4: Rebuild Electron and native dependencies
echo "🔨 Rebuilding Electron and native dependencies..."
cd "$ELECTRON_APP_DIR"
npm run postinstall

# Step 5: Ensure release/app dependencies are installed
echo "📦 Installing release/app dependencies..."
cd "$ELECTRON_APP_DIR/release/app"
npm install

# Step 6: Verify Electron installation
echo "✅ Verifying Electron installation..."
cd "$ELECTRON_APP_DIR"
if [ -f "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ] || [ -f "node_modules/electron/dist/electron.exe" ]; then
    echo "✅ Electron installed successfully!"
else
    echo "❌ Electron installation verification failed!"
    echo "🔄 Attempting to reinstall Electron..."
    pnpm add -D electron@latest
fi

echo "✨ Clean install complete!"
echo "🚀 You can now run: pnpm run dev"
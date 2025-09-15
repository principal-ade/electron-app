#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧹 Clearing Electron extension cache...\n');

// Determine the extension cache path based on the platform
let extensionPath;
if (process.platform === 'win32') {
  extensionPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Electron', 'extensions');
} else if (process.platform === 'darwin') {
  extensionPath = path.join(os.homedir(), 'Library', 'Application Support', 'Electron', 'extensions');
} else {
  extensionPath = path.join(os.homedir(), '.config', 'Electron', 'extensions');
}

console.log(`📍 Extension cache path: ${extensionPath}`);

if (fs.existsSync(extensionPath)) {
  try {
    // Remove the extensions directory
    fs.rmSync(extensionPath, { recursive: true, force: true });
    console.log('✅ Extension cache cleared successfully!');
    console.log('\n💡 The React Developer Tools extension will be re-downloaded on next run.');
  } catch (error) {
    console.error('❌ Failed to clear extension cache:', error.message);
    console.error('💡 Try running with sudo or administrator privileges.');
  }
} else {
  console.log('ℹ️  No extension cache found. Nothing to clear.');
}

console.log('\n🚀 You can now run: pnpm run dev');
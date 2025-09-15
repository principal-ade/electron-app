#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Rebuilding native dependencies...\n');

try {
  // Read package.json to get electron version
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  // Sanitize version to remove range specifiers like ^ or ~
  const rawElectronVersion = packageJson.devDependencies.electron;

  if (!rawElectronVersion) {
    throw new Error('Electron not found in devDependencies');
  }

  const match = String(rawElectronVersion).match(/\d+(?:\.\d+){1,2}/);
  const electronVersion = match ? match[0] : String(rawElectronVersion);

  console.log(`📍 Found Electron version: ${rawElectronVersion}`);
  console.log(`📍 Using sanitized Electron version: ${electronVersion}`);

  // Check if electron is actually installed
  const electronPath = path.join(__dirname, '..', 'node_modules', 'electron');
  if (!fs.existsSync(electronPath)) {
    console.error('❌ Electron is not installed!');
    console.log('💡 Run "npm install" first');
    process.exit(1);
  }

  // Run electron-rebuild with explicit version
  console.log('🔧 Running electron-rebuild...');
  const rebuildCmd = `electron-rebuild --version ${electronVersion} --parallel --types prod,dev,optional --module-dir release/app`;
  
  execSync(rebuildCmd, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ELECTRON_VERSION: electronVersion
    }
  });

  console.log('\n✅ Native dependencies rebuilt successfully!');
} catch (error) {
  console.error('\n❌ Failed to rebuild native dependencies:', error.message);
  console.log('\n💡 Troubleshooting tips:');
  console.log('  1. Make sure Electron is installed: npm install');
  console.log('  2. Try clearing node_modules and reinstalling: npm run clean-install');
  console.log('  3. Check that you have build tools installed:');
  console.log('     - macOS: Xcode Command Line Tools');
  console.log('     - Windows: windows-build-tools');
  console.log('     - Linux: build-essential');
  process.exit(1);
}
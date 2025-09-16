#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '../..');

console.log('🚀 Starting Windows production build process...');

// Step 1: Clean up
console.log('🧹 Cleaning up old builds...');
execSync('node -r ts-node/register ./.erb/scripts/clean.js dist', {
  cwd: projectRoot,
  stdio: 'inherit',
});

// Step 2: Backup package.json
console.log('💾 Backing up package.json...');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJsonBackup = fs.readFileSync(packageJsonPath, 'utf8');

// Step 3: Build core hooks
console.log('🔨 Building core hooks...');
const coreDir = path.join(projectRoot, '../core');
if (fs.existsSync(coreDir)) {
  try {
    // First, ensure core dependencies are installed
    console.log('📦 Installing core dependencies...');
    execSync('npm install', { cwd: coreDir, stdio: 'inherit' });

    // Then build
    execSync('npm run build:electron', { cwd: coreDir, stdio: 'inherit' });
  } catch (error) {
    console.error('⚠️  Warning: Failed to build core hooks:', error.message);
    console.error(
      'The build will continue, but agent hooks may not be available.',
    );
    console.error(
      'To fix this, manually run "npm install && npm run build:electron" in the core directory',
    );
    // Don't exit, just continue with the build
  }
} else {
  console.error('⚠️  Warning: Core directory not found at:', coreDir);
  console.error(
    'The build will continue, but agent hooks may not be available.',
  );
}

// Step 4: Run prepare:shared-lib
console.log('📦 Preparing shared library...');
execSync('node ./.erb/scripts/prepare-shared-lib.js', {
  cwd: projectRoot,
  stdio: 'inherit',
});

try {
  // Step 5: Remove pnpm workspace and install with npm
  console.log('🔄 Converting to npm dependencies...');

  // Remove node_modules and pnpm lock
  if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
    // Windows-specific removal
    execSync(`rmdir /s /q "${path.join(projectRoot, 'node_modules')}"`, {
      shell: 'cmd',
      cwd: projectRoot,
    });
  }

  // Install with npm to get proper node_modules structure
  console.log('📦 Installing dependencies with npm...');
  execSync('npm install --legacy-peer-deps', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Step 6: Build the app
  console.log('🏗️ Building application...');
  execSync('npm run build:windows', { cwd: projectRoot, stdio: 'inherit' });

  // Step 7: Package with electron-builder
  console.log('📦 Packaging application...');
  // Check if --publish flag was passed
  const publishArg = process.argv.includes('--publish')
    ? '--publish always'
    : '--publish never';
  execSync(`electron-builder build --win ${publishArg}`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  console.log('✨ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Always restore the original package.json
  console.log('🔄 Restoring original package.json...');
  fs.writeFileSync(packageJsonPath, packageJsonBackup);

  // Run cleanup
  console.log('🧹 Running cleanup...');
  execSync('node ./.erb/scripts/cleanup-shared-lib.js', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

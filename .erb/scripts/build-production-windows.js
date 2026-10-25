#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cleanEnv } = require('../../scripts/clean-env');

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

// Step 3: Hook files are now included in assets directory
console.log('✅ Hook files are bundled in assets directory...');

// Step 4: Run prepare:shared-lib
console.log('📦 Preparing shared library...');
execSync('node ./.erb/scripts/prepare-shared-lib.js', {
  cwd: projectRoot,
  stdio: 'inherit',
});

try {
  // Step 5: Clean reinstall for production build
  console.log('🔄 Performing clean npm install for production build...');

  // Remove node_modules for clean install
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
    // node_modules was just deleted, so the ts-node preload inherited from the
    // shell would fail to resolve. Install with a plain Node environment.
    env: cleanEnv(),
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
    // electron-builder spawns npm inside release/app; keep those children free
    // of the ts-node preload inherited from the calling shell.
    env: cleanEnv(),
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

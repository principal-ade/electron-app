#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '../..');

console.log('🚀 Starting production build process...');

// Step 1: Clean up
console.log('🧹 Cleaning up old builds...');
// Clean up manually since ts-node might not be available after npm install
const distPath = path.join(projectRoot, 'dist');
const buildPath = path.join(projectRoot, 'release/build');
const dllPath = path.join(projectRoot, 'dll');

[distPath, buildPath, dllPath].forEach((folder) => {
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

// Clean release/app/dist to remove stale preload files
const releaseAppDistPath = path.join(projectRoot, 'release/app/dist');
if (fs.existsSync(releaseAppDistPath)) {
  console.log('🧹 Removing stale release/app/dist...');
  fs.rmSync(releaseAppDistPath, { recursive: true });
}

// Step 2: Backup package.json
console.log('💾 Backing up package.json...');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJsonBackup = fs.readFileSync(packageJsonPath, 'utf8');

// Step 3: Core library dependencies removed - no longer needed

try {
  // Step 3: Clean reinstall for production build
  console.log('🔄 Performing clean npm install for production build...');

  // Remove node_modules for clean install
  if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
    fs.rmSync(path.join(projectRoot, 'node_modules'), { recursive: true });
  }

  // Install with npm to get proper node_modules structure
  console.log('📦 Installing dependencies with npm...');
  execSync('npm install --legacy-peer-deps', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Step 3.5: Install release/app dependencies
  console.log('📦 Installing release/app dependencies...');
  const releaseAppDir = path.join(projectRoot, 'release/app');
  execSync('npm install --legacy-peer-deps --ignore-scripts', {
    cwd: releaseAppDir,
    stdio: 'inherit',
  });
  
  // Run electron-rebuild manually for release/app
  console.log('🔨 Rebuilding native modules for release/app...');
  execSync('npx electron-rebuild --force --types prod,dev,optional --module-dir .', {
    cwd: releaseAppDir,
    stdio: 'inherit',
  });

  // Step 4: Build the app
  console.log('🏗️ Building application...');
  execSync('npm run build:mac', { cwd: projectRoot, stdio: 'inherit' });
  
  // Step 4.5: Copy dist to release/app for electron-builder
  console.log('📋 Copying dist to release/app...');
  const distPath = path.join(projectRoot, 'dist');
  const releaseAppDistPath = path.join(releaseAppDir, 'dist');
  
  // Remove old dist if exists
  if (fs.existsSync(releaseAppDistPath)) {
    fs.rmSync(releaseAppDistPath, { recursive: true });
  }
  
  // Copy dist folder
  fs.cpSync(distPath, releaseAppDistPath, { recursive: true });
  console.log('✓ Copied dist folder to release/app');

  // Step 5: Package with electron-builder
  console.log('📦 Packaging application...');
  // Check if --publish flag was passed
  const publishArg = process.argv.includes('--publish')
    ? '--publish always'
    : '--publish never';
  execSync(`electron-builder build ${publishArg}`, {
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

  // Cleanup step removed - core library no longer used
}

const { execSync } = require('child_process');
const path = require('path');

/**
 * This script ensures all @libsql platform-specific packages are installed
 * even when building on a different platform (e.g., building Windows/Linux on Mac)
 */

console.log('📦 Installing all @libsql platform-specific dependencies...\n');

const libsqlPlatforms = [
  '@libsql/darwin-arm64@0.5.22',
  '@libsql/darwin-x64@0.5.22',
  '@libsql/linux-arm-gnueabihf@0.5.22',
  '@libsql/linux-arm-musleabihf@0.5.22',
  '@libsql/linux-arm64-gnu@0.5.22',
  '@libsql/linux-arm64-musl@0.5.22',
  '@libsql/linux-x64-gnu@0.5.22',
  '@libsql/linux-x64-musl@0.5.22',
  '@libsql/win32-x64-msvc@0.5.22'
];

const targetDir = path.join(__dirname, '..');

// Install all packages in a single command to prevent npm from removing them
const packagesToInstall = libsqlPlatforms.join(' ');

try {
  console.log('Installing all platform-specific packages at once...\n');
  // Use --force to bypass platform checks and --no-save to not modify package.json
  execSync(`npm install --force --no-save --legacy-peer-deps ${packagesToInstall}`, {
    cwd: targetDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_platform: undefined,
      npm_config_arch: undefined,
    }
  });
  console.log('\n✓ All @libsql platform-specific dependencies installed!\n');
} catch (error) {
  console.error('✗ Failed to install @libsql packages:', error.message);
  process.exit(1);
}

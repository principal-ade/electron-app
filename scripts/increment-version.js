#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Get current version
  const currentVersion = packageJson.version;
  console.log(`Current version: ${currentVersion}`);

  // Parse version (assuming semver format: major.minor.patch)
  const versionParts = currentVersion.split('.');
  if (versionParts.length !== 3) {
    throw new Error('Version format should be major.minor.patch');
  }

  // Increment patch version
  const major = parseInt(versionParts[0]);
  const minor = parseInt(versionParts[1]);
  const patch = parseInt(versionParts[2]) + 1;

  const newVersion = `${major}.${minor}.${patch}`;
  console.log(`New version: ${newVersion}`);

  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log('Version incremented successfully');

  // Output new version for use in scripts
  process.stdout.write(newVersion);

} catch (error) {
  console.error('Error incrementing version:', error.message);
  process.exit(1);
}
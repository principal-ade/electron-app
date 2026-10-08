const { execFileSync } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const electronPackageDirectory = path.dirname(require.resolve('electron'));
const plistPath = path.join(
  electronPackageDirectory,
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist',
);
const applicationName = 'Principal AI Dev';
const plistBuddy = '/usr/libexec/PlistBuddy';

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  try {
    execFileSync(
      plistBuddy,
      ['-c', `Set :${key} "${applicationName}"`, plistPath],
      { stdio: 'ignore' },
    );
  } catch {
    execFileSync(
      plistBuddy,
      ['-c', `Add :${key} string "${applicationName}"`, plistPath],
      { stdio: 'ignore' },
    );
  }
}

console.log(`Set development app bundle name to "${applicationName}".`);

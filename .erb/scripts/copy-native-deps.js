const fs = require('fs');
const path = require('path');

// This script ensures native dependencies from release/app are available during build
const sourceDir = path.join(__dirname, '../../release/app/node_modules');
const targetDir = path.join(__dirname, '../../node_modules');

const nativeDeps = ['node-pty', 'keytar', 'canvas'];

console.log('📦 Copying native dependencies for build...');

nativeDeps.forEach((dep) => {
  const sourcePath = path.join(sourceDir, dep);
  const targetPath = path.join(targetDir, dep);

  if (fs.existsSync(sourcePath)) {
    // Remove existing if present
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Copy the native module
    copyFolderRecursiveSync(sourcePath, targetDir);
    console.log(`✓ Copied ${dep}`);
  } else {
    console.log(`⚠️  ${dep} not found in release/app/node_modules`);
  }
});

function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
}

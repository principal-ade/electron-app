const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nativeModules = ['node-pty', 'keytar', 'canvas'];

exports.default = async function (context) {
  const { appOutDir } = context;

  // Patch unicorn-magic in release/app before packing
  console.log('Before pack: Patching unicorn-magic...');
  try {
    execSync('node scripts/patch-unicorn-magic.js', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });
  } catch (e) {
    console.warn('Warning: Failed to patch unicorn-magic:', e.message);
  }

  console.log('Before pack: Ensuring native modules are included...');

  const targetNodeModules = path.join(appOutDir, 'node_modules');

  if (!fs.existsSync(targetNodeModules)) {
    fs.mkdirSync(targetNodeModules, { recursive: true });
  }

  for (const moduleName of nativeModules) {
    const sourceModule = path.join(
      __dirname,
      '../../release/app/node_modules',
      moduleName,
    );

    if (fs.existsSync(sourceModule)) {
      copyFolderRecursiveSync(sourceModule, targetNodeModules);
      console.log(`✓ Copied ${moduleName} to app`);
    }
  }
};

function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
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

const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  const { appOutDir, packager } = context;
  const { productName } = packager.appInfo;

  console.log('Before pack: Ensuring node-pty is included...');

  // Copy node-pty from release/app to the app's node_modules
  const sourceNodePty = path.join(
    __dirname,
    '../../release/app/node_modules/node-pty',
  );
  const targetNodeModules = path.join(appOutDir, 'node_modules');
  const targetNodePty = path.join(targetNodeModules, 'node-pty');

  if (fs.existsSync(sourceNodePty)) {
    if (!fs.existsSync(targetNodeModules)) {
      fs.mkdirSync(targetNodeModules, { recursive: true });
    }

    // Copy node-pty
    copyFolderRecursiveSync(sourceNodePty, targetNodeModules);
    console.log('✓ Copied node-pty to app');
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

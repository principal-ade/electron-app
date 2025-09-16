#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');

const projectRoot = path.join(__dirname, '../..');
const corePath = path.join(projectRoot, '../core');
const targetPath = path.join(projectRoot, 'src/core-lib');

const isWatchMode = process.argv.includes('--watch');

function syncCore() {
  console.log('🔄 Syncing core library for development...');
  
  // Step 1: Ensure core is built
  const coreDist = path.join(corePath, 'dist');
  if (!fs.existsSync(coreDist)) {
    console.log('📦 Building core library...');
    execSync('npm run build', { cwd: corePath, stdio: 'inherit' });
  }
  
  // Step 2: Create target directory if needed
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  
  // Step 3: Use rsync for efficient syncing (preserves unchanged files)
  console.log('📋 Syncing core dist files...');
  execSync(`rsync -av --delete ${coreDist}/ ${targetPath}/`, { 
    stdio: isWatchMode ? 'pipe' : 'inherit' 
  });
  
  // Step 4: Fix nested directory structure issue (same as prepare-core.js)
  const nestedDirs = ['configs', 'layers', 'file-tree', 'code-city', 'a24z', 'local-search'];
  for (const dir of nestedDirs) {
    const nestedPath = path.join(targetPath, 'lib', dir, dir);
    const parentPath = path.join(targetPath, 'lib', dir);
    
    if (fs.existsSync(nestedPath)) {
      const items = fs.readdirSync(nestedPath);
      for (const item of items) {
        const srcPath = path.join(nestedPath, item);
        const destPath = path.join(parentPath, item);
        if (fs.existsSync(destPath) && destPath !== nestedPath) {
          fs.rmSync(destPath, { recursive: true });
        }
        fs.renameSync(srcPath, destPath);
      }
      fs.rmSync(nestedPath, { recursive: true });
    }
  }
  
  // Step 5: Copy config files to expected location
  const configSrcPath = path.join(targetPath, 'lib/code-city/config');
  const configDestPath = path.join(targetPath, 'lib/config');
  if (fs.existsSync(configSrcPath) && !fs.existsSync(configDestPath)) {
    fs.mkdirSync(configDestPath, { recursive: true });
    fs.readdirSync(configSrcPath).forEach(file => {
      fs.copyFileSync(
        path.join(configSrcPath, file),
        path.join(configDestPath, file)
      );
    });
    console.log('📋 Copied config files to lib/config');
  }
  
  // Step 6: Create/update package.json
  const corePackageJson = JSON.parse(
    fs.readFileSync(path.join(corePath, 'package.json'), 'utf8')
  );
  
  const updatedExports = {};
  if (corePackageJson.exports) {
    for (const [key, value] of Object.entries(corePackageJson.exports)) {
      if (typeof value === 'string') {
        updatedExports[key] = value.replace(/^\.\/dist\//, './');
      } else if (typeof value === 'object') {
        updatedExports[key] = {};
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === 'string') {
            updatedExports[key][subKey] = subValue.replace(/^\.\/dist\//, './');
          } else {
            updatedExports[key][subKey] = subValue;
          }
        }
      }
    }
  }
  
  const localPackageJson = {
    name: corePackageJson.name,
    version: corePackageJson.version,
    main: 'index.js',
    exports: updatedExports
  };
  
  fs.writeFileSync(
    path.join(targetPath, 'package.json'),
    JSON.stringify(localPackageJson, null, 2)
  );
  
  console.log('✅ Core library synced to src/core-lib');
}

// Initial sync
syncCore();

// Watch mode for development
if (isWatchMode) {
  console.log('👀 Watching core/dist for changes...');
  
  const watcher = chokidar.watch(path.join(corePath, 'dist'), {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });
  
  let syncTimeout;
  const debouncedSync = () => {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      console.log('\n🔄 Core files changed, resyncing...');
      syncCore();
    }, 500);
  };
  
  watcher
    .on('add', debouncedSync)
    .on('change', debouncedSync)
    .on('unlink', debouncedSync)
    .on('addDir', debouncedSync)
    .on('unlinkDir', debouncedSync);
  
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping core watch...');
    watcher.close();
    process.exit(0);
  });
}
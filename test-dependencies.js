const fs = require('fs');
const path = require('path');

console.log('🔍 Checking dependency setup...\n');

// Check release/app package.json
const releaseAppPkg = JSON.parse(fs.readFileSync('./release/app/package.json', 'utf8'));
console.log('📦 release/app/package.json dependencies:');
console.log(Object.keys(releaseAppPkg.dependencies || {}).sort());

// Check if node_modules exist
const releaseAppModules = './release/app/node_modules';
if (fs.existsSync(releaseAppModules)) {
  console.log('\n✅ release/app/node_modules exists');
  
  // Check specific modules
  const modulesToCheck = ['electron-log', 'electron-updater', 'debug', 'uuid', 'node-pty'];
  console.log('\n🔍 Checking for required modules:');
  
  modulesToCheck.forEach(mod => {
    const modPath = path.join(releaseAppModules, mod);
    if (fs.existsSync(modPath)) {
      console.log(`  ✅ ${mod} found`);
    } else {
      console.log(`  ❌ ${mod} NOT FOUND`);
    }
  });
} else {
  console.log('\n❌ release/app/node_modules does NOT exist');
}

// Check webpack config
console.log('\n🔧 Checking webpack externals...');
const webpackConfig = fs.readFileSync('./.erb/configs/webpack.config.main.base.ts', 'utf8');
const externalizedDeps = webpackConfig.match(/dep !== '([^']+)'/g);
if (externalizedDeps) {
  console.log('Modules NOT externalized (bundled):');
  externalizedDeps.forEach(match => {
    const dep = match.match(/dep !== '([^']+)'/)[1];
    console.log(`  - ${dep}`);
  });
}

// Check electron-builder config
console.log('\n📋 Checking electron-builder files config...');
const mainPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
console.log('Files included in build:');
mainPkg.build.files.forEach(f => console.log(`  - ${f}`));

console.log('\n💡 To fix missing modules:');
console.log('1. Make sure all dependencies are in release/app/package.json');
console.log('2. Run: cd release/app && npm install');
console.log('3. Check that electron-builder includes node_modules/');
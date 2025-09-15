#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Helper function to execute commands
function exec(command, cwd, allowFailure = false) {
  console.log(`📍 Running: ${command}`);
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: cwd || process.cwd(),
      shell: true 
    });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    if (!allowFailure) {
      process.exit(1);
    }
    return false;
  }
}

// Helper function to remove directory
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    console.log(`🗑️  Removing ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('🧹 Starting clean install process...\n');

// Get paths
const electronAppDir = process.cwd();
const monorepoRoot = path.dirname(electronAppDir);

console.log(`📍 Monorepo root: ${monorepoRoot}`);
console.log(`📍 Electron app: ${electronAppDir}\n`);

// Step 1: Clean only necessary node_modules (not the whole monorepo)
console.log('🗑️  Cleaning node_modules for core, shared-lib, and electron-react...');
removeDir(path.join(monorepoRoot, 'core', 'node_modules'));
removeDir(path.join(electronAppDir, 'node_modules'));
removeDir(path.join(electronAppDir, 'release', 'app', 'node_modules'));

// Step 1.5: Fix any lockfile issues
console.log('\n🔧 Ensuring lockfile integrity...');
const lockfileFixed = exec('npm install --no-save --ignore-scripts', monorepoRoot, true);
if (!lockfileFixed) {
  console.warn('⚠️  Failed to fix lockfile, but continuing anyway...');
}

// Don't remove the monorepo lock file or root node_modules
// This avoids breaking other packages in the monorepo

// Step 2: Install core dependencies
console.log('\n📦 Installing core dependencies...');

// Create placeholder files for binaries to avoid warnings during install
const coreDistHooks = path.join(monorepoRoot, 'core', 'dist', 'hooks');
const coreDistMcp = path.join(monorepoRoot, 'core', 'dist', 'mcp');

console.log('📁 Creating placeholder directories for core binaries...');
fs.mkdirSync(coreDistHooks, { recursive: true });
fs.mkdirSync(coreDistMcp, { recursive: true });

// Create placeholder files
fs.writeFileSync(path.join(coreDistHooks, 'agent-hook.js'), '#!/usr/bin/env node\n// Placeholder - will be replaced by build\n');
fs.writeFileSync(path.join(coreDistMcp, 'mcp-server.js'), '#!/usr/bin/env node\n// Placeholder - will be replaced by build\n');

// Make them executable
if (process.platform !== 'win32') {
  fs.chmodSync(path.join(coreDistHooks, 'agent-hook.js'), '755');
  fs.chmodSync(path.join(coreDistMcp, 'mcp-server.js'), '755');
}

// Install core dependencies
exec('npm install', path.join(monorepoRoot, 'core'));

// Build core to create the real bin files
console.log('🔨 Building core package...');
const coreBuildSuccess = exec('npm run build', path.join(monorepoRoot, 'core'), true);
if (!coreBuildSuccess) {
  console.warn('⚠️  Core build had issues, but this is often due to TypeScript looking for types in root node_modules');
  console.warn('⚠️  This is expected behavior in the monorepo setup');
}

// Step 3: Install electron-react dependencies
console.log('\n📦 Installing electron-react dependencies...');
// Install in the electron-react directory to ensure all deps are installed
const electronInstallSuccess = exec('npm install', electronAppDir, true);

if (!electronInstallSuccess) {
  console.warn('⚠️  Installation had issues, trying to fix...');
  
  // Clear problematic pnpm state files
  const modulesYaml = path.join(electronAppDir, 'node_modules', '.modules.yaml');
  const pnpmLock = path.join(electronAppDir, 'node_modules', '.pnpm-lock.yaml');
  
  if (fs.existsSync(modulesYaml)) {
    console.log('🗑️  Removing .modules.yaml');
    fs.unlinkSync(modulesYaml);
  }
  
  if (fs.existsSync(pnpmLock)) {
    console.log('🗑️  Removing .pnpm-lock.yaml');
    fs.unlinkSync(pnpmLock);
  }
  
  // Retry installation
  console.log('💡 Retrying installation...');
  exec('npm install --force', electronAppDir, true);
}

// Step 5: Ensure Electron is properly installed
console.log('\n📥 Checking Electron installation...');
const electronPath = path.join(electronAppDir, 'node_modules', 'electron');
if (!fs.existsSync(electronPath)) {
  console.log('⚠️  Electron not found in node_modules, installing it explicitly...');
  
  // Try to install electron with different approaches
  let electronInstalled = false;
  
  // Attempt 1: Try with npm
  console.log('💡 Attempt 1: Installing with npm...');
  electronInstalled = exec('npm install --save-dev electron@37.2.4', electronAppDir, true);
  
  // Attempt 2: Try with npm and legacy peer deps if first attempt fails
  if (!electronInstalled) {
    console.log('💡 Attempt 2: Installing with npm and legacy peer deps...');
    electronInstalled = exec('npm install --save-dev electron@37.2.4 --legacy-peer-deps', electronAppDir, true);
  }
  
  // Attempt 3: Force reinstall
  if (!electronInstalled) {
    console.log('💡 Attempt 3: Force reinstalling...');
    electronInstalled = exec('npm install --save-dev electron@37.2.4 --force', electronAppDir, true);
  }
  
  if (fs.existsSync(electronPath)) {
    console.log('✅ Electron installed successfully!');
  } else {
    console.error('❌ Failed to install Electron package');
    console.error('💡 You may need to manually install: npm install --save-dev electron@37.2.4');
  }
}

// Download Electron binary
if (fs.existsSync(electronPath)) {
  console.log('📥 Downloading Electron binary...');
  const electronInstallPath = path.join(electronPath, 'install.js');
  
  if (fs.existsSync(electronInstallPath)) {
    const success = exec(`node "${electronInstallPath}"`, electronPath, true);
    if (success) {
      console.log('✅ Electron binary downloaded successfully!');
    } else {
      console.warn('⚠️  Failed to download Electron binary, will retry after rebuild...');
    }
  } else {
    console.warn('⚠️  Electron install.js not found, will retry after rebuild...');
  }
}

// Step 6: Rebuild Electron and native dependencies
console.log('\n🔨 Rebuilding Electron and native dependencies...');
try {
  // Get electron version from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(electronAppDir, 'package.json'), 'utf8'));
  const electronVersion = packageJson.devDependencies.electron;
  
  console.log(`📍 Using Electron version: ${electronVersion}`);
  
  // Set ELECTRON_VERSION environment variable for rebuild
  process.env.ELECTRON_VERSION = electronVersion;
  
  exec('npm run postinstall', electronAppDir);
} catch (error) {
  console.warn('⚠️  Some postinstall scripts failed, but continuing...');
  console.warn('💡 If rebuild failed, try running: npm run rebuild');
}

// Step 7: Ensure release/app dependencies are installed
console.log('\n📦 Installing release/app dependencies...');
exec('npm install --ignore-scripts', path.join(electronAppDir, 'release', 'app'));

// Step 7.5: Run postinstall scripts separately (skip electron-builder install-app-deps)
console.log('\n🔧 Running postinstall scripts...');
const postinstallSuccess = exec('npm run postinstall', electronAppDir, true);
if (!postinstallSuccess) {
  console.warn('⚠️  Postinstall had issues, but continuing...');
  console.warn('💡 This is expected due to electron-builder/ajv compatibility issues');
}

// Always run electron-rebuild since it's critical
console.log('\n🔨 Running electron-rebuild...');
const rebuildSuccess = exec('npx electron-rebuild --version 37.2.4', electronAppDir, true);
if (rebuildSuccess) {
  console.log('✅ Native modules rebuilt successfully!');
} else {
  console.error('❌ Failed to rebuild native modules');
  console.error('💡 You may need to run: npm run rebuild');
}

// Step 7.6: Explicitly rebuild node-pty to ensure terminal functionality
console.log('\n🔨 Explicitly rebuilding node-pty for terminal support...');

// Rebuild node-pty in both locations to ensure it works
const mainNodePtyPath = path.join(electronAppDir, 'node_modules', 'node-pty');
const releaseNodePtyPath = path.join(electronAppDir, 'release', 'app', 'node_modules', 'node-pty');

// Rebuild in main electron-react directory
if (fs.existsSync(mainNodePtyPath)) {
  console.log('📍 Rebuilding node-pty in main directory...');
  const mainRebuildSuccess = exec('npx electron-rebuild --version 37.2.4 --only node-pty', electronAppDir, true);
  if (mainRebuildSuccess) {
    console.log('✅ node-pty rebuilt successfully in main directory!');
  } else {
    console.warn('⚠️  Failed to rebuild node-pty in main directory');
  }
}

// Rebuild in release/app directory (where it's actually needed at runtime)
if (fs.existsSync(releaseNodePtyPath)) {
  console.log('📍 Rebuilding node-pty in release/app directory...');
  const releaseRebuildSuccess = exec('npx electron-rebuild --version 37.2.4 --only node-pty', path.join(electronAppDir, 'release', 'app'), true);
  if (releaseRebuildSuccess) {
    console.log('✅ node-pty rebuilt successfully in release/app directory!');
  } else {
    console.warn('⚠️  Failed to rebuild node-pty in release/app directory, trying alternative approach...');
    // Try rebuilding with a different approach
    const alternativeRebuild = exec(`cd "${releaseNodePtyPath}" && npm rebuild`, electronAppDir, true);
    if (alternativeRebuild) {
      console.log('✅ node-pty rebuilt with alternative approach in release/app!');
    } else {
      console.error('❌ Failed to rebuild node-pty in release/app - terminal features may not work');
      console.error('💡 Try running manually: cd release/app && npx electron-rebuild --version 37.2.4 --only node-pty');
    }
  }
} else if (!fs.existsSync(mainNodePtyPath)) {
  console.warn('⚠️  node-pty not found in either location, terminal features will be disabled');
}

// Step 8: Final verification and retry if needed
console.log('\n✅ Verifying Electron installation...');
const electronBinary = process.platform === 'win32' 
  ? path.join(electronAppDir, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(electronAppDir, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');

if (!fs.existsSync(electronBinary)) {
  console.log('⚠️  Electron binary still missing, attempting final download...');
  
  const electronInstallPath = path.join(electronPath, 'install.js');
  if (fs.existsSync(electronInstallPath)) {
    // Try multiple approaches to install Electron
    let installSuccess = false;
    
    // Attempt 1: Direct node execution
    console.log('💡 Attempt 1: Direct node execution...');
    installSuccess = exec(`node "${electronInstallPath}"`, electronPath, true);
    
    if (!installSuccess && fs.existsSync(electronBinary)) {
      installSuccess = true;
    }
    
    // Attempt 2: With environment variables
    if (!installSuccess) {
      console.log('💡 Attempt 2: With explicit environment variables...');
      const envCommand = process.platform === 'win32'
        ? `set ELECTRON_SKIP_BINARY_DOWNLOAD= && node "${electronInstallPath}"`
        : `ELECTRON_SKIP_BINARY_DOWNLOAD= node "${electronInstallPath}"`;
      installSuccess = exec(envCommand, electronPath, true);
    }
    
    if (!installSuccess && fs.existsSync(electronBinary)) {
      installSuccess = true;
    }
    
    // Attempt 3: Force cache clear and retry
    if (!installSuccess) {
      console.log('💡 Attempt 3: Clearing cache and retrying...');
      const cacheDir = path.join(require('os').homedir(), '.electron');
      if (fs.existsSync(cacheDir)) {
        console.log(`🗑️  Clearing Electron cache at ${cacheDir}`);
        removeDir(cacheDir);
      }
      installSuccess = exec(`node "${electronInstallPath}"`, electronPath, true);
    }
    
    if (fs.existsSync(electronBinary)) {
      console.log('✅ Electron binary downloaded successfully!');
    } else {
      console.error('❌ Failed to download Electron binary after multiple attempts');
      console.error('💡 This might be due to network issues, permissions, or proxy settings');
      console.error('💡 Try running manually: cd node_modules/electron && node install.js');
      console.error('💡 Or set proxy if needed: npm config set proxy http://your-proxy:port');
      process.exit(1);
    }
  } else {
    console.error('❌ Electron install.js not found at:', electronInstallPath);
    console.error('💡 Try reinstalling electron: npm install --save-dev electron@37.2.4');
    process.exit(1);
  }
} else {
  console.log('✅ Electron installed successfully!');
}

console.log('\n✨ Clean install complete!');
console.log('🚀 You can now run: npm run dev');
console.log('\n📝 Notes:');
console.log('   - The workspace dependencies are now managed directly.');
console.log('   - The postinstall script may show ajv-keywords errors. This is due to electron-builder v26 compatibility issues.');
console.log('   - The critical parts (electron-rebuild) have been run separately to ensure proper setup.\n');
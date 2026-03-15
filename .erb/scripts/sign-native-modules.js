const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function findNativeModules(appPath) {
  const nativeModules = [];
  
  // Common locations for native modules in Electron apps
  const searchPaths = [
    path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules'),
    path.join(appPath, 'Contents', 'Resources', 'app', 'node_modules'),
    path.join(appPath, 'Contents', 'Frameworks'),
  ];

  // Specific native modules we know about
  const knownNativeModules = [
    'node-pty/build/Release/pty.node',
    'node-pty/build/Release/spawn-helper', // Helper binary for Unix PTY spawning
    'node-pty/build/Release/conpty.node',
    'node-pty/build/Release/conpty_console_list.node',
  ];

  // Also check prebuilds directory
  const knownPrebuilds = [
    'node-pty/prebuilds/darwin-arm64/pty.node',
    'node-pty/prebuilds/darwin-arm64/spawn-helper',
    'node-pty/prebuilds/darwin-x64/pty.node',
    'node-pty/prebuilds/darwin-x64/spawn-helper',
  ];

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      // Check known native modules
      for (const modulePath of knownNativeModules) {
        const fullPath = path.join(searchPath, modulePath);
        if (fs.existsSync(fullPath)) {
          nativeModules.push(fullPath);
          console.log(`Found native module: ${fullPath}`);
        }
      }
      // Check prebuilds
      for (const modulePath of knownPrebuilds) {
        const fullPath = path.join(searchPath, modulePath);
        if (fs.existsSync(fullPath)) {
          nativeModules.push(fullPath);
          console.log(`Found prebuild: ${fullPath}`);
        }
      }
    }
  }

  // Also search for any .node files
  const findNodeFiles = (dir) => {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        findNodeFiles(fullPath);
      } else if (file.endsWith('.node') || file === 'spawn-helper') {
        if (!nativeModules.includes(fullPath)) {
          nativeModules.push(fullPath);
          console.log(`Found native module: ${fullPath}`);
        }
      }
    }
  };

  searchPaths.forEach(findNodeFiles);
  
  return nativeModules;
}

async function signModule(modulePath, identity) {
  try {
    // First check if already signed
    const { stdout: verifyOutput } = await execAsync(`codesign --verify "${modulePath}" 2>&1`, { shell: true }).catch(e => e);
    
    if (verifyOutput && !verifyOutput.includes('not signed')) {
      console.log(`✓ Module already signed: ${path.basename(modulePath)}`);
      return;
    }

    console.log(`Signing ${path.basename(modulePath)}...`);
    
    // Remove any existing signatures
    await execAsync(`codesign --remove-signature "${modulePath}"`, { shell: true }).catch(() => {});
    
    // Sign with entitlements
    const entitlementsPath = path.join(__dirname, '../../assets/entitlements.mac.plist');
    const signCommand = `codesign --sign "${identity}" --force --timestamp --options runtime --entitlements "${entitlementsPath}" "${modulePath}"`;
    
    const { stderr } = await execAsync(signCommand, { shell: true });
    
    if (stderr && !stderr.includes('replacing existing signature')) {
      console.error(`Warning while signing ${modulePath}: ${stderr}`);
    }
    
    // Verify the signature
    await execAsync(`codesign --verify --deep --strict "${modulePath}"`, { shell: true });
    console.log(`✓ Successfully signed: ${path.basename(modulePath)}`);
    
  } catch (error) {
    console.error(`✗ Failed to sign ${modulePath}:`, error.message);
    throw error;
  }
}

async function signNativeModules(context) {
  // Only sign on macOS
  if (process.platform !== 'darwin') {
    console.log('Skipping native module signing (not macOS)');
    return;
  }

  console.log('\n=== Signing Native Modules ===\n');

  const appPath = context.appOutDir;
  const identity = context.packager.codeSigningInfo?.identityName || process.env.APPLE_IDENTITY;

  if (!identity) {
    console.warn('⚠️  No signing identity found. Set APPLE_IDENTITY environment variable.');
    console.warn('   Example: export APPLE_IDENTITY="Developer ID Application: Your Name (XXXXXXXXXX)"');
    console.warn('   Run: security find-identity -v -p codesigning to list available identities');
    return;
  }

  console.log(`Using identity: ${identity}`);
  console.log(`App path: ${appPath}\n`);

  try {
    // Find all native modules
    const nativeModules = await findNativeModules(appPath);
    
    if (nativeModules.length === 0) {
      console.log('No native modules found to sign');
      return;
    }

    console.log(`Found ${nativeModules.length} native module(s) to sign\n`);

    // Sign each module
    for (const modulePath of nativeModules) {
      await signModule(modulePath, identity);
    }

    console.log('\n✓ All native modules signed successfully');
    
  } catch (error) {
    console.error('\n✗ Failed to sign native modules:', error);
    // Don't throw - let the build continue but warn
    console.warn('\n⚠️  Build continuing without signed native modules');
    console.warn('   This may cause notarization to fail');
  }
}

// Export for electron-builder
exports.default = signNativeModules;

// Allow running directly for testing
if (require.main === module) {
  const testContext = {
    appOutDir: process.argv[2] || '/path/to/YourApp.app',
    packager: {
      codeSigningInfo: {
        identityName: process.env.APPLE_IDENTITY
      }
    }
  };
  
  signNativeModules(testContext).catch(console.error);
}
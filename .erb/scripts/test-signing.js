#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

async function checkIdentities() {
  console.log('=== Available Code Signing Identities ===\n');
  
  try {
    const { stdout } = await execAsync('security find-identity -v -p codesigning');
    console.log(stdout);
    
    // Extract Developer ID Application identity
    const developerIdMatch = stdout.match(/[A-F0-9]{40}.*"(Developer ID Application:[^"]+)"/);
    if (developerIdMatch) {
      console.log('\nRecommended identity for distribution:');
      console.log(`export APPLE_IDENTITY="${developerIdMatch[1]}"`);
    }
  } catch (error) {
    console.error('Failed to list identities:', error.message);
    console.log('\nMake sure you have Xcode installed and certificates in Keychain');
  }
}

async function testSignSingleFile(filePath) {
  console.log(`\n=== Testing Sign on ${path.basename(filePath)} ===\n`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  const identity = process.env.APPLE_IDENTITY;
  if (!identity) {
    console.error('APPLE_IDENTITY environment variable not set');
    return;
  }

  try {
    // Remove existing signature
    await execAsync(`codesign --remove-signature "${filePath}"`).catch(() => {});
    
    // Sign the file
    console.log(`Signing with identity: ${identity}`);
    const { stderr } = await execAsync(`codesign --sign "${identity}" --force --timestamp "${filePath}"`);
    
    if (stderr) {
      console.log('Sign output:', stderr);
    }
    
    // Verify
    const { stdout: verifyOut } = await execAsync(`codesign --verify --verbose "${filePath}"`);
    console.log('✓ Signature verified successfully');
    
    // Display signature info
    const { stdout: displayOut } = await execAsync(`codesign --display --verbose "${filePath}"`);
    console.log('\nSignature details:');
    console.log(displayOut);
    
  } catch (error) {
    console.error('✗ Signing failed:', error.message);
  }
}

async function findBuiltApp() {
  const possiblePaths = [
    path.join(__dirname, '../../release/build/mac/principle.md.app'),
    path.join(__dirname, '../../release/build/mac-arm64/principle.md.app'),
    path.join(__dirname, '../../release/build/mac-x64/principle.md.app'),
    path.join(__dirname, '../../dist/mac/principle.md.app'),
  ];

  for (const appPath of possiblePaths) {
    if (fs.existsSync(appPath)) {
      return appPath;
    }
  }
  
  return null;
}

async function main() {
  console.log('Code Signing Test Utility\n');
  
  // Check identities
  await checkIdentities();
  
  // If a file path is provided, test signing it
  if (process.argv[2]) {
    await testSignSingleFile(process.argv[2]);
  } else {
    // Try to find the built app
    const appPath = await findBuiltApp();
    if (appPath) {
      console.log(`\nFound built app at: ${appPath}`);
      console.log('Run this command to test native module signing:');
      console.log(`node ${__filename} "${appPath}"`);
    } else {
      console.log('\nUsage:');
      console.log(`  node ${path.basename(__filename)} [path-to-file-to-sign]`);
      console.log('\nExample:');
      console.log('  node test-signing.js /path/to/principle.md.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node');
    }
  }
}

main().catch(console.error);
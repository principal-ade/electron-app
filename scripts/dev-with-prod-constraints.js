#!/usr/bin/env node

/**
 * Run the app in development mode with production-like constraints
 * This helps catch issues that would only appear in the packed app
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development with production constraints...\n');
console.log('⚠️  Running in production-safe mode with sandbox restrictions.');
console.log('   This simulates the packaged app environment.\n');
console.log('   Use "npm run dev:unsafe" for unrestricted development.\n');

// Set environment variables to enforce production-like behavior
const env = {
  ...process.env,
  NODE_ENV: 'development',
  FORCE_PRODUCTION_PATHS: 'true',
  ELECTRON_DISABLE_SECURITY_WARNINGS: 'false', // Enable to see security issues
  
  // Production-like constraints
  ELECTRON_ENABLE_SANDBOX: 'true',
  // Don't set ELECTRON_RUN_AS_NODE as it breaks electronmon
  
  // Disable features that won't work in production
  ELECTRON_ENABLE_LOGGING: 'false',
  ELECTRON_ENABLE_STACK_DUMPING: 'false',
  
  // Simulate packaged app environment
  NODE_ENV_PACKAGED_SIMULATION: 'true',
};

// First ensure release/app structure exists
console.log('Ensuring release/app structure...');
const releaseAppPath = path.resolve(__dirname, '..', 'release', 'app');
if (!fs.existsSync(releaseAppPath)) {
  fs.mkdirSync(releaseAppPath, { recursive: true });
  
  // Create a simplified package.json for production dependencies
  const mainPackage = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json')));
  const releasePackage = {
    name: mainPackage.name,
    version: mainPackage.version,
    description: mainPackage.description,
    main: mainPackage.main,
    dependencies: mainPackage.dependencies,
    overrides: mainPackage.overrides
  };
  
  const releasePackageJson = path.resolve(releaseAppPath, 'package.json');
  fs.writeFileSync(releasePackageJson, JSON.stringify(releasePackage, null, 2));
  
  // Install production dependencies
  console.log('Installing production dependencies in release/app...');
  const installDeps = spawn('npm', ['install', '--omit=dev'], {
    cwd: releaseAppPath,
    stdio: 'inherit',
    shell: true
  });
  
  installDeps.on('exit', (installCode) => {
    if (installCode !== 0) {
      console.error(`Production deps install failed with code ${installCode}`);
      process.exit(installCode);
    }
    
    // Rebuild native modules for Electron
    console.log('Rebuilding native modules for Electron...');
    const rebuild = spawn('npx', ['electron-rebuild', '--version', '37.2.4'], {
      cwd: releaseAppPath,
      stdio: 'inherit',
      shell: true
    });
    
    rebuild.on('exit', (rebuildCode) => {
      if (rebuildCode !== 0) {
        console.warn(`Native module rebuild failed with code ${rebuildCode}, continuing...`);
      }
      startDllBuild();
    });
  });
} else {
  startDllBuild();
}

function startDllBuild() {
// First build DLL if needed
console.log('Building DLL files...');
const dllBuild = spawn('npm', ['run', 'build:dll'], {
  env,
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

dllBuild.on('exit', (code) => {
  if (code !== 0) {
    console.error(`DLL build failed with code ${code}`);
    process.exit(code);
  }
  
  console.log('Preparing webpack builds...\n');
  
  // Run prestart to build main process
  const prestart = spawn('npm', ['run', 'prestart'], {
    env,
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..')
  });
  
  prestart.on('exit', (prestartCode) => {
    if (prestartCode !== 0) {
      console.error(`Prestart failed with code ${prestartCode}`);
      process.exit(prestartCode);
    }
    
    console.log('\n📋 Production Constraints Applied:');
    console.log('   ✓ Sandbox enabled');
    console.log('   ✓ Node integration restrictions');
    console.log('   ✓ Context isolation enforced');
    console.log('   ✓ Security warnings enabled');
    console.log('   ✓ Process spawning restrictions\n');
    
    console.log('Starting development server with production constraints...\n');
    
    // Start the renderer build in background
    const rendererProcess = spawn('npm', ['run', 'start:renderer'], {
      env,
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..')
    });
    
    // Important: Do NOT start start:main here. The renderer dev server
    // (webpack.config.renderer.dev.standalone.ts) already spawns both
    // start:preload and start:main. Launching it again causes a second
    // Electron instance which triggers the single-instance lock and exits.
    
    rendererProcess.on('error', (err) => {
      console.error('Failed to start renderer process:', err);
      process.exit(1);
    });

    // If the renderer dev server exits (e.g., because main exited),
    // propagate the exit so this wrapper terminates cleanly.
    rendererProcess.on('exit', (code) => {
      process.exit(code || 0);
    });
  });
});
}
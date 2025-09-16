#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '../..');
const tempBuildDir = path.join(projectRoot, '.temp-build');

console.log('🔧 Creating temporary build environment for electron-builder...');

try {
  // Step 1: Create temp directory
  console.log('📁 Creating temporary build directory...');
  if (fs.existsSync(tempBuildDir)) {
    fs.rmSync(tempBuildDir, { recursive: true });
  }
  fs.mkdirSync(tempBuildDir);

  // Step 2: Copy necessary files
  console.log('📋 Copying build artifacts...');
  const filesToCopy = [
    { src: 'dist', dest: 'dist' },
    { src: 'assets', dest: 'assets' },
    { src: 'release/app', dest: 'release/app' },
    { src: '.erb/scripts/notarize.js', dest: '.erb/scripts/notarize.js' },
    { src: 'dist_mcp_server', dest: 'dist_mcp_server' },
  ];

  for (const file of filesToCopy) {
    const srcPath = path.join(projectRoot, file.src);
    const destPath = path.join(tempBuildDir, file.dest);

    // Create parent directory if needed
    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Copy recursively
    execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'inherit' });
  }

  // Step 3: Create a clean package.json without workspace dependency
  console.log('📝 Creating clean package.json...');
  const originalPackageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
  );

  // Remove problematic fields
  delete originalPackageJson.devDependencies;
  delete originalPackageJson.scripts;
  delete originalPackageJson.devEngines;

  // Write clean package.json
  fs.writeFileSync(
    path.join(tempBuildDir, 'package.json'),
    JSON.stringify(originalPackageJson, null, 2),
  );

  // Step 4: Copy electron-builder config
  if (fs.existsSync(path.join(projectRoot, 'electron-builder.json'))) {
    fs.copyFileSync(
      path.join(projectRoot, 'electron-builder.json'),
      path.join(tempBuildDir, 'electron-builder.json'),
    );
  }

  // Step 5: Create minimal node_modules structure
  console.log('📦 Creating minimal node_modules...');
  fs.mkdirSync(path.join(tempBuildDir, 'node_modules'));

  // Step 6: Run electron-builder from temp directory
  console.log('🚀 Running electron-builder...');
  process.chdir(tempBuildDir);

  execSync('npx electron-builder build --mac --publish never', {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true',
    },
  });

  // Step 7: Copy build output back
  console.log('📋 Copying build output back...');
  const buildOutput = path.join(tempBuildDir, 'release/build');
  const targetOutput = path.join(projectRoot, 'release/build');

  if (fs.existsSync(buildOutput)) {
    execSync(`cp -r "${buildOutput}"/* "${targetOutput}"/`, {
      stdio: 'inherit',
    });
  }

  console.log('✨ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Cleanup
  process.chdir(projectRoot);
  if (fs.existsSync(tempBuildDir)) {
    console.log('🧹 Cleaning up temporary build directory...');
    fs.rmSync(tempBuildDir, { recursive: true });
  }
}

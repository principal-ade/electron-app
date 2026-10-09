#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '../..');

// Load environment variables from .env file if it exists
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
  console.log('✓ Loaded environment variables from .env');
}

console.log('🚀 Starting production build process...');

// Sync versions from main package.json to release/app/package.json
const mainPackageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const releaseAppPackageJsonPath = path.join(projectRoot, 'release/app/package.json');
const releaseAppPackageJson = JSON.parse(fs.readFileSync(releaseAppPackageJsonPath, 'utf8'));

if (mainPackageJson.version !== releaseAppPackageJson.version) {
  console.log(`📦 Syncing version: ${releaseAppPackageJson.version} → ${mainPackageJson.version}`);
  releaseAppPackageJson.version = mainPackageJson.version;
  fs.writeFileSync(releaseAppPackageJsonPath, JSON.stringify(releaseAppPackageJson, null, 2) + '\n');
  console.log('✓ Version synced to release/app/package.json');
}

// Step 1: Clean up
console.log('🧹 Cleaning up old builds...');
// Clean up manually since ts-node might not be available after npm install
const distPath = path.join(projectRoot, 'dist');
const buildPath = path.join(projectRoot, 'release/build');
const dllPath = path.join(projectRoot, 'dll');

[distPath, buildPath, dllPath].forEach((folder) => {
  if (fs.existsSync(folder)) {
    try {
      fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      // If fs.rmSync fails, try using shell command as fallback
      console.log(`⚠️  fs.rmSync failed for ${folder}, using rm -rf as fallback`);
      try {
        execSync(`rm -rf "${folder}"`, { stdio: 'inherit' });
      } catch (shellErr) {
        console.error(`❌ Failed to remove ${folder}:`, shellErr.message);
        console.log('   You may need to manually delete this folder and retry.');
      }
    }
  }
});

// Clean release/app/dist to remove stale preload files
const releaseAppDistPath = path.join(projectRoot, 'release/app/dist');
if (fs.existsSync(releaseAppDistPath)) {
  console.log('🧹 Removing stale release/app/dist...');
  fs.rmSync(releaseAppDistPath, { recursive: true });
}

// Step 2: Backup package.json
console.log('💾 Backing up package.json...');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJsonBackup = fs.readFileSync(packageJsonPath, 'utf8');

// Step 3: Core library dependencies removed - no longer needed

try {
  // Step 3: Clean reinstall for production build
  console.log('🔄 Performing clean npm install for production build...');

  // Remove node_modules for clean install
  if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
    fs.rmSync(path.join(projectRoot, 'node_modules'), { recursive: true });
  }

  // Install with npm to get proper node_modules structure
  console.log('📦 Installing dependencies with npm...');
  execSync('npm install --legacy-peer-deps', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Step 3.5: Install release/app dependencies
  console.log('📦 Installing release/app dependencies...');
  const releaseAppDir = path.join(projectRoot, 'release/app');
  execSync('npm install --legacy-peer-deps --ignore-scripts', {
    cwd: releaseAppDir,
    stdio: 'inherit',
  });
  
  // Run electron-rebuild manually for release/app
  console.log('🔨 Rebuilding native modules for release/app...');
  execSync('npx electron-rebuild --force --types prod,dev,optional --module-dir .', {
    cwd: releaseAppDir,
    stdio: 'inherit',
  });

  // Step 4: Build the app
  console.log('🏗️ Building application...');
  execSync('npm run build:mac', { cwd: projectRoot, stdio: 'inherit' });
  
  // Step 4.5: Copy dist to release/app for electron-builder
  console.log('📋 Copying dist to release/app...');
  const distPath = path.join(projectRoot, 'dist');
  const releaseAppDistPath = path.join(releaseAppDir, 'dist');
  
  // Remove old dist if exists
  if (fs.existsSync(releaseAppDistPath)) {
    fs.rmSync(releaseAppDistPath, { recursive: true });
  }
  
  // Copy dist folder
  fs.cpSync(distPath, releaseAppDistPath, { recursive: true });
  console.log('✓ Copied dist folder to release/app');

  // Step 5: Package with electron-builder
  console.log('📦 Packaging application...');
  // Check if --publish flag was passed
  const shouldPublish = process.argv.includes('--publish');

  if (shouldPublish) {
    // Pre-publish check: verify GitHub release doesn't already exist
    const version = mainPackageJson.version;
    console.log(`🔍 Checking if version ${version} can be published...`);

    if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
      console.error('❌ No GitHub token found. Please set GH_TOKEN or GITHUB_TOKEN environment variable.');
      console.log('   You can set it in your .env file or export it manually:');
      console.log('   export GH_TOKEN=your_github_token_here');
      process.exit(1);
    }

    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    try {
      // Check if release already exists
      const checkCmd = `curl -s -H "Authorization: token ${token}" https://api.github.com/repos/principal-ade/electron-app/releases/tags/v${version}`;
      const releaseCheck = execSync(checkCmd, { encoding: 'utf8' });

      if (releaseCheck && JSON.parse(releaseCheck).id) {
        console.warn(`⚠️  Release v${version} already exists on GitHub.`);
        console.log('   Options:');
        console.log('   1. Delete the existing release on GitHub');
        console.log('   2. Bump the version in package.json');
        console.log('   3. Run without --publish flag to build without publishing');
        process.exit(1);
      }
    } catch (e) {
      // 404 error is expected and means we can publish
      if (!e.stdout || !e.stdout.includes('Not Found')) {
        console.log('✓ Version can be published');
      }
    }
  }

  // Always build without publishing first (we'll publish after fixing DMGs)
  execSync(`npx electron-builder build --publish never`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Step 6: Rebuild DMGs with hdiutil to fix missing Electron Framework
  // (electron-builder's dmg-builder has a bug that drops the framework binary)
  if (process.platform === 'darwin') {
    console.log('🔧 Rebuilding DMGs with hdiutil...');
    execSync('node .erb/scripts/rebuild-dmg.js', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  }

  // Step 7: Publish if requested (now with fixed DMGs)
  if (shouldPublish) {
    console.log('📤 Publishing to GitHub...');
    const version = mainPackageJson.version;
    const buildDir = path.join(projectRoot, 'release', 'build');

    // Create GitHub release on electron-app repo
    const repo = 'principal-ade/electron-app';
    try {
      execSync(`gh release create v${version} --repo ${repo} --title "v${version}" --generate-notes`, {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch (e) {
      // Release might already exist, that's ok
      console.log(`ℹ️  Release v${version} may already exist, uploading assets...`);
    }

    // Upload all build artifacts
    // Note: Files need to be renamed to replace spaces with hyphens to match
    // what electron-builder puts in latest-mac.yml (gh CLI converts spaces to dots)
    const artifacts = fs.readdirSync(buildDir).filter(f =>
      f.endsWith('.dmg') || f.endsWith('.zip') || f.endsWith('.exe') ||
      f.endsWith('.AppImage') || f.endsWith('.yml') || f.endsWith('.yaml') ||
      f.endsWith('.blockmap')
    );

    for (const artifact of artifacts) {
      const artifactPath = path.join(buildDir, artifact);
      // Rename file if it contains spaces (to match yml expectations)
      const newName = artifact.replace(/ /g, '-');
      const newPath = path.join(buildDir, newName);

      if (artifact !== newName) {
        fs.renameSync(artifactPath, newPath);
        console.log(`📝 Renamed: ${artifact} → ${newName}`);
      }

      console.log(`📤 Uploading ${newName}...`);
      try {
        execSync(`gh release upload v${version} "${newPath}" --repo ${repo} --clobber`, {
          cwd: projectRoot,
          stdio: 'inherit',
        });
      } catch (e) {
        console.warn(`⚠️  Failed to upload ${newName}: ${e.message}`);
      }
    }
  }

  console.log('✨ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Always restore the original package.json
  console.log('🔄 Restoring original package.json...');
  fs.writeFileSync(packageJsonPath, packageJsonBackup);

  // Cleanup step removed - core library no longer used
}

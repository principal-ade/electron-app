#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cleanEnv } = require('../../scripts/clean-env');

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

// ---------------------------------------------------------------------------
// Publish pre-flight: auto-bump the version if the release tag already exists
// ---------------------------------------------------------------------------
// Publishing over an existing tag would fail (or silently mix artifacts), so
// when --publish is requested we check GitHub and bump the patch version until
// we land on a free one. This keeps the git tag, package.json and release/app
// in sync without a manual version edit.
const shouldPublish = process.argv.includes('--publish');
const publishRepo = 'principal-ade/electron-app';
const publishToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

const releaseExists = (version) => {
  try {
    const checkCmd = `curl -s -H "Authorization: token ${publishToken}" https://api.github.com/repos/${publishRepo}/releases/tags/v${version}`;
    const releaseCheck = execSync(checkCmd, { encoding: 'utf8' });
    return Boolean(releaseCheck && JSON.parse(releaseCheck).id);
  } catch (e) {
    // Probe failure (network, rate limit, ...) shouldn't block the build.
    return false;
  }
};

const bumpPatchVersion = () => {
  const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(mainPackageJson.version);
  if (!match) {
    throw new Error(`Cannot auto-bump non-semver version "${mainPackageJson.version}"`);
  }
  const nextVersion = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  console.log(`⬆️  Bumping version: ${mainPackageJson.version} → ${nextVersion}`);
  mainPackageJson.version = nextVersion;
  fs.writeFileSync(
    path.join(projectRoot, 'package.json'),
    JSON.stringify(mainPackageJson, null, 2) + '\n'
  );
};

if (shouldPublish) {
  if (!publishToken) {
    console.error('❌ No GitHub token found. Please set GH_TOKEN or GITHUB_TOKEN environment variable.');
    console.log('   You can set it in your .env file or export it manually:');
    console.log('   export GH_TOKEN=your_github_token_here');
    process.exit(1);
  }

  let attempts = 0;
  while (releaseExists(mainPackageJson.version)) {
    console.warn(`⚠️  Release v${mainPackageJson.version} already exists on GitHub — bumping automatically.`);
    bumpPatchVersion();
    attempts += 1;
    if (attempts >= 100) {
      console.error('❌ Could not find a free version after 100 bumps. Aborting.');
      process.exit(1);
    }
  }
  console.log(`🔍 Publishing as v${mainPackageJson.version}`);
}

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
    // node_modules was just deleted, so the ts-node preload inherited from the
    // shell would fail to resolve. Install with a plain Node environment.
    env: cleanEnv(),
  });

  // Step 3.5: Install release/app dependencies
  console.log('📦 Installing release/app dependencies...');
  const releaseAppDir = path.join(projectRoot, 'release/app');
  execSync('npm install --legacy-peer-deps --ignore-scripts', {
    cwd: releaseAppDir,
    stdio: 'inherit',
    // release/app has no tsconfig.node.json, so inherited ts-node settings
    // from the build scripts must not leak into this install.
    env: cleanEnv(),
  });
  
  // Run electron-rebuild manually for release/app
  console.log('🔨 Rebuilding native modules for release/app...');
  execSync('npx electron-rebuild --force --types prod,dev,optional --module-dir .', {
    cwd: releaseAppDir,
    stdio: 'inherit',
    // npx is a Node process started in release/app: without this it dies with
    // "TS5083: Cannot read file '<release/app>/tsconfig.node.json'".
    env: cleanEnv(),
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

  // Always build without publishing first (we'll publish after fixing DMGs)
  execSync(`npx electron-builder build --publish never`, {
    cwd: projectRoot,
    stdio: 'inherit',
    // electron-builder spawns npm inside release/app; keep those children free
    // of the ts-node preload inherited from the calling shell.
    env: cleanEnv(),
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
    const repo = publishRepo;
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

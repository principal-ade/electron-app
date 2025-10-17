#!/usr/bin/env node
/**
 * Download nektos/act binaries for all platforms
 *
 * This script downloads the act CLI binaries and places them in the
 * resources/bin directory to be bundled with the application.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const { createGunzip } = require('zlib');
const tar = require('tar');

const ACT_VERSION = 'v0.2.72'; // Stable version
const BINARIES_DIR = path.join(__dirname, '../resources/bin');

const PLATFORMS = [
  {
    platform: 'darwin',
    arch: 'arm64',
    filename: `act_Darwin_arm64.tar.gz`,
    url: `https://github.com/nektos/act/releases/download/${ACT_VERSION}/act_Darwin_arm64.tar.gz`,
    outputName: 'act-darwin-arm64',
  },
  {
    platform: 'darwin',
    arch: 'x64',
    filename: `act_Darwin_x86_64.tar.gz`,
    url: `https://github.com/nektos/act/releases/download/${ACT_VERSION}/act_Darwin_x86_64.tar.gz`,
    outputName: 'act-darwin-x64',
  },
  {
    platform: 'linux',
    arch: 'x64',
    filename: `act_Linux_x86_64.tar.gz`,
    url: `https://github.com/nektos/act/releases/download/${ACT_VERSION}/act_Linux_x86_64.tar.gz`,
    outputName: 'act-linux-x64',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    filename: `act_Linux_arm64.tar.gz`,
    url: `https://github.com/nektos/act/releases/download/${ACT_VERSION}/act_Linux_arm64.tar.gz`,
    outputName: 'act-linux-arm64',
  },
  {
    platform: 'win32',
    arch: 'x64',
    filename: `act_Windows_x86_64.zip`,
    url: `https://github.com/nektos/act/releases/download/${ACT_VERSION}/act_Windows_x86_64.zip`,
    outputName: 'act-win32-x64.exe',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  Downloading from ${url}...`);
    const file = createWriteStream(dest);

    https.get(url, {
      headers: {
        'User-Agent': 'principal-ade-build-script'
      }
    }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
      }
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function extractTarGz(archivePath, outputPath) {
  console.log(`  Extracting ${archivePath}...`);

  const tempDir = path.join(BINARIES_DIR, 'temp-extract');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Extract the tar.gz
  await tar.extract({
    file: archivePath,
    cwd: tempDir,
  });

  // Find the 'act' binary in the extracted files
  const actBinary = path.join(tempDir, 'act');
  if (fs.existsSync(actBinary)) {
    fs.copyFileSync(actBinary, outputPath);
    fs.chmodSync(outputPath, 0o755);
  } else {
    throw new Error(`Act binary not found in extracted archive`);
  }

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.unlinkSync(archivePath);
}

async function extractZip(archivePath, outputPath) {
  console.log(`  Extracting ${archivePath}...`);

  // For Windows, we'll use a simple approach with unzipper or adm-zip
  // For now, let's use adm-zip if available, otherwise manual
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(archivePath);
    const tempDir = path.join(BINARIES_DIR, 'temp-extract');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    zip.extractAllTo(tempDir, true);

    // Find act.exe
    const actExe = path.join(tempDir, 'act.exe');
    if (fs.existsSync(actExe)) {
      fs.copyFileSync(actExe, outputPath);
    } else {
      throw new Error(`act.exe not found in extracted archive`);
    }

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(archivePath);
  } catch (error) {
    console.error('  adm-zip not available, skipping Windows binary extraction');
    console.error('  Please install adm-zip: npm install --save-dev adm-zip');
    fs.unlinkSync(archivePath);
  }
}

async function downloadBinary(platformConfig) {
  const { platform, arch, filename, url, outputName } = platformConfig;

  console.log(`\nDownloading act for ${platform}-${arch}...`);

  // Create binaries directory if it doesn't exist
  if (!fs.existsSync(BINARIES_DIR)) {
    fs.mkdirSync(BINARIES_DIR, { recursive: true });
  }

  const outputPath = path.join(BINARIES_DIR, outputName);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`  ✓ Already exists: ${outputPath}`);
    return;
  }

  const archivePath = path.join(BINARIES_DIR, filename);

  try {
    // Download the archive
    await download(url, archivePath);

    // Extract based on file type
    if (filename.endsWith('.tar.gz')) {
      await extractTarGz(archivePath, outputPath);
    } else if (filename.endsWith('.zip')) {
      await extractZip(archivePath, outputPath);
    }

    console.log(`  ✓ Successfully downloaded and extracted to ${outputPath}`);
  } catch (error) {
    console.error(`  ✗ Failed to download ${platform}-${arch}:`, error.message);
    // Don't fail the entire build if one platform fails
  }
}

async function main() {
  console.log(`Downloading act binaries (version ${ACT_VERSION})...`);
  console.log(`Target directory: ${BINARIES_DIR}\n`);

  // Download all binaries
  for (const platformConfig of PLATFORMS) {
    await downloadBinary(platformConfig);
  }

  console.log('\n✓ Act binaries download complete!');
  console.log('\nDownloaded binaries:');

  if (fs.existsSync(BINARIES_DIR)) {
    const files = fs.readdirSync(BINARIES_DIR);
    files.forEach(file => {
      const filePath = path.join(BINARIES_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  - ${file} (${sizeMB} MB)`);
    });
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { downloadBinary, PLATFORMS };

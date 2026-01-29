#!/usr/bin/env node
/**
 * Download OpenTelemetry Collector binaries for all platforms
 *
 * This script downloads the OTEL Collector binaries and places them in the
 * resources/bin directory to be bundled with the application.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const { createGunzip } = require('zlib');
const tar = require('tar');

const OTEL_VERSION = 'v0.144.0';
const OTEL_VERSION_NUM = '0.144.0'; // Version without 'v' prefix
const BINARIES_DIR = path.join(__dirname, '../resources/bin');

const PLATFORMS = [
  {
    platform: 'darwin',
    arch: 'arm64',
    filename: `otelcol-contrib_${OTEL_VERSION_NUM}_darwin_arm64.tar.gz`,
    url: `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/${OTEL_VERSION}/otelcol-contrib_${OTEL_VERSION_NUM}_darwin_arm64.tar.gz`,
    outputName: 'otelcol_darwin_arm64',
    binaryInArchive: 'otelcol-contrib', // Name of the binary inside the archive
  },
  {
    platform: 'darwin',
    arch: 'x64',
    filename: `otelcol-contrib_${OTEL_VERSION_NUM}_darwin_amd64.tar.gz`,
    url: `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/${OTEL_VERSION}/otelcol-contrib_${OTEL_VERSION_NUM}_darwin_amd64.tar.gz`,
    outputName: 'otelcol_darwin_amd64',
    binaryInArchive: 'otelcol-contrib',
  },
  {
    platform: 'linux',
    arch: 'x64',
    filename: `otelcol-contrib_${OTEL_VERSION_NUM}_linux_amd64.tar.gz`,
    url: `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/${OTEL_VERSION}/otelcol-contrib_${OTEL_VERSION_NUM}_linux_amd64.tar.gz`,
    outputName: 'otelcol_linux_amd64',
    binaryInArchive: 'otelcol-contrib',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    filename: `otelcol-contrib_${OTEL_VERSION_NUM}_linux_arm64.tar.gz`,
    url: `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/${OTEL_VERSION}/otelcol-contrib_${OTEL_VERSION_NUM}_linux_arm64.tar.gz`,
    outputName: 'otelcol_linux_arm64',
    binaryInArchive: 'otelcol-contrib',
  },
  {
    platform: 'win32',
    arch: 'x64',
    filename: `otelcol-contrib_${OTEL_VERSION_NUM}_windows_amd64.tar.gz`,
    url: `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/${OTEL_VERSION}/otelcol-contrib_${OTEL_VERSION_NUM}_windows_amd64.tar.gz`,
    outputName: 'otelcol_windows_amd64.exe',
    binaryInArchive: 'otelcol-contrib.exe',
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
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
      }
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function extractTarGz(archivePath, outputPath, binaryName) {
  const tmpDir = path.join(BINARIES_DIR, 'tmp');

  // Create temp directory
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Extract archive
  await tar.extract({
    file: archivePath,
    cwd: tmpDir,
  });

  // Move binary to final location
  const extractedBinary = path.join(tmpDir, binaryName);
  if (fs.existsSync(extractedBinary)) {
    fs.renameSync(extractedBinary, outputPath);
  } else {
    throw new Error(`Binary ${binaryName} not found in archive`);
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.unlinkSync(archivePath);
}

async function extractZip(archivePath, outputPath, binaryName) {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(archivePath);
    const tmpDir = path.join(BINARIES_DIR, 'tmp');

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    zip.extractAllTo(tmpDir, true);

    // Find the binary
    const extractedBinary = path.join(tmpDir, binaryName);
    if (fs.existsSync(extractedBinary)) {
      fs.copyFileSync(extractedBinary, outputPath);
    } else {
      throw new Error(`Binary ${binaryName} not found in extracted archive`);
    }

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.unlinkSync(archivePath);
  } catch (error) {
    console.error('  adm-zip not available, skipping Windows binary extraction');
    console.error('  Please install adm-zip: npm install --save-dev adm-zip');
    fs.unlinkSync(archivePath);
    throw error;
  }
}

async function downloadBinary(platformConfig) {
  const { platform, arch, url, outputName, filename, binaryInArchive } = platformConfig;
  const outputPath = path.join(BINARIES_DIR, outputName);

  // Check if binary already exists
  if (fs.existsSync(outputPath)) {
    console.log(`✓ ${outputName} already exists, skipping...`);
    return;
  }

  console.log(`\nDownloading ${outputName} (${platform}-${arch})...`);

  try {
    // Download archive to temp location
    const archivePath = path.join(BINARIES_DIR, filename);
    await download(url, archivePath);

    console.log(`  Extracting binary...`);

    // Extract based on file type
    if (filename.endsWith('.tar.gz')) {
      await extractTarGz(archivePath, outputPath, binaryInArchive);
    } else if (filename.endsWith('.zip')) {
      await extractZip(archivePath, outputPath, binaryInArchive);
    } else {
      // Direct binary download (no extraction needed)
      fs.renameSync(archivePath, outputPath);
    }

    // Make executable on Unix-like systems
    if (platform !== 'win32') {
      fs.chmodSync(outputPath, 0o755);
    }

    console.log(`✓ ${outputName} extracted successfully`);
  } catch (err) {
    console.error(`✗ Failed to download ${outputName}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('======================================');
  console.log('OpenTelemetry Collector Binary Downloader');
  console.log(`Version: ${OTEL_VERSION}`);
  console.log('======================================\n');

  // Ensure binaries directory exists
  if (!fs.existsSync(BINARIES_DIR)) {
    console.log(`Creating directory: ${BINARIES_DIR}`);
    fs.mkdirSync(BINARIES_DIR, { recursive: true });
  }

  // Download all binaries
  for (const platformConfig of PLATFORMS) {
    try {
      await downloadBinary(platformConfig);
    } catch (err) {
      console.error(`Failed to download binary for ${platformConfig.platform}-${platformConfig.arch}`);
      process.exit(1);
    }
  }

  console.log('\n======================================');
  console.log('✓ All binaries downloaded successfully!');
  console.log('======================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

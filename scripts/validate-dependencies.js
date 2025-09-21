#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read both package.json files
const rootPkgPath = path.join(__dirname, '..', 'package.json');
const releasePkgPath = path.join(__dirname, '..', 'release', 'app', 'package.json');

if (!fs.existsSync(releasePkgPath)) {
  console.log('⚠️  Release package.json not found at:', releasePkgPath);
  console.log('   Make sure release/app/package.json exists before running this script.');
  process.exit(1);
}

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const releasePkg = JSON.parse(fs.readFileSync(releasePkgPath, 'utf8'));

// Get all imports from source files using multiple patterns
// Files to scan (moved to module scope for summary)
let filesToScan = [];

const findImports = () => {
  const imports = new Set();
  const srcDir = path.join(__dirname, '..', 'src');

  // Reset files to scan
  filesToScan = [];

  const scanDirectory = (dir) => {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip test, spec, example, and mock directories
        if (file.includes('test') ||
            file.includes('spec') ||
            file.includes('example') ||
            file.includes('mock') ||
            file === '__tests__' ||
            file === '__mocks__' ||
            filePath.includes('vscode-extension-example')) {
          continue;
        }
        scanDirectory(filePath);
      } else if (file.match(/\.(ts|tsx|js|jsx)$/) &&
                 !file.includes('.test.') &&
                 !file.includes('.spec.') &&
                 !file.includes('.example.') &&
                 !file.includes('.mock.')) {
        filesToScan.push(filePath);
      }
    }
  };

  scanDirectory(srcDir);

  // Process each file
  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Normalize content to handle multi-line imports
    // Remove comments and normalize whitespace for better pattern matching
    const normalizedContent = content
      .replace(/\/\/.*$/gm, '')           // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove block comments
      .replace(/\s+/g, ' ');               // Normalize whitespace

    // Multiple regex patterns to catch different import styles
    const patterns = [
      // From clause patterns (handles multi-line imports better)
      /from\s+['"]([^'"]+)['"]/g,

      // Dynamic imports: import('package')
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,

      // Require statements: require('package')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    // First process normalized content for from clauses
    for (const pattern of patterns) {
      let match;
      const searchContent = pattern === patterns[0] ? normalizedContent : content;
      while ((match = pattern.exec(searchContent)) !== null) {
        const importPath = match[1];

        // Skip template literals and dynamic imports
        if (importPath.includes('${') || importPath.includes('$')) {
          continue;
        }

        // Only track external packages (not relative imports)
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          // Extract package name (handle scoped packages)
          const packageName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0];

          imports.add(packageName);
        }
      }
    }
  }

  return imports;
};

// Node.js built-in modules (extended list)
const builtinModules = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
]);

console.log('🔍 Scanning source files for imports...\n');
const usedImports = findImports();

// Get all dependencies
const rootDeps = {
  ...rootPkg.dependencies,
  ...rootPkg.peerDependencies
};

const releaseDeps = {
  ...releasePkg.dependencies,
  ...releasePkg.peerDependencies
};

// Known false positives and build-time only dependencies
const allowedDevDeps = new Set([
  'typescript',     // Type definitions, not needed at runtime
  'globby',         // Used in build scripts
  '@types/node',    // Type definitions
  '@types/react',   // Type definitions
]);

const knownFalsePositives = new Set([
  'chai',                  // Test framework
  'fs-extra',              // May be in conditional imports
  'lodash',                // May be in optional imports
  'electron-cli-bridge',   // May be in optional imports
  'vscode',                // VSCode extension example code
]);

// Categorize findings
const missingInRelease = [];
const missingEverywhere = [];
const onlyInDevDeps = [];

for (const packageName of usedImports) {
  // Skip built-in modules
  if (builtinModules.has(packageName) || packageName.startsWith('node:')) {
    continue;
  }

  // Skip electron
  if (packageName === 'electron' || packageName.startsWith('electron/')) {
    continue;
  }

  // Skip known false positives
  if (knownFalsePositives.has(packageName)) {
    continue;
  }

  const inRoot = rootDeps[packageName];
  const inRelease = releaseDeps[packageName];
  const inDevDeps = rootPkg.devDependencies?.[packageName];

  if (inRoot && !inRelease) {
    missingInRelease.push({
      name: packageName,
      version: inRoot
    });
  } else if (!inRoot && !inRelease && !inDevDeps) {
    missingEverywhere.push(packageName);
  } else if (!inRoot && !inRelease && inDevDeps && !allowedDevDeps.has(packageName)) {
    onlyInDevDeps.push({
      name: packageName,
      version: inDevDeps
    });
  }
}

// Sort for consistent output
missingInRelease.sort((a, b) => a.name.localeCompare(b.name));
missingEverywhere.sort();
onlyInDevDeps.sort((a, b) => a.name.localeCompare(b.name));

// Report results
console.log('='.repeat(70));
console.log('DEPENDENCY VALIDATION REPORT');
console.log('='.repeat(70) + '\n');

let hasErrors = false;

if (missingInRelease.length > 0) {
  hasErrors = true;
  console.log('❌ MISSING IN release/app/package.json');
  console.log('   These packages are in root package.json but missing from release:\n');

  for (const dep of missingInRelease) {
    console.log(`   • ${dep.name} (${dep.version})`);
  }

  console.log('\n   To fix, add to release/app/package.json:\n');
  const depsObject = {};
  for (const dep of missingInRelease) {
    depsObject[dep.name] = dep.version;
  }
  console.log(JSON.stringify(depsObject, null, 2));
  console.log();
}

if (missingEverywhere.length > 0) {
  hasErrors = true;
  console.log('⚠️  MISSING EVERYWHERE');
  console.log('   These packages are imported but not in any package.json:\n');

  for (const packageName of missingEverywhere) {
    console.log(`   • ${packageName}`);
  }
  console.log();
}

if (onlyInDevDeps.length > 0) {
  console.log('⚠️  IN DEVDEPENDENCIES ONLY');
  console.log('   These are in devDependencies but used in production code:');
  console.log('   (May be intentional for build-time only packages)\n');

  for (const dep of onlyInDevDeps) {
    console.log(`   • ${dep.name} (${dep.version})`);
  }
  console.log();
}

if (!hasErrors) {
  console.log('✅ All production dependencies are properly configured!');
  console.log(`\n📊 Summary: Found ${usedImports.size} unique imports across ${filesToScan.length || 'all'} files`);
  process.exit(0);
} else {
  console.log('Please fix the issues above before packaging the application.');
  console.log('\nRun this check with: node scripts/validate-dependencies.js');
  process.exit(1);
}
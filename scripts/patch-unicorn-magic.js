#!/usr/bin/env node

/**
 * Patches unicorn-magic to add missing "./node" subpath export
 * This fixes compatibility with globby v16+
 *
 * The issue: unicorn-magic 0.3.0 uses conditional exports ("node": {...})
 * but globby tries to import "unicorn-magic/node" which requires
 * subpath exports ("./node": {...})
 */

const fs = require('fs');
const path = require('path');

// Patch both root and release/app node_modules
const locations = [
  path.join(__dirname, '..', 'node_modules', 'unicorn-magic', 'package.json'),
  path.join(__dirname, '..', 'release', 'app', 'node_modules', 'unicorn-magic', 'package.json'),
];

function patchPackage(pkgPath) {
  if (!fs.existsSync(pkgPath)) {
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Check if already patched (has subpath exports structure)
  if (pkg.exports && pkg.exports['.'] && pkg.exports['./node']) {
    return 'already';
  }

  // Convert conditional exports to subpath exports
  // Node.js doesn't allow mixing "." prefixed keys with non-"." prefixed keys
  if (pkg.exports) {
    pkg.exports = {
      '.': {
        node: {
          types: './node.d.ts',
          import: './node.js',
          default: './node.js'
        },
        default: {
          types: './default.d.ts',
          import: './default.js',
          default: './default.js'
        }
      },
      './node': {
        types: './node.d.ts',
        import: './node.js',
        default: './node.js'
      },
      './default': {
        types: './default.d.ts',
        import: './default.js',
        default: './default.js'
      }
    };

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
    return 'patched';
  }
  return false;
}

let patchedCount = 0;
for (const pkgPath of locations) {
  const result = patchPackage(pkgPath);
  if (result === 'patched') {
    console.log(`✓ Patched unicorn-magic: ${pkgPath}`);
    patchedCount++;
  } else if (result === 'already') {
    console.log(`✓ Already patched: ${pkgPath}`);
  }
}

if (patchedCount === 0 && !locations.some(p => fs.existsSync(p))) {
  console.log('unicorn-magic not found, skipping patch');
}

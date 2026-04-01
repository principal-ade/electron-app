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

const pkgPath = path.join(__dirname, '..', 'node_modules', 'unicorn-magic', 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('unicorn-magic not found, skipping patch');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Check if already patched (has subpath exports structure)
if (pkg.exports && pkg.exports['.'] && pkg.exports['./node']) {
  console.log('✓ unicorn-magic already patched');
  process.exit(0);
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
  console.log('✓ Patched unicorn-magic exports');
}

#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Helper function to execute commands
function exec(command, cwd, env = {}) {
  console.log(`📍 Running: ${command}`);
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: cwd || process.cwd(),
      shell: true,
      env: { ...process.env, ...env }
    });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    return false;
  }
}

console.log('🧹 Starting simple install process...\n');

// Get paths
const electronAppDir = process.cwd();
const monorepoRoot = path.dirname(electronAppDir);

// Step 1: Install core first with smaller memory allocation
console.log('\n📦 Installing core dependencies...');
const coreDir = path.join(monorepoRoot, 'core');
if (fs.existsSync(coreDir)) {
  // Create placeholder directories
  const coreDistHooks = path.join(coreDir, 'dist', 'hooks');
  const coreDistMcp = path.join(coreDir, 'dist', 'mcp');
  
  fs.mkdirSync(coreDistHooks, { recursive: true });
  fs.mkdirSync(coreDistMcp, { recursive: true });
  
  // Create placeholder files
  fs.writeFileSync(path.join(coreDistHooks, 'agent-hook.js'), '#!/usr/bin/env node\n// Placeholder\n');
  fs.writeFileSync(path.join(coreDistMcp, 'mcp-server.js'), '#!/usr/bin/env node\n// Placeholder\n');
  
  exec('npm ci', coreDir, { NODE_OPTIONS: '--max-old-space-size=4096' });
}

// Step 2: Install electron-react with no workspace deps first
console.log('\n📦 Installing electron-react dependencies...');
exec('npm ci --production', electronAppDir, { NODE_OPTIONS: '--max-old-space-size=8192' });

// Step 4: Install dev dependencies
console.log('\n📦 Installing dev dependencies...');
exec('npm ci', electronAppDir, { NODE_OPTIONS: '--max-old-space-size=8192' });

// Step 5: Install release/app dependencies
console.log('\n📦 Installing release/app dependencies...');
const releaseAppDir = path.join(electronAppDir, 'release', 'app');
exec('npm install --ignore-scripts', releaseAppDir, { NODE_OPTIONS: '--max-old-space-size=4096' });

// Step 6: Rebuild native modules
console.log('\n🔨 Rebuilding native modules...');
exec('npx electron-rebuild --version 37.2.4', electronAppDir, { NODE_OPTIONS: '--max-old-space-size=4096' });

console.log('\n✨ Simple install complete!');
console.log('🚀 You can now run: npm run dev');
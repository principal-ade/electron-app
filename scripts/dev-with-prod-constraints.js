#!/usr/bin/env node

/**
 * Run the app in development mode with production-like constraints.
 * Only clean up process trees started by this launcher.
 */

const { spawn, spawnSync } = require('child_process');
const { constants } = require('os');
const path = require('path');
const fs = require('fs');

const rootPath = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const children = new Set();
let shuttingDown = false;

function signalExitCode(signal) {
  return 128 + (constants.signals[signal] || 1);
}

function stopChild(child) {
  if (!child.pid) return;
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      // Every child starts its own process group, including build stages.
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.warn('Could not stop a development process:', error.message);
    }
  }
}

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down this launcher’s development processes...');
  for (const child of children) stopChild(child);
  children.clear();
}

function shutdown(code) {
  cleanup();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(signalExitCode('SIGINT')));
process.on('SIGTERM', () => shutdown(signalExitCode('SIGTERM')));
process.on('exit', cleanup);

const env = {
  ...process.env,
  NODE_ENV: 'development',
  FORCE_PRODUCTION_PATHS: 'true',
  ELECTRON_DISABLE_SECURITY_WARNINGS: 'false',
  ELECTRON_ENABLE_SANDBOX: 'true',
  ELECTRON_ENABLE_LOGGING: 'false',
  ELECTRON_ENABLE_STACK_DUMPING: 'false',
  NODE_ENV_PACKAGED_SIMULATION: 'true',
};
// Agent/terminal hosts may run inside Electron and export this flag. Inherit
// neither its Node-only mode nor a false-looking value: the flag must be absent.
delete env.ELECTRON_RUN_AS_NODE;

/** Run a stage, preserving signal failures instead of treating null as success. */
function runStage(name, command, args, onSuccess, options = {}) {
  if (shuttingDown) return;
  let child;
  try {
    child = spawn(command, args, {
      env,
      stdio: 'inherit',
      shell: isWindows,
      cwd: rootPath,
      ...options,
      detached: !isWindows,
    });
  } catch (error) {
    console.error(`${name} could not start:`, error.message);
    shutdown(1);
    return;
  }
  children.add(child);
  child.once('error', (error) => {
    if (shuttingDown) return;
    console.error(`${name} could not start:`, error.message);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    // A shell/npm parent can exit while descendants are still alive.
    stopChild(child);
    children.delete(child);
    if (signal || code !== 0) {
      console.error(
        signal
          ? `${name} terminated by ${signal}`
          : `${name} failed with code ${code}`,
      );
      shutdown(signal ? signalExitCode(signal) : (code ?? 1));
      return;
    }
    onSuccess();
  });
}

function startRenderer() {
  console.log('\nStarting development server with production constraints...');
  // The renderer dev server starts main and preload itself. Starting main
  // again creates a second Electron instance and trips the single-instance lock.
  runStage('Renderer dev server', 'npm', ['run', 'start:renderer'], () =>
    shutdown(0),
  );
}

function startDllBuild() {
  console.log('Building DLL files...');
  runStage('DLL build', 'npm', ['run', 'build:dll'], () => {
    console.log('Preparing webpack builds...');
    runStage('Prestart', 'npm', ['run', 'prestart'], startRenderer);
  });
}

console.log('Starting development with production constraints.');
console.log('Sandbox restrictions are enabled, matching the packaged app.');
console.log('Use "npm run dev:unsafe" for unrestricted development.\n');
console.log('Ensuring release/app structure...');

const releaseAppPath = path.join(rootPath, 'release', 'app');
if (!fs.existsSync(releaseAppPath)) {
  fs.mkdirSync(releaseAppPath, { recursive: true });
  const mainPackage = JSON.parse(
    fs.readFileSync(path.join(rootPath, 'package.json')),
  );
  const releasePackage = {
    name: mainPackage.name,
    version: mainPackage.version,
    description: mainPackage.description,
    main: mainPackage.main,
    dependencies: mainPackage.dependencies,
    overrides: mainPackage.overrides,
  };
  fs.writeFileSync(
    path.join(releaseAppPath, 'package.json'),
    JSON.stringify(releasePackage, null, 2),
  );
  runStage(
    'Production deps install',
    'npm',
    ['install', '--omit=dev'],
    () => {
      runStage(
        'Native module rebuild',
        'npx',
        ['electron-rebuild', '--version', '37.2.4'],
        startDllBuild,
        { cwd: releaseAppPath },
      );
    },
    { cwd: releaseAppPath },
  );
} else {
  startDllBuild();
}

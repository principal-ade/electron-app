#!/usr/bin/env node

/**
 * Test script to run the event-worker bundle directly
 * This helps debug issues with the bundle in isolation
 */

const path = require('path');
const { fork } = require('child_process');

console.log('=== Event Worker Bundle Test ===\n');

// Path to the compiled bundle
const bundlePath = path.join(__dirname, '.erb/dll/event-worker.bundle.dev.js');

console.log(`Testing bundle at: ${bundlePath}`);
console.log('Attempting to load bundle directly...\n');

// First, try to require it directly to see if it loads
try {
  console.log('--- Attempting direct require ---');
  const bundle = require(bundlePath);
  console.log('Bundle loaded successfully!');
  console.log('Bundle exports:', Object.keys(bundle));
  console.log('Bundle type:', typeof bundle);
} catch (error) {
  console.error('Failed to require bundle directly:');
  console.error(error.message);
  console.error('\n');
}

// Now try to fork it as a child process (similar to utility process)
console.log('\n--- Attempting to fork as child process ---');

const child = fork(bundlePath, [], {
  silent: false, // Show all output
  env: {
    ...process.env,
    DEBUG_EVENT_SERVER: 'true',
    NODE_ENV: 'development'
  }
});

// Set up event handlers
child.on('spawn', () => {
  console.log('✅ Child process spawned successfully');
});

child.on('error', (error) => {
  console.error('❌ Child process error:', error);
});

child.on('message', (msg) => {
  console.log('📨 Message from child:', JSON.stringify(msg, null, 2));
});

child.stdout?.on('data', (data) => {
  console.log('[STDOUT]', data.toString());
});

child.stderr?.on('data', (data) => {
  console.error('[STDERR]', data.toString());
});

child.on('exit', (code, signal) => {
  console.log(`\nChild process exited with code ${code}, signal ${signal}`);
  process.exit(code || 0);
});

// Give it some time to initialize
setTimeout(() => {
  console.log('\n--- Sending test message to child ---');
  try {
    child.send({ type: 'PING', timestamp: Date.now() });
    console.log('Test message sent');
  } catch (error) {
    console.error('Failed to send test message:', error);
  }
}, 2000);

// Keep the parent process alive
setTimeout(() => {
  console.log('\n--- Test timeout reached, exiting ---');
  child.kill();
  process.exit(0);
}, 10000);

console.log('\nWaiting for child process to initialize...');
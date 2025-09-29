#!/usr/bin/env node

/**
 * Test script for git event library integration
 * Usage: node test-git-events.js /path/to/repo
 */

const { RepositoryMonitor } = require('@principal-ai/repository-monitoring');
const path = require('path');

const repoPath = process.argv[2] || process.cwd();

console.log('Testing git events for repository:', repoPath);

async function testGitEvents() {
  try {
    // Create a repository monitor with options
    const monitor = new RepositoryMonitor({
      repoPath,
      watch: true,
      debounceMs: 500,
    });

    // Subscribe to specific git event types
    const handleEvent = (event) => {
      console.log('\n🎉 Git Event Detected!');
      console.log('  Type:', event.type);
      console.log('  Branch:', event.branch);
      console.log('  SHA:', event.shortSha);
      console.log('  Full SHA:', event.fullSha);
      console.log('  Dirty:', event.isDirty);
      console.log('  Timestamp:', new Date(event.timestamp).toISOString());
      console.log('  Raw event:', JSON.stringify(event, null, 2));
    };

    monitor.on('commit', handleEvent);
    monitor.on('branch-switch', handleEvent);
    monitor.on('merge', handleEvent);
    monitor.on('dirty-state-change', handleEvent);

    monitor.on('error', (error) => {
      console.error('Monitor error:', error);
    });

    // Start watching (uses 'start' not 'startWatching')
    console.log('\nStarting git event monitoring...');
    await monitor.start();

    console.log('✅ Monitoring started successfully!');
    console.log('\nTry these actions to trigger events:');
    console.log('  1. Make a commit: git commit -am "test"');
    console.log('  2. Switch branches: git checkout -b test-branch');
    console.log('  3. Stage/unstage files: git add/reset file.txt');
    console.log('  4. Perform a merge: git merge branch');
    console.log('\nPress Ctrl+C to stop monitoring\n');

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n\nStopping monitor...');
      await monitor.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
testGitEvents();
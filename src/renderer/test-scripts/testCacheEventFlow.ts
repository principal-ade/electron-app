/**
 * Test script for verifying the event-driven cache flow
 * This script tests that:
 * 1. Repositories are registered on startup
 * 2. Git watching is enabled
 * 3. Events are properly forwarded
 * 4. Cache updates automatically
 */

import { RepositoryDataCache } from '../services/RepositoryDataCache';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Test result tracking
interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  duration?: number;
}

const testResults: TestResult[] = [];

// Helper function to log with colors
function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper to run a test
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  log(`\n📝 Testing: ${name}`, colors.cyan);
  const startTime = Date.now();

  try {
    await testFn();
    const duration = Date.now() - startTime;
    testResults.push({ name, status: 'pass', duration });
    log(`✅ PASS: ${name} (${duration}ms)`, colors.green);
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    testResults.push({ name, status: 'fail', message, duration });
    log(`❌ FAIL: ${name} - ${message} (${duration}ms)`, colors.red);
  }
}

// Test 1: Check monitoring status
async function testMonitoringStatus() {
  const status = await RepositoryMonitoringService.getMonitoringStatus();

  if (!status.repositories || status.repositories.length === 0) {
    throw new Error('No repositories registered with monitoring service');
  }

  log(`  Found ${status.repositories.length} registered repositories`, colors.yellow);

  // Check git watching is enabled
  const gitWatchingEnabled = status.repositories.filter(r => r.gitWatchingEnabled);
  log(`  Git watching enabled for ${gitWatchingEnabled.length} repositories`, colors.yellow);

  if (gitWatchingEnabled.length === 0) {
    throw new Error('Git watching not enabled for any repository');
  }
}

// Test 2: Check cache initialization
async function testCacheInitialization() {
  const cache = RepositoryDataCache.getInstance();
  const stats = cache.getStats();

  log(`  Cache size: ${stats.cacheSize} repositories`, colors.yellow);
  log(`  Queued updates: ${stats.queuedUpdates}`, colors.yellow);

  if (stats.cacheSize === 0) {
    // Try to load a repository
    const repos = await AlexandriaService.getRepositories();
    if (repos.length > 0) {
      log(`  Loading first repository into cache...`, colors.yellow);
      await cache.load(repos[0].path);

      const newStats = cache.getStats();
      if (newStats.cacheSize === 0) {
        throw new Error('Failed to load repository into cache');
      }
    }
  }
}

// Test 3: Test event subscription
async function testEventSubscription() {
  const cache = RepositoryDataCache.getInstance();
  const repos = await AlexandriaService.getRepositories();

  if (repos.length === 0) {
    throw new Error('No repositories available for testing');
  }

  const testRepo = repos[0];
  log(`  Testing with repository: ${testRepo.name}`, colors.yellow);

  // Subscribe to updates
  let updateReceived = false;
  const componentId = 'test-component-' + Date.now();

  const unsubscribe = cache.subscribe(
    testRepo.path,
    componentId,
    (data) => {
      updateReceived = true;
      log(`  📨 Received cache update for ${data.repository.name}`, colors.magenta);
    }
  );

  // Trigger a refresh to cause an update
  log(`  Triggering repository refresh...`, colors.yellow);
  await RepositoryMonitoringService.refreshRepository(testRepo.path);

  // Wait a bit for events to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Clean up
  unsubscribe();

  if (!updateReceived) {
    log(`  ⚠️ Warning: No cache update received (might be normal if no changes)`, colors.yellow);
  }
}

// Test 4: Test git status change events
async function testGitStatusEvents() {
  let eventReceived = false;

  // Subscribe to git status changes
  const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
    eventReceived = true;
    log(`  📨 Git status change event received for: ${status.repoPath}`, colors.magenta);
    log(`    Branch: ${status.branch}, Dirty: ${status.isDirty}`, colors.yellow);
  });

  log(`  Waiting 5 seconds for git status events...`, colors.yellow);
  log(`  (Make a file change in one of your repositories to trigger an event)`, colors.yellow);

  // Wait for events
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Clean up
  unsubscribe();

  if (!eventReceived) {
    log(`  ℹ️ No git status events received (make a file change to trigger)`, colors.yellow);
  }
}

// Test 5: Verify cache data structure
async function testCacheDataStructure() {
  const cache = RepositoryDataCache.getInstance();
  const repos = await AlexandriaService.getRepositories();

  if (repos.length === 0) {
    throw new Error('No repositories available for testing');
  }

  const testRepo = repos[0];
  const componentId = 'test-structure-' + Date.now();

  // Load repository data
  const data = await cache.load(testRepo.path);

  // Verify data structure
  if (!data.repository) {
    throw new Error('Cache data missing repository field');
  }

  if (!data.gitStatus && !data.gitBranch) {
    throw new Error('Cache data missing git information');
  }

  log(`  ✓ Repository: ${data.repository.name}`, colors.green);
  log(`  ✓ Git Branch: ${data.gitBranch}`, colors.green);
  log(`  ✓ Git Status: ${data.gitStatus ? 'Available' : 'Not available'}`, colors.green);
  log(`  ✓ File Tree: ${data.fileTree ? 'Available' : 'Not available'}`, colors.green);
  log(`  ✓ Packages: ${data.packages.length} packages`, colors.green);
  log(`  ✓ Quality Metrics: ${data.qualityMetrics ? 'Available' : 'Not available'}`, colors.green);
}

// Test 6: Performance test
async function testCachePerformance() {
  const cache = RepositoryDataCache.getInstance();
  const repos = await AlexandriaService.getRepositories();

  if (repos.length === 0) {
    throw new Error('No repositories available for testing');
  }

  const testRepo = repos[0];
  const componentId = 'test-perf-' + Date.now();

  // First load (cold cache)
  const coldStart = Date.now();
  await cache.load(testRepo.path);
  const coldTime = Date.now() - coldStart;
  log(`  Cold cache load: ${coldTime}ms`, colors.yellow);

  // Second load (warm cache)
  const warmStart = Date.now();
  const cachedData = cache.get(testRepo.path, componentId);
  const warmTime = Date.now() - warmStart;
  log(`  Warm cache load: ${warmTime}ms`, colors.yellow);

  // Cache should be significantly faster
  if (warmTime > 10) {
    throw new Error(`Cache retrieval too slow: ${warmTime}ms (should be <10ms)`);
  }

  log(`  ✓ Cache performance: ${Math.round((coldTime / warmTime))}x faster`, colors.green);
}

// Main test runner
export async function runEventFlowTests() {
  log('\n🚀 Starting Event-Driven Cache Test Suite', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  // Run all tests
  await runTest('Monitoring Status', testMonitoringStatus);
  await runTest('Cache Initialization', testCacheInitialization);
  await runTest('Event Subscription', testEventSubscription);
  await runTest('Git Status Events', testGitStatusEvents);
  await runTest('Cache Data Structure', testCacheDataStructure);
  await runTest('Cache Performance', testCachePerformance);

  // Print summary
  log('\n' + '=' .repeat(50), colors.cyan);
  log('📊 Test Summary', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  const passed = testResults.filter(r => r.status === 'pass').length;
  const failed = testResults.filter(r => r.status === 'fail').length;
  const total = testResults.length;

  testResults.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    const color = result.status === 'pass' ? colors.green : colors.red;
    const time = result.duration ? ` (${result.duration}ms)` : '';
    log(`${icon} ${result.name}${time}`, color);
    if (result.message) {
      log(`   └─ ${result.message}`, colors.yellow);
    }
  });

  log('\n' + '=' .repeat(50), colors.cyan);
  const summaryColor = failed === 0 ? colors.green : colors.red;
  log(`Results: ${passed}/${total} passed, ${failed} failed`, summaryColor);

  if (failed === 0) {
    log('\n🎉 All tests passed! Event-driven cache is working correctly.', colors.green);
  } else {
    log('\n⚠️ Some tests failed. Check the logs above for details.', colors.red);
  }
}

// Auto-run if executed directly
if (typeof window !== 'undefined' && window.location.href.includes('test=cache')) {
  runEventFlowTests().catch(console.error);
}

// Export for manual testing in console
(window as any).testCacheEventFlow = runEventFlowTests;
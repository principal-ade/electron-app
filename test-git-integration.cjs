/**
 * Test script for git integration using electron-cli-bridge
 */

const { electronCLI } = require('./dist/main/electron-cli-bridge/index.js');

async function testGitIntegration() {
  console.log('🧪 Testing Git Integration with electron-cli-bridge\n');
  
  try {
    // Initialize
    console.log('1. Initializing electron-cli-bridge...');
    await electronCLI.initialize();
    console.log('   ✅ Initialized successfully\n');
    
    // Test git availability
    console.log('2. Checking git availability...');
    const gitAvailable = await electronCLI.git.checkAvailability();
    console.log(`   ✅ Git available: ${gitAvailable.available}, version: ${gitAvailable.version}\n`);
    
    // Test finding git root
    console.log('3. Finding git root...');
    const gitRoot = await electronCLI.git.findGitRoot(process.cwd());
    console.log(`   ✅ Git root: ${gitRoot}\n`);
    
    // Test getting current branch
    console.log('4. Getting current branch...');
    const branch = await electronCLI.git.getCurrentBranch(process.cwd());
    console.log(`   ✅ Current branch: ${branch}\n`);
    
    // Test getting status
    console.log('5. Getting git status...');
    const status = await electronCLI.git.getStatus(process.cwd());
    console.log(`   ✅ Status - Staged: ${status.staged.length}, Unstaged: ${status.unstaged.length}, Untracked: ${status.untracked.length}\n`);
    
    // Test getting remotes
    console.log('6. Getting remotes...');
    const remotes = await electronCLI.git.getRemotes(process.cwd());
    console.log(`   ✅ Found ${remotes.length} remote(s):`);
    remotes.forEach(r => console.log(`      - ${r.name}: ${r.url}`));
    console.log();
    
    // Test getting branches
    console.log('7. Getting local branches...');
    const localBranches = await electronCLI.git.getLocalBranches(process.cwd());
    console.log(`   ✅ Found ${localBranches.length} local branches`);
    console.log(`      First 5: ${localBranches.slice(0, 5).join(', ')}\n`);
    
    // Test getting current commit
    console.log('8. Getting current commit...');
    const commit = await electronCLI.git.getCurrentCommit(process.cwd());
    console.log(`   ✅ Current commit: ${commit?.substring(0, 8)}\n`);
    
    console.log('🎉 All tests passed successfully!');
    
    // Cleanup
    await electronCLI.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await electronCLI.shutdown();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testGitIntegration();
}
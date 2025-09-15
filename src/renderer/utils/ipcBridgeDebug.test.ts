/**
 * Test to debug the IPC bridge availability in Jest environment
 */

describe('IPC Bridge Debug', () => {
  it('should check if window.mainProcess exists in Jest environment', () => {
    console.log('=== Window Object Analysis ===');
    console.log('typeof window:', typeof window);
    console.log('window keys:', Object.keys(window).slice(0, 20)); // First 20 keys
    
    // Check if mainProcess exists
    console.log('window.mainProcess exists:', 'mainProcess' in window);
    console.log('window.mainProcess type:', typeof (window as any).mainProcess);
    
    if ((window as any).mainProcess) {
      console.log('window.mainProcess keys:', Object.keys((window as any).mainProcess));
      
      // Check fileSystem specifically
      console.log('window.mainProcess.fileSystem exists:', 'fileSystem' in (window as any).mainProcess);
      console.log('window.mainProcess.fileSystem type:', typeof (window as any).mainProcess?.fileSystem);
      
      if ((window as any).mainProcess?.fileSystem) {
        console.log('fileSystem methods:', Object.keys((window as any).mainProcess.fileSystem));
      }
    } else {
      console.log('❌ window.mainProcess is not available in Jest environment');
    }
    
    // Check other window objects that might be available
    const expectedProps = ['electron', 'appName', '__preloadTest'];
    expectedProps.forEach(prop => {
      console.log(`window.${prop} exists:`, prop in window, typeof (window as any)[prop]);
    });
    
    expect(typeof window).toBe('object');
  });
  
  it('should check what happens when we try to use window.mainProcess.fileSystem', () => {
    console.log('=== Direct Usage Test ===');
    
    try {
      // This should be the exact same code that fails in ElectronFileSystemAdapter
      const fileSystemService = (window as any).mainProcess?.fileSystem;
      console.log('Retrieved fileSystem service:', typeof fileSystemService);
      
      if (fileSystemService) {
        console.log('fileSystem service methods:', Object.keys(fileSystemService));
        
        // Try to call readDirectory like the adapter does
        if (typeof fileSystemService.readDirectory === 'function') {
          console.log('✅ readDirectory method is available');
        } else {
          console.log('❌ readDirectory method is not available');
        }
      } else {
        console.log('❌ fileSystem service is not available');
        console.log('This explains why ElectronFileSystemAdapter fails!');
      }
    } catch (error) {
      console.log('❌ Error accessing window.mainProcess.fileSystem:', error);
    }
  });
  
  it('should check Jest environment globals', () => {
    console.log('=== Jest Environment Analysis ===');
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('process.env.TEST_ENV:', process.env.TEST_ENV);
    console.log('typeof global:', typeof global);
    console.log('typeof process:', typeof process);
    
    // Check if we're in jsdom environment
    console.log('window.navigator.userAgent:', (window as any).navigator?.userAgent);
    
    // Check if electron APIs are mocked
    console.log('Has __mocks__ directory?', process.env.PWD?.includes('__mocks__'));
    
    expect(true).toBe(true);
  });
  
  it('should simulate what the actual Electron app would have', () => {
    console.log('=== Simulating Electron Environment ===');
    
    // Create a mock window.mainProcess for testing
    const mockMainProcess = {
      fileSystem: {
        readFile: jest.fn().mockResolvedValue({ content: 'mock file content', filePath: '/mock/path' }),
        readDirectory: jest.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
        getFileStats: jest.fn().mockResolvedValue({ size: 100, isDirectory: false, lastModified: new Date() }),
        buildFilteredFileTree: jest.fn().mockResolvedValue({ paths: ['/mock/path/file1.ts'], stats: [] })
      }
    };
    
    // Temporarily assign to window
    (window as any).mainProcess = mockMainProcess;
    
    console.log('✅ Mock mainProcess assigned to window');
    console.log('window.mainProcess.fileSystem methods:', Object.keys((window as any).mainProcess.fileSystem));
    
    // Now test what would happen
    try {
      const fileSystemService = (window as any).mainProcess.fileSystem;
      console.log('✅ Successfully accessed mocked fileSystem service');
      console.log('readDirectory available:', typeof fileSystemService.readDirectory === 'function');
      
      if (typeof fileSystemService.readDirectory === 'function') {
        console.log('✅ This would work in the actual Electron app!');
      }
    } catch (error) {
      console.log('❌ Even with mock, still failing:', error);
    }
    
    // Clean up
    delete (window as any).mainProcess;
  });
});
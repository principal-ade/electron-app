/**
 * Tests for file system handlers - especially the critical filtering logic
 */
import { ElectronFileSystemAdapter as FileSystemHandlerService } from './fileSystemHandlers';
// Mock the imports
jest.mock('fdir');
jest.mock('ignore');
jest.mock('fs');
describe('FileSystemHandlerService', () => {
    let service;
    beforeEach(() => {
        service = new FileSystemHandlerService();
    });
});

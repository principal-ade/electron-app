// Safe window API access utilities
// Import individual service modules
export { shell } from './ipcServices/shell';
export { typeExtraction } from './ipcServices/typeExtraction';
export { typeSchema } from './ipcServices/typeSchema';
export { mcp } from './ipcServices/mcp';
export { isElectronEnvironment, waitForWindowAPIs } from './ipcServices/utils';
// All services have been moved to individual files in ./ipcServices/
// This file now re-exports them for backward compatibility

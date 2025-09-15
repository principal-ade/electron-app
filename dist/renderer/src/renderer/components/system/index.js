// Full system resource widget (both memory and disk)
export { SystemResourceWidget, useSystemInfo } from './SystemResourceWidget';
// Lightweight memory-only widget
export { MemoryWidget, useMemoryInfo } from './MemoryWidget';
// Disk space widget (more expensive, use sparingly)
export { DiskSpaceWidget, useDiskInfo } from './DiskSpaceWidget';

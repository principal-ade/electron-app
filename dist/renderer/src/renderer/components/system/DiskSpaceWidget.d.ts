import React from 'react';
export interface DiskInfo {
    totalDisk: number;
    freeDisk: number;
}
interface DiskSpaceWidgetProps {
    compact?: boolean;
    showWarning?: boolean;
    warningThreshold?: number;
    refreshInterval?: number;
    onDiskChange?: (info: DiskInfo) => void;
    additionalUsage?: {
        label: string;
        sizeGB: number;
        color?: string;
    }[];
    cacheTimeout?: number;
}
export declare const DiskSpaceWidget: React.FC<DiskSpaceWidgetProps>;
export declare const useDiskInfo: (refreshInterval?: number, cacheTimeout?: number) => {
    diskInfo: DiskInfo | null;
    loading: boolean;
};
export {};
//# sourceMappingURL=DiskSpaceWidget.d.ts.map
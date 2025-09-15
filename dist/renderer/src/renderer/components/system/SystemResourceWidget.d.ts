import React from 'react';
export interface SystemInfo {
    totalMemory: number;
    freeMemory: number;
    totalDisk: number;
    freeDisk: number;
    platform: string;
    arch: string;
    cpus?: number;
    osVersion?: string;
}
interface SystemResourceWidgetProps {
    showMemory?: boolean;
    showDisk?: boolean;
    showRecommendations?: boolean;
    compact?: boolean;
    refreshInterval?: number;
    onSystemInfoChange?: (info: SystemInfo) => void;
    additionalDiskUsage?: {
        label: string;
        sizeGB: number;
        color?: string;
    }[];
    cacheTimeout?: number;
}
export declare const SystemResourceWidget: React.FC<SystemResourceWidgetProps>;
export declare const useSystemInfo: (refreshInterval?: number, cacheTimeout?: number) => {
    systemInfo: SystemInfo | null;
    loading: boolean;
    error: string | null;
};
export {};
//# sourceMappingURL=SystemResourceWidget.d.ts.map
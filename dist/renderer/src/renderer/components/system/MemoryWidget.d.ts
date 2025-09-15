import React from 'react';
export interface MemoryInfo {
    totalMemory: number;
    freeMemory: number;
    cpus?: number;
    platform?: string;
    arch?: string;
}
interface MemoryWidgetProps {
    compact?: boolean;
    showWarning?: boolean;
    warningThreshold?: number;
    refreshInterval?: number;
    onMemoryChange?: (info: MemoryInfo) => void;
    cacheTimeout?: number;
}
export declare const MemoryWidget: React.FC<MemoryWidgetProps>;
export declare const useMemoryInfo: (refreshInterval?: number, cacheTimeout?: number) => {
    memoryInfo: MemoryInfo | null;
    loading: boolean;
};
export {};
//# sourceMappingURL=MemoryWidget.d.ts.map
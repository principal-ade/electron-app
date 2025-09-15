import React from 'react';
interface MetricBoxProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    isExceeded?: boolean;
    threshold?: number;
    customColor?: string;
    onClick?: () => void;
    isClickable?: boolean;
}
export declare const MetricBox: React.FC<MetricBoxProps>;
export {};
//# sourceMappingURL=MetricBox.d.ts.map
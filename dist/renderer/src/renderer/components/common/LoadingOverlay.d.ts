import React from 'react';
interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
    fullScreen?: boolean;
    blur?: boolean;
    opacity?: number;
    spinnerSize?: number;
    backgroundColor?: string;
    children?: React.ReactNode;
}
export declare const LoadingOverlay: React.FC<LoadingOverlayProps>;
interface LoadingSpinnerProps {
    size?: number;
    color?: string;
    className?: string;
}
export declare const LoadingSpinner: React.FC<LoadingSpinnerProps>;
interface LoadingDotsProps {
    color?: string;
    size?: number;
}
export declare const LoadingDots: React.FC<LoadingDotsProps>;
interface SkeletonLoaderProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    animate?: boolean;
}
export declare const SkeletonLoader: React.FC<SkeletonLoaderProps>;
interface ProgressBarProps {
    progress: number;
    height?: number;
    color?: string;
    backgroundColor?: string;
    showPercentage?: boolean;
    animated?: boolean;
}
export declare const ProgressBar: React.FC<ProgressBarProps>;
export default LoadingOverlay;
//# sourceMappingURL=LoadingOverlay.d.ts.map
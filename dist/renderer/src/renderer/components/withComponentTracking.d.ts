import React from 'react';
interface ComponentTrackingProps {
    'data-component-name'?: string;
    'data-component-path'?: string;
}
/**
 * HOC to add component tracking data attributes
 * This helps the feedback system identify which component was right-clicked
 */
export declare function withComponentTracking<P extends object>(Component: React.ComponentType<P>, componentName: string, componentPath?: string): React.ForwardRefExoticComponent<React.PropsWithoutRef<P & ComponentTrackingProps> & React.RefAttributes<any>>;
/**
 * Hook version for functional components
 */
export declare function useComponentTracking(componentName: string, componentPath?: string): {
    'data-component-name': string;
    'data-component-path': string;
};
export {};
//# sourceMappingURL=withComponentTracking.d.ts.map
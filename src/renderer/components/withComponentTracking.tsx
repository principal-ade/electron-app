import React from 'react';

interface ComponentTrackingProps {
  'data-component-name'?: string;
  'data-component-path'?: string;
}

/**
 * HOC to add component tracking data attributes
 * This helps the feedback system identify which component was right-clicked
 */
export function withComponentTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  componentPath?: string
) {
  return React.forwardRef<any, P & ComponentTrackingProps>((props, ref) => {
    return (
      <div
        data-component-name={componentName}
        data-component-path={componentPath || `Unknown path for ${componentName}`}
        style={{ display: 'contents' }} // This makes the wrapper div invisible
      >
        <Component {...props} ref={ref} />
      </div>
    );
  });
}

/**
 * Hook version for functional components
 */
export function useComponentTracking(componentName: string, componentPath?: string) {
  return {
    'data-component-name': componentName,
    'data-component-path': componentPath || `Unknown path for ${componentName}`,
  };
}
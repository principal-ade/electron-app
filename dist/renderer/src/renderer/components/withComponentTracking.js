import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
/**
 * HOC to add component tracking data attributes
 * This helps the feedback system identify which component was right-clicked
 */
export function withComponentTracking(Component, componentName, componentPath) {
    return React.forwardRef((props, ref) => {
        return (_jsx("div", { "data-component-name": componentName, "data-component-path": componentPath || `Unknown path for ${componentName}`, style: { display: 'contents' }, children: _jsx(Component, { ...props, ref: ref }) }));
    });
}
/**
 * Hook version for functional components
 */
export function useComponentTracking(componentName, componentPath) {
    return {
        'data-component-name': componentName,
        'data-component-path': componentPath || `Unknown path for ${componentName}`,
    };
}

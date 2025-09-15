/**
 * Development helper to add component names to React components
 * This makes it easier for the feedback system to identify components
 */
// Store original createElement to wrap it
const originalCreateElement = window.React?.createElement;
export function enableComponentTracking() {
    if (process.env.NODE_ENV !== 'development')
        return;
    // Only run if React is available
    if (!window.React || !originalCreateElement) {
        console.log('[DevComponentHelper] React not found on window, skipping component tracking');
        return;
    }
    console.log('[DevComponentHelper] Enabling automatic component tracking');
    // Wrap React.createElement to inject component info
    window.React.createElement = function (type, props, ...children) {
        // Only process function components and class components
        if (typeof type === 'function' && type.name) {
            // Don't modify if already has tracking
            if (props && (props['data-component-name'] || props.className?.includes('react-tracked'))) {
                return originalCreateElement.call(this, type, props, ...children);
            }
            // Add component tracking
            const enhancedProps = {
                ...props,
                'data-component-name': type.displayName || type.name,
                className: props?.className ? `${props.className} react-tracked` : 'react-tracked',
            };
            return originalCreateElement.call(this, type, enhancedProps, ...children);
        }
        return originalCreateElement.call(this, type, props, ...children);
    };
}
// Auto-enable in development
if (process.env.NODE_ENV === 'development') {
    // Wait for React to be available
    const checkReact = setInterval(() => {
        if (window.React) {
            clearInterval(checkReact);
            enableComponentTracking();
        }
    }, 100);
    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(checkReact), 5000);
}

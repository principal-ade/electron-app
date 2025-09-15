/**
 * Enhanced component detection utilities
 */
interface ComponentInfo {
    name: string;
    path: string;
    props?: any;
}
/**
 * Main function to detect React component from DOM element
 */
export declare function detectReactComponent(element: HTMLElement): ComponentInfo;
/**
 * Development helper to display component names
 */
export declare function enableComponentNameDisplay(): void;
export {};
//# sourceMappingURL=componentDetection.d.ts.map
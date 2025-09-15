import React from 'react';
interface ThemedOwlIconSimpleProps {
    size?: number;
    className?: string;
    /** Base path to icon assets */
    basePath?: string;
    /** Use a single combined image instead of layers */
    useSingleImage?: boolean;
}
/**
 * Simplified Themed Owl Icon
 *
 * This component supports two modes:
 * 1. Single Image Mode: Uses pre-colored versions for each theme
 * 2. Layered Mode: Uses CSS filters to colorize specific layers
 */
export declare const ThemedOwlIconSimple: React.FC<ThemedOwlIconSimpleProps>;
export {};
//# sourceMappingURL=ThemedOwlIconSimple.d.ts.map
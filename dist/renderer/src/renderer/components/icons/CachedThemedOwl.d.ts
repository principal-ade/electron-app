import React from 'react';
interface CachedThemedOwlProps {
    size?: number;
    className?: string;
    /** Fallback image to use while icon is being generated */
    fallbackSrc?: string;
    /** Whether to show a loading spinner while generating */
    showLoading?: boolean;
}
/**
 * CachedThemedOwl - Efficient themed owl icon that uses pre-generated cached images
 *
 * This component:
 * 1. Uses cached themed icons that are generated once when theme switches
 * 2. Falls back to a default icon while the themed version is being generated
 * 3. Automatically updates when the theme changes
 */
export declare const CachedThemedOwl: React.FC<CachedThemedOwlProps>;
export {};
//# sourceMappingURL=CachedThemedOwl.d.ts.map
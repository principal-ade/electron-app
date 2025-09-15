import React from 'react';
interface LayeredOwlIconProps {
    size?: number;
    className?: string;
    basePath?: string;
}
/**
 * LayeredOwlIcon Component
 *
 * Expects the following image files in the basePath directory:
 * - owl-body.png (grayscale base layer)
 * - owl-eyes-base.png (white eye backgrounds)
 * - owl-eyes-iris.png (grayscale iris layer - will be colorized)
 * - owl-eyes-pupils.png (black pupils)
 * - owl-eyes-highlight.png (white highlights)
 * - owl-accessories.png (optional accessories layer)
 *
 * For best results, use grayscale PNGs with transparency
 */
export declare const LayeredOwlIcon: React.FC<LayeredOwlIconProps>;
export {};
//# sourceMappingURL=LayeredOwlIcon.d.ts.map
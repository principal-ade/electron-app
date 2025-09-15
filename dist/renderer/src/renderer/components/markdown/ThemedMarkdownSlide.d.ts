import React from 'react';
import { IndustryMarkdownSlide } from 'themed-markdown';
/**
 * ThemedMarkdownSlide - A wrapper around IndustryMarkdownSlide that applies theming
 *
 * This component:
 * 1. By default uses the current application theme
 * 2. Can optionally use a custom markdown theme from user preferences
 * 3. Updates when preferences change
 *
 * Use this instead of importing IndustryMarkdownSlide directly.
 */
export type ThemedMarkdownSlideProps = React.ComponentProps<typeof IndustryMarkdownSlide> & {
    useCustomTheme?: boolean;
};
export declare const ThemedMarkdownSlide: React.FC<ThemedMarkdownSlideProps>;
export declare const useMarkdownTheme: (useCustom?: boolean) => any;
//# sourceMappingURL=ThemedMarkdownSlide.d.ts.map
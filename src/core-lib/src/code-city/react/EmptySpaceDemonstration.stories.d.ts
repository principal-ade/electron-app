import { Meta, StoryObj } from '@storybook/react';
import { ArchitectureMapHighlightLayers } from './ArchitectureMapHighlightLayers';
declare const meta: Meta<typeof ArchitectureMapHighlightLayers>;
export default meta;
type Story = StoryObj<typeof ArchitectureMapHighlightLayers>;
/**
 * Default behavior - shows empty space issue
 *
 * With only 2 files and 8 directories, the legacy-sqrt strategy
 * calculates a large minimum dimension due to the directory multiplier.
 * This creates significant empty space in the visualization.
 */
export declare const DefaultWithEmptySpace: Story;
/**
 * With automatic spacing disabled
 *
 * Even with automatic spacing disabled, the minimum dimension
 * enforcement still creates empty space.
 */
export declare const WithSpacingDisabled: Story;
/**
 * Progressive brackets strategy - even more empty space for small projects
 */
export declare const ProgressiveBracketsStrategy: Story;
/**
 * Minimum area guarantee with buffer - shows the 50% buffer effect
 */
export declare const MinimumAreaWithBuffer: Story;
/**
 * Comparison view showing all strategies side by side
 */
export declare const ComparisonView: Story;
//# sourceMappingURL=EmptySpaceDemonstration.stories.d.ts.map
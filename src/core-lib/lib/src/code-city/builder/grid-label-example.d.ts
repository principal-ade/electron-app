/**
 * Example of using the new grid cell label configuration
 *
 * This demonstrates how to add labels above or below grid cells
 * in the code city visualization.
 */
import { FileTree } from '@principal-ai/repository-abstraction';
export declare function createGridWithDefaultLabels(fileTree: FileTree): import("..").CityData;
export declare function createGridWithBottomLabels(fileTree: FileTree): import("..").CityData;
export declare function createGridWithoutLabels(fileTree: FileTree): import("..").CityData;
export declare function createGridWithCustomLabelSizing(fileTree: FileTree): import("..").CityData;
export declare function createResponsiveGridLabels(fileTree: FileTree): import("..").CityData;
/**
 * How to use the label data in rendering:
 *
 * The CityDistrict objects for grid cells will now include label information:
 *
 * cityData.districts.forEach(district => {
 *   if (district.path.startsWith('grid-cell-') && district.label) {
 *     // Render the label
 *     const label = district.label;
 *     renderText(
 *       label.text,
 *       label.bounds.minX,
 *       label.bounds.minZ,
 *       label.bounds.maxX - label.bounds.minX,  // width
 *       label.bounds.maxZ - label.bounds.minZ   // height
 *     );
 *   }
 * });
 */
//# sourceMappingURL=grid-label-example.d.ts.map
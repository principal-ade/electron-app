import { FileTree as FileSystemTree } from '@principal-ai/repository-abstraction';
import { CodebaseView } from 'a24z-memory';
import { CityData, CityBuilding, CityDistrict } from '../types/cityData';
import { DirectorySortFunction, FileSortFunction } from '../types/sorts';
import { ColorTheme, ColorFunction } from '../types/themes';
export interface LegendEntry {
    label: string;
    color: string;
    count: number;
    buildingTypeId?: string;
    priority?: number;
    fileType?: string;
    description?: string;
    isSpecialFile?: boolean;
}
export interface Legend {
    entries: LegendEntry[];
    totalTypes?: number;
    generatedAt?: Date;
}
export type SizingStrategy = 'minimum-area-guarantee' | 'hierarchical-depth' | 'progressive-brackets' | 'content-aware' | 'viewport-optimized' | 'legacy-sqrt';
export interface TreemapOptions {
    gridLayout?: CodebaseView;
    sizingStrategy?: SizingStrategy;
    minBuildingVisualSize?: number;
    guaranteedMinArea?: number;
    hierarchyDepthWeight?: number;
    contentAwareScaling?: boolean;
    aspectRatioOptimization?: boolean;
    disableAutomaticSpacing?: boolean;
    bufferMultiplier?: number;
    maxNestingDepth?: number;
    deepNestingStrategy?: 'flatten' | 'boost-size' | 'reduce-padding' | 'hybrid';
    depthBasedPaddingReduction?: boolean;
    minimumBuildingSizeOverride?: boolean;
    deepNestingSizeBoost?: number;
    flattenThreshold?: number;
    padding?: number;
    paddingOuter?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingInner?: number;
    round?: boolean;
    tile?: any;
    directorySortFn?: DirectorySortFunction;
    fileSortFn?: FileSortFunction;
}
/**
 * CodeCityBuilderWithGrid - D3 Treemap Implementation with Grid Layout
 *
 * This class converts a FileSystemTree into a CityData visualization using D3's
 * robust treemap algorithms with grid-based spatial organization.
 *
 * Grid Layout:
 * - Default: 1x1 grid (traditional single treemap)
 * - Multi-cell: Organize code into spatial regions (src, tests, docs, etc.)
 * - Each directory becomes a district (rectangular boundary)
 * - Each file becomes a building (3D block) within those districts
 *
 * The grid system provides better organization for large codebases while
 * maintaining backward compatibility through the 1x1 default configuration.
 */
export declare class CodeCityBuilderWithGrid {
    private minBuildingSize;
    private maxBuildingSize;
    private buildingTypeResolver;
    constructor(theme?: ColorTheme, customColorFn?: ColorFunction);
    /**
     * Default alphabetical sort for directories
     */
    private defaultDirectorySort;
    /**
     * Default alphabetical sort for files
     */
    private defaultFileSort;
    /**
     * Calculate maximum depth of directory hierarchy
     */
    private calculateMaxDepth;
    /**
     * Analyze file system complexity for content-aware sizing
     */
    private analyzeFileSystemComplexity;
    /**
     * Minimum area guarantee sizing strategy
     */
    private calculateMinimumAreaSize;
    /**
     * Hierarchical depth-based sizing strategy
     */
    private calculateHierarchicalSize;
    /**
     * Progressive brackets sizing strategy
     */
    private calculateBracketedSize;
    /**
     * Content-aware sizing strategy
     */
    private calculateContentAwareSize;
    /**
     * Viewport-optimized sizing strategy
     */
    private calculateViewportOptimizedSize;
    /**
     * Legacy square root scaling (original method)
     */
    private calculateLegacySqrtSize;
    /**
     * Calculate optimal size using the specified sizing strategy
     */
    private calculateOptimalSize;
    /**
     * Apply deep nesting handling to the hierarchy data before treemap layout
     */
    private handleDeepNesting;
    /**
     * Flatten directory structure beyond a certain depth
     * Moves deeply nested files to shallower directories with path-based names
     */
    private flattenDeepStructure;
    /**
     * Recursively collect files from deeply nested directories
     */
    private collectDeepFiles;
    /**
     * Boost the importance (value) of files in deeply nested directories
     * This makes treemap allocate more space to them
     */
    private boostDeepFileImportance;
    /**
     * Calculate depth-aware padding that reduces at deeper levels
     */
    private calculateDepthAwarePadding;
    /**
     * Post-process buildings to enforce minimum sizes for deeply nested items
     */
    private enforceMinimumBuildingSizes;
    /**
     * Main method to convert file system tree to city data using D3 treemap with grid layout
     *
     * @param fileSystemTree - The file system structure to visualize
     * @param rootPath - The root path for the visualization
     * @param options - Treemap configuration options
     * @returns CityData with districts and buildings positioned via grid-based D3 treemap
     */
    buildCityFromFileSystem(fileSystemTree: FileSystemTree, rootPath?: string, options?: TreemapOptions): CityData;
    /**
     * Build city with grid-based spatial layout (now the primary implementation)
     *
     * @param fileSystemTree - The file system structure to visualize
     * @param rootPath - The root path for the visualization
     * @param options - Treemap configuration options with grid layout
     * @returns CityData with districts and buildings positioned in grid cells
     */
    private buildCityWithGridLayout;
    /**
     * Build city for a single grid cell using treemap layout
     * This is the core treemap implementation without grid splitting
     */
    private buildSingleCellCity;
    /**
     * Convert FileSystemTree format to D3 hierarchy format
     *
     * D3 expects a specific hierarchy structure with name, children, and value properties.
     * This method recursively transforms our FileSystemTree into that format.
     */
    private convertToD3Hierarchy;
    /**
     * Convert D3 treemap layout results back to our CityData format
     *
     * This method traverses the D3 treemap result and creates districts for directories
     * and buildings for files, using the calculated rectangle positions and sizes.
     */
    private convertD3TreemapToCityData;
    /**
     * Create a building from D3 treemap node data
     *
     * Buildings are positioned at the center of their allocated treemap rectangle,
     * with dimensions that fill the rectangle and height based on file size.
     *
     * UPDATED: Use D3's built-in padding system for proper space management
     * instead of manual post-processing adjustments.
     */
    private createBuildingFromD3Node;
    /**
     * Compute bounds from children nodes when a directory has no allocated area
     */
    private computeBoundsFromChildren;
    /**
     * Get building color based on file extension
     * Simple color mapping for different file types
     */
    /**
     * Generate legend with color and file/directory type information using BuildingTypeResolver
     */
    private generateLegend;
    /**
     * Update file system tree to use new building type distribution
     * This ensures the legend and distribution are in sync with the new system
     */
    updateBuildingTypeDistribution(fileSystemTree: FileSystemTree): FileSystemTree;
    /**
     * Update the color configuration for the building type resolver
     */
    updateColorConfig(theme?: ColorTheme, customColorFn?: ColorFunction): void;
    /**
     * Get the color for a district based on its directory type
     * This allows rendering code to color districts based on directory patterns
     *
     * @param district - The district to get color for
     * @returns The color string for the district
     */
    getDistrictColor(district: CityDistrict): string;
    /**
     * Get building color using the centralized BuildingTypeResolver
     * This replaces the scattered color logic from the old system
     *
     * @param building - The building to get color for
     * @returns The color string for the building
     */
    getBuildingColor(building: CityBuilding): string;
    /**
     * Calculate overall bounds of the city
     *
     * This determines the total area covered by all districts and buildings
     * for camera positioning and viewport calculations.
     */
    private calculateBounds;
    /**
     * Validate that buildings are properly contained within their parent districts
     * This helps debug coordinate system issues with the D3 treemap layout
     */
    private validateBuildingDistrictContainment;
}
export declare const SizingPresets: {
    readonly smallProject: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly minBuildingVisualSize: 16;
        readonly padding: 8;
        readonly paddingOuter: 16;
        readonly paddingInner: 12;
        readonly paddingTop: 30;
        readonly paddingBottom: 30;
    };
    readonly mediumProject: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly minBuildingVisualSize: 12;
        readonly hierarchyDepthWeight: 0.25;
        readonly padding: 4;
        readonly paddingOuter: 8;
        readonly paddingInner: 6;
    };
    readonly largeProject: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly minBuildingVisualSize: 8;
        readonly aspectRatioOptimization: true;
        readonly padding: 2;
        readonly paddingOuter: 4;
        readonly paddingInner: 3;
    };
    readonly guaranteedVisibility: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly guaranteedMinArea: 64;
        readonly minBuildingVisualSize: 10;
        readonly padding: 4;
        readonly paddingOuter: 8;
    };
    readonly contentAware: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly contentAwareScaling: true;
        readonly padding: 4;
        readonly paddingOuter: 6;
    };
    readonly legacy: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly width: 1000;
        readonly height: 800;
    };
    readonly deepNestingFlattened: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly deepNestingStrategy: "flatten";
        readonly maxNestingDepth: 4;
        readonly minBuildingVisualSize: 10;
        readonly hierarchyDepthWeight: 0.2;
        readonly padding: 3;
        readonly paddingOuter: 6;
        readonly paddingInner: 2;
    };
    readonly deepNestingBoosted: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly deepNestingStrategy: "boost-size";
        readonly deepNestingSizeBoost: 2;
        readonly guaranteedMinArea: 36;
        readonly minimumBuildingSizeOverride: true;
        readonly minBuildingVisualSize: 8;
        readonly padding: 2;
        readonly paddingInner: 1;
    };
    readonly deepNestingHybrid: {
        readonly adaptiveSize: true;
        readonly sizingStrategy: SizingStrategy;
        readonly deepNestingStrategy: "hybrid";
        readonly maxNestingDepth: 5;
        readonly deepNestingSizeBoost: 1.5;
        readonly depthBasedPaddingReduction: true;
        readonly minimumBuildingSizeOverride: true;
        readonly minBuildingVisualSize: 10;
        readonly aspectRatioOptimization: true;
        readonly padding: 4;
        readonly paddingInner: 3;
    };
};

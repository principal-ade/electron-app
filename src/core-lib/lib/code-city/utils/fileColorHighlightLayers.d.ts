import { FileTree } from '@principal-ai/repository-abstraction';
import { HighlightLayer, LayerRenderStrategy } from '../render/client/drawLayeredBuildings';
export interface ColorLayerConfig {
    color: string;
    renderStrategy: LayerRenderStrategy;
    opacity?: number;
    borderWidth?: number;
    priority?: number;
    coverOptions?: {
        opacity?: number;
        image?: string;
        text?: string;
        textSize?: number;
        backgroundColor?: string;
        borderRadius?: number;
        icon?: string;
        iconSize?: number;
    };
    customRender?: (ctx: CanvasRenderingContext2D, bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, scale: number) => void;
}
export interface FileSuffixConfig {
    primary: ColorLayerConfig;
    secondary?: ColorLayerConfig;
    displayName?: string;
    description?: string;
    category?: string;
    source?: string;
}
export interface FileSuffixColorConfig {
    version: string;
    description: string;
    lastUpdated: string;
    suffixConfigs: Record<string, FileSuffixConfig>;
    defaultConfig?: FileSuffixConfig;
    includeUnmatched?: boolean;
}
/**
 * Creates highlight layers for files based on file extension configurations.
 *
 * @param fileTree - The file tree structure from core library
 * @param config - Optional configuration object with suffix mappings. If not provided, uses default config from files.json
 * @returns Array of HighlightLayer objects for the map visualization
 *
 * @example
 * // Using default configuration
 * const layers = createFileColorHighlightLayers(fileTree);
 *
 * @example
 * // Using custom configuration
 * const customConfig: FileSuffixColorConfig = {
 *   version: "1.0.0",
 *   description: "Custom colors",
 *   lastUpdated: "2025-01-26",
 *   suffixConfigs: {
 *     ".ts": {
 *       primary: {
 *         color: "#ff0000",
 *         renderStrategy: "border"
 *       }
 *     }
 *   }
 * };
 * const layers = createFileColorHighlightLayers(fileTree, customConfig);
 */
export declare function createFileColorHighlightLayers(fileTree: FileTree | null, config?: FileSuffixColorConfig): HighlightLayer[];
/**
 * Get the default file color configuration.
 * This returns the configuration loaded from files.json.
 */
export declare function getDefaultFileColorConfig(): FileSuffixColorConfig;
/**
 * Get a simple color mapping from the configuration.
 * This is useful for backwards compatibility or simpler use cases.
 *
 * @param config - Optional configuration. If not provided, uses default config.
 * @returns Record mapping file extensions to hex color strings
 */
export declare function getFileColorMapping(config?: FileSuffixColorConfig): Record<string, string>;

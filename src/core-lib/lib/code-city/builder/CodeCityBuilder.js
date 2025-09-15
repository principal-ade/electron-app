"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SizingPresets = exports.CodeCityBuilder = void 0;
const d3_hierarchy_1 = require("d3-hierarchy");
const buildingTypes_1 = require("../types/buildingTypes");
/**
 * CodeCityBuilder - D3 Treemap Implementation
 *
 * This class converts a FileSystemTree into a CityData visualization using D3's
 * robust treemap algorithms. Each directory becomes a district (rectangular boundary)
 * and each file becomes a building (square) within those districts.
 *
 * The treemap layout ensures optimal space utilization and visual hierarchy.
 */
class CodeCityBuilder {
    constructor(theme, customColorFn) {
        this.minBuildingSize = 4;
        this.maxBuildingSize = 40;
        this.buildingTypeResolver = new buildingTypes_1.BuildingTypeResolver(theme, customColorFn);
    }
    /**
     * Default alphabetical sort for directories
     */
    defaultDirectorySort(a, b) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    /**
     * Default alphabetical sort for files
     */
    defaultFileSort(a, b) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    /**
     * Calculate maximum depth of directory hierarchy
     */
    calculateMaxDepth(directory, currentDepth = 0) {
        let maxDepth = currentDepth;
        directory.children.forEach(child => {
            if ('children' in child) {
                const childDepth = this.calculateMaxDepth(child, currentDepth + 1);
                maxDepth = Math.max(maxDepth, childDepth);
            }
        });
        return maxDepth;
    }
    /**
     * Analyze file system complexity for content-aware sizing
     */
    analyzeFileSystemComplexity(directory, stats = {
        totalFiles: 0,
        totalDirectories: 0,
        totalFileSize: 0,
        maxDepth: 0,
        avgFilesPerDirectory: 0,
    }, currentDepth = 0) {
        stats.totalDirectories++;
        stats.maxDepth = Math.max(stats.maxDepth, currentDepth);
        directory.children.forEach(child => {
            if ('children' in child) {
                this.analyzeFileSystemComplexity(child, stats, currentDepth + 1);
            }
            else {
                const file = child;
                stats.totalFiles++;
                stats.totalFileSize += file.size || 0;
            }
        });
        if (currentDepth === 0) {
            stats.avgFilesPerDirectory = stats.totalFiles / Math.max(1, stats.totalDirectories);
        }
        return stats;
    }
    /**
     * Minimum area guarantee sizing strategy
     */
    calculateMinimumAreaSize(totalFiles, totalDirectories, options) {
        const guaranteedMinArea = options.guaranteedMinArea || this.minBuildingSize * this.minBuildingSize;
        const minDistrictLabelSpace = 40; // Space for district labels
        const paddingPerDistrict = (options.paddingInner || 4) * 2;
        // Calculate total minimum area needed
        const totalBuildingArea = totalFiles * guaranteedMinArea;
        const totalDistrictOverhead = totalDirectories * (minDistrictLabelSpace + paddingPerDistrict);
        // Add 50% buffer for treemap efficiency (increased from 20%)
        const totalMinArea = (totalBuildingArea + totalDistrictOverhead) * 1.5;
        const dimension = Math.sqrt(totalMinArea);
        console.log(`📐 Minimum area guarantee: ${Math.round(dimension)}x${Math.round(dimension)} (${guaranteedMinArea} per building)`);
        return { width: dimension, height: dimension };
    }
    /**
     * Hierarchical depth-based sizing strategy
     */
    calculateHierarchicalSize(fileSystemTree, totalFiles, totalDirectories, options) {
        const maxDepth = this.calculateMaxDepth(fileSystemTree.root);
        const avgFilesPerDirectory = totalFiles / Math.max(1, totalDirectories);
        // Base size per building that guarantees visibility
        const baseSize = options.minBuildingVisualSize || 8;
        // Depth factor: deeper hierarchies need more space for proper nesting
        const depthWeight = options.hierarchyDepthWeight || 0.3;
        const depthFactor = Math.max(1, maxDepth * depthWeight);
        // Density factor: directories with many files need more space
        const densityFactor = avgFilesPerDirectory > 1 ? Math.sqrt(avgFilesPerDirectory) : 1;
        // Add padding factor for directories
        const paddingFactor = 1.5; // 50% extra space for padding between buildings
        const effectiveSize = baseSize * depthFactor * densityFactor * paddingFactor;
        const totalArea = totalFiles * effectiveSize * effectiveSize;
        // Add directory overhead
        const directoryOverhead = totalDirectories * 100;
        const finalArea = totalArea + directoryOverhead;
        const dimension = Math.sqrt(finalArea);
        console.log(`📐 Hierarchical sizing: ${Math.round(dimension)}x${Math.round(dimension)} (depth: ${maxDepth}, density: ${avgFilesPerDirectory.toFixed(1)})`);
        return { width: dimension, height: dimension };
    }
    /**
     * Progressive brackets sizing strategy
     */
    calculateBracketedSize(totalFiles, totalDirectories) {
        const totalItems = totalFiles + totalDirectories;
        let area;
        let description;
        // Add extra space for directory overhead and padding
        const directoryOverhead = totalDirectories * 100; // Extra space for district boundaries
        if (totalItems <= 50) {
            // Small projects: generous spacing
            area = totalFiles * 400 + directoryOverhead; // 20x20 per file + overhead
            description = 'small project (generous spacing)';
        }
        else if (totalItems <= 500) {
            // Medium projects: balanced spacing
            area = totalFiles * 100 + directoryOverhead; // 10x10 per file + overhead
            description = 'medium project (balanced spacing)';
        }
        else {
            // Large projects: efficient packing but still comfortable
            area = totalFiles * 36 + directoryOverhead; // 6x6 per file + overhead
            description = 'large project (efficient packing)';
        }
        const dimension = Math.sqrt(area);
        console.log(`📐 Progressive brackets: ${Math.round(dimension)}x${Math.round(dimension)} (${description})`);
        return { width: dimension, height: dimension };
    }
    /**
     * Content-aware sizing strategy
     */
    calculateContentAwareSize(fileSystemTree) {
        const stats = this.analyzeFileSystemComplexity(fileSystemTree.root);
        // Base calculation on actual file size distribution
        const avgFileSize = stats.totalFileSize / Math.max(1, stats.totalFiles);
        const sizeFactor = Math.log10(Math.max(1, avgFileSize / 1000)); // KB-based scaling
        // Calculate based on directory fan-out (files per directory)
        const fanOutFactor = Math.sqrt(stats.avgFilesPerDirectory / 5); // Normalize around 5 files/dir
        // Combine factors
        const sizeMultiplier = Math.max(1, sizeFactor * fanOutFactor);
        const baseArea = stats.totalFiles * 64; // 8x8 base
        const adjustedArea = baseArea * sizeMultiplier;
        const dimension = Math.sqrt(adjustedArea);
        console.log(`📐 Content-aware sizing: ${Math.round(dimension)}x${Math.round(dimension)} (avg size: ${Math.round(avgFileSize)} bytes, multiplier: ${sizeMultiplier.toFixed(2)})`);
        return { width: dimension, height: dimension };
    }
    /**
     * Viewport-optimized sizing strategy
     */
    calculateViewportOptimizedSize(totalFiles, totalDirectories, options) {
        const targetBuildingSize = options.minBuildingVisualSize || 12;
        // Work backwards from desired visual size
        const minVisualArea = targetBuildingSize * targetBuildingSize;
        const paddingRatio = 0.3; // 30% padding between buildings
        const effectiveArea = minVisualArea / (1 - paddingRatio);
        // Account for district boundaries and labels
        const districtOverheadRatio = 0.2; // 20% overhead for districts
        const totalAreaNeeded = totalFiles * effectiveArea * (1 + districtOverheadRatio);
        // Calculate optimal dimensions
        const dimension = Math.sqrt(totalAreaNeeded);
        let width = dimension;
        let height = dimension;
        // Apply aspect ratio optimization for better screen usage
        if (options.aspectRatioOptimization) {
            const screenAspectRatio = 16 / 9; // Common screen ratio
            width = dimension * Math.sqrt(screenAspectRatio);
            height = dimension / Math.sqrt(screenAspectRatio);
        }
        console.log(`📐 Viewport-optimized: ${Math.round(width)}x${Math.round(height)} (target building: ${targetBuildingSize}px)`);
        return { width, height };
    }
    /**
     * Legacy square root scaling (original method)
     */
    calculateLegacySqrtSize(totalFiles, _fixedWidth, _fixedHeight) {
        const minDimension = 500;
        const maxDimension = 1200;
        // Square root scaling: balanced growth
        const filesPerUnit = 10;
        const scaleFactor = Math.max(1, Math.sqrt(totalFiles / filesPerUnit));
        const width = Math.min(Math.max(minDimension * scaleFactor, minDimension), maxDimension);
        const height = width; // Keep square
        console.log(`📐 Legacy sqrt sizing: ${width}x${height} (scale factor: ${scaleFactor.toFixed(2)})`);
        return { width, height };
    }
    /**
     * Calculate optimal size using the specified sizing strategy
     */
    calculateOptimalSize(fileSystemTree, totalFiles, totalDirectories, options, fixedWidth, fixedHeight) {
        const strategy = options.sizingStrategy || 'legacy-sqrt';
        let result;
        switch (strategy) {
            case 'minimum-area-guarantee':
                result = this.calculateMinimumAreaSize(totalFiles, totalDirectories, options);
                break;
            case 'hierarchical-depth':
                result = this.calculateHierarchicalSize(fileSystemTree, totalFiles, totalDirectories, options);
                break;
            case 'progressive-brackets':
                result = this.calculateBracketedSize(totalFiles, totalDirectories);
                break;
            case 'content-aware':
                result = this.calculateContentAwareSize(fileSystemTree);
                break;
            case 'viewport-optimized':
                result = this.calculateViewportOptimizedSize(totalFiles, totalDirectories, options);
                break;
            case 'legacy-sqrt':
            default:
                result = this.calculateLegacySqrtSize(totalFiles, fixedWidth, fixedHeight);
        }
        // Enforce minimum dimensions based on file count and directory structure
        if (totalFiles > 0) {
            // More aggressive minimum dimensions to prevent overlaps
            const baseMinPerFile = 50; // Base minimum dimension per file
            const directoryMultiplier = Math.max(1, totalDirectories / totalFiles); // Penalty for spread out files
            // Use a formula that ensures enough space even for worst-case scenarios
            const minDimension = Math.max(1000, // Absolute minimum
            baseMinPerFile * Math.sqrt(totalFiles) * (1 + directoryMultiplier));
            if (result.width < minDimension || result.height < minDimension) {
                console.log(`⚠️ Dimensions too small for ${totalFiles} files across ${totalDirectories} directories. Adjusting from ${Math.round(result.width)}x${Math.round(result.height)} to ${Math.round(minDimension)}x${Math.round(minDimension)}`);
                result.width = Math.max(result.width, minDimension);
                result.height = Math.max(result.height, minDimension);
            }
        }
        return result;
    }
    /**
     * Apply deep nesting handling to the hierarchy data before treemap layout
     */
    handleDeepNesting(hierarchyData, options) {
        const strategy = options.deepNestingStrategy || 'hybrid';
        const maxDepth = options.maxNestingDepth || 6;
        console.log(`🏗️ Deep nesting strategy: ${strategy}, max depth: ${maxDepth}`);
        console.log('📊 Options passed:', {
            deepNestingStrategy: options.deepNestingStrategy,
            maxNestingDepth: options.maxNestingDepth,
            hasOptions: Object.keys(options).length > 0,
        });
        switch (strategy) {
            case 'flatten':
                return this.flattenDeepStructure(hierarchyData, maxDepth);
            case 'boost-size':
                return this.boostDeepFileImportance(hierarchyData, options);
            case 'reduce-padding':
                // This will be handled in the treemap configuration
                return hierarchyData;
            case 'hybrid':
            default: {
                // Apply multiple strategies
                let processed = this.flattenDeepStructure(hierarchyData, maxDepth);
                processed = this.boostDeepFileImportance(processed, options);
                return processed;
            }
        }
    }
    /**
     * Flatten directory structure beyond a certain depth
     * Moves deeply nested files to shallower directories with path-based names
     */
    flattenDeepStructure(data, maxDepth, currentDepth = 0) {
        // Debug: Log when we're processing bracket directories
        if (data.name?.includes('[')) {
            console.log(`🔍 [flattenDeepStructure] Processing bracket dir: ${data.name} at depth ${currentDepth} (maxDepth: ${maxDepth})`);
        }
        if (data.type === 'file' || currentDepth < maxDepth) {
            // Process children recursively
            if (data.children) {
                data.children = data.children.map((child) => this.flattenDeepStructure(child, maxDepth, currentDepth + 1));
            }
            return data;
        }
        // We're at max depth - flatten this directory
        console.log(`⚠️ [flattenDeepStructure] FLATTENING directory at max depth: ${data.name} (depth: ${currentDepth})`);
        const flattenedFiles = [];
        const remainingDirectories = [];
        this.collectDeepFiles(data, flattenedFiles, currentDepth);
        // Create flattened structure
        return {
            ...data,
            children: [
                ...remainingDirectories,
                ...flattenedFiles.map(file => ({
                    ...file,
                    name: `${data.name}/${file.originalPath || file.name}`, // Show full path in name
                    flattenedFrom: file.originalPath || file.relativePath,
                })),
            ],
        };
    }
    /**
     * Recursively collect files from deeply nested directories
     */
    collectDeepFiles(directory, collectedFiles, currentDepth) {
        if (!directory.children)
            return;
        directory.children.forEach((child) => {
            if (child.type === 'file') {
                collectedFiles.push({
                    ...child,
                    originalPath: child.relativePath,
                });
            }
            else if (child.type === 'directory') {
                // Recursively collect from subdirectories
                this.collectDeepFiles(child, collectedFiles, currentDepth + 1);
            }
        });
    }
    /**
     * Boost the importance (value) of files in deeply nested directories
     * This makes treemap allocate more space to them
     */
    boostDeepFileImportance(data, options, currentDepth = 0) {
        const boostFactor = options.deepNestingSizeBoost || 1.5;
        const boostThreshold = 3; // Start boosting at depth 3
        if (data.type === 'file' && currentDepth >= boostThreshold) {
            // Boost file importance for treemap calculation
            const depthBoost = Math.pow(boostFactor, currentDepth - boostThreshold + 1);
            return {
                ...data,
                weight: depthBoost, // Custom weight property
                deepNestingBoost: depthBoost,
            };
        }
        // Process children recursively
        if (data.children) {
            data.children = data.children.map((child) => this.boostDeepFileImportance(child, options, currentDepth + 1));
        }
        return data;
    }
    /**
     * Calculate depth-aware padding that reduces at deeper levels
     */
    calculateDepthAwarePadding(baseOptions, maxDepth) {
        if (!baseOptions.depthBasedPaddingReduction) {
            return baseOptions;
        }
        const basePadding = baseOptions.paddingInner || 4;
        const reductionFactor = 0.7; // Reduce padding by 30% at each level
        // Calculate average padding across all depths
        let totalPadding = 0;
        for (let depth = 0; depth <= maxDepth; depth++) {
            const depthPadding = basePadding * Math.pow(reductionFactor, depth);
            totalPadding += depthPadding;
        }
        const averagePadding = totalPadding / (maxDepth + 1);
        console.log(`🔍 Depth-aware padding: base=${basePadding}, average=${averagePadding.toFixed(1)}`);
        return {
            ...baseOptions,
            paddingInner: Math.max(1, averagePadding), // Ensure minimum padding of 1
        };
    }
    /**
     * Post-process buildings to enforce minimum sizes for deeply nested items
     */
    enforceMinimumBuildingSizes(buildings, options) {
        if (!options.minimumBuildingSizeOverride) {
            return buildings;
        }
        const minSize = options.minBuildingVisualSize || 6;
        const minArea = minSize * minSize;
        let adjustedCount = 0;
        const adjustedBuildings = buildings.map(building => {
            const currentArea = building.dimensions[0] * building.dimensions[2];
            if (currentArea < minArea) {
                adjustedCount++;
                const scaleFactor = Math.sqrt(minArea / currentArea);
                return {
                    ...building,
                    dimensions: [
                        Math.max(minSize, building.dimensions[0] * scaleFactor),
                        building.dimensions[1], // Keep height unchanged
                        Math.max(minSize, building.dimensions[2] * scaleFactor),
                    ],
                };
            }
            return building;
        });
        if (adjustedCount > 0) {
            console.log(`🔧 Enforced minimum size for ${adjustedCount} deeply nested buildings`);
        }
        return adjustedBuildings;
    }
    /**
     * Main method to convert file system tree to city data using D3 treemap
     *
     * @param fileSystemTree - The file system structure to visualize
     * @param rootPath - The root path for the visualization
     * @param options - Treemap configuration options
     * @returns CityData with districts and buildings positioned via D3 treemap
     */
    buildCityFromFileSystem(fileSystemTree, rootPath = '', options = {}) {
        const { width: fixedWidth = 1000, height: fixedHeight = 800, adaptiveSize = true, padding = 4, paddingOuter = 8, paddingTop = 20, paddingBottom = 20, paddingLeft = 4, paddingRight = 4, paddingInner = 4, round = true, tile = d3_hierarchy_1.treemapSquarify, } = options;
        // Calculate adaptive dimensions if enabled
        let width = fixedWidth;
        let height = fixedHeight;
        if (adaptiveSize) {
            const totalFiles = fileSystemTree.stats.totalFiles;
            const totalDirectories = fileSystemTree.stats.totalDirectories;
            const sizeResult = this.calculateOptimalSize(fileSystemTree, totalFiles, totalDirectories, options, fixedWidth, fixedHeight);
            width = sizeResult.width;
            height = sizeResult.height;
        }
        else {
            console.log(`📐 Fixed sizing: ${width}x${height}`);
        }
        const buildings = [];
        const districts = [];
        // Step 1: Convert FileSystemTree to D3 hierarchy format
        const hierarchyData = this.convertToD3Hierarchy(fileSystemTree.root);
        // Step 2: Deep nesting handling - DISABLED
        // TODO: The deep nesting handler was flattening directories beyond depth 6,
        // which caused bracket directories like [owner]/[name] to disappear from the visualization.
        // In the future, if we need to handle deeply nested structures, we should:
        // 1. Make the max depth configurable and much higher (e.g., 20+ levels)
        // 2. Only flatten when absolutely necessary (e.g., > 100 levels)
        // 3. Preserve important directory markers like [owner], [name], etc.
        // 4. Consider alternative approaches like visual compression instead of flattening
        //
        // For now, we're disabling this feature entirely to preserve the true file structure.
        const processedHierarchyData = hierarchyData;
        // Original code (disabled):
        // const processedHierarchyData = this.handleDeepNesting(hierarchyData, options);
        // Step 3: Create D3 hierarchy and calculate file counts
        const root = (0, d3_hierarchy_1.hierarchy)(processedHierarchyData)
            .sum(d => {
            if (d.type === 'file') {
                // Use boosted weight for deeply nested files, or default to 1
                return d.weight || 1;
            }
            // FIXED: Give directories a small minimum value to ensure they get area allocated
            // This ensures directories with only subdirectories still appear as districts
            if (d.type === 'directory') {
                // Give a very small value (0.01) to ensure the directory gets space
                // but doesn't significantly affect the layout proportions
                // The actual district size will come from the sum of its children
                return 0.01;
            }
            return 0;
        })
            .sort((a, b) => (b.value || 0) - (a.value || 0)); // Sort by value (descending)
        // Step 4: Create D3 treemap layout
        const treemapLayout = (0, d3_hierarchy_1.treemap)()
            .size([width, height])
            .padding(padding)
            .paddingOuter(paddingOuter)
            .paddingTop(paddingTop)
            .paddingBottom(paddingBottom)
            .paddingLeft(paddingLeft)
            .paddingRight(paddingRight)
            .paddingInner(paddingInner)
            .tile(tile)
            .round(round);
        // Step 5: Apply treemap layout
        treemapLayout(root);
        // Step 6: Convert D3 treemap nodes back to districts and buildings
        this.convertD3TreemapToCityData(root, districts, buildings, rootPath);
        // Calculate overall bounds
        const bounds = this.calculateBounds(buildings, districts);
        // Validate building-district containment
        //this.validateBuildingDistrictContainment(buildings, districts);
        // Post-process buildings to enforce minimum sizes for deeply nested items
        const finalBuildings = this.enforceMinimumBuildingSizes(buildings, options);
        // Populate legend on FileSystemTree after city building is complete
        //if (!fileSystemTree.legend) {
        //  this.populateLegend(fileSystemTree);
        //}
        return {
            buildings: finalBuildings,
            districts,
            bounds,
            metadata: {
                totalFiles: fileSystemTree.stats.totalFiles,
                totalDirectories: fileSystemTree.stats.totalDirectories,
                analyzedAt: new Date(),
                rootPath,
                layoutConfig: {
                    paddingTop,
                    paddingBottom,
                    paddingLeft,
                    paddingRight,
                    paddingInner,
                    paddingOuter,
                },
            },
        };
    }
    /**
     * Convert FileSystemTree format to D3 hierarchy format
     *
     * D3 expects a specific hierarchy structure with name, children, and value properties.
     * This method recursively transforms our FileSystemTree into that format.
     */
    convertToD3Hierarchy(directory) {
        const children = [];
        // Sort children using configured sort functions
        const sortedChildren = [...directory.children];
        // Add subdirectories
        sortedChildren.forEach(child => {
            if ('children' in child) {
                // It's a directory
                const subdir = child;
                children.push(this.convertToD3Hierarchy(subdir));
            }
            else {
                // It's a file
                const file = child;
                children.push({
                    name: file.name,
                    relativePath: file.relativePath,
                    type: 'file',
                    size: file.size,
                    extension: file.extension,
                    lastModified: file.lastModified,
                });
            }
        });
        return {
            name: directory.name,
            relativePath: directory.relativePath,
            type: 'directory',
            fileCount: directory.fileCount,
            totalSize: directory.totalSize,
            children: children.length > 0 ? children : undefined,
        };
    }
    /**
     * Convert D3 treemap layout results back to our CityData format
     *
     * This method traverses the D3 treemap result and creates districts for directories
     * and buildings for files, using the calculated rectangle positions and sizes.
     */
    convertD3TreemapToCityData(node, districts, buildings, rootPath, depth = 0, parentPath = '') {
        const data = node.data;
        if (data.type === 'file') {
            // Create building for file using the data's relativePath
            const building = this.createBuildingFromD3Node(node, data, rootPath);
            buildings.push(building);
        }
        else if (data.type === 'directory') {
            // Create district for directory (only if it has area allocated)
            const hasArea = (node.x1 || 0) > (node.x0 || 0) && (node.y1 || 0) > (node.y0 || 0);
            if (hasArea) {
                // Use the relativePath from the data
                let fullPath;
                if (depth === 0) {
                    // Root directory - use the root path or empty for relative trees
                    fullPath = rootPath.startsWith('/') ? rootPath.substring(1) : rootPath;
                }
                else {
                    // Child directory - construct path properly
                    const cleanRoot = rootPath.startsWith('/') ? rootPath.substring(1) : rootPath;
                    if (cleanRoot === '' || cleanRoot === '.') {
                        // For relative path trees, use relativePath directly
                        fullPath = data.relativePath || data.name;
                    }
                    else {
                        // For rooted trees, prefix with root
                        fullPath = `${cleanRoot}/${data.relativePath}`;
                    }
                }
                // Remove any incorrect prefix like "PrincipleMD/"
                if (fullPath.startsWith('PrincipleMD/')) {
                    console.warn('⚠️ Removing incorrect PrincipleMD prefix from district path:', fullPath);
                    fullPath = fullPath.substring('PrincipleMD/'.length);
                }
                const district = {
                    path: fullPath,
                    worldBounds: {
                        minX: node.x0 || 0,
                        maxX: node.x1 || 0,
                        minZ: node.y0 || 0, // Using y as Z coordinate (depth)
                        maxZ: node.y1 || 0,
                    },
                    fileCount: node.value || 0, // D3 calculated sum of file counts
                    type: 'directory',
                };
                districts.push(district);
            }
        }
        // Recursively process children
        if (node.children) {
            // Pass the current node's path as parent path for children
            const currentPath = data.type === 'directory' ? data.relativePath || data.name || '' : parentPath;
            node.children.forEach(child => {
                this.convertD3TreemapToCityData(child, districts, buildings, rootPath, depth + 1, currentPath);
            });
        }
    }
    /**
     * Create a building from D3 treemap node data
     *
     * Buildings are positioned at the center of their allocated treemap rectangle,
     * with dimensions that fill the rectangle and height based on file size.
     *
     * UPDATED: Use D3's built-in padding system for proper space management
     * instead of manual post-processing adjustments.
     */
    createBuildingFromD3Node(node, fileData, rootPath = '') {
        // Calculate building dimensions from treemap rectangle
        const rawWidth = (node.x1 || 0) - (node.x0 || 0);
        const rawDepth = (node.y1 || 0) - (node.y0 || 0);
        // SIMPLIFIED: D3 treemap now handles padding and label space properly
        // Apply minimal padding to prevent buildings from exactly touching district edges
        const paddingFactor = 0.95; // Slight reduction for visual separation
        const width = Math.max(1, rawWidth * paddingFactor);
        const depth = Math.max(1, rawDepth * paddingFactor);
        // Calculate center position - treemap already accounts for label space
        const centerX = (node.x0 || 0) + rawWidth / 2;
        const centerZ = (node.y0 || 0) + rawDepth / 2;
        // Calculate building height based on file size (normalized)
        const sizeRatio = Math.min(fileData.size / 10000, 1); // Normalize to 10KB max
        const buildingHeight = this.minBuildingSize + sizeRatio * (this.maxBuildingSize - this.minBuildingSize);
        // Use the relativePath from fileData with the root prefix
        const cleanRoot = rootPath.startsWith('/') ? rootPath.substring(1) : rootPath;
        let fullFilePath;
        if (cleanRoot === '' || cleanRoot === '.') {
            // For relative path trees, use relativePath directly
            fullFilePath = fileData.relativePath || fileData.name;
        }
        else {
            // For rooted trees, prefix with root
            fullFilePath = `${cleanRoot}/${fileData.relativePath}`;
        }
        return {
            path: fullFilePath,
            position: { x: centerX, y: buildingHeight / 2, z: centerZ },
            dimensions: [width, buildingHeight, depth], // [width, height, depth]
            type: 'file',
            // Removed color property to allow theme system to work
            size: fileData.size,
            fileExtension: fileData.extension,
            lastModified: fileData.lastModified,
        };
    }
    /**
     * Get building color based on file extension
     * Simple color mapping for different file types
     */
    /**
     * Generate legend with color and file/directory type information using BuildingTypeResolver
     */
    generateLegend(fileSystemTree) {
        const entries = [];
        // Use combined type distribution (files + directories)
        const combinedDistribution = fileSystemTree.stats.combinedTypeDistribution || {};
        // Get all types present in the project (files + directories)
        // Filter out invalid entries and report them as errors for debugging
        const validFiles = fileSystemTree.allFiles
            ?.filter(f => {
            if (!f || !f.path || typeof f.path !== 'string') {
                throw new Error(`CodeCityBuilder.generateLegend: Invalid file entry found. Expected object with string path, got: ${JSON.stringify(f, null, 2)}`);
            }
            return true;
        })
            .map(f => ({
            path: f.path,
            fileExtension: f.extension,
            size: f.size,
            lastModified: f.lastModified,
        })) || [];
        const validDirectories = fileSystemTree.allDirectories
            ?.filter(d => {
            if (!d ||
                !d.path ||
                typeof d.path !== 'string' ||
                !d.name ||
                typeof d.name !== 'string') {
                throw new Error(`CodeCityBuilder.generateLegend: Invalid directory entry found. Expected object with string path and name, got: ${JSON.stringify(d, null, 2)}`);
            }
            return true;
        })
            .map(d => ({
            path: d.path,
            name: d.name,
            children: d.children,
        })) || [];
        const allTypes = this.buildingTypeResolver.getAllTypes(validFiles, validDirectories);
        // Create legend entries only for types that exist in the distribution
        allTypes.forEach(type => {
            const count = combinedDistribution[type.id];
            if (count && count > 0) {
                entries.push({
                    label: type.displayName,
                    buildingTypeId: type.id,
                    fileType: type.displayName,
                    color: type.color,
                    count: count,
                    description: type.displayName,
                    isSpecialFile: type.isSpecialFile,
                    priority: type.priority,
                });
            }
        });
        // Sort entries by priority first (higher priority first), then by count (descending)
        entries.sort((a, b) => {
            if (a.priority !== b.priority) {
                return (b.priority || 0) - (a.priority || 0);
            }
            return b.count - a.count;
        });
        return {
            entries,
            totalTypes: entries.length,
            generatedAt: new Date(),
        };
    }
    /**
     * Update file system tree to use new building type distribution
     * This ensures the legend and distribution are in sync with the new system
     */
    updateBuildingTypeDistribution(fileSystemTree) {
        // Calculate new building type distribution
        // Defensive check for allFiles array
        if (!fileSystemTree.allFiles || !Array.isArray(fileSystemTree.allFiles)) {
            throw new Error(`CodeCityBuilder.updateBuildingTypeDistribution: fileSystemTree.allFiles is invalid. Expected array, got: ${typeof fileSystemTree.allFiles}`);
        }
        // Check for invalid files and throw descriptive errors
        const files = fileSystemTree.allFiles
            .filter(f => {
            if (!f || !f.path || typeof f.path !== 'string') {
                throw new Error(`CodeCityBuilder.updateBuildingTypeDistribution: Invalid file entry found. Expected object with string path, got: ${JSON.stringify(f, null, 2)}`);
            }
            return true;
        })
            .map(f => ({
            path: f.path,
            fileExtension: f.extension,
            size: f.size,
            lastModified: f.lastModified,
        }));
        const buildingTypeDistribution = this.buildingTypeResolver.calculateBuildingTypeDistribution(files);
        // Update the stats
        fileSystemTree.stats.buildingTypeDistribution = buildingTypeDistribution;
        // Calculate directory type distribution if directories exist
        if (fileSystemTree.allDirectories && Array.isArray(fileSystemTree.allDirectories)) {
            const directories = fileSystemTree.allDirectories
                .filter(d => {
                if (!d || !d.path || typeof d.path !== 'string') {
                    throw new Error(`CodeCityBuilder.updateBuildingTypeDistribution: Invalid directory entry found. Expected object with string path, got: ${JSON.stringify(d, null, 2)}`);
                }
                return true;
            })
                .map(d => ({
                path: d.path,
                name: d.name,
                children: d.children,
            }));
            const directoryTypeDistribution = this.buildingTypeResolver.calculateDirectoryTypeDistribution(directories);
            fileSystemTree.stats.directoryTypeDistribution = directoryTypeDistribution;
            // Calculate combined distribution
            const combinedTypeDistribution = this.buildingTypeResolver.calculateCombinedTypeDistribution(files, directories);
            fileSystemTree.stats.combinedTypeDistribution = combinedTypeDistribution;
        }
        else {
            // If no directories, use empty distribution
            fileSystemTree.stats.directoryTypeDistribution = {};
            fileSystemTree.stats.combinedTypeDistribution = { ...buildingTypeDistribution };
        }
        return fileSystemTree;
    }
    /**
     * Update the color configuration for the building type resolver
     */
    updateColorConfig(theme, customColorFn) {
        this.buildingTypeResolver.updateColorConfig(theme, customColorFn);
    }
    /**
     * Get the color for a district based on its directory type
     * This allows rendering code to color districts based on directory patterns
     *
     * @param district - The district to get color for
     * @returns The color string for the district
     */
    getDistrictColor(district) {
        // Defensive check for invalid district data - throw error to identify source
        if (!district.path || typeof district.path !== 'string') {
            throw new Error(`CodeCityBuilder.getDistrictColor: Invalid district path. Expected string, got: ${typeof district.path} (${district.path}). District object: ${JSON.stringify(district, null, 2)}`);
        }
        const name = district.path.split('/').pop() || district.path;
        if (!name || typeof name !== 'string') {
            throw new Error(`CodeCityBuilder.getDistrictColor: Could not determine district name from path (${district.path}). Expected valid string path.`);
        }
        const classification = this.buildingTypeResolver.classifyDirectory({
            path: district.path,
            name: name,
            fileCount: district.fileCount,
        });
        return classification.buildingType.color;
    }
    /**
     * Get building color using the centralized BuildingTypeResolver
     * This replaces the scattered color logic from the old system
     *
     * @param building - The building to get color for
     * @returns The color string for the building
     */
    getBuildingColor(building) {
        // Defensive check for invalid building data - throw error to identify source
        if (!building.path || typeof building.path !== 'string') {
            throw new Error(`CodeCityBuilder.getBuildingColor: Invalid building path. Expected string, got: ${typeof building.path} (${building.path}). Building object: ${JSON.stringify(building, null, 2)}`);
        }
        const classification = this.buildingTypeResolver.classifyBuilding({
            path: building.path,
            fileExtension: building.fileExtension,
            size: building.size,
            lastModified: building.lastModified,
        });
        return classification.buildingType.color;
    }
    /**
     * Calculate overall bounds of the city
     *
     * This determines the total area covered by all districts and buildings
     * for camera positioning and viewport calculations.
     */
    calculateBounds(buildings, districts) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        // Check building bounds
        buildings.forEach(building => {
            const halfWidth = building.dimensions[0] / 2;
            const halfDepth = building.dimensions[2] / 2;
            minX = Math.min(minX, building.position.x - halfWidth);
            maxX = Math.max(maxX, building.position.x + halfWidth);
            minZ = Math.min(minZ, building.position.z - halfDepth);
            maxZ = Math.max(maxZ, building.position.z + halfDepth);
        });
        // Check district bounds
        districts.forEach(district => {
            minX = Math.min(minX, district.worldBounds.minX);
            maxX = Math.max(maxX, district.worldBounds.maxX);
            minZ = Math.min(minZ, district.worldBounds.minZ);
            maxZ = Math.max(maxZ, district.worldBounds.maxZ);
        });
        // Fallback if no items
        if (buildings.length === 0 && districts.length === 0) {
            return { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
        }
        return { minX, maxX, minZ, maxZ };
    }
    /**
     * Validate that buildings are properly contained within their parent districts
     * This helps debug coordinate system issues with the D3 treemap layout
     */
    validateBuildingDistrictContainment(buildings, districts) {
        // NEW: Calculate areas to test equal importance theory
        const buildingAreas = [];
        const violationSummary = [];
        buildings.forEach(building => {
            // Calculate building's actual bounds
            const buildingBounds = {
                minX: building.position.x - building.dimensions[0] / 2,
                maxX: building.position.x + building.dimensions[0] / 2,
                minZ: building.position.z - building.dimensions[2] / 2,
                maxZ: building.position.z + building.dimensions[2] / 2,
            };
            // Calculate area (width × depth, ignoring height)
            const area = building.dimensions[0] * building.dimensions[2];
            buildingAreas.push({
                name: building.path,
                area: area,
                dimensions: building.dimensions,
            });
            // Find the most specific district that should contain this building
            // FIXED: Handle different path structures correctly
            const containingDistricts = districts
                .filter(district => {
                // Handle empty/root district path
                if (district.path === '' || district.path === '/') {
                    return !building.path.includes('/');
                }
                // Handle case where building path is relative and doesn't include the root directory name
                // e.g., building: "index.js", district: "minimal-project"
                if (!building.path.includes('/') && district.path && !district.path.includes('/')) {
                    // This is likely a root-level file in the root directory
                    return true;
                }
                // Standard subdirectory case
                return building.path.startsWith(district.path + '/');
            })
                .sort((a, b) => b.path.length - a.path.length); // Most specific first
            if (containingDistricts.length === 0) {
                return;
            }
            const parentDistrict = containingDistricts[0];
            // Check if building extends beyond district boundaries
            const overflowsLeft = buildingBounds.minX < parentDistrict.worldBounds.minX;
            const overflowsRight = buildingBounds.maxX > parentDistrict.worldBounds.maxX;
            const overflowsTop = buildingBounds.minZ < parentDistrict.worldBounds.minZ;
            const overflowsBottom = buildingBounds.maxZ > parentDistrict.worldBounds.maxZ;
            const hasOverflow = overflowsLeft || overflowsRight || overflowsTop || overflowsBottom;
            if (hasOverflow) {
                violationSummary.push({
                    building: building.path,
                    district: parentDistrict.path || 'root',
                    leftOverflow: overflowsLeft
                        ? (buildingBounds.minX - parentDistrict.worldBounds.minX).toFixed(1)
                        : 'OK',
                    rightOverflow: overflowsRight
                        ? (buildingBounds.maxX - parentDistrict.worldBounds.maxX).toFixed(1)
                        : 'OK',
                    topOverflow: overflowsTop
                        ? (buildingBounds.minZ - parentDistrict.worldBounds.minZ).toFixed(1)
                        : 'OK',
                    bottomOverflow: overflowsBottom
                        ? (buildingBounds.maxZ - parentDistrict.worldBounds.maxZ).toFixed(1)
                        : 'OK',
                });
            }
        });
    }
}
exports.CodeCityBuilder = CodeCityBuilder;
// Predefined sizing strategy presets for common use cases
exports.SizingPresets = {
    // Best for small projects (< 50 files) - generous spacing
    smallProject: {
        adaptiveSize: true,
        sizingStrategy: 'progressive-brackets',
        minBuildingVisualSize: 16,
        padding: 8,
        paddingOuter: 16,
        paddingInner: 12,
        paddingTop: 30,
        paddingBottom: 30,
    },
    // Best for medium projects (50-500 files) - balanced approach
    mediumProject: {
        adaptiveSize: true,
        sizingStrategy: 'hierarchical-depth',
        minBuildingVisualSize: 12,
        hierarchyDepthWeight: 0.25,
        padding: 4,
        paddingOuter: 8,
        paddingInner: 6,
    },
    // Best for large projects (500+ files) - space efficient but still readable
    largeProject: {
        adaptiveSize: true,
        sizingStrategy: 'viewport-optimized',
        minBuildingVisualSize: 8,
        aspectRatioOptimization: true,
        padding: 2,
        paddingOuter: 4,
        paddingInner: 3,
    },
    // Guaranteed minimum visibility - ensures every building is at least N pixels
    guaranteedVisibility: {
        adaptiveSize: true,
        sizingStrategy: 'minimum-area-guarantee',
        guaranteedMinArea: 64, // 8x8 minimum
        minBuildingVisualSize: 10,
        padding: 4,
        paddingOuter: 8,
    },
    // Content-aware - adapts to file sizes and directory structure
    contentAware: {
        adaptiveSize: true,
        sizingStrategy: 'content-aware',
        contentAwareScaling: true,
        padding: 4,
        paddingOuter: 6,
    },
    // Legacy mode - original behavior
    legacy: {
        adaptiveSize: true,
        sizingStrategy: 'legacy-sqrt',
        width: 1000,
        height: 800,
    },
    // Deep nesting solutions - specialized presets for deeply nested projects
    deepNestingFlattened: {
        adaptiveSize: true,
        sizingStrategy: 'hierarchical-depth',
        deepNestingStrategy: 'flatten',
        maxNestingDepth: 4,
        minBuildingVisualSize: 10,
        hierarchyDepthWeight: 0.2,
        padding: 3,
        paddingOuter: 6,
        paddingInner: 2,
    },
    deepNestingBoosted: {
        adaptiveSize: true,
        sizingStrategy: 'minimum-area-guarantee',
        deepNestingStrategy: 'boost-size',
        deepNestingSizeBoost: 2.0,
        guaranteedMinArea: 36, // 6x6 minimum
        minimumBuildingSizeOverride: true,
        minBuildingVisualSize: 8,
        padding: 2,
        paddingInner: 1,
    },
    deepNestingHybrid: {
        adaptiveSize: true,
        sizingStrategy: 'viewport-optimized',
        deepNestingStrategy: 'hybrid',
        maxNestingDepth: 5,
        deepNestingSizeBoost: 1.5,
        depthBasedPaddingReduction: true,
        minimumBuildingSizeOverride: true,
        minBuildingVisualSize: 10,
        aspectRatioOptimization: true,
        padding: 4,
        paddingInner: 3,
    },
};

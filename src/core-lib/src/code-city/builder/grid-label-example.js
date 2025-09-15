/**
 * Example of using the new grid cell label configuration
 *
 * This demonstrates how to add labels above or below grid cells
 * in the code city visualization.
 */
import { CodeCityBuilderWithGrid } from './CodeCityBuilderWithGrid';
// Example 1: Basic 2x2 grid with default labels (enabled by default, positioned at top)
export function createGridWithDefaultLabels(fileTree) {
    const builder = new CodeCityBuilderWithGrid();
    const options = {
        gridLayout: {
            id: 'default-labels-example',
            version: '1.0',
            name: 'Default Labels Example',
            description: 'Example showing default label configuration',
            overviewPath: 'README.md',
            cells: {
                'Source Code': {
                    files: ['src'],
                    coordinates: [0, 0],
                },
                Documentation: {
                    files: ['docs'],
                    coordinates: [0, 1],
                },
                Tests: {
                    files: ['test*', '__tests__'],
                    coordinates: [1, 0],
                },
                Configuration: {
                    files: ['config', '.github'],
                    coordinates: [1, 1],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                    // Labels are enabled by default with position 'top' and height = 10% of cell height
                    // (with bounds: minimum 20px, maximum 60px)
                    // No need to specify unless you want to override
                    cellPadding: 10,
                },
            },
        },
    };
    return builder.buildCityFromFileSystem(fileTree, '/', options);
}
// Example 2: Grid with labels below cells
export function createGridWithBottomLabels(fileTree) {
    const builder = new CodeCityBuilderWithGrid();
    const options = {
        gridLayout: {
            id: 'bottom-labels-example',
            version: '1.0',
            name: 'Bottom Labels Example',
            description: 'Example with labels positioned below cells',
            overviewPath: 'README.md',
            cells: {
                Frontend: {
                    files: ['client', 'ui', 'frontend'],
                    coordinates: [0, 0],
                },
                Backend: {
                    files: ['server', 'api', 'backend'],
                    coordinates: [0, 1],
                },
                Shared: {
                    files: ['shared', 'common', 'lib'],
                    coordinates: [0, 2],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 1,
                    cols: 3,
                    // Labels positioned below cells
                    showCellLabels: true,
                    cellLabelPosition: 'bottom',
                    cellLabelHeightPercent: 0.08, // 8% of cell height for more compact labels
                    cellPadding: 15,
                },
            },
        },
    };
    return builder.buildCityFromFileSystem(fileTree, '/', options);
}
// Example 3: Grid without labels (explicitly disabled)
export function createGridWithoutLabels(fileTree) {
    const builder = new CodeCityBuilderWithGrid();
    const options = {
        gridLayout: {
            id: 'no-labels-example',
            version: '1.0',
            name: 'No Labels Example',
            description: 'Grid layout with labels explicitly disabled',
            overviewPath: 'README.md',
            cells: {
                main: {
                    files: ['src'],
                    coordinates: [0, 0],
                },
                tests: {
                    files: ['test*'],
                    coordinates: [1, 0],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                    // Explicitly disable labels (they're now enabled by default)
                    showCellLabels: false,
                    cellPadding: 10,
                },
            },
        },
    };
    return builder.buildCityFromFileSystem(fileTree, '/', options);
}
// Example 4: Different label sizing approaches
export function createGridWithCustomLabelSizing(fileTree) {
    const builder = new CodeCityBuilderWithGrid();
    const options = {
        gridLayout: {
            id: 'custom-sizing-example',
            version: '1.0',
            name: 'Custom Label Sizing Example',
            description: 'Demonstrates different label sizing approaches',
            overviewPath: 'README.md',
            cells: {
                'Application Core': {
                    files: ['src/core'],
                    coordinates: [0, 0],
                },
                'User Interface Components': {
                    files: ['src/components'],
                    coordinates: [0, 1],
                },
                'Business Logic': {
                    files: ['src/services'],
                    coordinates: [0, 2],
                },
                'Data Management': {
                    files: ['src/data'],
                    coordinates: [1, 0],
                },
                'Utilities & Helpers': {
                    files: ['src/utils'],
                    coordinates: [1, 1],
                },
                'External Integrations': {
                    files: ['src/integrations'],
                    coordinates: [1, 2],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 3,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                    // Option 1: Use percentage-based sizing (recommended)
                    cellLabelHeightPercent: 0.12, // 12% of cell height
                    // Option 2: Use fixed pixel height (alternative)
                    // cellLabelHeight: 35,
                    cellPadding: 12,
                },
            },
        },
    };
    return builder.buildCityFromFileSystem(fileTree, '/', options);
}
// Example 5: Responsive label sizing for different cell sizes
export function createResponsiveGridLabels(fileTree) {
    const builder = new CodeCityBuilderWithGrid();
    const options = {
        gridLayout: {
            id: 'responsive-labels-example',
            version: '1.0',
            name: 'Responsive Labels Example',
            description: 'Example of responsive label sizing for different cell sizes',
            overviewPath: 'README.md',
            cells: {
                Core: { files: ['src/core'], coordinates: [0, 0] },
                Components: { files: ['src/components'], coordinates: [0, 1] },
                Services: { files: ['src/services'], coordinates: [0, 2] },
                Utils: { files: ['src/utils'], coordinates: [1, 0] },
                Tests: { files: ['test*', '__tests__'], coordinates: [1, 1] },
                Docs: { files: ['docs'], coordinates: [1, 2] },
                Config: { files: ['config', '.github'], coordinates: [2, 0] },
                Build: { files: ['build', 'dist'], coordinates: [2, 1] },
                Other: { files: ['*'], coordinates: [2, 2] },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 3,
                    cols: 3,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                    // Use 8% for more compact labels when you have many cells
                    cellLabelHeightPercent: 0.08,
                    cellPadding: 8,
                },
            },
        },
    };
    return builder.buildCityFromFileSystem(fileTree, '/', options);
}
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

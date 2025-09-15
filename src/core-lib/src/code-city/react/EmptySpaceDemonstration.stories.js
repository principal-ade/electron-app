import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CodeCityBuilderWithGrid } from '../builder/CodeCityBuilderWithGrid';
import { ArchitectureMapHighlightLayers } from './ArchitectureMapHighlightLayers';
const meta = {
    title: 'CodeCity/Empty Space Demonstration',
    component: ArchitectureMapHighlightLayers,
    parameters: {
        layout: 'fullscreen',
    },
};
export default meta;
/**
 * Creates a simple file tree with many directories but few files
 * This demonstrates the empty space issue
 */
function createSparseFileTree() {
    // Create a structure with many directories but few files
    // This mimics what happens in many real repositories
    const root = {
        name: 'root',
        path: '',
        relativePath: '',
        children: [
            {
                name: 'src',
                path: 'src',
                relativePath: 'src',
                children: [
                    {
                        name: 'components',
                        path: 'src/components',
                        relativePath: 'src/components',
                        children: [
                            {
                                name: 'Button.tsx',
                                path: 'src/components/Button.tsx',
                                relativePath: 'src/components/Button.tsx',
                                size: 1000,
                                extension: '.tsx',
                            },
                        ],
                        fileCount: 1,
                        totalSize: 1000,
                        depth: 2,
                    },
                    {
                        name: 'utils',
                        path: 'src/utils',
                        relativePath: 'src/utils',
                        children: [
                            {
                                name: 'helpers.ts',
                                path: 'src/utils/helpers.ts',
                                relativePath: 'src/utils/helpers.ts',
                                size: 500,
                                extension: '.ts',
                            },
                        ],
                        fileCount: 1,
                        totalSize: 500,
                        depth: 2,
                    },
                    {
                        name: 'hooks',
                        path: 'src/hooks',
                        relativePath: 'src/hooks',
                        children: [], // Empty directory
                        fileCount: 0,
                        totalSize: 0,
                        depth: 2,
                    },
                ],
                fileCount: 2,
                totalSize: 1500,
                depth: 1,
            },
            {
                name: 'tests',
                path: 'tests',
                relativePath: 'tests',
                children: [
                    {
                        name: 'unit',
                        path: 'tests/unit',
                        relativePath: 'tests/unit',
                        children: [], // Empty directory
                        fileCount: 0,
                        totalSize: 0,
                        depth: 2,
                    },
                    {
                        name: 'integration',
                        path: 'tests/integration',
                        relativePath: 'tests/integration',
                        children: [], // Empty directory
                        fileCount: 0,
                        totalSize: 0,
                        depth: 2,
                    },
                ],
                fileCount: 0,
                totalSize: 0,
                depth: 1,
            },
            {
                name: 'docs',
                path: 'docs',
                relativePath: 'docs',
                children: [], // Empty directory
                fileCount: 0,
                totalSize: 0,
                depth: 1,
            },
        ],
        fileCount: 2,
        totalSize: 1500,
        depth: 0,
    };
    return {
        root,
        stats: {
            totalFiles: 2,
            totalDirectories: 8, // root + src + components + utils + hooks + tests + unit + integration + docs
            totalSize: 1500,
            maxDepth: 2,
            buildingTypeDistribution: {},
            directoryTypeDistribution: {},
            combinedTypeDistribution: {},
        },
        allFiles: [
            {
                name: 'Button.tsx',
                path: 'src/components/Button.tsx',
                relativePath: 'src/components/Button.tsx',
                size: 1000,
                extension: '.tsx',
            },
            {
                name: 'helpers.ts',
                path: 'src/utils/helpers.ts',
                relativePath: 'src/utils/helpers.ts',
                size: 500,
                extension: '.ts',
            },
        ],
        allDirectories: [],
        sha: 'demo',
    };
}
/**
 * Builds city data with different sizing strategies to show the empty space issue
 */
function buildCityWithStrategy(tree, strategy, disableAutomaticSpacing) {
    const builder = new CodeCityBuilderWithGrid();
    return builder.buildCityFromFileSystem(tree, '', {
        sizingStrategy: strategy,
        disableAutomaticSpacing,
        minBuildingVisualSize: 6,
        paddingInner: 2,
        paddingOuter: 4,
    });
}
/**
 * Default behavior - shows empty space issue
 *
 * With only 2 files and 8 directories, the legacy-sqrt strategy
 * calculates a large minimum dimension due to the directory multiplier.
 * This creates significant empty space in the visualization.
 */
export const DefaultWithEmptySpace = {
    render: () => {
        const cityData = buildCityWithStrategy(createSparseFileTree(), 'legacy-sqrt');
        console.log('DefaultWithEmptySpace cityData:', cityData);
        // Debug visualization to see if we have data
        if (!cityData || !cityData.buildings || cityData.buildings.length === 0) {
            return (_jsxs("div", { style: { color: 'red', padding: '20px' }, children: ["No city data or buildings generated!", _jsx("pre", { children: JSON.stringify(cityData, null, 2) })] }));
        }
        // Calculate empty space percentage
        const totalArea = (cityData.bounds.maxX - cityData.bounds.minX) * (cityData.bounds.maxZ - cityData.bounds.minZ);
        const buildingArea = cityData.buildings.reduce((sum, b) => sum + b.dimensions[0] * b.dimensions[2], 0);
        const emptySpacePercent = (((totalArea - buildingArea) / totalArea) * 100).toFixed(1);
        return (_jsxs("div", { style: { width: '100%', height: '100%', background: '#1a1a1a', position: 'relative' }, children: [_jsxs("div", { style: {
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.8)',
                        padding: '10px',
                        borderRadius: '5px',
                        color: 'white',
                        fontSize: '14px',
                    }, children: [_jsxs("div", { children: ["Canvas Size: ", Math.round(cityData.bounds.maxX), "\u00D7", Math.round(cityData.bounds.maxZ), "px"] }), _jsxs("div", { children: ["Buildings: ", cityData.buildings.length] }), _jsxs("div", { children: ["Districts: ", cityData.districts.length] }), _jsxs("div", { style: { color: '#ff6b6b', fontWeight: 'bold' }, children: ["Empty Space: ", emptySpacePercent, "%"] })] }), _jsx("div", { style: { width: '100%', height: '600px' }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData, fullSize: true, showGrid: true }) })] }));
    },
    parameters: {
        docs: {
            description: {
                story: `
This demonstrates the empty space issue in clean repositories.

**The Problem:**
- Repository has only 2 files but 8 directories
- The directoryMultiplier = 8/2 = 4
- Minimum dimension = max(1000, 50 * sqrt(2) * (1 + 4)) ≈ max(1000, 354) = 1000
- This creates a 1000x1000 canvas for just 2 small files!

**Result:** Large empty areas because the actual content doesn't need all that allocated space.
        `,
            },
        },
    },
};
/**
 * With automatic spacing disabled
 *
 * Even with automatic spacing disabled, the minimum dimension
 * enforcement still creates empty space.
 */
export const WithSpacingDisabled = {
    render: () => {
        const cityData = buildCityWithStrategy(createSparseFileTree(), 'legacy-sqrt', true);
        return (_jsx("div", { style: { width: '100%', height: '600px', background: '#1a1a1a' }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData }) }));
    },
    parameters: {
        docs: {
            description: {
                story: `
Same structure but with automatic spacing disabled.

The minimum dimension enforcement (1000x1000) still applies,
so we still get empty space even though automatic spacing is off.
        `,
            },
        },
    },
};
/**
 * Progressive brackets strategy - even more empty space for small projects
 */
export const ProgressiveBracketsStrategy = {
    render: () => {
        const cityData = buildCityWithStrategy(createSparseFileTree(), 'progressive-brackets');
        return (_jsx("div", { style: { width: '100%', height: '600px', background: '#1a1a1a' }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData }) }));
    },
    parameters: {
        docs: {
            description: {
                story: `
Progressive brackets strategy gives generous spacing to small projects.

**Calculation:**
- Total items = 2 files + 8 directories = 10 (small project)
- Area = 2 files * 400 (generous) + 8 directories * 100 = 800 + 800 = 1600
- Dimension = sqrt(1600) = 40

But then the minimum dimension enforcement kicks in:
- minDimension = max(1000, 50 * sqrt(2) * 5) = 1000

So we still get a 1000x1000 canvas with lots of empty space.
        `,
            },
        },
    },
};
/**
 * Minimum area guarantee with buffer - shows the 50% buffer effect
 */
export const MinimumAreaWithBuffer = {
    render: () => {
        const cityData = buildCityWithStrategy(createSparseFileTree(), 'minimum-area-guarantee');
        return (_jsx("div", { style: { width: '100%', height: '600px', background: '#1a1a1a' }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData }) }));
    },
    parameters: {
        docs: {
            description: {
                story: `
Minimum area guarantee strategy with default 50% buffer.

**Calculation:**
- Building area = 2 files * 36 = 72
- District overhead = 8 directories * 44 = 352
- Total = (72 + 352) * 1.5 (buffer) = 636
- Dimension = sqrt(636) ≈ 25

But minimum dimension enforcement makes it 1000x1000 anyway.

The 50% buffer (1.5x multiplier) would be more noticeable in larger projects.
        `,
            },
        },
    },
};
/**
 * Comparison view showing all strategies side by side
 */
export const ComparisonView = {
    render: () => {
        const tree = createSparseFileTree();
        const strategies = [
            { name: 'Legacy Sqrt', strategy: 'legacy-sqrt' },
            { name: 'Progressive Brackets', strategy: 'progressive-brackets' },
            { name: 'Min Area + Buffer', strategy: 'minimum-area-guarantee' },
        ];
        return (_jsx("div", { style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                padding: '20px',
                background: '#1a1a1a',
            }, children: strategies.map(({ name, strategy }) => {
                const cityData = buildCityWithStrategy(tree, strategy);
                const totalArea = (cityData.bounds.maxX - cityData.bounds.minX) *
                    (cityData.bounds.maxZ - cityData.bounds.minZ);
                const buildingArea = cityData.buildings.reduce((sum, b) => sum + b.dimensions[0] * b.dimensions[2], 0);
                const emptySpacePercent = (((totalArea - buildingArea) / totalArea) * 100).toFixed(1);
                return (_jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h3", { style: { color: 'white', marginBottom: '10px' }, children: name }), _jsx("div", { style: { height: '300px', border: '1px solid #444' }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData }) }), _jsxs("div", { style: { color: '#aaa', marginTop: '10px', fontSize: '14px' }, children: [_jsxs("div", { children: ["Canvas: ", Math.round(cityData.bounds.maxX), "\u00D7", Math.round(cityData.bounds.maxZ)] }), _jsxs("div", { children: ["Empty Space: ", emptySpacePercent, "%"] }), _jsxs("div", { children: ["Files: ", tree.stats.totalFiles] }), _jsxs("div", { children: ["Directories: ", tree.stats.totalDirectories] })] })] }, strategy));
            }) }));
    },
    parameters: {
        docs: {
            description: {
                story: `
Side-by-side comparison showing how different strategies handle sparse file trees.

All strategies result in significant empty space due to:
1. Minimum dimension enforcement (1000×1000)
2. Directory multiplier effect
3. Buffer multipliers (for some strategies)

This explains why clean repositories show empty blocks in the visualization.
        `,
            },
        },
    },
};

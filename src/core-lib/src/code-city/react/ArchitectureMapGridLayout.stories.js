import { jsx as _jsx } from "react/jsx-runtime";
import { CodeCityBuilderWithGrid } from '../builder/CodeCityBuilderWithGrid';
import { buildFileSystemTreeFromFileInfoList } from '../builder/FileTreeBuilder';
import { ArchitectureMapHighlightLayers } from './ArchitectureMapHighlightLayers';
const meta = {
    title: 'Code City/Grid Layout',
    component: ArchitectureMapHighlightLayers,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        Story => (_jsx("div", { style: { width: '100vw', height: '100vh' }, children: _jsx(Story, {}) })),
    ],
};
export default meta;
// Helper function to create city data with grid layout
function createGridLayoutCityData(config, customFilePaths) {
    // Create a mock file tree with typical monorepo structure
    const filePaths = customFilePaths || [
        // Core source files
        'src/index.ts',
        'src/components/App.tsx',
        'src/components/Header.tsx',
        'src/utils/helpers.ts',
        'lib/core.ts',
        'lib/utils.ts',
        // Configuration
        '.a24z/config.json',
        '.principleMD/settings.json',
        'config/webpack.config.js',
        // Documentation
        'docs/README.md',
        'docs/API.md',
        'examples/basic.ts',
        'examples/advanced.ts',
        // Testing
        'tests/unit/app.test.ts',
        'tests/integration/api.test.ts',
        '__tests__/components.test.tsx',
        'test-utils/helpers.ts',
        // Build outputs
        'dist/bundle.js',
        'build/index.html',
        '.next/static/chunks/pages.js',
        // Dependencies
        'node_modules/react/index.js',
        'node_modules/typescript/lib/typescript.js',
        'packages/shared/index.ts',
        'packages/ui/components.tsx',
        // Assets
        'public/index.html',
        'public/favicon.ico',
        'static/logo.svg',
        'assets/styles.css',
        // Root files
        'package.json',
        'README.md',
        '.gitignore',
        'tsconfig.json',
    ];
    // Convert file paths to FileInfo objects
    const fileInfos = filePaths.map(path => ({
        name: path.split('/').pop() || path,
        path: path,
        relativePath: path,
        size: Math.random() * 10000, // Random size for demo
        extension: path.includes('.') ? '.' + path.split('.').pop() : '',
        lastModified: new Date(),
        isDirectory: false,
    }));
    // Build a proper file tree with hierarchy
    const fileTree = buildFileSystemTreeFromFileInfoList(fileInfos, 'demo-sha');
    const cityBuilder = new CodeCityBuilderWithGrid();
    // Use the new integrated grid layout builder with adaptive sizing
    // This allows the grid to calculate its own optimal dimensions
    return cityBuilder.buildCityFromFileSystem(fileTree, '', {
        gridLayout: config,
    });
}
// Minimal config - tests default UI metadata
export const DefaultsTest = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'defaults-test',
            version: '1.0.0',
            name: 'Test Default UI Settings',
            description: 'Tests default UI metadata settings when none are provided',
            overviewPath: 'README.md',
            cells: {
                Source: {
                    files: ['src', 'lib'],
                    coordinates: [0, 0],
                },
                Config: {
                    files: ['config', '.*'],
                    coordinates: [0, 1],
                },
                Tests: {
                    files: ['test*', '__tests__'],
                    coordinates: [1, 0],
                },
                Build: {
                    files: ['dist', 'build', 'node_modules'],
                    coordinates: [1, 1],
                },
            },
            // No metadata.ui provided - should use defaults
        }),
        showGrid: true,
        showFileNames: false,
        showDirectoryLabels: true,
        fullSize: true,
    },
};
// 2x2 Grid Layout with Labels
export const TwoByTwoGrid = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'two-by-two-grid',
            version: '1.0.0',
            name: 'Two by Two Grid Layout',
            description: 'A 2x2 grid layout organizing code into four quadrants',
            overviewPath: 'README.md',
            cells: {
                'Source Code': {
                    files: ['src', 'lib'],
                    coordinates: [0, 0],
                },
                Configuration: {
                    files: ['.a24z', '.principleMD', 'config'],
                    coordinates: [0, 1],
                },
                Testing: {
                    files: ['test*', '__tests__'],
                    coordinates: [1, 0],
                },
                Dependencies: {
                    files: ['node_modules', 'packages'],
                    coordinates: [1, 1],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                    cellLabelHeightPercent: 0.12, // 12% of cell height for visibility
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        showDirectoryLabels: true, // Make sure directory labels are enabled
        fullSize: true,
    },
};
// 3x3 Grid Layout (More Complex)
export const ThreeByThreeGrid = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'three-by-three-grid',
            version: '1.0.0',
            name: 'Three by Three Grid Layout',
            description: 'A 3x3 grid layout with core components in the center',
            overviewPath: 'README.md',
            cells: {
                core: {
                    files: ['src', 'lib'],
                    coordinates: [1, 1], // Center
                    priority: 10,
                },
                config: {
                    files: ['.a24z', '.principleMD', 'config'],
                    coordinates: [0, 1], // Top center
                    priority: 8,
                },
                docs: {
                    files: ['docs', 'examples'],
                    coordinates: [0, 0], // Top left
                },
                testing: {
                    files: ['test*', '__tests__'],
                    coordinates: [2, 1], // Bottom center
                },
                dependencies: {
                    files: ['node_modules', 'vendor'],
                    coordinates: [2, 2], // Bottom right
                },
                packages: {
                    files: ['packages'],
                    coordinates: [1, 2], // Middle right
                },
                build: {
                    files: ['dist', 'build', '.next'],
                    coordinates: [2, 0], // Bottom left
                },
                assets: {
                    files: ['public', 'static', 'assets'],
                    coordinates: [0, 2], // Top right
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 3,
                    cols: 3,
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Centered Core Pattern
export const CenteredCore = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'centered-core',
            version: '1.0.0',
            name: 'Centered Core Layout',
            description: 'Layout with core functionality in the center and supporting elements around it',
            overviewPath: 'README.md',
            cells: {
                'core-and-config': {
                    files: ['src', 'lib', '.a24z', '.principleMD'],
                    coordinates: [1, 1], // Everything important in center
                    priority: 10,
                },
                documentation: {
                    files: ['docs', 'README*'],
                    coordinates: [0, 1], // Top
                },
                testing: {
                    files: ['test*', '__tests__', 'spec'],
                    coordinates: [2, 1], // Bottom
                },
                support: {
                    files: ['scripts', 'tools', 'utils'],
                    coordinates: [1, 0], // Left
                },
                output: {
                    files: ['dist', 'build', 'out'],
                    coordinates: [1, 2], // Right
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 3,
                    cols: 3,
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Priority-Based Assignment (demonstrates conflict resolution)
export const PriorityBasedAssignment = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'priority-based',
            version: '1.0.0',
            name: 'Priority Based Assignment',
            description: 'Demonstrates priority-based conflict resolution for overlapping patterns',
            overviewPath: 'README.md',
            cells: {
                'all-test-related': {
                    files: ['test*', '__tests__', '*utils'], // test-utils matches both
                    coordinates: [0, 0],
                    priority: 5, // Lower priority
                },
                'utility-focused': {
                    files: ['*utils', 'helpers', 'tools'],
                    coordinates: [0, 1],
                    priority: 10, // Higher priority wins for test-utils
                },
                core: {
                    files: ['src', 'lib'],
                    coordinates: [1, 0],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Single Column Layout (for narrow spaces)
export const SingleColumnLayout = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'single-column',
            version: '1.0.0',
            name: 'Single Column Layout',
            description: 'Vertical single-column layout for narrow display spaces',
            overviewPath: 'docs/overview.md',
            cells: {
                config: {
                    files: ['.a24z', '.principleMD', 'config'],
                    coordinates: [0, 0], // Top
                },
                core: {
                    files: ['src', 'lib'],
                    coordinates: [1, 0],
                },
                testing: {
                    files: ['test*', '__tests__'],
                    coordinates: [2, 0],
                },
                output: {
                    files: ['dist', 'build', 'node_modules'],
                    coordinates: [3, 0], // Bottom
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 4,
                    cols: 1,
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Labels Test - Demonstrates the new label feature
export const LabelsDemo = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'labels-demo',
            version: '1.0.0',
            name: 'Labels Demo',
            description: 'Demonstrates cell label rendering with various configurations',
            overviewPath: 'README.md',
            cells: {
                Core: {
                    files: ['src', 'lib'],
                    coordinates: [0, 0],
                },
                Tests: {
                    files: ['test*', '__tests__'],
                    coordinates: [0, 1],
                },
                Docs: {
                    files: ['docs', 'examples'],
                    coordinates: [0, 2],
                },
                Config: {
                    files: ['.a24z', 'config'],
                    coordinates: [1, 0],
                },
                Assets: {
                    files: ['public', 'static'],
                    coordinates: [1, 1],
                },
                Build: {
                    files: ['dist', 'build'],
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
                    cellLabelHeightPercent: 0.15, // 15% for extra visibility
                    cellPadding: 15,
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        showDirectoryLabels: true,
        fullSize: true,
    },
};
// ============================================================================
// PATTERN MATCHING DEMONSTRATIONS
// ============================================================================
// Demonstrates all pattern types including wildcards and globstars
export const PatternMatchingShowcase = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'pattern-matching',
            version: '1.0.0',
            name: 'Pattern Matching Showcase',
            description: 'Showcases various glob pattern matching capabilities',
            overviewPath: 'README.md',
            cells: {
                'Exact Match': {
                    files: ['package.json', 'README.md', 'tsconfig.json'],
                    coordinates: [0, 0],
                },
                'Wildcard Extension': {
                    files: ['*.ts', '*.tsx'], // Matches files with these extensions in root
                    coordinates: [0, 1],
                },
                'Directory Wildcard': {
                    files: ['src/*.ts', 'lib/*.ts'], // Direct children only
                    coordinates: [0, 2],
                },
                'Globstar Recursive': {
                    files: ['src/**/*.tsx'], // All .tsx files under src, recursively
                    coordinates: [1, 0],
                },
                'Multiple Wildcards': {
                    files: ['test*/*', '__tests__/*'], // Anything in test-prefixed dirs
                    coordinates: [1, 1],
                },
                'Complex Glob': {
                    files: ['**/components/**/*.tsx'], // Components at any depth
                    coordinates: [1, 2],
                },
                'Directory Match': {
                    files: ['docs', 'examples'], // Matches entire directories
                    coordinates: [2, 0],
                },
                'Mixed Patterns': {
                    files: ['config/**', 'public/**', 'static/**'], // Multiple directory patterns
                    coordinates: [2, 1],
                },
                'Build Outputs': {
                    files: ['dist/**', 'build/**', '.next/**'],
                    coordinates: [2, 2],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 3,
                    cols: 3,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                },
            },
        }),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Demonstrates negation patterns (exclusion)
export const NegationPatterns = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'negation-patterns',
            version: '1.0.0',
            name: 'Negation Patterns',
            description: 'Demonstrates exclusion patterns with negation',
            overviewPath: 'README.md',
            cells: {
                'Source (No Tests)': {
                    files: [
                        'src/**/*.ts',
                        'src/**/*.tsx',
                        '!src/**/*.test.*',
                        '!src/**/*.spec.*',
                        '!src/**/*.stories.*',
                    ],
                    coordinates: [0, 0],
                },
                'Tests Only': {
                    files: ['src/**/*.test.*', 'src/**/*.spec.*', 'tests/**', '__tests__/**'],
                    coordinates: [0, 1],
                },
                'Config (No JSON)': {
                    files: [
                        'config/**',
                        '!config/**/*.json', // Exclude JSON files
                    ],
                    coordinates: [0, 2],
                },
                'Docs (No Examples)': {
                    files: [
                        'docs/**',
                        'examples/**',
                        '!examples/**', // This negates the examples inclusion
                    ],
                    coordinates: [1, 0],
                },
                'All Except Tests': {
                    files: ['!**/*.test.*', '!**/*.spec.*', '!tests/**', '!__tests__/**'],
                    coordinates: [1, 1],
                },
                'Dependencies (No Node)': {
                    files: [
                        'packages/**',
                        '!node_modules/**', // Would exclude if node_modules was included
                    ],
                    coordinates: [1, 2],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 3,
                    showCellLabels: true,
                },
            },
        }, 
        // Extended file list for better negation demonstration
        [
            'src/index.ts',
            'src/app.ts',
            'src/app.test.ts',
            'src/app.spec.ts',
            'src/app.stories.ts',
            'src/components/Button.tsx',
            'src/components/Button.test.tsx',
            'src/components/Button.stories.tsx',
            'src/utils/helpers.ts',
            'src/utils/helpers.test.ts',
            'tests/e2e/app.test.ts',
            'tests/unit/utils.test.ts',
            '__tests__/integration.test.ts',
            'config/webpack.config.js',
            'config/settings.json',
            'config/env.js',
            'docs/README.md',
            'docs/API.md',
            'examples/basic.ts',
            'examples/advanced.ts',
            'packages/shared/index.ts',
            'packages/ui/button.tsx',
            'node_modules/react/index.js',
        ]),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Real-world Electron app pattern (like your Window.electron example)
export const ElectronAppPattern = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'electron-app',
            version: '1.0.0',
            name: 'Electron App Pattern',
            description: 'Grid layout for Electron application structure',
            overviewPath: 'README.md',
            cells: {
                'Electron Renderer (Prod)': {
                    files: [
                        'electron-react/src/renderer/**/*.ts',
                        'electron-react/src/renderer/**/*.tsx',
                        '!electron-react/src/renderer/**/*.test.*',
                        '!electron-react/src/renderer/**/*.spec.*',
                    ],
                    coordinates: [0, 0],
                    priority: 100,
                    metadata: {
                        ui: {
                            color: '#ff6b6b',
                        },
                    },
                    experimentalMetadata: {
                        errorType: 'TS2551',
                        description: "Property 'electron' does not exist on Window",
                    },
                },
                'Electron Main': {
                    files: ['electron-react/src/main/**/*.ts', '!electron-react/src/main/**/*.test.*'],
                    coordinates: [0, 1],
                    metadata: {
                        ui: {
                            color: '#6b9fff',
                        },
                    },
                },
                'Electron Tests': {
                    files: ['electron-react/**/*.test.*', 'electron-react/**/*.spec.*'],
                    coordinates: [0, 2],
                    metadata: {
                        ui: {
                            color: '#9fff6b',
                        },
                    },
                },
                'Shared Code': {
                    files: ['electron-react/src/shared/**', '!electron-react/src/shared/**/*.test.*'],
                    coordinates: [1, 0],
                },
                'Preload Scripts': {
                    files: ['electron-react/src/preload/**/*.ts'],
                    coordinates: [1, 1],
                },
                'Build & Config': {
                    files: ['electron-react/*.json', 'electron-react/*.config.*', 'electron-react/.erb/**'],
                    coordinates: [1, 2],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 3,
                    showCellLabels: true,
                },
            },
        }, 
        // Electron-specific file structure
        [
            'electron-react/src/renderer/App.tsx',
            'electron-react/src/renderer/App.test.tsx',
            'electron-react/src/renderer/index.tsx',
            'electron-react/src/renderer/components/Settings.tsx',
            'electron-react/src/renderer/components/Settings.test.tsx',
            'electron-react/src/renderer/hooks/useElectron.ts',
            'electron-react/src/renderer/hooks/useElectron.test.ts',
            'electron-react/src/main/main.ts',
            'electron-react/src/main/main.test.ts',
            'electron-react/src/main/menu.ts',
            'electron-react/src/main/preload.ts',
            'electron-react/src/preload/index.ts',
            'electron-react/src/preload/bridge.ts',
            'electron-react/src/shared/types.ts',
            'electron-react/src/shared/constants.ts',
            'electron-react/src/shared/constants.test.ts',
            'electron-react/package.json',
            'electron-react/electron-builder.json',
            'electron-react/tsconfig.json',
            'electron-react/.erb/configs/webpack.config.base.ts',
            'electron-react/.erb/configs/webpack.config.renderer.prod.ts',
        ]),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};
// Directory-Only Structure Test (Validates the bug fix)
export const DirectoryOnlyStructure = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'directory-only-fix',
            version: '1.0.0',
            name: 'Directory Only Structure Test',
            description: 'Tests the fix for directories that contain only subdirectories (no direct files)',
            overviewPath: 'README.md',
            cells: {
                Source: {
                    files: ['src/**'],
                    coordinates: [0, 0],
                },
                Configs: {
                    files: ['config/**', '.a24z/**'],
                    coordinates: [0, 1],
                },
                Tests: {
                    files: ['tests/**', '__tests__/**'],
                    coordinates: [1, 0],
                },
                Docs: {
                    files: ['docs/**'],
                    coordinates: [1, 1],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                },
            },
        }, 
        // File structure that creates directory-only scenarios
        [
            // 'src' directory only contains 'components' and 'utils' subdirectories
            'src/components/atoms/Button.tsx',
            'src/components/atoms/Input.tsx',
            'src/components/molecules/Form.tsx',
            'src/components/molecules/Card.tsx',
            'src/utils/helpers.ts',
            'src/utils/api.ts',
            // 'config' directory only contains 'environments' subdirectory
            'config/environments/dev.json',
            'config/environments/prod.json',
            // 'tests' directory structure
            'tests/unit/components.test.ts',
            'tests/integration/api.test.ts',
            '__tests__/setup.ts',
            // 'docs' directory structure
            'docs/api/endpoints.md',
            'docs/guides/getting-started.md',
            // Deep nesting test
            'deeply/nested/folder/structure/file1.ts',
            'deeply/nested/folder/structure/file2.ts',
            'deeply/nested/another/path/file3.ts',
        ]),
        showGrid: true,
        showFileNames: false,
        showDirectoryLabels: true,
        fullSize: true,
    },
};
// Advanced bash-style patterns
export const BashStylePatterns = {
    args: {
        cityData: createGridLayoutCityData({
            id: 'bash-style',
            version: '1.0.0',
            name: 'Bash Style Patterns',
            description: 'Advanced bash-style glob patterns including brace expansion',
            overviewPath: 'README.md',
            cells: {
                'Brace Expansion': {
                    files: [
                        'src/{components,hooks,utils}/**/*.{ts,tsx}',
                        '!src/{components,hooks,utils}/**/*.test.*',
                    ],
                    coordinates: [0, 0],
                },
                'Character Classes': {
                    files: [
                        'src/**/[A-Z]*.tsx', // Components starting with uppercase
                        'src/**/*.[jt]s', // .js or .ts files
                    ],
                    coordinates: [0, 1],
                },
                'Question Mark': {
                    files: [
                        'src/components/?.tsx', // Single character components
                        'config/env.?s', // env.js or env.ts
                    ],
                    coordinates: [1, 0],
                },
                Extglobs: {
                    files: [
                        'src/**/!(*.test|*.spec).ts', // Not test or spec files
                        'docs/!(README).md', // All markdown except README
                    ],
                    coordinates: [1, 1],
                },
            },
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                    showCellLabels: true,
                },
            },
        }, [
            'src/components/Button.tsx',
            'src/components/Button.test.tsx',
            'src/components/A.tsx',
            'src/components/B.tsx',
            'src/hooks/useAuth.ts',
            'src/hooks/useAuth.test.ts',
            'src/utils/format.ts',
            'src/utils/format.test.ts',
            'src/services/Api.tsx',
            'src/services/api.js',
            'config/env.js',
            'config/env.ts',
            'docs/README.md',
            'docs/API.md',
            'docs/GUIDE.md',
        ]),
        showGrid: true,
        showFileNames: false,
        fullSize: true,
    },
};

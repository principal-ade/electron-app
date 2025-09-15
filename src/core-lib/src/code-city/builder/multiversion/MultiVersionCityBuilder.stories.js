import { jsx as _jsx } from "react/jsx-runtime";
import { ArchitectureMapHighlightLayers } from '../../react/ArchitectureMapHighlightLayers';
import { buildFileSystemTreeFromFileInfoList } from '../FileTreeBuilder';
import { MultiVersionCityBuilder } from './MultiVersionCityBuilder';
const meta = {
    title: 'Code City/Multi-Version Builder',
    component: ArchitectureMapHighlightLayers,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        Story => (_jsx("div", { style: { width: '100vw', height: '100vh' }, children: _jsx(Story, {}) })),
    ],
};
export default meta;
// Helper function to create version-specific file lists for grid demo
function createVersionFiles(version) {
    const baseFiles = [
        'package.json',
        'README.md',
        'tsconfig.json',
        'src/index.ts',
        'src/types/core.ts',
        'src/utils/helpers.ts',
    ];
    const v1Files = [
        ...baseFiles,
        'src/components/App.tsx',
        'src/components/Header.tsx',
        'src/components/Footer.tsx',
        'src/legacy/oldComponent.tsx',
        'src/legacy/deprecated.ts',
    ];
    const v2Files = [
        ...baseFiles,
        'src/components/App.tsx',
        'src/components/Header.tsx',
        'src/components/NavigationBar.tsx',
        'src/components/Sidebar.tsx',
        'src/features/auth/login.tsx',
        'src/features/auth/register.tsx',
    ];
    const v3Files = [
        ...baseFiles,
        'src/components/App.tsx',
        'src/components/Header.tsx',
        'src/components/NavigationBar.tsx',
        'src/components/Sidebar.tsx',
        'src/features/auth/login.tsx',
        'src/features/auth/register.tsx',
        'src/features/auth/oauth.tsx',
        'src/features/dashboard/index.tsx',
        'src/features/dashboard/widgets.tsx',
        'src/hooks/useAuth.ts',
        'src/hooks/useDashboard.ts',
        'tests/unit/auth.test.ts',
        'tests/integration/dashboard.test.ts',
    ];
    const fileList = version === 'v1' ? v1Files : version === 'v2' ? v2Files : v3Files;
    return fileList.map(path => ({
        name: path.split('/').pop() || path,
        path: path,
        relativePath: path,
        size: Math.random() * 10000 + 500,
        extension: path.includes('.') ? '.' + path.split('.').pop() : '',
        lastModified: new Date(),
        isDirectory: false,
    }));
}
// Multi-version with 2x2 grid layout
export const MultiVersionGrid2x2 = {
    render: () => {
        const v1Tree = buildFileSystemTreeFromFileInfoList(createVersionFiles('v1'), 'v1-sha');
        const v2Tree = buildFileSystemTreeFromFileInfoList(createVersionFiles('v2'), 'v2-sha');
        const v3Tree = buildFileSystemTreeFromFileInfoList(createVersionFiles('v3'), 'v3-sha');
        const versionTrees = new Map([
            ['v1', v1Tree],
            ['v2', v2Tree],
            ['v3', v3Tree],
        ]);
        const gridConfig = {
            id: 'multi-version-2x2',
            version: '1.0.0',
            name: 'Multi-Version 2x2 Grid',
            description: 'Multi-version view with 2x2 grid layout',
            overviewPath: 'docs/overview.md',
            metadata: {
                ui: {
                    enabled: true,
                    rows: 2,
                    cols: 2,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                    cellLabelHeightPercent: 0.12,
                },
            },
            cells: {
                'Core Components': {
                    files: ['src/components', 'src/types', 'src/utils'],
                    coordinates: [0, 0],
                },
                Features: {
                    files: ['src/features'],
                    coordinates: [0, 1],
                },
                'Legacy Code': {
                    files: ['src/legacy'],
                    coordinates: [1, 0],
                },
                'Tests & Hooks': {
                    files: ['src/hooks', 'tests'],
                    coordinates: [1, 1],
                },
            },
        };
        // Build with grid layout
        const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(versionTrees, {
            gridLayout: gridConfig,
        });
        // Get view for v3 (latest)
        const v3View = MultiVersionCityBuilder.getVersionView(unionCity, presenceByVersion.get('v3'));
        return (_jsx(ArchitectureMapHighlightLayers, { cityData: v3View, showGrid: true, showFileNames: false, showDirectoryLabels: true, fullSize: true }));
    },
};
// Multi-version with 3x3 grid layout
export const MultiVersionGrid3x3 = {
    render: () => {
        // Create more comprehensive file structure for 3x3 grid
        const expandedFiles = (version) => {
            const base = createVersionFiles(version);
            // Add more files for 3x3 grid demonstration
            const additionalFiles = version === 'v3'
                ? [
                    'docs/README.md',
                    'docs/API.md',
                    'config/webpack.config.js',
                    'config/tsconfig.json',
                    'scripts/build.js',
                    'scripts/deploy.js',
                    '.github/workflows/ci.yml',
                    'public/index.html',
                    'public/assets/logo.svg',
                ]
                : [];
            return [
                ...base,
                ...additionalFiles.map(path => ({
                    name: path.split('/').pop() || path,
                    path: path,
                    relativePath: path,
                    size: Math.random() * 5000 + 1000,
                    extension: path.includes('.') ? '.' + path.split('.').pop() : '',
                    lastModified: new Date(),
                    isDirectory: false,
                })),
            ];
        };
        const v1Tree = buildFileSystemTreeFromFileInfoList(expandedFiles('v1'), 'v1-sha');
        const v2Tree = buildFileSystemTreeFromFileInfoList(expandedFiles('v2'), 'v2-sha');
        const v3Tree = buildFileSystemTreeFromFileInfoList(expandedFiles('v3'), 'v3-sha');
        const versionTrees = new Map([
            ['v1', v1Tree],
            ['v2', v2Tree],
            ['v3', v3Tree],
        ]);
        const gridConfig = {
            id: 'multi-version-3x3',
            version: '1.0.0',
            name: 'Multi-Version 3x3 Grid',
            description: 'Multi-version view with 3x3 grid layout',
            overviewPath: 'docs/overview.md',
            metadata: {
                ui: {
                    enabled: true,
                    rows: 3,
                    cols: 3,
                    showCellLabels: true,
                    cellLabelPosition: 'top',
                    cellLabelHeightPercent: 0.1,
                },
            },
            cells: {
                Core: {
                    files: ['src/components', 'src/types', 'src/utils'],
                    coordinates: [1, 1], // Center
                    priority: 10,
                },
                Features: {
                    files: ['src/features'],
                    coordinates: [0, 1], // Top center
                    priority: 8,
                },
                Documentation: {
                    files: ['docs'],
                    coordinates: [0, 0], // Top left
                },
                Testing: {
                    files: ['tests'],
                    coordinates: [2, 1], // Bottom center
                },
                Hooks: {
                    files: ['src/hooks'],
                    coordinates: [1, 2], // Middle right
                },
                Legacy: {
                    files: ['src/legacy'],
                    coordinates: [2, 0], // Bottom left
                },
                Config: {
                    files: ['config', '.github'],
                    coordinates: [0, 2], // Top right
                },
                Scripts: {
                    files: ['scripts'],
                    coordinates: [2, 2], // Bottom right
                },
                Public: {
                    files: ['public'],
                    coordinates: [1, 0], // Middle left
                },
            },
        };
        // Build with grid layout
        const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(versionTrees, {
            gridLayout: gridConfig,
        });
        // Get view for v3
        const v3View = MultiVersionCityBuilder.getVersionView(unionCity, presenceByVersion.get('v3'));
        return (_jsx(ArchitectureMapHighlightLayers, { cityData: v3View, showGrid: true, showFileNames: false, showDirectoryLabels: true, fullSize: true }));
    },
};

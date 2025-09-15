import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { CodeCityBuilderWithGrid } from '../builder/CodeCityBuilderWithGrid';
import { ArchitectureMapHighlightLayers } from './ArchitectureMapHighlightLayers';
const meta = {
    title: 'Code City/Spacing Strategies',
    component: ArchitectureMapHighlightLayers,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        Story => (_jsx("div", { style: { width: '100vw', height: '100vh' }, children: _jsx(Story, {}) })),
    ],
};
export default meta;
// Helper function to create a FileTree structure directly
function createFileTree(filePaths) {
    // Build directory structure
    const root = {
        path: '',
        name: 'root',
        children: [],
        fileCount: 0,
        totalSize: 0,
        depth: 0,
        relativePath: '',
    };
    const allFiles = [];
    const allDirectories = [root];
    const dirMap = new Map();
    dirMap.set('', root);
    // Sort paths to ensure directories are created before files
    filePaths.sort();
    for (const filePath of filePaths) {
        const parts = filePath.split('/').filter(p => p);
        let currentPath = '';
        let currentDir = root;
        // Create/traverse directory structure
        for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i];
            currentPath = currentPath ? `${currentPath}/${dirName}` : dirName;
            if (!dirMap.has(currentPath)) {
                const newDir = {
                    path: currentPath,
                    name: dirName,
                    children: [],
                    fileCount: 0,
                    totalSize: 0,
                    depth: i + 1,
                    relativePath: currentPath,
                };
                currentDir.children.push(newDir);
                dirMap.set(currentPath, newDir);
                allDirectories.push(newDir);
            }
            currentDir = dirMap.get(currentPath);
        }
        // Add file to the current directory
        const fileName = parts[parts.length - 1];
        const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
        // Skip if it's just a directory marker (ends with /)
        if (fileName && !filePath.endsWith('/')) {
            const file = {
                path: fullPath,
                name: fileName,
                extension: fileName.includes('.') ? '.' + fileName.split('.').pop() : '',
                size: Math.random() * 10000 + 1000,
                lastModified: new Date(),
                isDirectory: false,
                relativePath: fullPath,
            };
            currentDir.children.push(file);
            allFiles.push(file);
            currentDir.fileCount++;
        }
    }
    // Update file counts recursively
    const updateFileCounts = (dir) => {
        let count = 0;
        for (const child of dir.children) {
            if ('children' in child) {
                count += updateFileCounts(child);
            }
            else {
                count++;
            }
        }
        dir.fileCount = count;
        return count;
    };
    updateFileCounts(root);
    return {
        sha: 'demo-sha',
        root,
        allFiles,
        allDirectories,
        stats: {
            totalFiles: allFiles.length,
            totalDirectories: allDirectories.length,
            totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
            maxDepth: Math.max(...allDirectories.map(d => d.depth)),
            buildingTypeDistribution: {},
            directoryTypeDistribution: {},
            combinedTypeDistribution: {},
        },
    };
}
// Helper function to create city data with specific sizing strategy
function createCityWithStrategy(filePaths, strategy, additionalOptions) {
    const fileTree = createFileTree(filePaths);
    const cityBuilder = new CodeCityBuilderWithGrid();
    return cityBuilder.buildCityFromFileSystem(fileTree, '', {
        sizingStrategy: strategy,
        ...additionalOptions,
    });
}
// Small project files (< 50 files)
const smallProjectFiles = [
    'package.json',
    'README.md',
    'src/index.ts',
    'src/app.ts',
    'src/components/Button.tsx',
    'src/components/Card.tsx',
    'src/utils/helpers.ts',
    'tests/app.test.ts',
    'docs/README.md',
];
// Medium project files (50-500 files)
const mediumProjectFiles = [
    ...Array.from({ length: 15 }, (_, i) => `src/components/Component${i}.tsx`),
    ...Array.from({ length: 10 }, (_, i) => `src/hooks/useHook${i}.ts`),
    ...Array.from({ length: 10 }, (_, i) => `src/utils/util${i}.ts`),
    ...Array.from({ length: 8 }, (_, i) => `src/services/service${i}.ts`),
    ...Array.from({ length: 12 }, (_, i) => `tests/test${i}.test.ts`),
    ...Array.from({ length: 5 }, (_, i) => `docs/doc${i}.md`),
    'package.json',
    'README.md',
    'tsconfig.json',
];
// Large project files (500+ files)
const largeProjectFiles = [
    ...Array.from({ length: 100 }, (_, i) => `src/components/Component${i}.tsx`),
    ...Array.from({ length: 80 }, (_, i) => `src/hooks/useHook${i}.ts`),
    ...Array.from({ length: 60 }, (_, i) => `src/utils/util${i}.ts`),
    ...Array.from({ length: 50 }, (_, i) => `src/services/service${i}.ts`),
    ...Array.from({ length: 100 }, (_, i) => `src/features/feature${i}/index.ts`),
    ...Array.from({ length: 70 }, (_, i) => `tests/test${i}.test.ts`),
    ...Array.from({ length: 40 }, (_, i) => `docs/doc${i}.md`),
    ...Array.from({ length: 30 }, (_, i) => `lib/library${i}.ts`),
    'package.json',
    'README.md',
    'tsconfig.json',
];
// Progressive Brackets - shows automatic spacing based on project size
export const ProgressiveBracketsSmall = {
    args: {
        cityData: createCityWithStrategy(smallProjectFiles, 'progressive-brackets'),
        showGrid: false,
        showFileNames: true,
        showDirectoryLabels: true,
        fullSize: true,
    },
};
export const ProgressiveBracketsMedium = {
    args: {
        cityData: createCityWithStrategy(mediumProjectFiles, 'progressive-brackets'),
        showGrid: false,
        showFileNames: false, // Too many to show names
        showDirectoryLabels: true,
        fullSize: true,
    },
};
export const ProgressiveBracketsLarge = {
    args: {
        cityData: createCityWithStrategy(largeProjectFiles, 'progressive-brackets'),
        showGrid: false,
        showFileNames: false,
        showDirectoryLabels: true,
        fullSize: true,
    },
};
// Interactive comparison of all strategies
export const InteractiveStrategyComparison = {
    render: () => {
        const [projectSize, setProjectSize] = React.useState('small');
        const [strategy, setStrategy] = React.useState('progressive-brackets');
        const files = projectSize === 'small'
            ? smallProjectFiles
            : projectSize === 'medium'
                ? mediumProjectFiles
                : largeProjectFiles;
        const cityData = createCityWithStrategy(files, strategy);
        // Calculate actual space per file
        const fileCount = files.length;
        const totalArea = cityData.bounds
            ? (cityData.bounds.maxX - cityData.bounds.minX) *
                (cityData.bounds.maxZ - cityData.bounds.minZ)
            : 0;
        const areaPerFile = totalArea / fileCount;
        const dimensionPerFile = Math.sqrt(areaPerFile);
        return (_jsxs("div", { style: { height: '100vh', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: {
                        padding: '15px',
                        background: '#f5f5f5',
                        borderBottom: '2px solid #ddd',
                    }, children: [_jsxs("div", { style: { marginBottom: '15px' }, children: [_jsx("strong", { children: "Project Size:" }), _jsxs("div", { style: { display: 'flex', gap: '15px', marginTop: '5px' }, children: [_jsxs("label", { children: [_jsx("input", { type: "radio", name: "size", checked: projectSize === 'small', onChange: () => setProjectSize('small') }), _jsxs("span", { children: [" Small (", smallProjectFiles.length, " files)"] })] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: "size", checked: projectSize === 'medium', onChange: () => setProjectSize('medium') }), _jsxs("span", { children: [" Medium (", mediumProjectFiles.length, " files)"] })] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: "size", checked: projectSize === 'large', onChange: () => setProjectSize('large') }), _jsxs("span", { children: [" Large (", largeProjectFiles.length, " files)"] })] })] })] }), _jsxs("div", { style: { marginBottom: '10px' }, children: [_jsx("strong", { children: "Sizing Strategy:" }), _jsxs("div", { style: { display: 'flex', gap: '15px', marginTop: '5px', flexWrap: 'wrap' }, children: [_jsxs("label", { children: [_jsx("input", { type: "radio", name: "strategy", checked: strategy === 'progressive-brackets', onChange: () => setStrategy('progressive-brackets') }), _jsx("span", { children: " Progressive Brackets" })] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: "strategy", checked: strategy === 'minimum-area-guarantee', onChange: () => setStrategy('minimum-area-guarantee') }), _jsx("span", { children: " Minimum Area Guarantee" })] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: "strategy", checked: strategy === 'hierarchical-depth', onChange: () => setStrategy('hierarchical-depth') }), _jsx("span", { children: " Hierarchical Depth" })] })] })] }), _jsxs("div", { style: {
                                padding: '10px',
                                background: '#fff',
                                borderRadius: '4px',
                                fontSize: '14px',
                            }, children: [_jsx("strong", { children: "Space allocation:" }), " ~", Math.round(dimensionPerFile), "\u00D7", Math.round(dimensionPerFile), " per file", strategy === 'progressive-brackets' && (_jsxs("span", { style: { marginLeft: '10px', color: '#666' }, children: ["(", projectSize === 'small'
                                            ? 'generous spacing'
                                            : projectSize === 'medium'
                                                ? 'balanced spacing'
                                                : 'efficient packing', ")"] }))] })] }), _jsx("div", { style: { flex: 1 }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData, showGrid: false, showFileNames: projectSize === 'small', showDirectoryLabels: true, fullSize: true }) })] }));
    },
};
// Show the automatic 50% buffer effect
export const BufferDemonstration = {
    render: () => {
        // Create city with automatic buffer
        // Note: We need to modify the builder to expose buffer control, for now we'll show the concept
        const cityData = createCityWithStrategy(smallProjectFiles, 'minimum-area-guarantee', {
        // This would need to be implemented in the builder
        // bufferMultiplier: 1.5
        });
        return (_jsxs("div", { style: { height: '100vh', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: {
                        padding: '15px',
                        background: '#f5f5f5',
                        borderBottom: '2px solid #ddd',
                    }, children: [_jsx("div", { style: { fontSize: '16px', marginBottom: '10px' }, children: _jsx("strong", { children: "Automatic Treemap Buffer (50% extra space)" }) }), _jsx("div", { style: { fontSize: '14px', color: '#666' }, children: "The builder automatically adds 50% extra space to improve treemap efficiency and provide growth room." }), _jsxs("div", { style: { marginTop: '10px', fontSize: '14px' }, children: ["This is built into the sizing calculation:", ' ', _jsx("code", { children: "totalMinArea = (buildingArea + districtOverhead) * 1.5" })] })] }), _jsx("div", { style: { flex: 1 }, children: _jsx(ArchitectureMapHighlightLayers, { cityData: cityData, showGrid: false, showFileNames: true, showDirectoryLabels: true, fullSize: true }) })] }));
    },
};
// Demonstrate directory overhead spacing
export const DirectoryOverheadSpacing = {
    args: {
        cityData: createCityWithStrategy([
            // Deep directory structure to show overhead
            'src/features/auth/components/LoginForm.tsx',
            'src/features/auth/components/RegisterForm.tsx',
            'src/features/auth/hooks/useAuth.ts',
            'src/features/dashboard/components/Widget.tsx',
            'src/features/dashboard/components/Chart.tsx',
            'src/features/settings/components/SettingsForm.tsx',
            'src/features/settings/utils/validation.ts',
            'lib/database/connection.ts',
            'lib/database/models.ts',
        ], 'progressive-brackets'),
        showGrid: false,
        showFileNames: true,
        showDirectoryLabels: true,
        fullSize: true,
    },
};

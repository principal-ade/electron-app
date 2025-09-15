import { CityConfigBuilder } from './CityConfigBuilder';
// Helper function to create valid DirectoryInfo
const createDirectory = (name, path, children = []) => ({
    name,
    path,
    relativePath: path,
    children,
    fileCount: children.filter(c => 'size' in c).length,
    totalSize: children.reduce((sum, child) => sum + ('size' in child ? child.size : child.totalSize), 0),
    depth: path.split('/').filter(Boolean).length,
});
// Helper function to create valid FileInfo
const createFile = (name, path, size) => ({
    name,
    path,
    relativePath: path,
    extension: name.includes('.') ? '.' + name.split('.').pop() : '',
    size,
    lastModified: new Date(),
    isDirectory: false,
});
// Helper function to create a complete FileTree
const createFileTree = (root) => {
    const allFiles = [];
    const allDirectories = [];
    const traverse = (node) => {
        if ('children' in node) {
            allDirectories.push(node);
            node.children.forEach(traverse);
        }
        else {
            allFiles.push(node);
        }
    };
    traverse(root);
    return {
        sha: 'mock-sha-' + Date.now(),
        root,
        allFiles,
        allDirectories,
        stats: {
            totalFiles: allFiles.length,
            totalDirectories: allDirectories.length,
            totalSize: allFiles.reduce((sum, file) => sum + file.size, 0),
            maxDepth: Math.max(...allDirectories.map(d => d.depth), 0),
            buildingTypeDistribution: {},
            directoryTypeDistribution: {},
            combinedTypeDistribution: {},
        },
    };
};
// Mock file system tree data
const mockRoot = createDirectory('project', '', [
    createDirectory('src', 'src', [
        createDirectory('components', 'src/components', []),
        createDirectory('utils', 'src/utils', []),
        createDirectory('services', 'src/services', []),
    ]),
    createDirectory('tests', 'tests', []),
    createDirectory('docs', 'docs', []),
    createFile('package.json', 'package.json', 2048),
    createFile('README.md', 'README.md', 5120),
    createFile('.gitignore', '.gitignore', 512),
    createDirectory('node_modules', 'node_modules', []),
    createDirectory('public', 'public', []),
    createDirectory('scripts', 'scripts', []),
]);
const mockFileSystemTree = createFileTree(mockRoot);
const meta = {
    title: 'Code City/Config Builder/CityConfigBuilder',
    component: CityConfigBuilder,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
    argTypes: {
        onConfigGenerated: { action: 'config-generated' },
        onGroupsChange: { action: 'groups-changed' },
        showGridLines: { control: 'boolean' },
    },
};
export default meta;
export const Default = {
    args: {
        fileSystemTree: mockFileSystemTree,
        showGridLines: true,
    },
};
export const WithInitialGroups = {
    args: {
        fileSystemTree: mockFileSystemTree,
        showGridLines: true,
        initialGroups: [
            {
                id: 'group-1',
                name: 'Core Components',
                files: ['src', 'tests'],
                position: { row: 1, col: 1 },
                color: '#667eea',
            },
            {
                id: 'group-2',
                name: 'Documentation',
                files: ['docs'],
                position: { row: 1, col: 2 },
                color: '#f56565',
            },
        ],
        initialGridSize: { rows: 2, cols: 2 },
    },
};
export const WithCustomTheme = {
    args: {
        fileSystemTree: mockFileSystemTree,
        showGridLines: true,
        theme: {
            colors: {
                primary: '#10b981',
                text: '#111827',
                textSecondary: '#6b7280',
                background: '#ffffff',
                backgroundSecondary: '#f3f4f6',
                border: '#d1d5db',
            },
            radius: {
                sm: '2px',
                md: '4px',
                lg: '6px',
            },
            components: {
                button: {
                    primary: {
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                    },
                    secondary: {
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                    },
                },
            },
        },
    },
};
export const EmptyState = {
    args: {
        fileSystemTree: createFileTree(createDirectory('empty', '', [])),
        showGridLines: true,
    },
};
export const LargeProject = {
    args: {
        fileSystemTree: createFileTree(createDirectory('large-project', '', Array.from({ length: 20 }, (_, i) => createDirectory(`module-${i + 1}`, `module-${i + 1}`, [])))),
        showGridLines: true,
    },
};

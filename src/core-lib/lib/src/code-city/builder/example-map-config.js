/**
 * Example map configurations demonstrating the new map-based navigation system.
 * This file shows how to create linked maps with scoping and metadata.
 */
/**
 * Top-level overview map showing the entire project structure
 */
export const overviewMap = {
    // Map identification
    id: 'overview',
    version: '1.0',
    name: 'Project Overview',
    description: 'High-level view of the entire codebase architecture',
    overviewPath: 'docs/overview.md',
    // Cell groups with linking
    cells: {
        Frontend: {
            files: ['src/frontend/*', 'packages/ui/*'],
            coordinates: [0, 0],
            links: { 'frontend-detail': 'View Frontend Details' },
            experimentalMetadata: {
                teamOwner: 'frontend-team',
                techStack: ['React', 'TypeScript', 'TailwindCSS'],
            },
        },
        Backend: {
            files: ['src/backend/*', 'packages/api/*'],
            coordinates: [0, 1],
            links: { 'backend-detail': 'View Backend Details' },
            experimentalMetadata: {
                teamOwner: 'backend-team',
                techStack: ['Node.js', 'Express', 'PostgreSQL'],
            },
        },
        Infrastructure: {
            files: ['infra/*', 'scripts/*', '.github/*'],
            coordinates: [1, 0],
            links: { 'infra-detail': 'View Infrastructure Details' },
        },
        'Tests & Docs': {
            files: ['tests/*', 'docs/*', '*.md'],
            coordinates: [1, 1],
            experimentalMetadata: {
                coverage: '85%',
                lastUpdated: '2024-01-20',
            },
        },
    },
    // UI configuration in metadata
    metadata: {
        ui: {
            enabled: true,
            rows: 2,
            cols: 2,
            showCellLabels: true,
            cellLabelPosition: 'top',
        },
    },
};
/**
 * Detailed frontend map - focused on frontend directory only
 */
export const frontendDetailMap = {
    // Map identification
    id: 'frontend-detail',
    version: '1.0',
    name: 'Frontend Architecture',
    description: 'Detailed view of frontend components and structure',
    overviewPath: 'docs/frontend-overview.md', // Add required overview path
    // Scope to frontend directory
    scope: {
        basePath: 'src/frontend',
        excludePatterns: ['*.test.ts', '*.spec.ts', '__mocks__/*'],
    },
    // Detailed frontend organization
    cells: {
        Components: {
            files: ['components/*'],
            coordinates: [0, 0],
            experimentalMetadata: {
                description: 'Reusable UI components',
                componentCount: 45,
            },
        },
        Pages: {
            files: ['pages/*', 'views/*'],
            coordinates: [0, 1],
            experimentalMetadata: {
                description: 'Application pages and views',
            },
        },
        Hooks: {
            files: ['hooks/*'],
            coordinates: [0, 2],
            experimentalMetadata: {
                description: 'Custom React hooks',
            },
        },
        'State Management': {
            files: ['store/*', 'redux/*', 'context/*'],
            coordinates: [1, 0],
            links: { 'state-detail': 'View State Details' },
        },
        Services: {
            files: ['services/*', 'api/*'],
            coordinates: [1, 1],
            experimentalMetadata: {
                description: 'API clients and services',
            },
        },
        Utils: {
            files: ['utils/*', 'helpers/*'],
            coordinates: [1, 2],
        },
        Styles: {
            files: ['styles/*', 'css/*', 'scss/*'],
            coordinates: [2, 0],
        },
        Assets: {
            files: ['assets/*', 'images/*', 'icons/*'],
            coordinates: [2, 1],
        },
        Types: {
            files: ['types/*', 'interfaces/*', '@types/*'],
            coordinates: [2, 2],
        },
    },
    // UI configuration in metadata
    metadata: {
        ui: {
            enabled: true,
            rows: 3,
            cols: 3,
            showCellLabels: true,
        },
    },
};
/**
 * Backend detail map - focused on backend architecture
 */
export const backendDetailMap = {
    id: 'backend-detail',
    version: '1.0',
    name: 'Backend Architecture',
    description: 'Server-side components and API structure',
    overviewPath: 'docs/backend-overview.md', // Add required overview path
    // Scope to backend directory
    scope: {
        basePath: 'src/backend',
    },
    cells: {
        Controllers: {
            files: ['controllers/*'],
            coordinates: [0, 0],
        },
        Models: {
            files: ['models/*', 'entities/*'],
            coordinates: [0, 1],
        },
        Services: {
            files: ['services/*'],
            coordinates: [0, 2],
        },
        Middleware: {
            files: ['middleware/*'],
            coordinates: [1, 0],
        },
        Database: {
            files: ['database/*', 'migrations/*'],
            coordinates: [1, 1],
        },
        Utils: {
            files: ['utils/*', 'helpers/*'],
            coordinates: [1, 2],
        },
    },
    // UI configuration in metadata
    metadata: {
        ui: {
            enabled: true,
            rows: 2,
            cols: 3,
            showCellLabels: true,
        },
    },
};
/**
 * Example map demonstrating negation pattern support for filtering files
 * This is useful for focusing on production code without test files
 */
export const productionCodeMap = {
    id: 'production-code',
    version: '1.0',
    name: 'Production Code Overview',
    description: 'Production code excluding tests, mocks, and stories',
    overviewPath: 'docs/production-code.md',
    cells: {
        'React Components': {
            files: [
                'src/components/**/*.tsx',
                'src/components/**/*.ts',
                '!src/components/**/*.test.*',
                '!src/components/**/*.spec.*',
                '!src/components/**/*.stories.*',
                '!src/components/**/__tests__/**',
                '!src/components/**/__mocks__/**',
            ],
            coordinates: [0, 0],
            experimentalMetadata: {
                description: 'Production React components without test files',
            },
        },
        'API Services': {
            files: [
                'src/services/**/*.ts',
                '!src/services/**/*.test.ts',
                '!src/services/**/*.mock.ts',
                '!src/services/**/test-utils/**',
            ],
            coordinates: [0, 1],
            experimentalMetadata: {
                description: 'API service layer excluding test utilities',
            },
        },
        'Business Logic': {
            files: [
                'src/domain/**/*',
                'src/business/**/*',
                '!**/*.test.*',
                '!**/*.spec.*',
                '!**/fixtures/**',
                '!**/mocks/**',
            ],
            coordinates: [0, 2],
            experimentalMetadata: {
                description: 'Core business logic without test artifacts',
            },
        },
        'Electron Main Process': {
            files: [
                'electron-react/src/main/**/*.ts',
                '!electron-react/src/main/**/*.test.*',
                '!electron-react/src/main/**/*.spec.*',
            ],
            coordinates: [1, 0],
            experimentalMetadata: {
                description: 'Electron main process code',
            },
        },
        'Electron Renderer': {
            files: [
                'electron-react/src/renderer/**/*.ts',
                'electron-react/src/renderer/**/*.tsx',
                '!electron-react/src/renderer/**/*.test.*',
                '!electron-react/src/renderer/**/*.spec.*',
                '!electron-react/src/renderer/**/*.stories.*',
            ],
            coordinates: [1, 1],
            priority: 100,
            metadata: {
                ui: { color: '#ff6b6b' },
            },
            experimentalMetadata: {
                description: 'Electron renderer process - Window.electron type errors',
                errorCount: 423,
                errorType: 'TS2551',
                fixStrategy: 'Create electron.d.ts with Window interface extensions',
            },
        },
        'Shared Libraries': {
            files: [
                'packages/*/src/**/*.ts',
                'packages/*/src/**/*.tsx',
                '!packages/*/src/**/*.test.*',
                '!packages/*/src/**/__tests__/**',
                '!packages/*/src/**/test/**',
            ],
            coordinates: [1, 2],
            experimentalMetadata: {
                description: 'Shared library code across packages',
            },
        },
        Configuration: {
            files: ['*.json', '*.config.*', '.env*', '!*.test.json', '!test.config.*'],
            coordinates: [2, 0],
            experimentalMetadata: {
                description: 'Configuration files excluding test configs',
            },
        },
        Documentation: {
            files: ['**/*.md', 'docs/**/*', '!**/test-*.md', '!**/TESTING.md'],
            coordinates: [2, 1],
            experimentalMetadata: {
                description: 'Documentation excluding test docs',
            },
        },
        'Build & Deploy': {
            files: [
                'scripts/**/*',
                '.github/workflows/**/*',
                'Dockerfile*',
                '!scripts/test-*',
                '!.github/workflows/test-*.yml',
            ],
            coordinates: [2, 2],
            experimentalMetadata: {
                description: 'Build and deployment scripts',
            },
        },
    },
    // UI configuration in metadata
    metadata: {
        ui: {
            enabled: true,
            rows: 3,
            cols: 3,
            showCellLabels: true,
        },
    },
};
/**
 * Example map registry for managing multiple maps
 */
export class MapRegistry {
    constructor() {
        this.maps = new Map();
        // Register default maps
        this.register(overviewMap);
        this.register(frontendDetailMap);
        this.register(backendDetailMap);
        this.register(productionCodeMap);
    }
    register(config) {
        if (!config.id) {
            throw new Error('Map configuration must have an ID');
        }
        this.maps.set(config.id, config);
    }
    get(id) {
        return this.maps.get(id);
    }
    getAll() {
        return Array.from(this.maps.values());
    }
    /**
     * Find all maps that link to a given map ID
     */
    findLinksTo(targetId) {
        const links = [];
        // Use Array.from for better compatibility
        const allMaps = Array.from(this.maps.values());
        for (const map of allMaps) {
            for (const [cellName, cell] of Object.entries(map.cells)) {
                if (cell.links && Object.keys(cell.links).includes(targetId)) {
                    links.push({ map, cell: cellName });
                }
            }
        }
        return links;
    }
    /**
     * Get navigation breadcrumbs from one map to another
     */
    getNavigationPath(fromId, toId) {
        // Simple implementation - could be enhanced with actual pathfinding
        const path = [];
        const fromMap = this.get(fromId);
        const toMap = this.get(toId);
        if (!fromMap || !toMap)
            return path;
        // Check if direct link exists
        for (const cell of Object.values(fromMap.cells)) {
            if (cell.links && Object.keys(cell.links).includes(toId)) {
                return [fromId, toId];
            }
        }
        // For now, assume we can always go through overview
        if (fromId !== 'overview' && toId !== 'overview') {
            return [fromId, 'overview', toId];
        }
        return [fromId, toId];
    }
}
// Example usage:
export function demonstrateMapNavigation() {
    const registry = new MapRegistry();
    // Start at overview
    let currentMap = registry.get('overview');
    console.log(`Current map: ${currentMap?.name}`);
    // User clicks on Frontend cell
    const frontendCell = currentMap?.cells['Frontend'];
    if (frontendCell?.links) {
        // Navigate to the first linked map
        const linkedMapId = Object.keys(frontendCell.links)[0];
        currentMap = registry.get(linkedMapId);
        console.log(`Navigated to: ${currentMap?.name}`);
        console.log(`Scope: ${currentMap?.scope?.basePath || 'entire repository'}`);
    }
    // Find what links to the frontend detail map
    const linksToFrontend = registry.findLinksTo('frontend-detail');
    console.log(`Maps linking to frontend-detail:`, linksToFrontend);
    // Get navigation path
    const path = registry.getNavigationPath('backend-detail', 'frontend-detail');
    console.log(`Navigation path:`, path);
}
//# sourceMappingURL=example-map-config.js.map
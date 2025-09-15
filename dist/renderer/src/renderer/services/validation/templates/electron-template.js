export const electronTemplate = {
    id: 'electron-standard',
    name: 'Electron Desktop App',
    description: 'Electron application validation',
    tool: {
        name: 'electron',
        type: 'framework',
        packageMatchers: [
            'electron',
            'electron-builder',
            'electron-forge',
            '@electron-forge/*',
            'electron-updater',
        ],
        configFiles: [
            'electron-builder.json',
            'electron-builder.yml',
            'forge.config.js',
            '.electronforge',
        ],
        requiredCommands: ['start', 'build'],
    },
    actions: [
        {
            category: 'build',
            items: [
                {
                    id: 'build-main',
                    name: 'Build Main Process',
                    command: '${pm} build:main',
                    description: 'Build Electron main process',
                    severity: 'error',
                    requiresScript: 'build:main',
                },
                {
                    id: 'build-renderer',
                    name: 'Build Renderer',
                    command: '${pm} build:renderer',
                    description: 'Build Electron renderer process',
                    severity: 'error',
                    requiresScript: 'build:renderer',
                },
                {
                    id: 'package',
                    name: 'Package App',
                    command: '${pm} package',
                    description: 'Package Electron app for distribution',
                    severity: 'warning',
                    requiresScript: 'package',
                },
            ],
        },
        {
            category: 'quality',
            items: [
                {
                    id: 'lint-electron',
                    name: 'Lint Electron',
                    command: '${pm} lint',
                    description: 'Lint Electron code',
                    severity: 'error',
                    requiresScript: 'lint',
                },
            ],
        },
        {
            category: 'security',
            items: [
                {
                    id: 'check-security',
                    name: 'Security Check',
                    command: 'npx electronegativity .',
                    description: 'Check for Electron security issues',
                    severity: 'warning',
                },
            ],
        },
    ],
    tags: ['electron', 'desktop', 'framework'],
};

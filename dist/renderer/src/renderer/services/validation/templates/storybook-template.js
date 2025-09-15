export const storybookTemplate = {
    id: 'storybook-standard',
    name: 'Storybook Component Development',
    description: 'Component documentation and visual testing with Storybook',
    tool: {
        name: 'storybook',
        type: 'framework',
        packageMatchers: [
            '@storybook/react',
            '@storybook/react-webpack5',
            '@storybook/react-vite',
            '@storybook/vue3',
            '@storybook/vue3-vite',
            '@storybook/angular',
            '@storybook/web-components',
            '@storybook/html',
            '@storybook/svelte',
            '@storybook/addon-*',
            'storybook',
        ],
        configFiles: [
            '.storybook/main.js',
            '.storybook/main.ts',
            '.storybook/main.mjs',
            '.storybook/preview.js',
            '.storybook/preview.ts',
            '.storybook/preview.mjs',
        ],
        requiredCommands: ['storybook'],
        documentationUrl: 'https://storybook.js.org/docs/react/get-started/introduction',
    },
    actions: [
        {
            category: 'build',
            items: [
                {
                    id: 'storybook-dev',
                    name: 'Start Storybook Dev Server',
                    command: '${pm} storybook',
                    description: 'Launch Storybook in development mode',
                    severity: 'info',
                    requiresScript: 'storybook',
                    timeout: 300000, // 5 minutes - dev server stays running
                    exitCodes: {
                        success: [0],
                        warning: [1],
                    },
                },
                {
                    id: 'storybook-build',
                    name: 'Build Storybook',
                    command: '${pm} build-storybook',
                    description: 'Build static Storybook for deployment',
                    severity: 'error',
                    requiresScript: 'build-storybook',
                    timeout: 120000, // 2 minutes
                    exitCodes: {
                        success: [0],
                    },
                },
            ],
        },
        {
            category: 'quality',
            items: [
                {
                    id: 'storybook-test',
                    name: 'Run Storybook Tests',
                    command: '${pm} test-storybook',
                    description: 'Run interaction tests and visual regression tests',
                    severity: 'error',
                    requiresScript: 'test-storybook',
                    timeout: 180000, // 3 minutes
                    exitCodes: {
                        success: [0],
                        warning: [1],
                    },
                },
                {
                    id: 'storybook-chromatic',
                    name: 'Run Chromatic Visual Tests',
                    command: 'npx chromatic',
                    description: 'Run visual regression tests with Chromatic',
                    severity: 'warning',
                    requiresConfig: ['.storybook/main.js', 'chromatic.config.json'],
                    timeout: 300000, // 5 minutes
                    exitCodes: {
                        success: [0],
                        warning: [1],
                    },
                },
            ],
        },
        {
            category: 'custom',
            items: [
                {
                    id: 'storybook-extract',
                    name: 'Extract Stories Metadata',
                    command: 'npx storybook extract',
                    description: 'Extract stories metadata for documentation',
                    severity: 'info',
                    timeout: 60000, // 1 minute
                    exitCodes: {
                        success: [0],
                    },
                },
                {
                    id: 'storybook-upgrade',
                    name: 'Upgrade Storybook',
                    command: 'npx storybook@latest upgrade',
                    description: 'Upgrade Storybook to the latest version',
                    severity: 'info',
                    timeout: 180000, // 3 minutes
                    exitCodes: {
                        success: [0],
                    },
                },
            ],
        },
    ],
};

export const reactTemplate = {
    id: 'react-standard',
    name: 'React Best Practices',
    description: 'React-specific linting and validation',
    tool: {
        name: 'react',
        type: 'framework',
        packageMatchers: [
            'react',
            'react-dom',
            '@types/react',
            '@types/react-dom',
            'eslint-plugin-react',
            'eslint-plugin-react-hooks',
        ],
        configFiles: [],
        requiredCommands: [],
    },
    actions: [
        {
            category: 'quality',
            items: [
                {
                    id: 'lint-react',
                    name: 'React Linting',
                    command: '${pm} lint',
                    description: 'Run React-specific linting rules',
                    severity: 'error',
                    requiresScript: 'lint',
                },
                {
                    id: 'check-hooks',
                    name: 'Check Hook Rules',
                    command: "npx eslint --rule 'react-hooks/rules-of-hooks: error' --rule 'react-hooks/exhaustive-deps: warn' .",
                    description: 'Validate React Hooks usage',
                    severity: 'error',
                },
            ],
        },
        {
            category: 'performance',
            items: [
                {
                    id: 'analyze-bundle',
                    name: 'Analyze Bundle',
                    command: '${pm} analyze || ${pm} build --analyze',
                    description: 'Analyze React bundle size',
                    severity: 'info',
                },
            ],
        },
    ],
    tags: ['react', 'framework', 'ui'],
};

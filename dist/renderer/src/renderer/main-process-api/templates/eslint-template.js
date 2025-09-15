export const eslintTemplate = {
    id: 'eslint-standard',
    name: 'ESLint Code Quality',
    description: 'JavaScript/TypeScript linting with ESLint',
    tool: {
        name: 'eslint',
        type: 'linter',
        packageMatchers: [
            'eslint',
            '@typescript-eslint/parser',
            '@typescript-eslint/eslint-plugin',
            'eslint-config-*',
            'eslint-plugin-*',
        ],
        configFiles: [
            'eslint.config.js',
            'eslint.config.mjs',
            '.eslintrc.js',
            '.eslintrc.json',
            '.eslintrc.yml',
            '.eslintrc.yaml',
            '.eslintignore',
        ],
        requiredCommands: ['lint'],
        // Indicate that this tool requires ignore configuration for safe operation
        requiresIgnoreFile: '.eslintignore',
        documentationUrl: 'https://eslint.org/docs/latest/use/configure/ignore',
    },
    actions: [
        {
            category: 'quality',
            items: [
                {
                    id: 'lint',
                    name: 'Run Linter',
                    command: 'npx eslint .',
                    description: 'Check code quality with ESLint',
                    severity: 'error',
                    requiresScript: 'lint', // Still check that they have linting set up
                    exitCodes: {
                        success: [0], // No linting issues
                        warning: [1], // Linting issues found
                        // Exit code 2 means ESLint error (config problem, etc)
                    },
                    targetLayers: ['javascript', 'typescript', 'react', 'vue'],
                    layerOverrides: {
                        // Pure JavaScript files only
                        javascript: 'npx eslint . --ext .js',
                        // TypeScript files (no JSX)
                        typescript: 'npx eslint . --ext .ts',
                        // React JSX files (both JS and TS variants)
                        react: 'npx eslint . --ext .jsx,.tsx',
                        // Vue single file components
                        vue: 'npx eslint . --ext .vue',
                    },
                },
                {
                    id: 'lint-fix',
                    name: 'Auto-fix Issues',
                    command: 'npx eslint . --fix',
                    description: 'Automatically fix ESLint issues',
                    severity: 'warning',
                    requiresScript: 'lint',
                    targetLayers: ['javascript', 'typescript', 'react', 'vue'],
                    layerOverrides: {
                        javascript: 'npx eslint . --fix --ext .js',
                        typescript: 'npx eslint . --fix --ext .ts',
                        react: 'npx eslint . --fix --ext .jsx,.tsx',
                        vue: 'npx eslint . --fix --ext .vue',
                    },
                },
                {
                    id: 'lint-debug',
                    name: 'Debug Config',
                    command: 'npx eslint --print-config .',
                    description: 'Print resolved ESLint configuration',
                    severity: 'info',
                },
            ],
        },
    ],
    tags: ['code-quality', 'linting', 'javascript', 'typescript'],
};

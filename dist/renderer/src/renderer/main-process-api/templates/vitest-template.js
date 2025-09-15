export const vitestTemplate = {
    id: 'vitest-standard',
    name: 'Vitest Testing',
    description: 'Fast unit testing with Vitest',
    tool: {
        name: 'vitest',
        type: 'test-runner',
        packageMatchers: ['vitest', '@vitest/ui', '@vitest/coverage-*'],
        configFiles: [
            'vitest.config.js',
            'vitest.config.ts',
            'vitest.config.mjs',
            'vite.config.js',
            'vite.config.ts',
            'vite.config.mjs',
        ],
        requiredCommands: ['test'],
    },
    actions: [
        {
            category: 'correctness',
            items: [
                {
                    id: 'test',
                    name: 'Run Tests',
                    command: '${pm} test',
                    description: 'Run all tests',
                    severity: 'error',
                    requiresScript: 'test',
                },
                {
                    id: 'test-ui',
                    name: 'Test UI',
                    command: '${pm} test:ui || npx vitest --ui',
                    description: 'Run tests with UI',
                    severity: 'info',
                },
                {
                    id: 'test-coverage',
                    name: 'Test Coverage',
                    command: '${pm} test:coverage || npx vitest --coverage',
                    description: 'Run tests with coverage',
                    severity: 'info',
                },
                {
                    id: 'test-watch',
                    name: 'Watch Tests',
                    command: '${pm} test:watch || npx vitest --watch',
                    description: 'Run tests in watch mode',
                    severity: 'info',
                },
            ],
        },
    ],
    tags: ['testing', 'unit-tests', 'vitest', 'vite'],
};

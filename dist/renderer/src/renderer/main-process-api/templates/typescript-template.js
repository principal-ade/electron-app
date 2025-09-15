export const typescriptTemplate = {
    id: 'typescript-standard',
    name: 'TypeScript Type Checking',
    description: 'Static type checking with TypeScript',
    tool: {
        name: 'typescript',
        type: 'compiler',
        packageMatchers: [
            'typescript',
            '@types/node',
            '@types/react',
            'ts-node',
            'tsx',
        ],
        configFiles: [
            'tsconfig.json',
            'tsconfig.*.json',
            'tsconfig.base.json',
            'tsconfig.build.json',
        ],
        requiredCommands: ['build'],
    },
    actions: [
        {
            category: 'correctness',
            items: [
                {
                    id: 'typecheck',
                    name: 'Type Check',
                    command: '${pm} typecheck || npx tsc --noEmit',
                    description: 'Run TypeScript type checking',
                    severity: 'error',
                },
                {
                    id: 'typecheck-watch',
                    name: 'Type Check (Watch)',
                    command: 'npx tsc --noEmit --watch',
                    description: 'Run TypeScript type checking in watch mode',
                    severity: 'info',
                },
            ],
        },
        {
            category: 'build',
            items: [
                {
                    id: 'build',
                    name: 'Build TypeScript',
                    command: '${pm} build',
                    description: 'Compile TypeScript to JavaScript',
                    severity: 'error',
                    requiresScript: 'build',
                },
                {
                    id: 'build-clean',
                    name: 'Clean Build',
                    command: 'rm -rf dist && ${pm} build',
                    description: 'Clean and rebuild TypeScript',
                    severity: 'warning',
                    requiresScript: 'build',
                },
            ],
        },
    ],
    tags: ['typescript', 'type-safety', 'compilation'],
};

export const nextjsTemplate = {
    id: 'nextjs-standard',
    name: 'Next.js Application',
    description: 'Next.js framework validation',
    tool: {
        name: 'nextjs',
        type: 'framework',
        packageMatchers: [
            'next',
            '@next/font',
            '@next/bundle-analyzer',
            'eslint-config-next',
        ],
        configFiles: ['next.config.js', 'next.config.mjs', 'next-env.d.ts'],
        requiredCommands: ['dev', 'build'],
    },
    actions: [
        {
            category: 'build',
            items: [
                {
                    id: 'build',
                    name: 'Build Production',
                    command: '${pm} build',
                    description: 'Build Next.js for production',
                    severity: 'error',
                    requiresScript: 'build',
                },
                {
                    id: 'build-analyze',
                    name: 'Build & Analyze',
                    command: 'ANALYZE=true ${pm} build',
                    description: 'Build with bundle analysis',
                    severity: 'info',
                    requiresScript: 'build',
                },
            ],
        },
        {
            category: 'quality',
            items: [
                {
                    id: 'lint',
                    name: 'Lint Next.js',
                    command: '${pm} lint',
                    description: 'Run Next.js linting',
                    severity: 'error',
                    requiresScript: 'lint',
                },
                {
                    id: 'type-check',
                    name: 'Type Check Pages',
                    command: 'npx tsc --noEmit',
                    description: 'Type check Next.js pages and components',
                    severity: 'error',
                    requiresConfig: ['tsconfig.json'],
                },
            ],
        },
    ],
    tags: ['nextjs', 'framework', 'react', 'ssr'],
};

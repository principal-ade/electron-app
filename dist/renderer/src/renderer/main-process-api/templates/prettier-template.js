export const prettierTemplate = {
    id: 'prettier-standard',
    name: 'Prettier Code Formatting',
    description: 'Code formatting with Prettier',
    tool: {
        name: 'prettier',
        type: 'formatter',
        packageMatchers: ['prettier', 'prettier-plugin-*', '@prettier/plugin-*'],
        configFiles: [
            '.prettierrc',
            '.prettierrc.json',
            '.prettierrc.yml',
            '.prettierrc.yaml',
            '.prettierrc.js',
            '.prettierrc.mjs',
            'prettier.config.js',
            'prettier.config.mjs',
            '.prettierignore',
        ],
        requiresIgnoreFile: '.prettierignore',
        documentationUrl: 'https://prettier.io/docs/en/ignore.html',
    },
    actions: [
        {
            category: 'quality',
            items: [
                {
                    id: 'format-check',
                    name: 'Check Formatting',
                    command: 'npx prettier --check .',
                    description: 'Check if files are formatted',
                    severity: 'warning',
                },
                {
                    id: 'format',
                    name: 'Format Files',
                    command: 'npx prettier --write .',
                    description: 'Format all files',
                    severity: 'warning',
                },
                {
                    id: 'format-staged',
                    name: 'Format Staged Files',
                    command: "npx prettier --write --cache --cache-strategy metadata $(git diff --cached --name-only --diff-filter=ACMR | sed 's| |\\\\ |g')",
                    description: 'Format only staged files',
                    severity: 'info',
                },
            ],
        },
    ],
    tags: ['formatting', 'code-style', 'prettier'],
};

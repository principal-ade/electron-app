// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [{
  ignores: [
    // Build outputs and dependencies
    'dist/**',
    '.erb/**',
    'release/**',
    'node_modules/**',
    'storybook-static/**',

    // Config files
    '*.config.js',
    '*.config.ts',
    '*.config.mjs',
    '*.config.cjs',

    // Assets and scripts
    'assets/**',
    'scripts/**',

    // Type declaration files (except in src/shared)
    '**/*.d.ts',
    '!src/shared/**/*.d.ts',

    // Unused code
    'src/renderer/unused/**',

    // WIP port from web-ade Next.js app (uses Next.js ESLint rules and has
    // known type/lint issues)
    'src/renderer/repo-explorer/**',
  ],
}, {
  files: [
    'src/**/*.{ts,tsx,js,jsx}',
  ],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    },
    globals: {
      console: 'readonly',
      process: 'readonly',
      Buffer: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
      require: 'readonly',
      module: 'readonly',
      exports: 'readonly',
      global: 'readonly',
      globalThis: 'readonly',
      window: 'readonly',
      document: 'readonly',
      navigator: 'readonly',
      HTMLElement: 'readonly',
      Element: 'readonly',
      Event: 'readonly',
      CustomEvent: 'readonly',
      NodeJS: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      setInterval: 'readonly',
      clearInterval: 'readonly',
      fetch: 'readonly',
      URL: 'readonly',
      URLSearchParams: 'readonly',
      FormData: 'readonly',
      localStorage: 'readonly',
      sessionStorage: 'readonly',
    },
  },
  plugins: {
    '@typescript-eslint': typescript,
    'react': reactPlugin,
    'react-hooks': reactHooksPlugin,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // JavaScript rules
    ...js.configs.recommended.rules,
    'no-unused-vars': 'off', // Use TypeScript's instead
    'no-undef': 'off', // TypeScript handles this
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-prototype-builtins': 'warn',
    'no-useless-escape': 'warn',

    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],

    // React rules
    'react/prop-types': 'off', // We use TypeScript
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+
    'react/jsx-no-target-blank': 'warn',
    'react/jsx-key': 'error',
    'react/no-array-index-key': 'warn',
    'react/no-unused-state': 'warn',

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
}, // Specific rules for main process files
{
  files: ['src/main/**/*.{ts,js}'],
  rules: {
    'no-console': 'off', // Console is OK in main process
  },
}, // Specific rules for test files
{
  files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
  },
}, // File size limits for TypeScript files
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    'max-lines': ['error', {
      max: 3500,
      skipBlankLines: true,
      skipComments: true,
    }],
  },
}, // Specific rules for storybook files
{
  files: ['.storybook/**/*.{ts,tsx,js,jsx}'],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  plugins: {
    '@typescript-eslint': typescript,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
}, // Renderer IPC boundary: UI code uses renderer services
{
  files: ['src/renderer/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-properties': ['error',
      { object: 'window', property: 'mainProcess', message: 'Use a renderer service instead of window.mainProcess.' },
      { object: 'window', property: 'electron', message: 'Use a renderer service or typed IPC adapter instead of window.electron.' },
      { object: 'window', property: 'electronTitlebar', message: 'Use WindowService for titlebar operations.' },
      { object: 'window', property: 'electronAPI', message: 'Use a renderer service for preload APIs.' },
    ],
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'electron', message: 'Renderer code must use the typed preload/service boundary.' },
        { name: '@egoist/tipc/renderer', message: 'Construct TIPC clients in the service/adapter layer, not renderer UI code.' },
      ],
      patterns: [{
        group: ['**/tipc/*Client', '**/tipc/ipcTransport'],
        message: 'Use a renderer service instead of importing a raw TIPC client or transport.',
      }],
    }],
  },
}, // Service adapters own the typed preload surface
{
  files: ['src/renderer/main-process-api/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-properties': ['error', {
      object: 'window', property: 'electron', message: 'Use ipcTransport or a typed TIPC client for IPC access.',
    }],
    'no-restricted-imports': ['error', {
      paths: [{ name: 'electron', message: 'Renderer service adapters must use the preload transport.' }],
    }],
  },
}, {
  files: ['src/renderer/services/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-properties': ['error', {
      object: 'window', property: 'electron', message: 'Use a typed renderer service for IPC access.',
    }],
  },
}, // TIPC clients are typed adapters; only the transport touches generic IPC
{
  files: ['src/renderer/tipc/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-properties': ['error',
      { object: 'window', property: 'mainProcess', message: 'Use the renderer service layer for main-process APIs.' },
      { object: 'window', property: 'electronTitlebar', message: 'Use WindowService for titlebar operations.' },
      { object: 'window', property: 'electronAPI', message: 'Use a renderer service for preload APIs.' },
      { object: 'window.electron', property: 'ipcRenderer', message: 'Use ipcTransport for generic IPC access.' },
    ],
    'no-restricted-imports': ['error', {
      paths: [{ name: 'electron', message: 'Use the typed preload transport.' }],
    }],
  },
}, {
  files: ['src/renderer/tipc/ipcTransport.ts'],
  rules: {
    'no-restricted-properties': ['error',
      { object: 'window', property: 'mainProcess', message: 'Keep raw preload access in the renderer service layer.' },
      { object: 'window', property: 'electronTitlebar', message: 'Use WindowService for titlebar operations.' },
      { object: 'window', property: 'electronAPI', message: 'Use a renderer service for preload APIs.' },
    ],
    'no-restricted-imports': ['error', {
      paths: [{ name: 'electron', message: 'Use the typed preload transport.' }],
    }],
  },
}, // Test and Storybook fixtures may mock preload APIs
{
  files: ['src/renderer/**/*.test.{ts,tsx}', 'src/renderer/**/*.spec.{ts,tsx}', 'src/renderer/**/*.stories.{ts,tsx}'],
  rules: {
    'no-restricted-properties': 'off',
    'no-restricted-imports': 'off',
  },
}, ...storybook.configs["flat/recommended"]];
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      // Build outputs and dependencies
      'dist/**',
      '.erb/**',
      'release/**',
      'node_modules/**',
      'dist_mcp_server/**',

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
    ],
  },
  {
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
  },
  // Specific rules for main process files
  {
    files: ['src/main/**/*.{ts,js}'],
    rules: {
      'no-console': 'off', // Console is OK in main process
    },
  },
  // Specific rules for test files
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
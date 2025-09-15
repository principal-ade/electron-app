import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'dist/**',
      '.erb/**',
      'release/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '*.config.cjs',
      'dist_mcp_server/**',
      'assets/**',
      'scripts/**',
      '**/*.d.ts',
      '!src/shared/**/*.d.ts',
      // Temporarily ignore renderer and other source files except the ones we're starting with
      'src/renderer/**/*',
      'src/types/**/*',
      // Re-include specific renderer files we want to lint
      '!src/renderer/pages/RepoManager/**/*.ts',
      '!src/renderer/pages/RepoManager/**/*.tsx',
      // Include all window folder files
      '!src/window/**/*.ts',
      '!src/window/**/*.tsx',
      // Include all shared library files - all issues have been fixed!
      '!src/shared/**/*.ts',
      '!src/shared/**/*.tsx',
      '!src/renderer/pages/RepoManager/**/*.ts',
      '!src/renderer/pages/RepoManager/**/*.tsx',
      // File tree and linter integration files (renderer)
      '!src/renderer/services/FileTreeSourceService.ts',
      '!src/renderer/services/FileTreeCacheService.ts',
      '!src/renderer/services/CloneVisibilityService.ts',
      '!src/renderer/services/FileTreeInvalidator.ts',
      '!src/renderer/services/CityDataCacheService.ts',
      '!src/renderer/utils/loadFileSystemTree.ts',
      '!src/renderer/utils/loadManifestContents.ts',
      '!src/renderer/adapters/ElectronFileSystemAdapter.ts',
      '!src/renderer/adapters/SourceFileSystemAdapter.ts',
      '!src/renderer/adapters/github/GitHubFileSystemAdapter.ts',
      '!src/renderer/adapters/GitHubWebAdapters.ts',
      '!src/renderer/adapters/index.ts',
      '!src/renderer/hooks/useViolationMonitoring.ts',
      '!src/renderer/types/file-tree-source.ts',
      '!src/renderer/contexts/GitChangesContext.tsx',
      // Renderer to main process bridge files
      '!src/renderer/main-process-api/FileSystemService.ts',
      '!src/renderer/main-process-api/GithubService.ts',
      '!src/renderer/main-process-api/RepositoryService.ts',
      '!src/renderer/main-process-api/GitService.ts',
      '!src/renderer/main-process-api/UserPreferencesService.ts',
      '!src/renderer/main-process-api/GitWatcherService.ts',
      // Landing page and repository management components
      '!src/renderer/pages/LandingPage/**/*.tsx',
      '!src/renderer/pages/LandingPage/**/*.ts',
      '!src/renderer/components/landing-page/RepositoryCard.tsx',
      '!src/renderer/components/landing-page/RepositorySettingsModal.tsx',
      '!src/renderer/components/landing-page/EmptyStateView.tsx',
      '!src/renderer/components/landing-page/ForkParentModal.tsx',
      // App.tsx and shared components
      '!src/renderer/App.tsx',
      '!src/renderer/components/shared/**/*.tsx',
      '!src/renderer/components/shared/**/*.ts',
    ],
  },
  {
    files: [
      'src/main/**/*.{ts,tsx,js,jsx}', 
      'src/window/**/*.{ts,tsx,js,jsx}',
      'src/shared/**/*.{ts,tsx,js,jsx}',
      'src/renderer/pages/RepoManager/**/*.{ts,tsx,js,jsx}',
      // File tree and linter integration files (renderer)
      'src/renderer/services/FileTreeSourceService.ts',
      'src/renderer/services/FileTreeCacheService.ts',
      'src/renderer/services/CloneVisibilityService.ts',
      'src/renderer/services/FileTreeInvalidator.ts',
      'src/renderer/services/CityDataCacheService.ts',
      'src/renderer/utils/loadFileSystemTree.ts',
      'src/renderer/utils/loadManifestContents.ts',
      'src/renderer/adapters/ElectronFileSystemAdapter.ts',
      'src/renderer/adapters/SourceFileSystemAdapter.ts',
      'src/renderer/adapters/github/GitHubFileSystemAdapter.ts',
      'src/renderer/adapters/GitHubWebAdapters.ts',
      'src/renderer/adapters/index.ts',
      'src/renderer/hooks/useViolationMonitoring.ts',
      'src/renderer/types/file-tree-source.ts',
      'src/renderer/contexts/GitChangesContext.tsx',
      // Main process services
      'src/main/services/ViolationCollectionService.ts',
      'src/main/services/ViolationMonitoringServiceIPC.ts',
      // Renderer to main process bridge files
      'src/renderer/main-process-api/FileSystemService.ts',
      'src/renderer/main-process-api/GithubService.ts',
      'src/renderer/main-process-api/RepositoryService.ts',
      'src/renderer/main-process-api/GitService.ts',
      'src/renderer/main-process-api/UserPreferencesService.ts',
      'src/renderer/main-process-api/GitWatcherService.ts',
      // Landing page and repository management components
      'src/renderer/pages/LandingPage/**/*.{ts,tsx,js,jsx}',
      'src/renderer/components/landing-page/RepositoryCard.tsx',
      'src/renderer/components/landing-page/RepositorySettingsModal.tsx',
      'src/renderer/components/landing-page/EmptyStateView.tsx',
      'src/renderer/components/landing-page/ForkParentModal.tsx',
      // Main process repository management
      'src/main/stores/RepositoryApiEventHandler.ts',
      'src/main/initialization.ts',
      'src/main/version-control-providers/avatarStorageService.ts',
      // App.tsx and shared components
      'src/renderer/App.tsx',
      'src/renderer/components/shared/**/*.{ts,tsx,js,jsx}',
      // Docker services
      'src/main/docker/**/*.ts',
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
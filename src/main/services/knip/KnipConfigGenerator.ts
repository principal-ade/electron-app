import * as fs from 'fs';
import * as path from 'path';

export interface KnipAutoConfig {
  entry: string[];
  project: string[];
  ignore: string[];
  ignoreDependencies: string[];
  webpack?: boolean;
  typescript?: boolean;
}

export class KnipConfigGenerator {
  /**
   * Detect project type and generate appropriate Knip config
   */
  static async generateConfig(projectPath: string): Promise<KnipAutoConfig> {
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('No package.json found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const projectType = this.detectProjectType(packageJson, projectPath);

    console.log(`[KnipConfigGenerator] Detected project type: ${projectType}`);

    switch (projectType) {
      case 'electron':
        return this.getElectronConfig(projectPath);
      case 'next':
        return this.getNextConfig(projectPath);
      case 'react':
        return this.getReactConfig(projectPath);
      case 'vue':
        return this.getVueConfig(projectPath);
      case 'angular':
        return this.getAngularConfig(projectPath);
      case 'express':
        return this.getExpressConfig(projectPath);
      case 'library':
        return this.getLibraryConfig(projectPath);
      default:
        return this.getGenericConfig(projectPath);
    }
  }

  /**
   * Detect project type based on dependencies and file structure
   */
  private static detectProjectType(
    packageJson: any,
    projectPath: string,
  ): string {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for framework-specific dependencies
    if (deps['electron']) return 'electron';
    if (deps['next']) return 'next';
    if (deps['react'] && !deps['next'] && !deps['electron']) return 'react';
    if (deps['vue']) return 'vue';
    if (deps['@angular/core']) return 'angular';
    if (deps['express'] || deps['fastify'] || deps['koa']) return 'express';

    // Check if it's a library (has main/module exports)
    if (packageJson.main || packageJson.module || packageJson.exports) {
      return 'library';
    }

    return 'generic';
  }

  /**
   * Find entry points by scanning for common patterns
   */
  private static findEntryPoints(projectPath: string): string[] {
    const entries: string[] = [];
    const commonEntries = [
      'src/index.ts',
      'src/index.tsx',
      'src/index.js',
      'src/index.jsx',
      'src/main.ts',
      'src/main.tsx',
      'src/main.js',
      'src/main.jsx',
      'src/app.ts',
      'src/app.tsx',
      'src/app.js',
      'src/app.jsx',
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
      'src/server.ts',
      'src/server.js',
      'bin/cli.js',
      'bin/cli.ts',
    ];

    for (const entry of commonEntries) {
      if (fs.existsSync(path.join(projectPath, entry))) {
        entries.push(entry);
      }
    }

    // Check package.json scripts for entry points
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.scripts) {
        // Look for start/dev scripts
        const scripts = Object.values(packageJson.scripts) as string[];
        for (const script of scripts) {
          const match = script.match(
            /(?:node|ts-node|tsx)\s+([^\s]+\.(?:js|ts|jsx|tsx))/,
          );
          if (match && fs.existsSync(path.join(projectPath, match[1]))) {
            entries.push(match[1]);
          }
        }
      }
    }

    return entries.length > 0 ? entries : ['src/index.{ts,tsx,js,jsx}'];
  }

  private static getElectronConfig(projectPath: string): KnipAutoConfig {
    return {
      entry: [
        'src/main/main.ts',
        'src/renderer/index.tsx',
        'src/main.js',
        'src/renderer.js',
      ].filter((e) => fs.existsSync(path.join(projectPath, e))),
      project: ['src/**/*.{ts,tsx,js,jsx}'],
      ignore: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/fixtures/**',
        '**/mocks/**',
        '.erb/**',
        'release/**',
        'dist/**',
      ],
      ignoreDependencies: [
        '@electron-forge/*',
        'electron-builder',
        'electron-rebuild',
      ],
      webpack: false,
    };
  }

  private static getNextConfig(projectPath: string): KnipAutoConfig {
    // Check for app/pages directories in both root and src folder
    const hasAppDir = fs.existsSync(path.join(projectPath, 'app'));
    const hasSrcAppDir = fs.existsSync(path.join(projectPath, 'src/app'));
    const hasPagesDir = fs.existsSync(path.join(projectPath, 'pages'));
    const hasSrcPagesDir = fs.existsSync(path.join(projectPath, 'src/pages'));

    const entry = [];
    if (hasAppDir) {
      entry.push(
        'app/**/page.{tsx,jsx,ts,js}',
        'app/**/layout.{tsx,jsx,ts,js}',
      );
    }
    if (hasSrcAppDir) {
      entry.push(
        'src/app/**/page.{tsx,jsx,ts,js}',
        'src/app/**/layout.{tsx,jsx,ts,js}',
      );
    }
    if (hasPagesDir) {
      entry.push('pages/**/*.{tsx,jsx,ts,js}');
    }
    if (hasSrcPagesDir) {
      entry.push('src/pages/**/*.{tsx,jsx,ts,js}');
    }

    // If no standard Next.js structure found, use generic entry points
    if (entry.length === 0) {
      entry.push('src/index.{ts,tsx,js,jsx}', 'index.{ts,tsx,js,jsx}');
    }

    return {
      entry,
      project: [
        'app/**/*.{ts,tsx,js,jsx}',
        'pages/**/*.{ts,tsx,js,jsx}',
        'components/**/*.{ts,tsx,js,jsx}',
        'lib/**/*.{ts,tsx,js,jsx}',
        'src/**/*.{ts,tsx,js,jsx}',
      ],
      ignore: ['**/*.test.*', '**/*.spec.*', '.next/**', 'out/**'],
      ignoreDependencies: ['next'],
    };
  }

  private static getReactConfig(projectPath: string): KnipAutoConfig {
    const isCreateReactApp = fs.existsSync(
      path.join(projectPath, 'public', 'index.html'),
    );

    return {
      entry: this.findEntryPoints(projectPath),
      project: ['src/**/*.{ts,tsx,js,jsx}'],
      ignore: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*',
        'build/**',
        'dist/**',
      ],
      ignoreDependencies: isCreateReactApp ? ['react-scripts'] : [],
    };
  }

  private static getVueConfig(projectPath: string): KnipAutoConfig {
    return {
      entry: ['src/main.{ts,js}', 'src/index.{ts,js}'],
      project: ['src/**/*.{ts,tsx,js,jsx,vue}'],
      ignore: ['**/*.test.*', '**/*.spec.*', 'dist/**'],
      ignoreDependencies: ['@vue/cli-service', 'vite'],
    };
  }

  private static getAngularConfig(projectPath: string): KnipAutoConfig {
    return {
      entry: ['src/main.ts'],
      project: ['src/**/*.{ts,tsx,js,jsx}'],
      ignore: ['**/*.spec.ts', 'e2e/**', 'dist/**'],
      ignoreDependencies: ['@angular-devkit/*', '@angular/cli'],
    };
  }

  private static getExpressConfig(projectPath: string): KnipAutoConfig {
    return {
      entry: this.findEntryPoints(projectPath),
      project: ['src/**/*.{ts,tsx,js,jsx}', '*.{ts,js}'],
      ignore: ['**/*.test.*', '**/*.spec.*', 'dist/**', 'build/**'],
      ignoreDependencies: ['nodemon', 'ts-node-dev'],
    };
  }

  private static getLibraryConfig(projectPath: string): KnipAutoConfig {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'),
    );

    const entry = [];
    if (packageJson.main) entry.push(packageJson.main);
    if (packageJson.module) entry.push(packageJson.module);
    if (packageJson.bin) {
      const bins =
        typeof packageJson.bin === 'string'
          ? [packageJson.bin]
          : Object.values(packageJson.bin);
      entry.push(...bins);
    }

    return {
      entry: entry.length > 0 ? entry : ['src/index.{ts,js}'],
      project: ['src/**/*.{ts,tsx,js,jsx}'],
      ignore: ['**/*.test.*', '**/*.spec.*', 'dist/**', 'lib/**', 'build/**'],
      ignoreDependencies: [],
    };
  }

  private static getGenericConfig(projectPath: string): KnipAutoConfig {
    return {
      entry: this.findEntryPoints(projectPath),
      project: ['**/*.{ts,tsx,js,jsx}'],
      ignore: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/test/**',
        '**/tests/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        'node_modules/**',
      ],
      ignoreDependencies: [],
    };
  }

  /**
   * Write config to temp file for Docker to use
   */
  static async writeConfigToTemp(
    config: KnipAutoConfig,
    tempPath: string,
  ): Promise<string> {
    const knipConfig = {
      $schema: 'https://unpkg.com/knip@5/schema.json',
      ...config,
    };

    const configPath = path.join(tempPath, 'knip.generated.json');
    fs.writeFileSync(configPath, JSON.stringify(knipConfig, null, 2));
    return configPath;
  }
}

import {
  HighlightLayer,
  LayerItem,
  LayerRenderStrategy,
} from "@principal-ai/code-city-react";

export interface FileTypeLayerDefinition {
  id: string;
  name: string;
  description: string;
  fileExtensions: string[];
  color: string;
  renderStrategy: LayerRenderStrategy;
  icon?: string;
  priority?: number;
  opacity?: number;
  borderWidth?: number;
}

export interface FileInfo {
  path: string;
  fileExtension?: string;
}

export class FileTypeLayerService {
  private static fileTypeDefinitions: FileTypeLayerDefinition[] = [
    {
      id: 'react-components',
      name: 'React Components',
      description: 'JSX and TSX files with React components',
      fileExtensions: ['.jsx', '.tsx'],
      color: '#00D8FF',
      renderStrategy: 'cover',
      icon: '⚛',
      priority: 50,
      opacity: 0.8,
    },
    {
      id: 'typescript-files',
      name: 'TypeScript',
      description: 'TypeScript source files',
      fileExtensions: ['.ts', '.tsx'],
      color: '#3178C6',
      renderStrategy: 'border',
      borderWidth: 2,
      priority: 40,
    },
    {
      id: 'javascript-files',
      name: 'JavaScript',
      description: 'JavaScript source files',
      fileExtensions: ['.js', '.jsx', '.mjs', '.cjs'],
      color: '#F7DF1E',
      renderStrategy: 'border',
      borderWidth: 2,
      priority: 35,
    },
    {
      id: 'test-files',
      name: 'Test Files',
      description: 'Test and spec files',
      fileExtensions: [
        '.test.js',
        '.test.ts',
        '.spec.js',
        '.spec.ts',
        '.test.jsx',
        '.test.tsx',
        '.test.mjs',
        '.spec.mjs',
      ],
      color: '#22c55e',
      renderStrategy: 'glow',
      priority: 60,
    },
    {
      id: 'style-files',
      name: 'Styles',
      description: 'CSS, SCSS, and other style files',
      fileExtensions: [
        '.css',
        '.scss',
        '.sass',
        '.less',
        '.styled.js',
        '.styled.ts',
      ],
      color: '#ff6b6b',
      renderStrategy: 'fill',
      opacity: 0.3,
      priority: 30,
    },
    {
      id: 'configuration-files',
      name: 'Config Files',
      description: 'Configuration and settings files',
      fileExtensions: [
        '.json',
        '.yaml',
        '.yml',
        '.toml',
        '.env',
        '.env.local',
        '.env.production',
        '.env.development',
      ],
      color: '#f59e0b',
      renderStrategy: 'fill',
      opacity: 0.2,
      priority: 25,
    },
    {
      id: 'markdown-docs',
      name: 'Documentation',
      description: 'Markdown and documentation files',
      fileExtensions: ['.md', '.mdx', '.rst', '.txt'],
      color: '#64b5f6',
      renderStrategy: 'border',
      borderWidth: 1,
      priority: 20,
    },
    {
      id: 'package-files',
      name: 'Package Files',
      description: 'Package manifests and lock files',
      fileExtensions: [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'Cargo.toml',
        'Cargo.lock',
        'go.mod',
        'go.sum',
      ],
      color: '#9c27b0',
      renderStrategy: 'glow',
      priority: 70,
    },
    {
      id: 'build-files',
      name: 'Build Files',
      description: 'Build configuration and compiled output',
      fileExtensions: [
        '.d.ts',
        '.map',
        '.min.js',
        '.bundle.js',
        'webpack.config.js',
        'vite.config.js',
        'rollup.config.js',
        'tsconfig.json',
      ],
      color: '#795548',
      renderStrategy: 'pattern',
      priority: 15,
    },
    {
      id: 'image-files',
      name: 'Images',
      description: 'Image and media files',
      fileExtensions: [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.webp',
        '.ico',
      ],
      color: '#e91e63',
      renderStrategy: 'fill',
      opacity: 0.4,
      priority: 10,
    },
  ];

  static getAvailableFileTypeLayers(): FileTypeLayerDefinition[] {
    return [...this.fileTypeDefinitions];
  }

  static getDefinitionById(id: string): FileTypeLayerDefinition | undefined {
    return this.fileTypeDefinitions.find((def) => def.id === id);
  }

  static createLayerFromDefinition(
    definition: FileTypeLayerDefinition,
    files: FileInfo[],
  ): HighlightLayer {
    // Filter files that match the extensions
    const matchingFiles = files.filter((f) => {
      const fileName = f.path.split('/').pop() || '';
      return definition.fileExtensions.some((ext) => {
        // Handle both extension patterns (e.g., '.js') and full filename patterns (e.g., 'package.json')
        if (ext.includes('/')) {
          // Full path pattern
          return f.path.endsWith(ext);
        }
        if (ext.startsWith('.')) {
          // Extension pattern
          return fileName.endsWith(ext);
        }
        // Exact filename pattern
        return fileName === ext;
      });
    });

    const items: LayerItem[] = matchingFiles.map((f) => {
      const item: LayerItem = {
        path: f.path,
        type: 'file' as const,
        renderStrategy: definition.renderStrategy,
      };

      // Add cover options for icon-based strategies
      if (definition.icon && definition.renderStrategy === 'cover') {
        item.coverOptions = {
          icon: definition.icon,
          opacity: definition.opacity || 0.8,
          backgroundColor: definition.color,
          iconSize: 24,
        };
      }

      return item;
    });

    return {
      id: `filetype-${definition.id}`,
      name: `${definition.name} (${matchingFiles.length})`,
      enabled: false, // User must explicitly enable
      color: definition.color,
      opacity: definition.opacity,
      borderWidth: definition.borderWidth,
      priority: definition.priority || 10,
      dynamic: false,
      items,
    };
  }

  static createCustomFileTypeLayer(
    name: string,
    extensions: string[],
    color: string,
    renderStrategy: LayerRenderStrategy,
    files: FileInfo[],
  ): HighlightLayer {
    const definition: FileTypeLayerDefinition = {
      id: `custom-${Date.now()}`,
      name,
      description: `Custom file type layer for ${extensions.join(', ')}`,
      fileExtensions: extensions,
      color,
      renderStrategy,
      priority: 30,
    };

    return this.createLayerFromDefinition(definition, files);
  }

  static suggestLayersForProject(files: FileInfo[]): FileTypeLayerDefinition[] {
    const suggestions: FileTypeLayerDefinition[] = [];
    const fileSet = new Set(files.map((f) => f.path));

    // Check which definitions have matching files
    for (const definition of this.fileTypeDefinitions) {
      const hasMatchingFiles = definition.fileExtensions.some((ext) => {
        return files.some((f) => {
          const fileName = f.path.split('/').pop() || '';
          if (ext.includes('/')) {
            return f.path.endsWith(ext);
          }
          if (ext.startsWith('.')) {
            return fileName.endsWith(ext);
          }
          return fileName === ext;
        });
      });

      if (hasMatchingFiles) {
        suggestions.push(definition);
      }
    }

    // Sort by priority (higher priority first)
    return suggestions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}

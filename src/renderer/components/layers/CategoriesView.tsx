import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';

interface FileTypeInfo {
  extension: string;
  count: number;
  color: string;
  icon: string;
  name: string;
  category?: string;
}

interface CategoryInfo {
  name: string;
  color: string;
  icon: string;
  extensions: string[];
}

interface CategoriesViewProps {
  fileTypeStats: FileTypeInfo[];
  enabledLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
  onToggleCategory: (extensions: string[]) => void;
}

const categories: CategoryInfo[] = [
  {
    name: 'Code',
    color: '#61DAFB',
    icon: '💻',
    extensions: [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.cs',
      '.go',
      '.rs',
      '.swift',
      '.kt',
      '.rb',
      '.php',
    ],
  },
  {
    name: 'Markup',
    color: '#E34C26',
    icon: '📄',
    extensions: ['.html', '.xml', '.svg', '.md', '.mdx'],
  },
  {
    name: 'Style',
    color: '#1572B6',
    icon: '🎨',
    extensions: ['.css', '.scss', '.sass', '.less', '.styl'],
  },
  {
    name: 'Config',
    color: '#FFA500',
    icon: '⚙️',
    extensions: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.config'],
  },
  {
    name: 'Data',
    color: '#4CAF50',
    icon: '📊',
    extensions: ['.csv', '.tsv', '.sql', '.db', '.sqlite'],
  },
  {
    name: 'Image',
    color: '#FF6B6B',
    icon: '🖼️',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'],
  },
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  fileTypeStats,
  enabledLayers,
  onToggleLayer,
  onToggleCategory,
}) => {
  const { theme } = useTheme();

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          Categories
        </h3>
        <span
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          {categories.length} categories
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {categories.map((category) => {
          const categoryStats = fileTypeStats.filter((stat) =>
            category.extensions.includes(stat.extension),
          );
          const totalFiles = categoryStats.reduce(
            (sum, stat) => sum + stat.count,
            0,
          );

          const enabledCount = categoryStats.filter((stat) =>
            enabledLayers.has(`tech-layer-${stat.extension}`),
          ).length;

          const isCategoryEnabled = enabledCount > 0;
          const isPartiallyEnabled =
            enabledCount > 0 && enabledCount < categoryStats.length;

          if (totalFiles === 0) return null;

          return (
            <div key={category.name}>
              <div
                onClick={() => onToggleCategory(category.extensions)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundLight,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: `2px solid ${isCategoryEnabled ? category.color : 'transparent'}`,
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: category.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                  }}
                >
                  {category.icon}
                </div>
                <div style={{ flex: 1, marginLeft: '12px' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: theme.colors.text,
                    }}
                  >
                    {category.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {totalFiles} file{totalFiles !== 1 ? 's' : ''} •{' '}
                    {categoryStats.length} type
                    {categoryStats.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid ${isCategoryEnabled ? category.color : theme.colors.border}`,
                    backgroundColor: isCategoryEnabled
                      ? category.color
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isCategoryEnabled && !isPartiallyEnabled && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path
                        d="M1 5L4 8L11 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {isPartiallyEnabled && (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        backgroundColor: category.color,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Show file types in this category when expanded */}
              {isCategoryEnabled && (
                <div
                  style={{
                    marginLeft: '34px',
                    marginTop: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {categoryStats.map((stat) => {
                    const layerId = `tech-layer-${stat.extension}`;
                    const isEnabled = enabledLayers.has(layerId);

                    return (
                      <div
                        key={stat.extension}
                        style={{
                          padding: '6px 8px',
                          backgroundColor: theme.colors.backgroundLight,
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          opacity: isEnabled ? 1 : 0.6,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayer(layerId);
                        }}
                      >
                        <span style={{ fontSize: '10px' }}>{stat.icon}</span>
                        <span style={{ flex: 1 }}>{stat.extension}</span>
                        <span>{stat.count}</span>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            border: `1px solid ${isEnabled ? stat.color : theme.colors.border}`,
                            backgroundColor: isEnabled
                              ? stat.color
                              : 'transparent',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

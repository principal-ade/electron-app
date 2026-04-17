/**
 * TypeInformationPanel
 *
 * Displays TypeScript type information from the current project with search functionality.
 * Uses TypeSchemaService to extract and display types.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { Search, FileType, Package, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { typeSchemaService } from '../../main-process-api/TypeSchemaService';

export interface TypeInformationPanelProps {
  context: PanelContextValue;
  actions: PanelActions;
  events: PanelEventEmitter;
}

interface ExtractedType {
  name: string;
  kind: 'interface' | 'type' | 'class' | 'enum' | 'function';
  filePath: string;
}

export const TypeInformationPanel: React.FC<TypeInformationPanelProps> = ({
  context,
  events,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [types, setTypes] = useState<ExtractedType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<ExtractedType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<ExtractedType | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [typeDefinitions, setTypeDefinitions] = useState<Map<string, string>>(new Map());
  const [loadingDefinition, setLoadingDefinition] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<{ name: string; path: string; tsConfigPath: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get repository info from context
  const repository = context.currentScope?.repository;

  // Listen for package selection events
  useEffect(() => {
    const unsubscribe = events.on('type-info:package-selected', (event) => {
      const payload = event.payload as { package: { name: string; path: string; tsConfigPath: string } };
      console.info('[TypeInformationPanel] Package selected:', payload.package);
      setSelectedPackage(payload.package);
      // Types will be reloaded by the useEffect that watches selectedPackage?.path
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Use theme space array or fallback values
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  const borderRadius = theme.radii?.[1] || 4;

  // Find all TypeScript files using glob
  const findTypeScriptFiles = async (dirPath: string): Promise<string[]> => {
    try {
      console.log('[TypeInformationPanel] Globbing for TypeScript files in:', dirPath);

      // Use glob to find all .ts and .tsx files, excluding .d.ts files
      const tsFiles = await window.mainProcess.fileSystem.glob('**/*.ts', { cwd: dirPath });
      const tsxFiles = await window.mainProcess.fileSystem.glob('**/*.tsx', { cwd: dirPath });

      const allFiles = [...tsFiles, ...tsxFiles];
      console.log('[TypeInformationPanel] Glob found files:', allFiles);

      // Filter out .d.ts files and files in common build/dependency directories
      const filtered = allFiles.filter(file => {
        const isDeclarationFile = file.endsWith('.d.ts');
        const isInExcludedDir =
          file.includes('node_modules/') ||
          file.includes('/.git/') ||
          file.includes('/dist/') ||
          file.includes('/build/') ||
          file.includes('/.next/') ||
          file.includes('/out/') ||
          file.includes('/coverage/');

        return !isDeclarationFile && !isInExcludedDir;
      });

      // Convert to absolute paths
      const absolutePaths = filtered.map(file => `${dirPath}/${file}`);

      console.log('[TypeInformationPanel] Filtered to', absolutePaths.length, 'TypeScript files');
      return absolutePaths;
    } catch (error) {
      console.error('Failed to find TypeScript files:', error);
      return [];
    }
  };

  // Load types from repository
  const loadTypes = async () => {
    const packagePath = selectedPackage?.path || repository?.path;
    const tsConfigPath = selectedPackage?.tsConfigPath;

    if (!packagePath) return;

    setIsLoading(true);
    try {
      console.info('[TypeInformationPanel] Loading types from:', packagePath);

      // Find all TypeScript files in the package
      const tsFiles = await findTypeScriptFiles(packagePath);
      console.info(`[TypeInformationPanel] Found ${tsFiles.length} TypeScript files`);

      // Limit to first 50 files for performance
      const filesToProcess = tsFiles.slice(0, 50);

      const allTypes: ExtractedType[] = [];

      // Extract types from each file
      for (const filePath of filesToProcess) {
        try {
          const result = await typeSchemaService.extractTypes(filePath, tsConfigPath);

          if (result.success && result.data) {
            const relativePath = filePath.replace(packagePath + '/', '');

            for (const typeName of result.data) {
              allTypes.push({
                name: typeName,
                kind: 'interface', // We'll infer this from the type name for now
                filePath: relativePath,
              });
            }
          }
        } catch (error) {
          console.error(`Failed to extract types from ${filePath}:`, error);
        }
      }

      console.info(`[TypeInformationPanel] Extracted ${allTypes.length} types`);
      setTypes(allTypes);
      setFilteredTypes(allTypes);
    } catch (error) {
      console.error('Failed to load types:', error);
      // Fall back to empty array on error
      setTypes([]);
      setFilteredTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load types on mount and when package changes
  useEffect(() => {
    loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository?.path, selectedPackage?.path]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const filtered = types.filter((type) =>
          type.name.toLowerCase().includes(query) ||
          type.filePath.toLowerCase().includes(query) ||
          type.kind.toLowerCase().includes(query)
        );
        setFilteredTypes(filtered);
      } else {
        setFilteredTypes(types);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, types]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadTypes();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle type selection
  const handleTypeSelect = async (type: ExtractedType) => {
    const typeKey = `${type.filePath}:${type.name}`;

    // Toggle expansion
    const newExpandedTypes = new Set(expandedTypes);
    if (newExpandedTypes.has(typeKey)) {
      newExpandedTypes.delete(typeKey);
      setExpandedTypes(newExpandedTypes);
      if (selectedType?.name === type.name && selectedType?.filePath === type.filePath) {
        setSelectedType(null);
      }
      return;
    }

    newExpandedTypes.add(typeKey);
    setExpandedTypes(newExpandedTypes);
    setSelectedType(type);

    events.emit({
      type: 'type-info:selected',
      source: 'type-information-panel',
      timestamp: Date.now(),
      payload: { type },
    });

    // If we already have the definition, don't fetch again
    if (typeDefinitions.has(typeKey)) {
      return;
    }

    // Fetch type definition
    setLoadingDefinition(typeKey);
    try {
      const packagePath = selectedPackage?.path || repository?.path;
      const tsConfigPath = selectedPackage?.tsConfigPath;
      const fullPath = `${packagePath}/${type.filePath}`;

      // Use generateDeclarations to get the full type definition
      const result = await typeSchemaService.generateDeclarations(fullPath, tsConfigPath);

      if (result.success && result.data) {
        // Extract just this type's definition from the declarations
        const declarations = result.data.declarations;
        const typeDefinition = extractTypeDefinition(declarations, type.name);

        setTypeDefinitions((prev) => new Map(prev).set(typeKey, typeDefinition));
      } else {
        setTypeDefinitions((prev) => new Map(prev).set(typeKey, `// Failed to load definition for ${type.name}`));
      }
    } catch (error) {
      console.error('Failed to fetch type definition:', error);
      setTypeDefinitions((prev) => new Map(prev).set(typeKey, `// Error loading definition: ${error}`));
    } finally {
      setLoadingDefinition(null);
    }
  };

  // Extract a specific type definition from declaration file content
  const extractTypeDefinition = (declarations: string, typeName: string): string => {
    // Try to find the specific type definition
    const patterns = [
      new RegExp(`export\\s+(?:declare\\s+)?interface\\s+${typeName}\\s*\\{[^}]*\\}`, 's'),
      new RegExp(`export\\s+(?:declare\\s+)?type\\s+${typeName}\\s*=\\s*[^;]+;`, 's'),
      new RegExp(`export\\s+(?:declare\\s+)?class\\s+${typeName}\\s*(?:extends\\s+[^\\{]+)?\\{[^}]*\\}`, 's'),
      new RegExp(`export\\s+(?:declare\\s+)?enum\\s+${typeName}\\s*\\{[^}]*\\}`, 's'),
      new RegExp(`export\\s+(?:declare\\s+)?(?:function|const)\\s+${typeName}[^;{]*(?:\\{[^}]*\\}|;)`, 's'),
    ];

    for (const pattern of patterns) {
      const match = declarations.match(pattern);
      if (match) {
        return match[0];
      }
    }

    // If not found, return the full declarations or a message
    return declarations || `// Definition for ${typeName} not found`;
  };

  // Get icon for type kind
  const getKindIcon = (kind: ExtractedType['kind']) => {
    switch (kind) {
      case 'interface':
      case 'type':
        return <FileType size={40} color={theme.colors.primary} />;
      case 'class':
        return <Package size={40} color={theme.colors.info} />;
      case 'enum':
        return <Package size={40} color={theme.colors.warning} />;
      case 'function':
        return <FileType size={40} color={theme.colors.success} />;
      default:
        return <FileType size={40} color={theme.colors.textSecondary} />;
    }
  };

  // Get color for type kind
  const getKindColor = (kind: ExtractedType['kind']) => {
    switch (kind) {
      case 'interface':
        return theme.colors.primary;
      case 'type':
        return theme.colors.info;
      case 'class':
        return theme.colors.success;
      case 'enum':
        return theme.colors.warning;
      case 'function':
        return theme.colors.accent;
      default:
        return theme.colors.textSecondary;
    }
  };

  // No repository selected
  if (!repository) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <FileType
          size={48}
          style={{ marginBottom: spacing.md, opacity: 0.5 }}
        />
        <p style={{ margin: 0, fontSize: theme.fontSizes[2], fontFamily: theme.fonts.body }}>
          No project selected
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body }}>
          Select a project to view its TypeScript types
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: theme.fontSizes[3],
                fontWeight: 600,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
              }}
            >
              Type Information
            </h3>
            {selectedPackage && (
              <div
                style={{
                  marginTop: spacing.xs / 2,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                }}
              >
                {selectedPackage.name}
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: `${spacing.xs}px ${spacing.sm}px`,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: borderRadius,
              background: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.6 : 1,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: spacing.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textTertiary,
              pointerEvents: 'none',
            }}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`Search ${types.length} types...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: `${spacing.sm}px ${spacing.sm}px ${spacing.sm}px ${spacing.lg + spacing.md}px`,
              fontSize: theme.fontSizes[2],
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: borderRadius,
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
        </div>

        {/* Results count */}
        {searchQuery && (
          <div
            style={{
              marginTop: spacing.xs,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
            }}
          >
            {filteredTypes.length} {filteredTypes.length === 1 ? 'result' : 'results'}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.lg,
              color: theme.colors.textSecondary,
            }}
          >
            <Loader2
              size={32}
              style={{
                marginBottom: spacing.md,
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ margin: 0, fontSize: theme.fontSizes[2], fontFamily: theme.fonts.body }}>
              Loading types...
            </p>
          </div>
        ) : filteredTypes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.lg,
              color: theme.colors.textSecondary,
              textAlign: 'center',
            }}
          >
            <FileType
              size={32}
              style={{ marginBottom: spacing.md, opacity: 0.5 }}
            />
            <p style={{ margin: 0, fontSize: theme.fontSizes[2], fontFamily: theme.fonts.body }}>
              {searchQuery ? 'No types found' : 'No types available'}
            </p>
            <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body }}>
              {searchQuery
                ? 'Try adjusting your search query'
                : 'This project has no TypeScript types'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {filteredTypes.map((type) => {
              const typeKey = `${type.filePath}:${type.name}`;
              const isExpanded = expandedTypes.has(typeKey);
              const isSelected = selectedType?.name === type.name && selectedType?.filePath === type.filePath;
              const definition = typeDefinitions.get(typeKey);
              const isLoadingDef = loadingDefinition === typeKey;

              return (
                <div
                  key={typeKey}
                  style={{
                    border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: borderRadius,
                    background: isSelected ? theme.colors.backgroundTertiary : theme.colors.backgroundSecondary,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Type Header (Clickable) */}
                  <div
                    onClick={() => handleTypeSelect(type)}
                    style={{
                      padding: spacing.sm,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing.sm,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.style.backgroundColor = theme.colors.backgroundTertiary;
                        e.currentTarget.parentElement.style.borderColor = theme.colors.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.style.backgroundColor = theme.colors.backgroundSecondary;
                        e.currentTarget.parentElement.style.borderColor = theme.colors.border;
                      }
                    }}
                  >
                    {getKindIcon(type.kind)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: 500,
                          marginBottom: spacing.xs / 2,
                          fontFamily: theme.fonts.monospace,
                          color: theme.colors.text,
                        }}
                      >
                        {type.name}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: theme.colors.background,
                            color: getKindColor(type.kind),
                            fontWeight: 500,
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts.body,
                            textTransform: 'uppercase',
                          }}
                        >
                          {type.kind}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontFamily: theme.fonts.body,
                          }}
                        >
                          {type.filePath}
                        </span>
                      </div>
                    </div>
                    {/* Expand indicator */}
                    <ChevronRight
                      size={16}
                      style={{
                        color: theme.colors.textSecondary,
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </div>

                  {/* Expanded Definition */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: `1px solid ${theme.colors.border}`,
                        padding: spacing.sm,
                        backgroundColor: theme.colors.background,
                      }}
                    >
                      {isLoadingDef ? (
                        <div style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body }}>
                          Loading definition...
                        </div>
                      ) : definition ? (
                        <pre
                          style={{
                            margin: 0,
                            padding: spacing.sm,
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: borderRadius,
                            overflow: 'auto',
                            fontSize: theme.fontSizes[1],
                            fontFamily: theme.fonts.monospace,
                            color: theme.colors.text,
                            lineHeight: 1.5,
                          }}
                        >
                          {definition}
                        </pre>
                      ) : (
                        <div style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[1], fontFamily: theme.fonts.body }}>
                          No definition available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

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

interface TypeInformationPanelProps {
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
  actions,
  _events,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get repository info from context
  const repository = context.currentScope?.repository;

  // Use theme space array or fallback values
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  const borderRadius = theme.radii?.[1] || 4;

  // Load types from repository
  const loadTypes = async () => {
    if (!repository?.path) return;

    setIsLoading(true);
    try {
      // Mock data for now - in real implementation, would scan all .ts/.tsx files
      // and call TypeSchemaService.extractTypes() for each
      const mockTypes: ExtractedType[] = [
        { name: 'UserProfile', kind: 'interface', filePath: 'src/types/user.ts' },
        { name: 'ApiResponse', kind: 'type', filePath: 'src/types/api.ts' },
        { name: 'Repository', kind: 'interface', filePath: 'src/types/repository.ts' },
        { name: 'GitStatus', kind: 'type', filePath: 'src/types/git.ts' },
        { name: 'PanelContextValue', kind: 'interface', filePath: 'src/types/panel.ts' },
        { name: 'ThemeColors', kind: 'enum', filePath: 'src/types/theme.ts' },
        { name: 'ValidationError', kind: 'class', filePath: 'src/utils/errors.ts' },
        { name: 'formatDate', kind: 'function', filePath: 'src/utils/date.ts' },
      ];

      setTypes(mockTypes);
      setFilteredTypes(mockTypes);
    } catch (error) {
      console.error('Failed to load types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load types on mount
  useEffect(() => {
    loadTypes();
  }, [repository?.path]);

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
      // Mock definition for now - in real implementation, use TypeSchemaService
      const mockDefinition = getMockDefinition(type);

      setTypeDefinitions((prev) => new Map(prev).set(typeKey, mockDefinition));
    } catch (error) {
      console.error('Failed to fetch type definition:', error);
    } finally {
      setLoadingDefinition(null);
    }
  };

  // Mock definition generator (replace with real TypeSchemaService call)
  const getMockDefinition = (type: ExtractedType): string => {
    switch (type.kind) {
      case 'interface':
        return `interface ${type.name} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}`;
      case 'type':
        return `type ${type.name} = {
  success: boolean;
  data?: any;
  error?: string;
};`;
      case 'class':
        return `class ${type.name} extends Error {
  constructor(message: string) {
    super(message);
    this.name = '${type.name}';
  }
}`;
      case 'enum':
        return `enum ${type.name} {
  Primary = 'primary',
  Secondary = 'secondary',
  Success = 'success',
  Error = 'error',
}`;
      case 'function':
        return `function ${type.name}(input: string): string {
  return input.trim();
}`;
      default:
        return `// Definition for ${type.name}`;
    }
  };

  // Get icon for type kind
  const getKindIcon = (kind: ExtractedType['kind']) => {
    switch (kind) {
      case 'interface':
      case 'type':
        return <FileType size={16} color={theme.colors.primary} />;
      case 'class':
        return <Package size={16} color={theme.colors.info} />;
      case 'enum':
        return <Package size={16} color={theme.colors.warning} />;
      case 'function':
        return <FileType size={16} color={theme.colors.success} />;
      default:
        return <FileType size={16} color={theme.colors.textSecondary} />;
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
        <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
          No project selected
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
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
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Type Information
          </h3>
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
            <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
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
            <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
              {searchQuery ? 'No types found' : 'No types available'}
            </p>
            <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
              {searchQuery
                ? 'Try adjusting your search query'
                : 'This project has no TypeScript types'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {filteredTypes.map((type, index) => {
              const typeKey = `${type.filePath}:${type.name}`;
              const isExpanded = expandedTypes.has(typeKey);
              const isSelected = selectedType?.name === type.name && selectedType?.filePath === type.filePath;
              const definition = typeDefinitions.get(typeKey);
              const isLoadingDef = loadingDefinition === typeKey;

              return (
                <div
                  key={`${type.filePath}-${type.name}-${index}`}
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
                      if (!isSelected) {
                        e.currentTarget.parentElement!.style.backgroundColor = theme.colors.backgroundTertiary;
                        e.currentTarget.parentElement!.style.borderColor = theme.colors.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.parentElement!.style.backgroundColor = theme.colors.backgroundSecondary;
                        e.currentTarget.parentElement!.style.borderColor = theme.colors.border;
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
                        <div style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[1] }}>
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
                        <div style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[1] }}>
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

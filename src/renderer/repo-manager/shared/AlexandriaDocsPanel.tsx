import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Search,
  FileText,
  Book,
  Loader,
  Eye,
  EyeOff,
  ArrowDownAZ,
  Clock,
} from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { AlexandriaDocsService } from '../../main-process-api/AlexandriaDocsService';
import { documentSearchService } from '../../services/DocumentSearchService';
import { promises as fs } from 'fs';

interface AlexandriaDocItem {
  path: string;
  name: string;
  relativePath: string;
  isTracked: boolean;
  mtime?: Date;
}

type SortMode = 'alphabetical' | 'recentlyEdited';

interface AlexandriaDocsPanelProps {
  repositoryPath: string;
  onDocumentSelect: (filePath: string, type: 'markdown' | 'excalidraw') => void;
  selectedDocument?: string;
}

export const AlexandriaDocsPanel: React.FC<AlexandriaDocsPanelProps> = ({
  repositoryPath,
  onDocumentSelect,
  selectedDocument,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<AlexandriaDocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alexandriaEntry, setAlexandriaEntry] =
    useState<AlexandriaEntry | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');

  // Fetch Alexandria entry and documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the Alexandria entry for this repository
      const entry = await AlexandriaService.getRepositoryByPath(repositoryPath);

      if (!entry) {
        setError('Repository not registered in Alexandria');
        setDocuments([]);
        return;
      }

      setAlexandriaEntry(entry);

      // Get comprehensive documents including tracked and untracked
      const comprehensiveDocs =
        await AlexandriaDocsService.getComprehensiveDocuments(entry);
      const { tracked, untracked, excluded } = comprehensiveDocs;

      // Convert document paths to our format
      const docItems: AlexandriaDocItem[] = [];

      // Add tracked documents with file stats
      for (const docPath of tracked) {
        const fileName = docPath.split('/').pop() || docPath;
        const name = fileName.replace(/\.(md|MD)$/i, '');
        const fullPath = `${repositoryPath}/${docPath}`.replace(/\/+/g, '/');

        // Get file modification time
        let mtime: Date | undefined;
        try {
          const stats = await fs.stat(fullPath);
          mtime = stats.mtime;
        } catch (err) {
          console.warn(`Failed to get mtime for ${fullPath}:`, err);
        }

        docItems.push({
          path: fullPath,
          name: name,
          relativePath: docPath,
          isTracked: true,
          mtime,
        });
      }

      // Add untracked documents with file stats
      for (const docPath of untracked) {
        const fileName = docPath.split('/').pop() || docPath;
        const name = fileName.replace(/\.(md|MD)$/i, '');
        const fullPath = `${repositoryPath}/${docPath}`.replace(/\/+/g, '/');

        // Get file modification time
        let mtime: Date | undefined;
        try {
          const stats = await fs.stat(fullPath);
          mtime = stats.mtime;
        } catch (err) {
          console.warn(`Failed to get mtime for ${fullPath}:`, err);
        }

        docItems.push({
          path: fullPath,
          name: name,
          relativePath: docPath,
          isTracked: false,
          mtime,
        });
      }

      setDocuments(docItems);

      console.info(
        `[AlexandriaDocsPanel] Loaded ${tracked.length} tracked, ${untracked.length} untracked documents (${excluded.length} excluded)`,
      );
    } catch (err) {
      console.error('[AlexandriaDocsPanel] Failed to fetch documents:', err);
      setError('Failed to load Alexandria documents');
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  // Load documents on mount and when repository changes
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Subscribe to repository changes
  useEffect(() => {
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      // Refresh documents if a repository was updated
      if (event.type === 'updated' && event.repository) {
        // Only refresh if this is the repository we're viewing
        if (event.repository.localPath === repositoryPath) {
          console.info(
            '[AlexandriaDocsPanel] Repository updated, refreshing documents',
          );
          fetchDocuments();
        }
      }
    });

    return unsubscribe;
  }, [repositoryPath, fetchDocuments]);

  // Subscribe to document changes
  useEffect(() => {
    const unsubscribe = documentSearchService.onDocumentChanged((event) => {
      // Refresh documents if a document was added, modified, or deleted in this repository
      if (event.document.path.startsWith(repositoryPath)) {
        console.info(
          `[AlexandriaDocsPanel] Document ${event.type}: ${event.document.path}, refreshing list`,
        );
        fetchDocuments();
      }
    });

    return unsubscribe;
  }, [repositoryPath, fetchDocuments]);

  // Filter and sort documents
  const filteredDocuments = React.useMemo(() => {
    // First filter by search query
    let filtered = searchQuery
      ? documents.filter(
          (doc) =>
            doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.relativePath.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : documents;

    // Then sort based on selected mode
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'recentlyEdited') {
        // Sort by modification time (most recent first)
        if (!a.mtime && !b.mtime) return 0;
        if (!a.mtime) return 1;
        if (!b.mtime) return -1;
        return b.mtime.getTime() - a.mtime.getTime();
      } else {
        // Sort alphabetically - tracked first, then by path
        if (a.isTracked !== b.isTracked) {
          return a.isTracked ? -1 : 1;
        }
        return a.relativePath
          .toLowerCase()
          .localeCompare(b.relativePath.toLowerCase());
      }
    });

    return sorted;
  }, [documents, searchQuery, sortMode]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '0px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Book size={16} color={theme.colors.primary} />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Alexandria Documents
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {alexandriaEntry && (
              <span
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.backgroundTertiary,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                {documents.length}{' '}
                {documents.length === 1 ? 'document' : 'documents'}
              </span>
            )}
            {documents.length > 0 && (
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                style={{
                  fontSize: '11px',
                  color: theme.colors.text,
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  outline: 'none',
                  fontWeight: 500,
                }}
                title="Sort documents"
              >
                <option value="alphabetical">A-Z</option>
                <option value="recentlyEdited">Recently Edited</option>
              </select>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div
          style={{
            position: 'relative',
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textSecondary,
            }}
          />
          <input
            type="text"
            placeholder="Search Alexandria documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '12px',
              color: theme.colors.text,
              outline: 'none',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.colors.border;
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: theme.colors.textSecondary,
            }}
          >
            <Loader
              size={24}
              className="animate-spin"
              style={{ marginBottom: '12px' }}
            />
            <span style={{ fontSize: '12px' }}>
              Loading Alexandria documents...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              padding: '40px 20px',
              fontSize: '12px',
            }}
          >
            <div style={{ marginBottom: '8px', color: theme.colors.error }}>
              {error}
            </div>
            {error === 'Repository not registered in Alexandria' && (
              <div style={{ fontSize: '11px', marginTop: '8px' }}>
                This repository needs to be registered with Alexandria to view
                its CodebaseView documents.
              </div>
            )}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              padding: '40px 20px',
              fontSize: '12px',
            }}
          >
            <div style={{ marginBottom: '8px', opacity: 0.5 }}>
              <FileText size={32} />
            </div>
            {searchQuery ? (
              <div>No documents found matching "{searchQuery}"</div>
            ) : (
              <>
                <div style={{ marginBottom: '4px' }}>
                  No Alexandria documents found
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                  CodebaseView documents will appear here once configured
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredDocuments.map((doc) => (
              <div
                key={doc.path}
                onClick={() => onDocumentSelect(doc.path, 'markdown')}
                style={{
                  padding: '10px 12px',
                  backgroundColor:
                    selectedDocument === doc.path
                      ? `${theme.colors.primary}15`
                      : 'transparent',
                  border:
                    selectedDocument === doc.path
                      ? `1px solid ${theme.colors.primary}`
                      : '1px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedDocument !== doc.path) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDocument !== doc.path) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <FileText
                      size={16}
                      color={
                        selectedDocument === doc.path
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                    {/* Tracked/Untracked indicator */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: doc.isTracked ? '#10b981' : '#f59e0b',
                        border: `1px solid ${theme.colors.background}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={
                        doc.isTracked
                          ? 'Tracked (in CodebaseView)'
                          : 'Untracked'
                      }
                    >
                      {doc.isTracked ? (
                        <Eye size={6} color="white" />
                      ) : (
                        <EyeOff size={6} color="white" />
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: selectedDocument === doc.path ? 600 : 500,
                        color:
                          selectedDocument === doc.path
                            ? theme.colors.primary
                            : theme.colors.text,
                        marginBottom: '2px',
                      }}
                    >
                      {doc.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                          opacity: 0.8,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {doc.relativePath}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: doc.isTracked ? '#10b981' : '#f59e0b',
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {doc.isTracked ? 'tracked' : 'untracked'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alexandria info footer */}
      {alexandriaEntry && documents.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundLight,
            fontSize: '10px',
            color: theme.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          Showing tracked and untracked markdown documents
        </div>
      )}
    </div>
  );
};

export const AlexandriaDocsPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <FileText size={14} style={{ color: theme.colors.primary }} />
        <span>README.md</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <FileText size={14} style={{ color: theme.colors.primary }} />
        <span>CONTRIBUTING.md</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Book size={14} style={{ color: theme.colors.primary }} />
        <span>docs/</span>
      </div>
    </div>
  );
};

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Search,
  FileText,
  Book,
  Loader,
  ArrowDownAZ,
  Clock,
  List,
  Eye,
} from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { GitStatus } from '../../../shared/types/repository.types';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { AlexandriaDocsService } from '../../main-process-api/AlexandriaDocsService';
import { documentSearchService } from '../../services/DocumentSearchService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { AlexandriaDocItem } from './AlexandriaDocItem';

export interface AlexandriaDocItemData {
  path: string;
  name: string;
  relativePath: string;
  isTracked: boolean;
  mtime?: Date;
  files?: string[];
}

type SortMode = 'alphabetical' | 'recentlyEdited';
type FilterMode = 'all' | 'tracked';

interface AlexandriaDocsPanelProps {
  repositoryPath: string;
  onDocumentSelect: (filePath: string, type: 'markdown' | 'excalidraw') => void;
  selectedDocument?: string;
  onFileSelect?: (filePath: string) => void;
  gitStatus?: GitStatus;
}

export const AlexandriaDocsPanel: React.FC<AlexandriaDocsPanelProps> = ({
  repositoryPath,
  onDocumentSelect,
  selectedDocument,
  onFileSelect,
  gitStatus,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<AlexandriaDocItemData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alexandriaEntry, setAlexandriaEntry] =
    useState<AlexandriaEntry | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('recentlyEdited');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Format relative time (e.g., "2 hours ago", "3 days ago")
  const formatRelativeTime = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }, []);

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

      // Get documents with their associated CodebaseView files
      const documentsWithFiles =
        await AlexandriaDocsService.getDocumentsWithFiles(entry);
      const { documents: docs } = documentsWithFiles;

      // Convert to our format and add file stats
      const docItems: AlexandriaDocItemData[] = [];

      for (const doc of docs) {
        const fileName = doc.relativePath.split('/').pop() || doc.relativePath;
        const name = fileName.replace(/\.(md|MD)$/i, '');

        // Get file modification time
        let mtime: Date | undefined;
        try {
          const stats = await FileSystemService.getFileStats(doc.path);
          if (stats?.lastModified) {
            mtime = new Date(stats.lastModified);
          }
        } catch (err) {
          console.warn(`Failed to get mtime for ${doc.path}:`, err);
        }

        docItems.push({
          path: doc.path,
          name: name,
          relativePath: doc.relativePath,
          isTracked: doc.isTracked,
          mtime,
          files: doc.files,
        });
      }

      setDocuments(docItems);

      const trackedCount = docItems.filter((d) => d.isTracked).length;
      const untrackedCount = docItems.filter((d) => !d.isTracked).length;

      console.info(
        `[AlexandriaDocsPanel] Loaded ${trackedCount} tracked, ${untrackedCount} untracked documents`,
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
        if (event.repository.path === repositoryPath) {
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

    // Then filter by tracked/untracked mode
    if (filterMode === 'tracked') {
      filtered = filtered.filter((doc) => doc.isTracked);
    }

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
  }, [documents, searchQuery, sortMode, filterMode]);

  // Compute which docs have associated files with changes
  const docsWithChanges = useMemo(() => {
    if (!gitStatus) return new Set<string>();

    const changedFiles = new Set([
      ...gitStatus.staged.map((f) => f.path),
      ...gitStatus.unstaged.map((f) => f.path),
      ...gitStatus.untracked.map((f) => f.path),
      ...gitStatus.deleted.map((f) => f.path),
    ]);

    return new Set(
      documents
        .filter((doc) => doc.files?.some((file) => changedFiles.has(file)))
        .map((doc) => doc.path),
    );
  }, [documents, gitStatus]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '0px',
        overflow: 'hidden',
        fontFamily: theme.fonts.body,
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
            {alexandriaEntry && (
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  fontWeight: theme.fontWeights.medium,
                }}
              >
                {documents.length}{' '}
                {documents.length === 1 ? 'document' : 'documents'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {documents.length > 0 && (
              <>
                <button
                  onClick={() =>
                    setFilterMode(filterMode === 'all' ? 'tracked' : 'all')
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts.body,
                    fontWeight: theme.fontWeights.medium,
                    color: theme.colors.text,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  title={`Filter: ${filterMode === 'all' ? 'All Documents' : 'Tracked Only'}`}
                >
                  {filterMode === 'all' ? (
                    <List size={14} color={theme.colors.primary} />
                  ) : (
                    <Eye size={14} color={theme.colors.primary} />
                  )}
                  <span>{filterMode === 'all' ? 'All' : 'Tracked'}</span>
                </button>
                <button
                  onClick={() =>
                    setSortMode(
                      sortMode === 'alphabetical'
                        ? 'recentlyEdited'
                        : 'alphabetical',
                    )
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts.body,
                    fontWeight: theme.fontWeights.medium,
                    color: theme.colors.text,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  title={`Sort: ${sortMode === 'alphabetical' ? 'Alphabetical' : 'Recently Edited'}`}
                >
                  {sortMode === 'alphabetical' ? (
                    <ArrowDownAZ size={14} color={theme.colors.primary} />
                  ) : (
                    <Clock size={14} color={theme.colors.primary} />
                  )}
                  <span>
                    {sortMode === 'alphabetical' ? 'A-Z' : 'Recent'}
                  </span>
                </button>
              </>
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
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts.body,
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
            <span style={{ fontSize: theme.fontSizes[0] }}>
              Loading documents...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              padding: '40px 20px',
              fontSize: theme.fontSizes[0],
            }}
          >
            <div style={{ marginBottom: '8px', color: theme.colors.error }}>
              {error}
            </div>
            {error === 'Repository not registered in Alexandria' && (
              <div style={{ fontSize: theme.fontSizes[0], marginTop: '8px' }}>
                This repository needs to be registered to view its documents.
              </div>
            )}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              padding: '40px 20px',
              fontSize: theme.fontSizes[0],
            }}
          >
            <div style={{ marginBottom: '8px', opacity: 0.5 }}>
              <FileText size={32} />
            </div>
            {searchQuery ? (
              <div>No documents found matching "{searchQuery}"</div>
            ) : (
              <>
                <div style={{ marginBottom: '4px' }}>No documents found</div>
                <div style={{ fontSize: theme.fontSizes[0], opacity: 0.8 }}>
                  Documents will appear here once configured
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredDocuments.map((doc) => (
              <AlexandriaDocItem
                key={doc.path}
                doc={doc}
                isSelected={selectedDocument === doc.path}
                onSelect={onDocumentSelect}
                formatRelativeTime={formatRelativeTime}
                trackedFiles={doc.files}
                onFileSelect={onFileSelect}
                gitStatus={gitStatus}
                hasChangedFiles={docsWithChanges.has(doc.path)}
              />
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
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          {filterMode === 'all'
            ? 'Showing tracked and untracked markdown documents'
            : 'Showing tracked markdown documents only'}
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
        fontSize: theme.fontSizes[0],
        fontFamily: theme.fonts.body,
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

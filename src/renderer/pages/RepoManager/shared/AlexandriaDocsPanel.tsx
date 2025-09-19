import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Search, FileText, Book, Loader } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { AlexandriaDocsService } from '../../../main-process-api/AlexandriaDocsService';

interface AlexandriaDocItem {
  path: string;
  name: string;
  relativePath: string;
}

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

      // Get documents from Alexandria (only those associated with CodebaseViews)
      const { documents: docPaths, excluded } =
        await AlexandriaDocsService.getDocumentsWithExclusions(entry);

      // Convert document paths to our format
      // Note: Deduplication is handled in the backend service temporarily until Alexandria library is fixed
      const docItems: AlexandriaDocItem[] = docPaths.map((docPath) => {
        // Extract just the filename without extension for the name
        const fileName = docPath.split('/').pop() || docPath;
        const name = fileName.replace(/\.(md|MD)$/i, '');

        // Build the full path
        const fullPath = `${repositoryPath}/${docPath}`.replace(/\/+/g, '/');

        return {
          path: fullPath,
          name: name,
          relativePath: docPath,
        };
      });

      // Sort by relative path
      docItems.sort((a, b) =>
        a.relativePath
          .toLowerCase()
          .localeCompare(b.relativePath.toLowerCase()),
      );

      setDocuments(docItems);

      console.info(
        `[AlexandriaDocsPanel] Loaded ${docItems.length} documents from Alexandria (${excluded.length} excluded)`,
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

  // Filter documents based on search
  const filteredDocuments = searchQuery
    ? documents.filter(
        (doc) =>
          doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.relativePath.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : documents;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
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
                  <FileText
                    size={16}
                    color={
                      selectedDocument === doc.path
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
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
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        opacity: 0.8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.relativePath}
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
          Showing documents from Alexandria CodebaseViews
        </div>
      )}
    </div>
  );
};

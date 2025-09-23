import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Search, FileText, Clock, Book, Loader } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { AlexandriaDocsService } from '../../../main-process-api/AlexandriaDocsService';

interface AlexandriaDocItem {
  path: string;
  name: string;
  relativePath: string;
}

interface MarkdownSearchPanelProps {
  baseDirectory: string;
  onDocumentSelect: (
    filePath: string,
    type: 'markdown' | 'excalidraw',
    storageLocation: 'repository',
    diagramId?: string,
  ) => void;
  onDocumentDeleted?: (deletedPath: string) => void;
  selectedDocument?: string;
}

export const MarkdownSearchPanel: React.FC<MarkdownSearchPanelProps> = ({
  baseDirectory,
  onDocumentSelect,
  onDocumentDeleted: _onDocumentDeleted,
  selectedDocument,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<AlexandriaDocItem[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<AlexandriaDocItem[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alexandriaEntry, setAlexandriaEntry] =
    useState<AlexandriaEntry | null>(null);

  // Fetch Alexandria documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the Alexandria entry for this repository
      const entry = await AlexandriaService.getRepositoryByPath(baseDirectory);

      if (!entry) {
        setError('Repository not registered in Alexandria');
        setDocuments([]);
        setRecentDocuments([]);
        return;
      }

      setAlexandriaEntry(entry);

      // Get documents from Alexandria (only those associated with CodebaseViews)
      const { documents: docPaths, excluded } =
        await AlexandriaDocsService.getDocumentsWithExclusions(entry);

      // Convert document paths to our format
      const docItems: AlexandriaDocItem[] = docPaths.map((docPath) => {
        // Extract just the filename without extension for the name
        const fileName = docPath.split('/').pop() || docPath;
        const name = fileName.replace(/\.(md|MD)$/i, '');

        // Build the full path
        const fullPath = `${baseDirectory}/${docPath}`.replace(/\/+/g, '/');

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

      // Set recent documents (first 5)
      setRecentDocuments(docItems.slice(0, 5));

      console.info(
        `[MarkdownSearchPanel] Loaded ${docItems.length} documents from Alexandria (${excluded.length} excluded)`,
      );
    } catch (err) {
      console.error('[MarkdownSearchPanel] Failed to fetch documents:', err);
      setError('Failed to load Alexandria documents');
    } finally {
      setLoading(false);
    }
  }, [baseDirectory]);

  // Load documents on mount and when baseDirectory changes
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
    : [];

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
        ) : (
          <>
            {/* Recent Documents */}
            {!searchQuery && recentDocuments.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Clock size={11} />
                  RECENT
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {recentDocuments.map((doc) => (
                    <DocumentItem
                      key={doc.path}
                      document={doc}
                      isSelected={doc.path === selectedDocument}
                      onClick={() =>
                        onDocumentSelect(doc.path, 'markdown', 'repository')
                      }
                      theme={theme}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchQuery && (
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    marginBottom: '8px',
                  }}
                >
                  SEARCH RESULTS ({filteredDocuments.length})
                </div>

                {filteredDocuments.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      color: theme.colors.textSecondary,
                      padding: '20px',
                      fontSize: '12px',
                    }}
                  >
                    No documents found matching "{searchQuery}"
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {filteredDocuments.map((doc) => (
                      <DocumentItem
                        key={doc.path}
                        document={doc}
                        isSelected={doc.path === selectedDocument}
                        onClick={() =>
                          onDocumentSelect(doc.path, 'markdown', 'repository')
                        }
                        theme={theme}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!searchQuery &&
              recentDocuments.length === 0 &&
              documents.length === 0 && (
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
                  <div style={{ marginBottom: '4px' }}>
                    No Alexandria documents found
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>
                    CodebaseView documents will appear here once configured
                  </div>
                </div>
              )}
          </>
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

// Document Item Component
const DocumentItem: React.FC<{
  document: AlexandriaDocItem;
  isSelected: boolean;
  onClick: () => void;
  theme: any;
}> = ({ document, isSelected, onClick, theme }) => {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        backgroundColor: isSelected
          ? `${theme.colors.primary}15`
          : 'transparent',
        border: isSelected
          ? `1px solid ${theme.colors.primary}`
          : '1px solid transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
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
          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
          style={{ marginTop: '2px', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? theme.colors.primary : theme.colors.text,
              marginBottom: '2px',
            }}
          >
            {document.name}
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
            {document.relativePath}
          </div>
        </div>
      </div>
    </div>
  );
};

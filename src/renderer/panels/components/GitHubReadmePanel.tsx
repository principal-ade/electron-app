import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileText, Loader2, AlertCircle, X } from 'lucide-react';
import { parseMarkdownIntoPresentation } from 'themed-markdown';
import { MarkdownDocumentViewer } from '../../repo-manager/shared/MarkdownDocumentViewer';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GithubService } from '../../main-process-api/GithubService';
import { RepositoryService } from '../../main-process-api/RepositoryService';
import { LocalFileSystemProvider } from '../../services/ContentProviders';

interface GitHubReadmePanelProps {
  repository: GitHubRepository | null;
  onClose?: () => void;
}

export const GitHubReadmePanel: React.FC<GitHubReadmePanelProps> = ({
  repository,
  onClose,
}) => {
  const { theme } = useTheme();
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1.0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'document' | 'book'>('book');

  // Parse markdown into slides
  const slides = useMemo(() => {
    if (!readmeContent) return [];
    const presentation = parseMarkdownIntoPresentation(readmeContent);
    return presentation.slides.map((slide) => slide.location.content);
  }, [readmeContent]);

  const hasSlides = slides.length > 1;

  const fetchReadme = useCallback(async () => {
    if (!repository) {
      setReadmeContent(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const owner = repository.owner?.login || '';
      const repo = repository.name;
      const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];
      let content: string | null = null;

      // Try to fetch from GitHub first
      for (const readmeName of readmeNames) {
        try {
          content = await GithubService.getFileContent(owner, repo, readmeName);
          if (content) break;
        } catch {
          // Continue to next filename
          continue;
        }
      }

      // If remote fetch failed, try local clone as fallback
      if (!content) {
        try {
          const repositories = await RepositoryService.getRepositories();
          const matchingRepo = repositories.find(
            (r) =>
              r.owner.toLowerCase() === owner.toLowerCase() &&
              r.name.toLowerCase() === repo.toLowerCase(),
          );

          if (matchingRepo && matchingRepo.localClones?.length > 0) {
            const localPath = matchingRepo.localClones[0].path;
            const localProvider = new LocalFileSystemProvider();

            // Try to read README from local clone
            for (const readmeName of readmeNames) {
              // Join path using forward slash (cross-platform compatible)
              const readmeFullPath = `${localPath}/${readmeName}`.replace(
                /\/+/g,
                '/',
              );
              const localContent =
                await localProvider.readFileContent(readmeFullPath);
              if (localContent) {
                content = localContent;
                console.log(
                  `[GitHubReadmePanel] Loaded README from local clone: ${readmeFullPath}`,
                );
                break;
              }
            }
          }
        } catch (localErr) {
          console.error(
            '[GitHubReadmePanel] Failed to read from local clone:',
            localErr,
          );
          // Continue - we'll show error below if no content found
        }
      }

      if (content) {
        setReadmeContent(content);
      } else {
        setError(
          'No README found (tried both GitHub and local clones if available)',
        );
        setReadmeContent(null);
      }
    } catch (err) {
      console.error('Failed to fetch README:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load README from GitHub',
      );
      setReadmeContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void fetchReadme();
  }, [fetchReadme]);

  const handleFontScaleChange = (delta: number) => {
    setFontScale((prev) => Math.max(0.5, Math.min(3.0, prev + delta)));
  };

  if (!repository) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '360px',
          }}
        >
          <FileText size={32} color={theme.colors.textSecondary} />
          <div>
            <h3
              style={{
                margin: 0,
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              No repository selected
            </h3>
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                lineHeight: theme.lineHeights.body,
                fontFamily: theme.fonts.body,
              }}
            >
              Click on a repository to view its README
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Loader2
            size={32}
            color={theme.colors.textSecondary}
            className="spin-animation"
          />
          <p
            style={{
              margin: 0,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
            }}
          >
            Loading README...
          </p>
        </div>
      </div>
    );
  }

  if (error || !readmeContent) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '360px',
          }}
        >
          <AlertCircle size={32} color={theme.colors.error || '#ef4444'} />
          <div>
            <h3
              style={{
                margin: 0,
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              Unable to load README
            </h3>
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                lineHeight: theme.lineHeights.body,
                fontFamily: theme.fonts.body,
              }}
            >
              {error || 'No README found for this repository'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchReadme()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontWeight: theme.fontWeights.semibold,
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.backgroundSecondary,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            flex: 1,
          }}
        >
          <FileText size={16} color={theme.colors.text} />
          <span
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repository.full_name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Font size controls */}
          <button
            type="button"
            onClick={() => handleFontScaleChange(-0.1)}
            title="Decrease font size"
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: `${theme.fontSizes[0]}px`,
              fontFamily: theme.fonts.body,
              cursor: 'pointer',
            }}
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => handleFontScaleChange(0.1)}
            title="Increase font size"
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: `${theme.fontSizes[0]}px`,
              fontFamily: theme.fonts.body,
              cursor: 'pointer',
            }}
          >
            A+
          </button>

          {/* View mode toggle - only show if document has slides */}
          {hasSlides && (
            <div
              style={{
                display: 'flex',
                backgroundColor: theme.colors.background,
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  setViewMode('document');
                  setCurrentSlide(0);
                }}
                style={{
                  background:
                    viewMode === 'document'
                      ? theme.colors.primary
                      : 'transparent',
                  color:
                    viewMode === 'document'
                      ? theme.colors.background
                      : theme.colors.textSecondary,
                  border: 'none',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  transition: 'all 0.2s',
                }}
              >
                Document
              </button>
              <button
                onClick={() => {
                  setViewMode('book');
                  setCurrentSlide(0);
                }}
                style={{
                  background:
                    viewMode === 'book' ? theme.colors.primary : 'transparent',
                  color:
                    viewMode === 'book'
                      ? theme.colors.background
                      : theme.colors.textSecondary,
                  border: 'none',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  transition: 'all 0.2s',
                }}
              >
                Slides
              </button>
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              style={{
                padding: '4px',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <MarkdownDocumentViewer
          viewMode={viewMode}
          showEditor={false}
          content={readmeContent || ''}
          slides={slides}
          currentSlide={currentSlide}
          theme={theme}
          fontSizeScale={fontScale}
          bookViewMode="single"
          initialTocOpen={true}
          onContentChange={() => {}}
          onSlideNavigate={setCurrentSlide}
          onCheckboxChange={() => {}}
        />
      </div>
    </div>
  );
};

import React, { useState, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { X, ExternalLink } from 'lucide-react';
import { FileViewer } from '../../components/FileViewer';
import { ContentProvider } from '../../services/ContentProviders';

interface RemoteFileViewerModalProps {
  filePath: string;
  relativePath: string;
  contentProvider: ContentProvider;
  onClose: () => void;
  repository?: {
    owner: string;
    repo: string;
    branch?: string;
  };
}

export const RemoteFileViewerModal: React.FC<RemoteFileViewerModalProps> = ({
  filePath,
  relativePath,
  contentProvider,
  onClose,
  repository,
}) => {
  const { theme } = useTheme();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Content loader function for FileViewer
  const contentLoader = useCallback(async () => {
    try {
      // Check if content provider can provide content
      if (!contentProvider.canProvideContent()) {
        setLoadError(
          'Content viewing is not available for this repository type.',
        );
        return null;
      }

      const fileContent = await contentProvider.readFileContent(filePath);

      if (fileContent === null) {
        // Check if we're rate limited
        const capabilities = contentProvider.getCapabilities();
        if (capabilities.rateLimit && capabilities.rateLimit.remaining === 0) {
          setIsRateLimited(true);
          setLoadError(
            'GitHub API rate limit exceeded. Please authenticate with GitHub CLI (gh auth login) or wait before trying again.',
          );
        } else {
          setLoadError(
            'Unable to load file content. The file may not exist or may be inaccessible.',
          );
        }
        return null;
      }

      setLoadError(null);
      return fileContent;
    } catch (err) {
      console.error('Error loading file content:', err);

      // Check for rate limiting in error message
      if (err instanceof Error && err.message.includes('rate limit')) {
        setIsRateLimited(true);
        setLoadError(
          'GitHub API rate limit exceeded. Please authenticate with GitHub CLI (gh auth login) or wait before trying again.',
        );
      } else {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load file content',
        );
      }
      return null;
    }
  }, [filePath, contentProvider]);

  // Handle open in GitHub
  const handleOpenInGitHub = useCallback(() => {
    if (repository) {
      const url = `https://github.com/${repository.owner}/${repository.repo}/blob/${repository.branch || 'main'}/${relativePath}`;
      window.open(url, '_blank');
    }
  }, [repository, relativePath]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '1200px',
          height: '85%',
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button overlay */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '8px',
            borderRadius: '8px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            cursor: 'pointer',
            color: theme.colors.text,
            display: 'flex',
            alignItems: 'center',
            zIndex: 10,
          }}
          title="Close (Esc)"
        >
          <X size={20} />
        </button>

        {/* GitHub button overlay */}
        {repository && (
          <button
            onClick={handleOpenInGitHub}
            style={{
              position: 'absolute',
              top: '16px',
              right: '60px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              zIndex: 10,
            }}
            title="Open in GitHub"
          >
            <ExternalLink size={14} />
            GitHub
          </button>
        )}

        {/* Error handling for rate limits */}
        {loadError && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: theme.colors.background,
              padding: '32px',
              borderRadius: '12px',
              border: `1px solid ${theme.colors.border}`,
              zIndex: 20,
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ color: theme.colors.text, marginBottom: '16px' }}>
              {isRateLimited ? 'Rate Limited' : 'Error Loading File'}
            </h3>
            <p
              style={{
                color: theme.colors.textSecondary,
                marginBottom: '24px',
              }}
            >
              {loadError}
            </p>
            {isRateLimited && (
              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: theme.colors.backgroundSecondary,
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <h4 style={{ marginBottom: '8px', color: theme.colors.text }}>
                  How to fix:
                </h4>
                <ol
                  style={{
                    marginLeft: '20px',
                    color: theme.colors.textSecondary,
                    fontSize: '14px',
                    lineHeight: '1.6',
                  }}
                >
                  <li>
                    Install GitHub CLI: <code>brew install gh</code>
                  </li>
                  <li>
                    Authenticate: <code>gh auth login</code>
                  </li>
                  <li>Reload this view</li>
                </ol>
              </div>
            )}
            <button
              onClick={handleOpenInGitHub}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: theme.colors.primary,
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Open on GitHub Instead
            </button>
          </div>
        )}

        {/* File viewer content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRadius: '12px',
          }}
        >
          <FileViewer
            key={relativePath} // Force remount when file changes
            filePath={relativePath}
            displayPath={relativePath}
            className="full-height"
            contentLoader={contentLoader}
            editable={false}
            enableVimMode={false}
          />
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Github,
  Settings2,
  Sparkles,
  ArrowRight,
  FileText,
  Bot,
  FolderOpen,
  Globe,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface EmptyStateViewProps {
  onPasteGitHubUrl: (url: string) => Promise<void>;
  onConfigureHooks: () => void;
  hasConfiguredAgents: boolean;
  onOpenLocalFolder?: () => void;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({
  onPasteGitHubUrl,
  onConfigureHooks,
  hasConfiguredAgents,
  onOpenLocalFolder,
}) => {
  const { theme } = useTheme();
  const [gitUrl, setGitUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleSubmitUrl = async () => {
    if (!gitUrl.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await onPasteGitHubUrl(gitUrl.trim());
      setGitUrl('');
      setShowUrlInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        minHeight: '400px',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Welcome Message */}
        <div
          style={{
            marginBottom: '48px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '16px 32px',
              borderRadius: '100px',
              backgroundColor: `${theme.colors.primary}15`,
              marginBottom: '24px',
            }}
          >
            <span
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: theme.colors.primary,
              }}
            >
              First Steps
            </span>
          </div>
        </div>

        {/* Two Main Options */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          {/* Option 1: Configure Assistants */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '16px',
              padding: '32px',
              border: `2px solid ${theme.colors.border}`,
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={onConfigureHooks}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.accent;
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${theme.colors.accent}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Gradient Background */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.primary})`,
              }}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: `${theme.colors.accent}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings2 size={32} color={theme.colors.accent} />
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                    margin: '0 0 8px 0',
                  }}
                >
                  Configure Assistants
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    margin: '0 0 12px 0',
                    lineHeight: 1.5,
                  }}
                >
                  Setup your AI assistants with context handoff and event
                  monitoring
                </p>

                {/* Agent Status Indicator */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: hasConfiguredAgents
                      ? '#10b98120'
                      : theme.colors.backgroundTertiary,
                    color: hasConfiguredAgents
                      ? '#10b981'
                      : theme.colors.textSecondary,
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  <Bot size={14} />
                  {hasConfiguredAgents
                    ? 'Agents Configured'
                    : 'No Agents Configured'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: theme.colors.accent,
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <span>Configure Now</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </div>

          {/* Option 2: Add Projects */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '16px',
              padding: '32px',
              border: `2px solid ${theme.colors.border}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Gradient Background */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.accent})`,
              }}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: `${theme.colors.primary}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Github size={32} color={theme.colors.primary} />
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '8px',
                    margin: '0 0 8px 0',
                  }}
                >
                  Add Projects
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Add a local repository or paste a GitHub URL
                </p>
              </div>

              {showUrlInput ? (
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitUrl();
                      if (e.key === 'Escape') {
                        setShowUrlInput(false);
                        setGitUrl('');
                        setError(null);
                      }
                    }}
                    placeholder="https://github.com/owner/repository"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: `1px solid ${error ? theme.colors.error : theme.colors.border}`,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => {
                      if (!error)
                        e.currentTarget.style.borderColor =
                          theme.colors.primary;
                    }}
                    onBlur={(e) => {
                      if (!error)
                        e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  />

                  {error && (
                    <p
                      style={{
                        fontSize: '12px',
                        color: theme.colors.error,
                        margin: 0,
                        textAlign: 'left',
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowUrlInput(false);
                        setGitUrl('');
                        setError(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        color: theme.colors.text,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.border;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleSubmitUrl}
                      disabled={!gitUrl.trim() || isLoading}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor:
                          gitUrl.trim() && !isLoading
                            ? theme.colors.primary
                            : theme.colors.backgroundTertiary,
                        color:
                          gitUrl.trim() && !isLoading
                            ? 'white'
                            : theme.colors.textSecondary,
                        border: 'none',
                        cursor:
                          gitUrl.trim() && !isLoading
                            ? 'pointer'
                            : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {isLoading ? (
                        <>
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              border: '2px solid transparent',
                              borderTopColor: 'currentColor',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                            }}
                          />
                          Adding...
                        </>
                      ) : (
                        'Add Repository'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <button
                    onClick={onOpenLocalFolder}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      borderRadius: '8px',
                      backgroundColor: theme.colors.background,
                      border: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <FolderOpen size={18} />
                    <span>Open Folder</span>
                  </button>

                  <button
                    onClick={() => setShowUrlInput(true)}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      borderRadius: '8px',
                      backgroundColor: theme.colors.primary,
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}40`;
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    <Globe size={18} />
                    <span>Enter URL</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronDown, FolderOpen, Github, Search, GitBranch, Clock, Star, Folder } from 'lucide-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';
import type { AlexandriaEntry } from '@a24z/core-library';

import { SupportedLLMProvider } from '../../../shared/main-process-api-interfaces/LLMModelsAPI';
import { useTheme } from 'themed-markdown';

import {
  AgentConfigurationService,
  AgentInstallationStatus,
} from '../../main-process-api/AgentConfigurationService';
import { aiService } from '../../main-process-api/AIService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { WindowService } from '../../main-process-api/WindowService';
import { useComponentTracking } from '../../components/withComponentTracking';
import { UpdateNotification } from '../../components/UpdateNotification';

// import { ProjectsView } from './ProjectsView'; // Old view - replaced with Alexandria
import { AlexandriaRepositoryManager } from '../alexandria/AlexandriaRepositoryManager';
import { OnboardingFlowV2 } from './OnboardingFlowV2';

interface LandingPageProps {
  initialAgentStatus: AgentInstallationStatus;
  onUpdateAvailable?: (hasUpdate: boolean) => void;
}

type BottomViewMode = 'repos';

export const LandingPage: React.FC<LandingPageProps> = ({
  initialAgentStatus,
  onUpdateAvailable,
}) => {
  const { theme } = useTheme();
  const trackingProps = useComponentTracking(
    'LandingPage',
    'src/renderer/pages/LandingPage.tsx',
  );
  const [bottomViewMode] = useState<BottomViewMode>('repos');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [, setAgentStatus] =
    useState<AgentInstallationStatus>(initialAgentStatus);
  const [, setHasUpdateAvailable] = useState(false);
  const [showAddProjectDropdown, setShowAddProjectDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Repository state
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<AlexandriaEntry | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Setup configuration status
  const [, setSetupStatus] = useState({
    agentsInstalled: false,
    hooksConfigured: false,
    llmConfigured: false,
    mcpConfigured: false,
    isOllamaRunning: false,
    hasOpenRouterKey: false,
  });
  const [setupLoading, setSetupLoading] = useState(true);

  const checkSetup = useCallback(async () => {
    try {
      console.info('Checking setup...');
      setSetupLoading(true);

      // Check agent installations
      const agentStatusData =
        await AgentConfigurationService.checkAgentInstallations();
      setAgentStatus(agentStatusData);
      const agentsInstalled =
        agentStatusData.claude.isInstalled ||
        agentStatusData.cline.isInstalled ||
        agentStatusData.opencode.isInstalled;
      const hooksConfigured =
        (agentStatusData.claude.hookCount || 0) > 0 ||
        (agentStatusData.cline.hookCount || 0) > 0 ||
        (agentStatusData.opencode.hookCount || 0) > 0;

      // Check LLM configuration
      const [ollamaStatus, openRouterConfig] = await Promise.all([
        aiService.checkOllamaStatus().catch(() => null),
        aiService
          .getProviderConfig(SupportedLLMProvider.OPENROUTER)
          .catch(() => null),
      ]);

      const llmConfigured =
        (ollamaStatus?.running && ollamaStatus.models.length > 0) ||
        (openRouterConfig?.enabled && openRouterConfig?.apiKey);

      // Check MCP configuration
      let mcpConfigured = false;
      let claudeMCP = false;
      let opencodeMCP = false;

      try {
        mcpConfigured = claudeMCP || opencodeMCP;
      } catch (e) {
        console.error('Failed to check MCP status:', e);
        mcpConfigured = false;
      }

      setSetupStatus({
        agentsInstalled,
        hooksConfigured,
        llmConfigured: !!llmConfigured,
        mcpConfigured,
        isOllamaRunning: ollamaStatus?.running || false,
        hasOpenRouterKey:
          !!openRouterConfig?.enabled && !!openRouterConfig?.apiKey,
      });
    } catch (error) {
      console.error('Failed to check setup configuration:', error);
    } finally {
      setSetupLoading(false);
    }
  }, []);

  // Load repositories on mount and listen for backend events
  useEffect(() => {
    loadRepositories();

    // Subscribe to repository changes from backend
    const unsubscribe = window.mainProcess.alexandria.onRepositoryChange(() => {
      loadRepositories();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadRepositories = async () => {
    try {
      setIsLoadingRepos(true);
      const repos = await AlexandriaService.getRepositories();

      // Sort repositories by most recent commit
      const sortedRepos = [...repos].sort((a, b) => {
        const aCommit = a.github?.lastCommit ? new Date(a.github.lastCommit).getTime() : 0;
        const bCommit = b.github?.lastCommit ? new Date(b.github.lastCommit).getTime() : 0;
        return bCommit - aCommit;
      });

      setRepositories(sortedRepos);

      // Select first repository by default if none selected
      if (!selectedRepository && sortedRepos.length > 0) {
        setSelectedRepository(sortedRepos[0]);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Check full setup configuration status
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowAddProjectDropdown(false);
      }
    };

    if (showAddProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddProjectDropdown]);

  // Handle adding local repository
  const handleAddLocalRepository = async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Local Repository',
        buttonLabel: 'Select Repository',
        properties: ['openDirectory'],
      });

      if (!result || result.canceled) {
        return;
      }

      // Handle both possible response formats
      const selectedPath =
        result.filePaths?.[0] || result.filePath || result.path;

      if (selectedPath) {
        const name = selectedPath.split('/').pop() || 'unnamed';
        await AlexandriaService.registerRepository(name, selectedPath);
        // Backend will emit event to update repository list
      }
    } catch (err) {
      console.error('Failed to add local repository:', err);
    }
  };

  // Handle repository selection
  const handleSelectRepository = async (repo: AlexandriaEntry) => {
    setSelectedRepository(repo);
    // Open repository dashboard
    await WindowService.openRepositoryDashboard(repo);
  };

  // Filter repositories based on search
  const filteredRepositories = repositories.filter((repo) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.github?.description?.toLowerCase().includes(query) ||
      repo.github?.topics?.some((t) => t.toLowerCase().includes(query))
    );
  });

  // Format relative time
  const getRelativeTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  // Handle pasting GitHub link
  const handleAddGithubLink = async () => {
    // TODO: Implement GitHub link modal
    console.info('Add GitHub link - not yet implemented');
  };

  // Handle GitHub search
  const handleSearchGithub = async () => {
    // TODO: Implement GitHub search modal
    console.info('Search GitHub - not yet implemented');
  };

  // Render left panel - Repository sidebar
  const renderLeftPanel = () => {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Repository List Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundLight,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '12px',
            }}
          >
            Repositories
          </h3>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
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
              placeholder="Search repositories..."
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

        {/* Repository List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
          }}
        >
          {isLoadingRepos ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '12px',
              }}
            >
              Loading repositories...
            </div>
          ) : filteredRepositories.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '12px',
              }}
            >
              {searchQuery
                ? 'No repositories found'
                : 'No repositories yet. Add one to get started!'}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {filteredRepositories.map((repo) => (
                <div
                  key={repo.name}
                  onClick={() => setSelectedRepository(repo)}
                  style={{
                    padding: '12px',
                    backgroundColor:
                      selectedRepository?.name === repo.name
                        ? `${theme.colors.primary}15`
                        : 'transparent',
                    border:
                      selectedRepository?.name === repo.name
                        ? `1px solid ${theme.colors.primary}`
                        : '1px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedRepository?.name !== repo.name) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedRepository?.name !== repo.name) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      width: '100%',
                    }}
                  >
                    <Folder
                      size={16}
                      color={
                        selectedRepository?.name === repo.name
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0, flex: 1, marginRight: '8px' }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight:
                                selectedRepository?.name === repo.name ? 600 : 500,
                              color:
                                selectedRepository?.name === repo.name
                                  ? theme.colors.primary
                                  : theme.colors.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {repo.name}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: theme.colors.textSecondary,
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span>{repo.github?.owner || repo.remoteUrl?.split('/')[3] || 'local'}</span>
                            {repo.github?.stars && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Star size={10} />
                                {repo.github.stars}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            color: theme.colors.textSecondary,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <Clock size={10} />
                          {getRelativeTime(repo.github?.lastCommit)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render right panel - Repository details
  const renderRightPanel = () => {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: theme.colors.background,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {selectedRepository ? (
          <>
            {/* Repository Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundLight,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '20px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '4px',
                    }}
                  >
                    {selectedRepository.name}
                  </h2>
                  {selectedRepository.github?.description && (
                    <p
                      style={{
                        margin: '8px 0 0 0',
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {selectedRepository.github.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSelectRepository(selectedRepository)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background,
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  Open Dashboard
                </button>
              </div>
            </div>

            {/* Repository Info */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                {/* Stats Cards */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Last Commit
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.text,
                      fontWeight: 500,
                    }}
                  >
                    {getRelativeTime(selectedRepository.github?.lastCommit)}
                  </div>
                </div>

                {selectedRepository.github?.stars && (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        marginBottom: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      Stars
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: theme.colors.text,
                        fontWeight: 500,
                      }}
                    >
                      {selectedRepository.github.stars}
                    </div>
                  </div>
                )}

                {selectedRepository.github?.primaryLanguage && (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        marginBottom: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      Language
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: theme.colors.text,
                        fontWeight: 500,
                      }}
                    >
                      {selectedRepository.github.primaryLanguage}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Views
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.text,
                      fontWeight: 500,
                    }}
                  >
                    {selectedRepository.viewCount || 0}
                  </div>
                </div>
              </div>

              {/* Last Commit Details */}
              {selectedRepository.github?.lastCommit && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginBottom: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <GitBranch size={12} />
                    Last Commit
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Commit Message */}
                    {(selectedRepository.github as any).lastCommitMessage && (
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: theme.colors.background,
                          borderRadius: '6px',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            color: theme.colors.text,
                            fontWeight: 500,
                            marginBottom: '8px',
                            lineHeight: '1.4',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {(selectedRepository.github as any).lastCommitMessage}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          {(selectedRepository.github as any).lastCommitAuthor && (
                            <span>{(selectedRepository.github as any).lastCommitAuthor}</span>
                          )}
                          {(selectedRepository.github as any).lastCommitAuthor && (selectedRepository.github as any).lastCommitHash && (
                            <span>•</span>
                          )}
                          {(selectedRepository.github as any).lastCommitHash && (
                            <span style={{ fontFamily: 'monospace' }}>
                              {(selectedRepository.github as any).lastCommitHash}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Time Info */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            color: theme.colors.text,
                            fontWeight: 500,
                            marginBottom: '4px',
                          }}
                        >
                          {getRelativeTime(selectedRepository.github.lastCommit)}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {new Date(selectedRepository.github.lastCommit).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Repository Path */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginBottom: '8px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Local Path
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.text,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {selectedRepository.path}
                </div>
              </div>

              {/* Topics */}
              {selectedRepository.github?.topics && selectedRepository.github.topics.length > 0 && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginBottom: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Topics
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {selectedRepository.github.topics.map((topic) => (
                      <span
                        key={topic}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: `${theme.colors.primary}20`,
                          color: theme.colors.primary,
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              fontSize: '14px',
            }}
          >
            {repositories.length === 0
              ? 'Add a repository to get started'
              : 'Select a repository to view details'}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Onboarding Modal */}
      {isOnboardingOpen && (
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
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1400px',
              height: '95%',
              maxHeight: '900px',
              backgroundColor: theme.colors.background,
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOnboardingOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
              }}
            >
              <X size={18} color={theme.colors.textSecondary} />
            </button>

            <OnboardingFlowV2
              onComplete={() => {
                setIsOnboardingOpen(false);
                checkSetup(); // Refresh the setup status
              }}
              onSkip={() => setIsOnboardingOpen(false)}
            />
          </div>
        </div>
      )}
      <div
        {...trackingProps}
        style={{
          height: '100%',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            width: '100%',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
          }}
        >
          {/* Main Header Row - Brand, Update Notification (centered), and Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start', // Align items to top
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            {/* Update Notification - Absolutely positioned in center at top */}
            <div
              style={{
                position: 'absolute',
                top: '0',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
            >
              <UpdateNotification
                onUpdateAvailable={(hasUpdate) => {
                  setHasUpdateAvailable(hasUpdate);
                  onUpdateAvailable?.(hasUpdate);
                }}
              />
            </div>

            {/* Left Section - Brand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Brand Name removed - now shown in titlebar */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}
              >
                <p
                  style={{
                    fontSize: '24px',
                    color: theme.colors.textSecondary,
                    margin: 0,
                    fontWeight: 300,
                  }}
                >
                  Codebase Manager
                </p>
              </div>
            </div>

            {/* Right Section - Controls */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {/* Search Button */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: showSearch
                    ? theme.colors.primary
                    : 'transparent',
                  color: showSearch
                    ? theme.colors.background
                    : theme.colors.text,
                  border: `1px solid ${showSearch ? theme.colors.primary : theme.colors.border}`,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!showSearch) {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showSearch) {
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.text;
                  }
                }}
              >
                <Search size={16} />
                Search
              </button>

              {/* Add Project Dropdown */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() =>
                    setShowAddProjectDropdown(!showAddProjectDropdown)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <Plus size={16} />
                  Add Project
                  <ChevronDown
                    size={14}
                    style={{
                      transform: showAddProjectDropdown
                        ? 'rotate(180deg)'
                        : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>

                {/* Dropdown Menu */}
                {showAddProjectDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      minWidth: '200px',
                      zIndex: 1000,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowAddProjectDropdown(false);
                        handleAddLocalRepository();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'transparent',
                        color: theme.colors.text,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        textAlign: 'left',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <FolderOpen size={16} />
                      Local Folder
                    </button>

                    <div
                      style={{
                        height: '1px',
                        backgroundColor: theme.colors.border,
                      }}
                    />

                    <button
                      onClick={() => {
                        setShowAddProjectDropdown(false);
                        handleAddGithubLink();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'transparent',
                        color: theme.colors.text,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        textAlign: 'left',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Github size={16} />
                      Paste Link
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Container */}
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '16px',
          }}
        >
          {/* Main Content Area with Resizable Panels */}
          {setupLoading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
              }}
            >
              Loading...
            </div>
          ) : (
            <AnimatedResizableLayout
              leftPanel={renderLeftPanel()}
              rightPanel={renderRightPanel()}
              minSize={25}
              defaultSize={35}
              collapsibleSide="left"
              style={{ height: '100%', width: '100%' }}
            />
          )}
        </div>
      </div>
    </>
  );
};

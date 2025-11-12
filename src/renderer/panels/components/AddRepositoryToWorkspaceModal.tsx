import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { X, Search, FolderOpen, Plus } from 'lucide-react';
import type { Workspace, AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { RepositoryAvatar } from '../../components/repository-maps/RepositoryAvatar';

interface AddRepositoryToWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  currentRepositoryIds: string[]; // List of repository IDs already in workspace
}

export const AddRepositoryToWorkspaceModal: React.FC<
  AddRepositoryToWorkspaceModalProps
> = ({ isOpen, onClose, workspace, currentRepositoryIds }) => {
  const { theme } = useTheme();
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // Track which repo is being added

  // Load repositories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRepositories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const repos = await AlexandriaService.getRepositories();

      // Filter out repositories already in the workspace
      const availableRepos = repos.filter(
        (r) => {
          // Check if this repository is already in the workspace
          const repoId = r.github?.id;
          if (!repoId) return false;
          return !currentRepositoryIds.includes(repoId);
        }
      );

      setRepositories(availableRepos);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter repositories based on search
  const filteredRepositories = repositories.filter((repo) => {
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      (repo.github?.owner || '').toLowerCase().includes(query)
    );
  });

  const handleAddRepository = async (repo: AlexandriaEntry) => {
    if (!repo.github?.id) {
      console.error('Repository missing GitHub ID');
      return;
    }

    try {
      setAdding(repo.path);
      await WorkspaceService.addRepositoryToWorkspace(repo, workspace.id);

      // Remove from available list
      setRepositories(prev => prev.filter(r => r.path !== repo.path));

      // If no more repos, close modal
      if (filteredRepositories.length <= 1) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to add repository to workspace:', error);
      alert(`Failed to add repository: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAdding(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '16px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 24px 16px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Add Repository to {workspace.name}
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                marginTop: '4px',
                margin: '4px 0 0 0',
              }}
            >
              Select repositories to add to this workspace
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              position: 'relative',
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
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
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            />
          </div>
        </div>

        {/* Repository List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: theme.colors.textSecondary,
                fontSize: '14px',
              }}
            >
              Loading repositories...
            </div>
          ) : filteredRepositories.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: theme.colors.textSecondary,
                fontSize: '14px',
                gap: '8px',
              }}
            >
              <FolderOpen size={48} style={{ opacity: 0.3 }} />
              <span>
                {searchQuery
                  ? 'No repositories match your search'
                  : 'No repositories available to add'}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '12px',
              }}
            >
              {filteredRepositories.map((repo) => {
                const isHovered = hoveredRepo === repo.path;
                const isAdding = adding === repo.path;

                return (
                  <div
                    key={repo.path}
                    style={{
                      backgroundColor: isHovered
                        ? theme.colors.backgroundTertiary
                        : theme.colors.background,
                      border: `2px solid ${isHovered ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '12px',
                      padding: '16px',
                      transition: 'all 0.2s',
                      cursor: isAdding ? 'default' : 'pointer',
                      transform: isHovered
                        ? 'translateY(-2px)'
                        : 'translateY(0)',
                      boxShadow: isHovered
                        ? '0 4px 12px rgba(0, 0, 0, 0.1)'
                        : 'none',
                      opacity: isAdding ? 0.6 : 1,
                    }}
                    onClick={() => {
                      if (!isAdding) {
                        handleAddRepository(repo);
                      }
                    }}
                    onMouseEnter={() => !isAdding && setHoveredRepo(repo.path)}
                    onMouseLeave={() => setHoveredRepo(null)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                      }}
                    >
                      {/* Repository Avatar */}
                      <RepositoryAvatar
                        repository={{
                          name: repo.name,
                          owner: repo.github?.owner || 'unknown',
                          remoteUrl: repo.remoteUrl || '',
                          vcsType: 'github',
                          localClones: [{ path: repo.path, addedAt: Date.now() }],
                          addedAt: Date.now(),
                        }}
                        size={48}
                        type="repository"
                      />

                      {/* Repository Info */}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}
                        >
                          <h3
                            style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: theme.colors.text,
                              margin: 0,
                            }}
                          >
                            {repo.name}
                          </h3>
                        </div>
                        <p
                          style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 4px 0',
                          }}
                        >
                          {repo.github?.owner && `by ${repo.github.owner}`}
                        </p>
                        <p
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textTertiary,
                            margin: 0,
                            fontFamily: theme.fonts.monospace,
                          }}
                        >
                          {repo.path}
                        </p>
                      </div>

                      {/* Add Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isAdding) {
                            handleAddRepository(repo);
                          }
                        }}
                        disabled={isAdding}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: isAdding
                            ? theme.colors.backgroundTertiary
                            : theme.colors.primary,
                          color: isAdding ? theme.colors.textSecondary : '#fff',
                          border: 'none',
                          cursor: isAdding ? 'default' : 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          opacity: isAdding ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isAdding) {
                            e.currentTarget.style.opacity = '0.9';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isAdding) {
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                      >
                        <Plus size={14} />
                        {isAdding ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundTertiary,
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            <span>
              {filteredRepositories.length} {filteredRepositories.length === 1 ? 'repository' : 'repositories'} available
            </span>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

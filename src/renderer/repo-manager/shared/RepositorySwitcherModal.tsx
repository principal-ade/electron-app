import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  X,
  Search,
  FolderOpen,
  GitFork,
  FolderSearch,
  NotebookPen,
} from 'lucide-react';
import type { Repository } from '../../../shared/types/repository.types';
import { RepositoryService } from '../../main-process-api/RepositoryService';
import { RepositoryAvatar } from '../../components/repository-maps/RepositoryAvatar';
import { LicenseBadge } from '../../components/common/LicenseBadge';

interface RepositorySwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRepository: Repository;
  onSelectRepository: (
    repository: Repository,
    mode: 'explore' | 'maintain',
    openInNewWindow: boolean,
  ) => void;
}

export const RepositorySwitcherModal: React.FC<
  RepositorySwitcherModalProps
> = ({ isOpen, onClose, currentRepository, onSelectRepository }) => {
  const { theme } = useTheme();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null);

  // Load repositories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRepositories();
    }
  }, [isOpen]);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const repos = await RepositoryService.getRepositories();
      // Filter out the current repository
      const otherRepos = repos.filter(
        (r) => r.remoteUrl !== currentRepository.remoteUrl,
      );
      setRepositories(otherRepos);
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
      repo.owner.toLowerCase().includes(query) ||
      repo.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const handleSelectRepository = (
    repo: Repository,
    mode: 'explore' | 'maintain',
    openInNewWindow: boolean = true,
  ) => {
    onSelectRepository(repo, mode, openInNewWindow);
    onClose();
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
              Switch Repository
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                marginTop: '4px',
                margin: '4px 0 0 0',
              }}
            >
              Select a repository to open
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
                  : 'No other repositories available'}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '12px',
              }}
            >
              {filteredRepositories.map((repo, index) => {
                const hasLocalClones = (repo.localClones?.length ?? 0) > 0;
                const isHovered = hoveredRepo === repo.remoteUrl;

                return (
                  <div
                    key={`${repo.remoteUrl}-${index}`}
                    style={{
                      backgroundColor: isHovered
                        ? theme.colors.backgroundTertiary
                        : theme.colors.background,
                      border: `2px ${hasLocalClones ? 'solid' : 'dashed'} ${isHovered ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '12px',
                      padding: '16px',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      transform: isHovered
                        ? 'translateY(-2px)'
                        : 'translateY(0)',
                      boxShadow: isHovered
                        ? '0 4px 12px rgba(0, 0, 0, 0.1)'
                        : 'none',
                    }}
                    onClick={() => {
                      // Default action: open in explore mode when clicking the card
                      handleSelectRepository(repo, 'explore', true);
                    }}
                    onMouseEnter={() => setHoveredRepo(repo.remoteUrl)}
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
                        repository={repo}
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
                          {repo.metadata?.license && (
                            <LicenseBadge
                              license={repo.metadata.license}
                              size="small"
                              interactive={false}
                            />
                          )}
                          {repo.metadata?.isFork && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#f59e0b15',
                                border: '1px solid #f59e0b40',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#f59e0b',
                              }}
                            >
                              <GitFork size={10} />
                              Fork
                            </div>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 8px 0',
                          }}
                        >
                          by {repo.owner}
                        </p>

                        {/* Action Buttons */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            opacity: isHovered ? 1 : 0,
                            visibility: isHovered ? 'visible' : 'hidden',
                            transition: 'opacity 0.2s, visibility 0.2s',
                          }}
                        >
                          {hasLocalClones ? (
                            <>
                              {/* Maintain button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectRepository(repo, 'maintain', true);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: theme.colors.backgroundLight,
                                  color: theme.colors.text,
                                  border: `1px solid ${theme.colors.border}`,
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    theme.colors.background;
                                  e.currentTarget.style.borderColor =
                                    theme.colors.textSecondary;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundLight;
                                  e.currentTarget.style.borderColor =
                                    theme.colors.border;
                                }}
                              >
                                <NotebookPen size={12} />
                                Maintain
                              </button>

                              {/* Explore button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectRepository(repo, 'explore', true);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor:
                                    theme.colors.backgroundTertiary,
                                  color: theme.colors.text,
                                  border: `1px solid ${theme.colors.border}`,
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    theme.colors.background;
                                  e.currentTarget.style.borderColor =
                                    theme.colors.primary;
                                  e.currentTarget.style.color =
                                    theme.colors.primary;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundTertiary;
                                  e.currentTarget.style.borderColor =
                                    theme.colors.border;
                                  e.currentTarget.style.color =
                                    theme.colors.text;
                                }}
                              >
                                <FolderSearch size={12} />
                                Explore
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRepository(repo, 'explore', true);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: theme.colors.backgroundLight,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.background;
                                e.currentTarget.style.borderColor =
                                  theme.colors.textSecondary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.backgroundLight;
                                e.currentTarget.style.borderColor =
                                  theme.colors.border;
                              }}
                            >
                              <FolderSearch size={12} />
                              Explore
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Repository Indicator */}
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
            <span>Currently viewing:</span>
            <strong style={{ color: theme.colors.text }}>
              {currentRepository.name}
            </strong>
            <span>by {currentRepository.owner}</span>
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

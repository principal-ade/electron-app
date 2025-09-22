import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  Github,
  Gitlab,
  GitBranch,
  FolderSearch,
  GitFork,
  AlertCircle,
  Trash2,
  FolderOpen,
  Code2,
  Camera,
  RefreshCw,
  Sparkles,
  Tag,
  Plus,
  X,
  FileText,
  NotebookPen,
  Settings,
} from 'lucide-react';
import type {
  Repository,
  LocalClone,
} from '../../../shared/types/repository.types';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { EditorId } from '../../../shared/types/editor.types';
import { RepositoryService } from '../../main-process-api/RepositoryService';
import { GitWatcherService } from '../../main-process-api/GitWatcherService';
import { GitService } from '../../main-process-api/GitService';
import type { GitStatus } from '../../../shared/main-process-api-interfaces/GitWatcherAPI';
import { ImageCropper } from '../repository-maps/ImageCropper';
import { RepositoryAvatar } from '../repository-maps/RepositoryAvatar';
import { getTagColor } from '../../utils/tagUtils';
import { LicenseBadge } from '../common/LicenseBadge';
import { WindowService } from '../../main-process-api/WindowService';

interface RepositoryCardProps {
  repository: Repository;
  onRemove: () => void;
  onOpenRepo: (repo: Repository, localClone?: LocalClone) => void;
  onRemoveLocalClone: (repo: Repository, localPath: string) => void;
  onShowForkParent?: (parentRepo: {
    owner: string;
    name: string;
    url: string;
  }) => void;
  onClone?: (repo: Repository) => void;
  onOpenSettings?: (repo: Repository) => void;
  showRemoveButton?: boolean;
  showTags?: boolean;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  onRemove,
  onOpenRepo,
  onRemoveLocalClone,
  onShowForkParent,
  onClone,
  onOpenSettings,
  showRemoveButton = true,
  showTags = false,
}) => {
  const { theme } = useTheme();
  const [preferredEditor, setPreferredEditor] = useState<EditorId>('vscode');
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({});
  const [isHovered, setIsHovered] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedBadgeInfo, setSelectedBadgeInfo] = useState<{
    branch: string;
    path: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
  } | null>(null);
  const [deletingClone, setDeletingClone] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [deleteWarning, setDeleteWarning] = useState<{
    path: string;
    hasUncommittedChanges: boolean;
    unpushedCommits: number;
    currentBranch: string;
  } | null>(null);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarTarget, setAvatarTarget] = useState<{
    type: 'repository' | 'clone';
    clonePath?: string;
  } | null>(null);
  const [customAvatarUrls, setCustomAvatarUrls] = useState<
    Record<string, string>
  >({});
  const [manualTags, setManualTags] = useState<string[]>(
    repository.manualTags || [],
  );
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const hasLocalClones = (repository.localClones?.length ?? 0) > 0;

  // Load custom avatar URLs
  useEffect(() => {
    const loadAvatarUrls = async () => {
      const urls: Record<string, string> = {};

      // Load repository avatar
      if (repository.customAvatarPath) {
        const url = await RepositoryService.getAvatarUrl(
          repository.customAvatarPath,
        );
        if (url) urls.repo = url;
      }

      // Load clone avatars
      if (repository.localClones) {
        for (const clone of repository.localClones) {
          if (clone.customAvatarPath) {
            const url = await RepositoryService.getAvatarUrl(
              clone.customAvatarPath,
            );
            if (url) urls[clone.path] = url;
          }
        }
      }

      setCustomAvatarUrls(urls);
    };

    loadAvatarUrls();
  }, [repository]);

  const handleAvatarSave = async (blob: Blob) => {
    if (!avatarTarget) return;

    try {
      let result;
      if (avatarTarget.type === 'repository') {
        result = await RepositoryService.setRepositoryAvatar(
          repository.remoteUrl,
          blob,
        );
      } else if (avatarTarget.clonePath) {
        result = await RepositoryService.setCloneAvatar(
          repository.remoteUrl,
          avatarTarget.clonePath,
          blob,
        );
      }

      if (result?.success) {
        // Reload repository to get updated avatar paths
        window.location.reload(); // Simple reload for now
      }
    } catch (error) {
      console.error('Failed to save avatar:', error);
    }
  };

  const handleRemoveAvatar = async (
    type: 'repository' | 'clone',
    clonePath?: string,
  ) => {
    try {
      let result;
      if (type === 'repository') {
        result = await RepositoryService.removeRepositoryAvatar(
          repository.remoteUrl,
        );
      } else if (clonePath) {
        result = await RepositoryService.removeCloneAvatar(
          repository.remoteUrl,
          clonePath,
        );
      }

      if (result?.success) {
        window.location.reload(); // Simple reload for now
      }
    } catch (error) {
      console.error('Failed to remove avatar:', error);
    }
  };

  const getDisplayAvatar = () => {
    // Priority: repo custom avatar > GitHub avatar > default icon
    if (customAvatarUrls.repo)
      return { type: 'image' as const, url: customAvatarUrls.repo };
    if (repository.avatarUrl)
      return { type: 'image' as const, url: repository.avatarUrl };
    return { type: 'icon' as const };
  };

  const handleDeleteLocalClone = async (
    clonePath: string,
    deleteFiles: boolean = false,
  ) => {
    setDeletingClone(clonePath);
    try {
      if (deleteFiles) {
        // First attempt to delete
        const result = await GitService.deleteGitRepository(clonePath);

        if (!result.success) {
          if (result.requiresConfirmation) {
            // Show warning dialog
            setDeleteWarning({
              path: clonePath,
              hasUncommittedChanges: result.hasUncommittedChanges || false,
              unpushedCommits: result.unpushedCommits || 0,
              currentBranch: result.currentBranch || 'unknown',
            });
            setDeletingClone(null);
            setShowDeleteConfirm(null);
            return;
          } else if (result.error !== 'warning') {
            alert(`Failed to delete repository: ${result.error}`);
            setDeletingClone(null);
            return;
          }
        }
      }

      // Remove from repository record
      await onRemoveLocalClone(repository, clonePath);

      // If this was the last clone, we might want to notify parent
      // Parent component can handle modal closing if needed
    } catch (error) {
      console.error('Failed to remove local clone:', error);
      alert(
        'Failed to remove local clone. Please check the console for details.',
      );
    } finally {
      setDeletingClone(null);
      setShowDeleteConfirm(null);
    }
  };

  const handleForceDelete = async (clonePath: string) => {
    setDeletingClone(clonePath);
    try {
      const result = await GitService.forceDeleteGitRepository(clonePath);
      if (!result.success) {
        alert(`Failed to delete repository: ${result.error}`);
        setDeletingClone(null);
        return;
      }

      // Remove from repository record
      await onRemoveLocalClone(repository, clonePath);

      // If this was the last clone, we might want to notify parent
      // Parent component can handle modal closing if needed
    } catch (error) {
      console.error('Failed to force delete local clone:', error);
      alert(
        'Failed to delete local clone. Please check the console for details.',
      );
    } finally {
      setDeletingClone(null);
      setDeleteWarning(null);
    }
  };

  const handleDeleteRepository = () => {
    onRemove();
  };

  const handleAddTag = async () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag || manualTags.includes(trimmedTag)) {
      setNewTag('');
      setIsAddingTag(false);
      return;
    }

    const updatedTags = [...manualTags, trimmedTag];
    setManualTags(updatedTags);

    // Save to repository
    await RepositoryService.updateRepository(repository.remoteUrl, {
      manualTags: updatedTags,
      tags: [
        ...(repository.tags || []).filter(
          (t) => !repository.manualTags?.includes(t),
        ),
        ...updatedTags,
      ],
    });

    setNewTag('');
    setIsAddingTag(false);

    // Trigger a refresh to update the parent component
    window.location.reload(); // Simple approach for now
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = manualTags.filter((tag) => tag !== tagToRemove);
    setManualTags(updatedTags);

    // Save to repository
    await RepositoryService.updateRepository(repository.remoteUrl, {
      manualTags: updatedTags,
      tags: [
        ...(repository.tags || []).filter(
          (t) => !repository.manualTags?.includes(t) || t === tagToRemove,
        ),
        ...updatedTags,
      ],
    });

    // Trigger a refresh to update the parent component
    window.location.reload(); // Simple approach for now
  };

  // Load preferred editor once
  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((p) =>
        setPreferredEditor((p.defaultEditor as EditorId) ?? 'vscode'),
      )
      .catch(() => setPreferredEditor('vscode'));
  }, []);

  // Watch git status for all local clones
  useEffect(() => {
    if (!hasLocalClones || !repository.localClones) return;

    const cleanupFns: Array<() => void> = [];

    // Start watching each local clone
    repository.localClones.forEach(async (clone) => {
      // Start watching
      const result = await GitWatcherService.watchRepository(clone.path);
      if (result.success) {
        // Get initial status
        const status = await GitWatcherService.getStatus(clone.path);
        if (status) {
          setGitStatuses((prev) => {
            const newStatuses = { ...prev, [clone.path]: status };
            return newStatuses;
          });
        }
      } else {
        console.error(
          '[RepositoryCard] Failed to watch:',
          clone.path,
          result.error,
        );
      }
    });

    // Listen for status updates
    const unsubscribe = GitWatcherService.onStatusUpdate((status) => {
      // Safety check - status might be undefined
      if (!status) {
        console.error('[RepositoryCard] Received undefined status update');
        return;
      }

      // Check if this status is for one of our clones
      const isOurClone = repository.localClones?.some(
        (c) => c.path === status.repoPath,
      );
      if (isOurClone) {
        setGitStatuses((prev) => {
          const newStatuses = { ...prev, [status.repoPath]: status };
          return newStatuses;
        });
      }
    });

    cleanupFns.push(unsubscribe);

    // Cleanup on unmount
    return () => {
      cleanupFns.forEach((fn) => fn());
      // Stop watching all clones
      repository.localClones?.forEach((clone) => {
        GitWatcherService.unwatchRepository(clone.path);
      });
    };
  }, [repository.localClones, hasLocalClones]);

  return (
    <>
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `2px ${hasLocalClones ? 'solid' : 'dashed'} ${isHovered ? theme.colors.primary : theme.colors.border}`,
          borderRadius: '8px',
          padding: '24px',
          transition: 'all 0.2s ease',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: '180px',
          opacity: hasLocalClones ? 1 : 0.95,
          cursor: 'pointer',
          boxShadow: isHovered
            ? '0 4px 12px rgba(0, 0, 0, 0.1)'
            : '0 1px 3px rgba(0, 0, 0, 0.05)',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        }}
        onClick={(e) => {
          // Only proceed if the click wasn't on an interactive element
          const target = e.target as HTMLElement;
          const isInteractiveElement = target.closest(
            'a, button, input, select, textarea',
          );

          if (!isInteractiveElement) {
            e.stopPropagation();
            // Open repository - let RepositoryManager determine mode from saved preferences
            WindowService.openRepositoryMaps({
              repository: repository,
            });
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* License and Fork badges - top right */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'flex-end',
            zIndex: 1,
          }}
        >
          {/* License badge */}
          {repository.metadata?.license && (
            <div style={{ pointerEvents: 'none' }}>
              <LicenseBadge
                license={repository.metadata.license}
                size="small"
                iconType="shield"
                interactive={false}
              />
            </div>
          )}

          {/* Fork badge */}
          {repository.metadata?.isFork && repository.metadata?.parentRepo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onShowForkParent && repository.metadata?.parentRepo) {
                  onShowForkParent(repository.metadata.parentRepo);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#f59e0b15',
                border: '1px solid #f59e0b40',
                fontSize: '11px',
                fontWeight: 500,
                color: '#f59e0b',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f59e0b25';
                e.currentTarget.style.borderColor = '#f59e0b60';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f59e0b15';
                e.currentTarget.style.borderColor = '#f59e0b40';
              }}
              title={`Forked from ${repository.metadata.parentRepo.owner}/${repository.metadata.parentRepo.name}`}
            >
              <GitFork size={10} />
              <span>Fork</span>
            </button>
          )}
        </div>

        {/* Header with icon and name */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '12px',
            alignItems: 'start',
          }}
        >
          <div style={{ gridRow: 'span 2' }}>
            <RepositoryAvatar
              repository={repository}
              customAvatarUrl={customAvatarUrls.repo}
              size={64}
              type="repository"
            />
          </div>

          <span
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: theme.colors.primary,
              margin: '0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              lineHeight: '1.2',
            }}
          >
            {repository.name}
          </span>

          <p
            style={{
              fontSize: '16px',
              color: theme.colors.textSecondary,
              margin: '0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: '1.2',
            }}
          >
            by {repository.owner}
          </p>
        </div>

        {/* Tags - Show when showTags prop is true */}
        {showTags && repository.tags && repository.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
              marginTop: '8px',
              marginBottom: '4px',
            }}
          >
            {repository.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: `${getTagColor(tag)}15`,
                  color: getTagColor(tag),
                  border: `1px solid ${getTagColor(tag)}30`,
                  fontWeight: 500,
                  opacity: 0.9,
                }}
              >
                {tag}
              </span>
            ))}
            {repository.tags.length > 5 && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  color: theme.colors.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                +{repository.tags.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            color: theme.colors.textSecondary,
            flex: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* Language */}
          {repository.metadata?.language && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary,
                }}
              />
              <span>{repository.metadata.language}</span>
            </div>
          )}

          {/* Branch badges for all clones */}
          {hasLocalClones &&
            repository.localClones?.map((clone, index) => {
              const status = gitStatuses[clone.path];

              if (
                status &&
                status.branch &&
                status.branch !== 'unknown' &&
                status.branch !== 'HEAD'
              ) {
                const isDirty = status.isDirty;
                const tagColor = isDirty ? '#f59e0b' : '#10b981'; // Orange for dirty, green for clean

                return (
                  <button
                    key={clone.path}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBadgeInfo({
                        branch: status.branch,
                        path: clone.path,
                        isDirty,
                        ahead: status.ahead,
                        behind: status.behind,
                      });
                      setShowBadgeModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: `${tagColor}20`,
                      border: `1px solid ${tagColor}40`,
                      fontSize: '11px',
                      fontWeight: 500,
                      color: tagColor,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${tagColor}30`;
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.transformOrigin = 'center';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = `${tagColor}20`;
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.transformOrigin = 'center';
                    }}
                    title={`${status.branch}${isDirty ? ' (modified)' : ''}${status.ahead > 0 ? ` ↑${status.ahead}` : ''}${status.behind > 0 ? ` ↓${status.behind}` : ''}`}
                  >
                    <GitBranch size={10} />
                    <span>{status.branch}</span>
                    {isDirty && <span style={{ fontSize: '10px' }}>●</span>}
                    {status.ahead > 0 && (
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>
                        ↑{status.ahead}
                      </span>
                    )}
                    {status.behind > 0 && (
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>
                        ↓{status.behind}
                      </span>
                    )}
                    {repository.localClones.length > 1 && (
                      <span style={{ fontSize: '9px', opacity: 0.7 }}>
                        #{index + 1}
                      </span>
                    )}
                  </button>
                );
              }
              return null;
            })}
        </div>

        {/* Open Settings button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenSettings) {
              onOpenSettings(repository);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: 'auto',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: `${theme.colors.primary}15`,
            border: `1px solid ${theme.colors.primary}30`,
            fontSize: '15px',
            fontWeight: 500,
            color: theme.colors.primary,
            transition: 'all 0.2s',
            cursor: 'pointer',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.primary}25`;
            e.currentTarget.style.borderColor = `${theme.colors.primary}50`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
            e.currentTarget.style.borderColor = `${theme.colors.primary}30`;
          }}
        >
          <Settings size={16} />
          <span>Open Settings</span>
        </button>
      </div>

      {/* Git Badge Modal */}
      {showBadgeModal && selectedBadgeInfo && (
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
            zIndex: 1001,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowBadgeModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              transform: 'translateY(-20px)',
              animation: 'slideIn 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${selectedBadgeInfo.isDirty ? '#f59e0b' : '#10b981'}20, ${selectedBadgeInfo.isDirty ? '#f59e0b' : '#10b981'}40)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GitBranch
                  size={24}
                  color={selectedBadgeInfo.isDirty ? '#f59e0b' : '#10b981'}
                />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    margin: 0,
                  }}
                >
                  Git Status Badge
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    margin: '4px 0 0 0',
                  }}
                >
                  Understanding your repository state
                </p>
              </div>
            </div>

            {/* Current Branch Info */}
            <div
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <GitBranch
                  size={16}
                  color={selectedBadgeInfo.isDirty ? '#f59e0b' : '#10b981'}
                />
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: selectedBadgeInfo.isDirty ? '#f59e0b' : '#10b981',
                  }}
                >
                  {selectedBadgeInfo.branch}
                </span>
                {selectedBadgeInfo.isDirty && (
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#f59e0b20',
                      color: '#f59e0b',
                      fontWeight: 500,
                    }}
                  >
                    Modified
                  </span>
                )}
                {selectedBadgeInfo.ahead > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#3b82f620',
                      color: '#3b82f6',
                      fontWeight: 500,
                    }}
                  >
                    ↑ {selectedBadgeInfo.ahead} ahead
                  </span>
                )}
                {selectedBadgeInfo.behind > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#ef444420',
                      color: '#ef4444',
                      fontWeight: 500,
                    }}
                  >
                    ↓ {selectedBadgeInfo.behind} behind
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  margin: '4px 0 0 0',
                  wordBreak: 'break-all',
                }}
              >
                {selectedBadgeInfo.path}
              </p>
            </div>

            {/* Status Explanations */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    marginTop: '6px',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: theme.colors.text,
                      margin: '0 0 4px 0',
                    }}
                  >
                    Green Badge
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      margin: 0,
                      lineHeight: '1.4',
                    }}
                  >
                    Your working directory is clean. All changes have been
                    committed.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    marginTop: '6px',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: theme.colors.text,
                      margin: '0 0 4px 0',
                    }}
                  >
                    Orange Badge with Dot
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      margin: 0,
                      lineHeight: '1.4',
                    }}
                  >
                    You have uncommitted changes. The dot (●) indicates
                    modified, staged, or untracked files.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <GitBranch
                  size={16}
                  color={theme.colors.textSecondary}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: theme.colors.text,
                      margin: '0 0 4px 0',
                    }}
                  >
                    Branch Name
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      margin: 0,
                      lineHeight: '1.4',
                    }}
                  >
                    Shows your current git branch. Hover over any badge to see
                    the full repository path.
                  </p>
                </div>
              </div>

              {(selectedBadgeInfo.ahead > 0 ||
                selectedBadgeInfo.behind > 0) && (
                <>
                  {selectedBadgeInfo.ahead > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          backgroundColor: '#3b82f620',
                          color: '#3b82f6',
                          fontWeight: 600,
                          flexShrink: 0,
                          marginTop: '4px',
                        }}
                      >
                        ↑
                      </span>
                      <div>
                        <p
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: theme.colors.text,
                            margin: '0 0 4px 0',
                          }}
                        >
                          Ahead by {selectedBadgeInfo.ahead} commit
                          {selectedBadgeInfo.ahead > 1 ? 's' : ''}
                        </p>
                        <p
                          style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            margin: 0,
                            lineHeight: '1.4',
                          }}
                        >
                          Your local branch has commits that haven't been pushed
                          to the remote yet.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedBadgeInfo.behind > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          backgroundColor: '#ef444420',
                          color: '#ef4444',
                          fontWeight: 600,
                          flexShrink: 0,
                          marginTop: '4px',
                        }}
                      >
                        ↓
                      </span>
                      <div>
                        <p
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: theme.colors.text,
                            margin: '0 0 4px 0',
                          }}
                        >
                          Behind by {selectedBadgeInfo.behind} commit
                          {selectedBadgeInfo.behind > 1 ? 's' : ''}
                        </p>
                        <p
                          style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            margin: 0,
                            lineHeight: '1.4',
                          }}
                        >
                          The remote branch has commits you haven't pulled yet.
                          Consider pulling to stay up-to-date.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => setShowBadgeModal(false)}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                fontSize: '14px',
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
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Avatar Cropper Modal */}
      <ImageCropper
        isOpen={showAvatarCropper}
        onClose={() => {
          setShowAvatarCropper(false);
          setAvatarTarget(null);
        }}
        onSave={handleAvatarSave}
        title={
          avatarTarget?.type === 'repository'
            ? 'Set Repository Avatar'
            : 'Set Clone Avatar'
        }
        shape={avatarTarget?.type === 'repository' ? 'circle' : 'square'}
      />
    </>
  );
};

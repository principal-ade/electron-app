import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  Settings,
  Camera,
  Tag,
  Plus,
  X,
  FolderOpen,
  Trash2,
  RefreshCw,
  Github,
  Gitlab,
} from 'lucide-react';
import type {
  Repository,
  LocalClone,
} from '../../../shared/types/repository.types';
import { RepositoryService } from '../../main-process-api/RepositoryService';
import { GitWatcherService } from '../../main-process-api/GitWatcherService';
import { GitService } from '../../main-process-api/GitService';
import type { GitStatus } from '../../../shared/main-process-api-interfaces/GitWatcherAPI';
import { RepositoryAvatar } from '../repository-maps/RepositoryAvatar';
import { ImageCropper } from '../repository-maps/ImageCropper';

interface RepositorySettingsModalProps {
  repository: Repository;
  isOpen: boolean;
  onClose: () => void;
  onDeleteRepository: (repo: Repository) => void;
  onRemoveLocalClone: (repo: Repository, clonePath: string) => void;
  onUpdateRepository?: (repo: Repository) => void;
}

export const RepositorySettingsModal: React.FC<
  RepositorySettingsModalProps
> = ({
  repository,
  isOpen,
  onClose,
  onDeleteRepository,
  onRemoveLocalClone,
  onUpdateRepository,
}) => {
  const { theme } = useTheme();
  const [customAvatarUrls, setCustomAvatarUrls] = useState<
    Record<string, string>
  >({});
  const [manualTags, setManualTags] = useState<string[]>(
    repository.manualTags || [],
  );
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({});
  const [deletingClone, setDeletingClone] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarTarget, setAvatarTarget] = useState<{
    type: 'repository' | 'clone';
    clonePath?: string;
  } | null>(null);

  const hasLocalClones = (repository.localClones?.length ?? 0) > 0;

  // Load custom avatar URLs
  useEffect(() => {
    if (!isOpen) return;

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
  }, [repository, isOpen]);

  // Watch git status for all local clones
  useEffect(() => {
    if (!isOpen || !hasLocalClones || !repository.localClones) return;

    const loadStatuses = async () => {
      const statuses: Record<string, GitStatus> = {};
      for (const clone of repository.localClones!) {
        const status = await GitWatcherService.getStatus(clone.path);
        if (status) {
          statuses[clone.path] = status;
        }
      }
      setGitStatuses(statuses);
    };

    loadStatuses();
  }, [repository.localClones, hasLocalClones, isOpen]);

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
        // Reload avatar URLs
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

    // Trigger a refresh
    if (onUpdateRepository) {
      onUpdateRepository({ ...repository, manualTags: updatedTags });
    }
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

    // Trigger a refresh
    if (onUpdateRepository) {
      onUpdateRepository({ ...repository, manualTags: updatedTags });
    }
  };

  const handleDeleteLocalClone = async (
    clonePath: string,
    deleteFiles: boolean = false,
  ) => {
    setDeletingClone(clonePath);
    try {
      if (deleteFiles) {
        const result = await GitService.deleteGitRepository(clonePath);
        if (!result.success) {
          alert(`Failed to delete repository: ${result.error}`);
          setDeletingClone(null);
          return;
        }
      }

      await onRemoveLocalClone(repository, clonePath);

      // If this was the last clone, close the modal
      if (repository.localClones?.length === 1) {
        onClose();
      }
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

  const handleDeleteRepository = () => {
    onDeleteRepository(repository);
    // Don't close here - let the parent handle it after delete completes
  };

  if (!isOpen) return null;

  return (
    <>
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
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            animation: 'slideIn 0.3s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Settings size={20} color={theme.colors.primary} />
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Repository Settings
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                color: theme.colors.textSecondary,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ×
            </button>
          </div>

          {/* Repository Avatar Section */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
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
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Repository Avatar
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <RepositoryAvatar
                repository={repository}
                size={48}
                customAvatarUrl={customAvatarUrls.repo}
              />
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <button
                  onClick={() => {
                    setAvatarTarget({ type: 'repository' });
                    setShowAvatarCropper(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <Camera size={14} />
                  Change
                </button>
                {repository.customAvatarPath && (
                  <button
                    onClick={() => handleRemoveAvatar('repository')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      color: theme.colors.textSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    <X size={14} />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <RepositoryAvatar
                repository={repository}
                size={40}
                type="owner"
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '4px',
                  }}
                >
                  {repository.owner}
                </div>
                <a
                  href={`https://github.com/${repository.owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px',
                    color: theme.colors.primary,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  {repository.vcsType === 'github' ? (
                    <Github size={12} />
                  ) : (
                    <Gitlab size={12} />
                  )}
                  github.com/{repository.owner}
                </a>
              </div>
            </div>
          </div>

          {/* Manual Tags Section */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
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
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Manual Tags
              </span>
              {!isAddingTag && (
                <button
                  onClick={() => setIsAddingTag(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    color: theme.colors.primary,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500,
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
                  <Plus size={12} />
                  Add Tag
                </button>
              )}
            </div>

            {isAddingTag && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                    if (e.key === 'Escape') {
                      setNewTag('');
                      setIsAddingTag(false);
                    }
                  }}
                  placeholder="Enter tag name"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundPrimary,
                    color: theme.colors.text,
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleAddTag}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setNewTag('');
                    setIsAddingTag(false);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {manualTags.length === 0 && !isAddingTag && (
                <span
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    fontStyle: 'italic',
                  }}
                >
                  No manual tags added
                </span>
              )}
              {manualTags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: theme.colors.backgroundPrimary,
                    border: `1px solid ${theme.colors.border}`,
                    fontSize: '11px',
                    color: theme.colors.text,
                  }}
                >
                  <Tag size={10} />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '2px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.colors.textSecondary,
                      padding: 0,
                      marginLeft: '2px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                      e.currentTarget.style.color = theme.colors.error;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Local Clones Section */}
          {hasLocalClones && repository.localClones && (
            <div
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
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
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: theme.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Local Clones ({repository.localClones.length})
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {repository.localClones.map((clone) => {
                  const status = gitStatuses[clone.path];
                  const isDeleting = deletingClone === clone.path;
                  const showDelete = showDeleteConfirm === clone.path;

                  return (
                    <div
                      key={clone.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: theme.colors.backgroundPrimary,
                        border: `1px solid ${theme.colors.border}`,
                        opacity: isDeleting ? 0.5 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flex: 1,
                        }}
                      >
                        <RepositoryAvatar
                          repository={repository}
                          size={32}
                          type="clone"
                          customAvatarUrl={customAvatarUrls[clone.path]}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              color: theme.colors.text,
                              marginBottom: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <FolderOpen size={12} />
                            {clone.path.split('/').pop()}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: theme.colors.textSecondary,
                              fontFamily: 'monospace',
                            }}
                          >
                            {clone.path}
                          </div>
                          {status && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: status.hasChanges
                                  ? theme.colors.warning
                                  : theme.colors.success,
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {status.branch && `⎇ ${status.branch}`}
                              {status.hasChanges && ' • Changes'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                        }}
                      >
                        <button
                          onClick={() => {
                            setAvatarTarget({
                              type: 'clone',
                              clonePath: clone.path,
                            });
                            setShowAvatarCropper(true);
                          }}
                          disabled={isDeleting}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.border}`,
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            color: theme.colors.textSecondary,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isDeleting) {
                              e.currentTarget.style.borderColor =
                                theme.colors.primary;
                              e.currentTarget.style.color =
                                theme.colors.primary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor =
                              theme.colors.border;
                            e.currentTarget.style.color =
                              theme.colors.textSecondary;
                          }}
                        >
                          <Camera size={14} />
                        </button>

                        {!showDelete ? (
                          <button
                            onClick={() => setShowDeleteConfirm(clone.path)}
                            disabled={isDeleting}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              backgroundColor: 'transparent',
                              border: `1px solid ${theme.colors.border}`,
                              cursor: isDeleting ? 'not-allowed' : 'pointer',
                              color: theme.colors.textSecondary,
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isDeleting) {
                                e.currentTarget.style.borderColor = '#ef4444';
                                e.currentTarget.style.color = '#ef4444';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                              e.currentTarget.style.color =
                                theme.colors.textSecondary;
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              gap: '4px',
                            }}
                          >
                            <button
                              onClick={() =>
                                handleDeleteLocalClone(clone.path, false)
                              }
                              disabled={isDeleting}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor: theme.colors.warning,
                                color: '#fff',
                                border: 'none',
                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                fontSize: '10px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Remove
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteLocalClone(clone.path, true)
                              }
                              disabled={isDeleting}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                fontSize: '10px',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Delete Files
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              disabled={isDeleting}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'transparent',
                                color: theme.colors.textSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                fontSize: '10px',
                                fontWeight: 500,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delete Repository Button */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '20px',
            }}
          >
            <button
              onClick={handleDeleteRepository}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef444410';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={16} />
              Remove Repository
              {hasLocalClones && ' (keeps local files)'}
            </button>

            {!hasLocalClones && (
              <p
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                  marginTop: '4px',
                }}
              >
                This will only remove the repository from your list. No files
                will be deleted.
              </p>
            )}
          </div>
        </div>
      </div>

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

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(-20px);
          }
        }
      `}</style>
    </>
  );
};

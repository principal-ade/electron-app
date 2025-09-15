import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { 
  X, 
  FolderOpen, 
  GitBranch, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  AlertCircle,
  Download,
  Loader2,
  ExternalLink,
  Terminal
} from 'lucide-react';
import type { Repository, LocalClone } from '../../../shared/types/repository.types';
import { GitService } from '../../main-process-api/GitService';
import { RepositoryService } from '../../main-process-api/RepositoryService';
import { SystemService } from '../../main-process-api/SystemService';
import { ShellService } from '../../main-process-api/ShellService';
import { RepositoryAvatar } from './RepositoryAvatar';

interface CloneManagementModalProps {
  repository: Repository;
  isOpen: boolean;
  onClose: () => void;
  onCloneAdded?: (clonePath: string) => void;
  onCloneRemoved?: (clonePath: string) => void;
}

export const CloneManagementModal: React.FC<CloneManagementModalProps> = ({
  repository,
  isOpen,
  onClose,
  onCloneAdded,
  onCloneRemoved,
}) => {
  const { theme } = useTheme();
  
  // Debug logging
  useEffect(() => {
    console.log('CloneManagementModal isOpen:', isOpen);
  }, [isOpen]);
  const [localClones, setLocalClones] = useState<LocalClone[]>(repository.localClones || []);
  const [showAddClone, setShowAddClone] = useState(false);
  const [clonePath, setClonePath] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [deletingClone, setDeletingClone] = useState<string | null>(null);
  const [customAvatarUrls, setCustomAvatarUrls] = useState<Record<string, string>>({});

  // Update local clones when repository prop changes
  useEffect(() => {
    setLocalClones(repository.localClones || []);
  }, [repository.localClones]);

  // Load custom avatar URLs
  useEffect(() => {
    if (!isOpen) return;
    
    const loadAvatarUrls = async () => {
      const urls: Record<string, string> = {};
      
      if (repository.localClones) {
        for (const clone of repository.localClones) {
          if (clone.customAvatarPath) {
            const url = await RepositoryService.getAvatarUrl(clone.customAvatarPath);
            if (url) urls[clone.path] = url;
          }
        }
      }
      
      setCustomAvatarUrls(urls);
    };
    
    loadAvatarUrls();
  }, [repository.localClones, isOpen]);

  const handleSelectDirectory = async () => {
    try {
      const result = await SystemService.openDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Clone Location',
      });
      
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        // Append repository name to the selected directory
        const repoName = repository.name || repository.remoteUrl.split('/').pop()?.replace('.git', '') || 'repo';
        setClonePath(`${result.filePaths[0]}/${repoName}`);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleCloneRepository = async () => {
    if (!clonePath) return;
    
    setIsCloning(true);
    setCloneError(null);
    
    try {
      // Check authentication methods first
      const authCheck = await GitService.checkAuthMethods(repository.remoteUrl);
      
      // Determine which URL to use based on auth availability
      let cloneUrl = repository.remoteUrl;
      if (authCheck.ssh.available && !authCheck.https.available) {
        // Convert to SSH URL if only SSH is available
        const match = repository.remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
        if (match) {
          cloneUrl = `git@github.com:${match[1]}/${match[2]}.git`;
        }
      }
      
      // Perform the clone
      const success = await GitService.cloneRepository(cloneUrl, clonePath);
      
      if (success) {
        // Add the clone to the repository
        await RepositoryService.addLocalClone(repository.remoteUrl, clonePath);
        
        // Update local state
        const newClone: LocalClone = {
          path: clonePath,
          addedAt: Date.now(),
          lastAccessed: Date.now(),
        };
        setLocalClones([...localClones, newClone]);
        
        // Reset form
        setShowAddClone(false);
        setClonePath('');
        
        // Notify parent
        if (onCloneAdded) {
          onCloneAdded(clonePath);
        }
      } else {
        setCloneError('Failed to clone repository. Please check your credentials and try again.');
      }
    } catch (error: any) {
      console.error('Clone failed:', error);
      setCloneError(error.message || 'Failed to clone repository');
    } finally {
      setIsCloning(false);
    }
  };

  const handleRemoveClone = async (clonePath: string, deleteFiles: boolean = false) => {
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
      
      // Remove from repository
      await RepositoryService.removeLocalClone(repository.remoteUrl, clonePath);
      
      // Update local state
      setLocalClones(localClones.filter(c => c.path !== clonePath));
      
      // Notify parent
      if (onCloneRemoved) {
        onCloneRemoved(clonePath);
      }
    } catch (error) {
      console.error('Failed to remove clone:', error);
      alert('Failed to remove clone. Please check the console for details.');
    } finally {
      setDeletingClone(null);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleOpenInFinder = (path: string) => {
    ShellService.openPath(path);
  };

  const handleOpenInTerminal = (path: string) => {
    ShellService.openTerminal(path);
  };

  console.log('CloneManagementModal render, isOpen:', isOpen, 'repository:', repository?.name);
  
  if (!isOpen) {
    console.log('CloneManagementModal not rendering because isOpen is false');
    return null;
  }

  console.log('CloneManagementModal rendering modal');
  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

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
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '24px',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <RepositoryAvatar
                repository={repository}
                size={32}
              />
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}>
                  Repository Clones
                </h2>
                <p style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  margin: '2px 0 0 0',
                }}>
                  {repository.owner}/{repository.name}
                </p>
              </div>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Clone List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: '16px',
          }}>
            {localClones.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: theme.colors.textSecondary,
              }}>
                <FolderOpen size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', margin: '0 0 8px 0' }}>No local clones</p>
                <p style={{ fontSize: '12px', opacity: 0.7 }}>
                  Add a clone to start working with this repository locally
                </p>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {localClones.map((clone) => (
                  <div
                    key={clone.path}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      border: `1px solid ${theme.colors.border}`,
                      opacity: deletingClone === clone.path ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flex: 1,
                        minWidth: 0,
                      }}>
                        <RepositoryAvatar
                          repository={repository}
                          size={36}
                          type="clone"
                          customAvatarUrl={customAvatarUrls[clone.path]}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}>
                            <FolderOpen size={14} color={theme.colors.primary} />
                            <span style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: theme.colors.text,
                            }}>
                              {clone.path.split('/').pop()}
                            </span>
                            {clone.currentBranch && (
                              <span style={{
                                fontSize: '11px',
                                color: theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                <GitBranch size={11} />
                                {clone.currentBranch}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {clone.path}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '4px',
                      }}>
                        <button
                          onClick={() => handleCopyPath(clone.path)}
                          title="Copy path"
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.border}`,
                            cursor: 'pointer',
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          {copiedPath === clone.path ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleOpenInFinder(clone.path)}
                          title="Open in Finder"
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.border}`,
                            cursor: 'pointer',
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenInTerminal(clone.path)}
                          title="Open in Terminal"
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.border}`,
                            cursor: 'pointer',
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Terminal size={14} />
                        </button>
                        <button
                          onClick={() => handleRemoveClone(clone.path, false)}
                          disabled={deletingClone === clone.path}
                          title="Remove clone (keeps files)"
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.border}`,
                            cursor: deletingClone === clone.path ? 'not-allowed' : 'pointer',
                            color: theme.colors.error,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Clone Section */}
          {showAddClone ? (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: 500,
                color: theme.colors.text,
                margin: '0 0 12px 0',
              }}>
                Clone Repository
              </h3>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div>
                  <label style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    display: 'block',
                    marginBottom: '4px',
                  }}>
                    Clone Location
                  </label>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                  }}>
                    <input
                      type="text"
                      value={clonePath}
                      onChange={(e) => setClonePath(e.target.value)}
                      placeholder="/path/to/clone/location"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <button
                      onClick={handleSelectDirectory}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: theme.colors.backgroundPrimary,
                        border: `1px solid ${theme.colors.border}`,
                        cursor: 'pointer',
                        color: theme.colors.text,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FolderOpen size={14} />
                      Browse
                    </button>
                  </div>
                </div>

                {cloneError && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: `${theme.colors.error}15`,
                    border: `1px solid ${theme.colors.error}30`,
                    color: theme.colors.error,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}>
                    <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{cloneError}</span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                }}>
                  <button
                    onClick={() => {
                      setShowAddClone(false);
                      setClonePath('');
                      setCloneError(null);
                    }}
                    disabled={isCloning}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      cursor: isCloning ? 'not-allowed' : 'pointer',
                      color: theme.colors.textSecondary,
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCloneRepository}
                    disabled={!clonePath || isCloning}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: theme.colors.primary,
                      border: 'none',
                      cursor: !clonePath || isCloning ? 'not-allowed' : 'pointer',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: !clonePath || isCloning ? 0.5 : 1,
                    }}
                  >
                    {isCloning ? (
                      <>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        Cloning...
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        Clone
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddClone(true)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: theme.colors.primary,
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={16} />
              Add New Clone
            </button>
          )}
        </div>
      </div>
    </>
  );
};
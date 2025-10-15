import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Link2,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  X,
} from 'lucide-react';
import type { Repository } from '../../../shared/types/repository.types';
import type {
  RepositoryLink,
  LinkMetadata,
} from '../../../shared/main-process-api-interfaces/LinksAPI';
import { LinksService } from '../../main-process-api/LinksService';

interface LinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: Repository;
  selectedSource?: { type: string; location: string } | null;
}

export const LinksModal: React.FC<LinksModalProps> = ({
  isOpen,
  onClose,
  repository,
  selectedSource,
}) => {
  const { theme } = useTheme();
  const [links, setLinks] = useState<RepositoryLink[]>([]);
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);

  // State for editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    label: '',
    url: '',
    description: '',
    category: '',
  });

  // State for adding new link
  const [newLink, setNewLink] = useState({
    label: '',
    url: '',
    description: '',
    category: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate repository ID from repository data
  const getRepoId = () => {
    if (repository.owner && repository.name) {
      return `${repository.owner}/${repository.name}`;
    }
    return repository.name || 'unknown';
  };

  // Get repository path (prefer selected local source)
  const getRepoPath = () => {
    if (selectedSource?.type === 'local' && selectedSource.location) {
      return selectedSource.location;
    }
    if (repository.localClones?.length > 0) {
      return repository.localClones[0].path;
    }
    return repository.remoteUrl || '';
  };

  // Load links when modal opens
  useEffect(() => {
    if (isOpen) {
      loadLinks();
    } else {
      // Reset form when closing
      setNewLink({ label: '', url: '', description: '', category: '' });
      setEditingId(null);
      setHasChanges(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const repoId = getRepoId();
      const loadedLinks = await LinksService.get(repoId);
      setLinks(loadedLinks);

      // Get metadata
      const allMetadata = await LinksService.list();
      const repoMeta = allMetadata.find((m) => m.repoId === repoId);
      setMetadata(repoMeta || null);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load links:', err);
      setError('Failed to load links');
    } finally {
      setLoading(false);
    }
  };

  const addLink = async () => {
    if (!newLink.label || !newLink.url) {
      setError('Label and URL are required');
      return;
    }

    // Basic URL validation
    try {
      new URL(newLink.url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await LinksService.addLink(getRepoId(), {
        label: newLink.label,
        url: newLink.url,
        description: newLink.description || undefined,
        category: newLink.category || undefined,
      });

      if (result.success) {
        setNewLink({ label: '', url: '', description: '', category: '' });
        await loadLinks();
      } else {
        setError(result.error || 'Failed to add link');
      }
    } catch (err) {
      console.error('Failed to add link:', err);
      setError('Failed to add link');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (link: RepositoryLink) => {
    setEditingId(link.id);
    setEditForm({
      label: link.label,
      url: link.url,
      description: link.description || '',
      category: link.category || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.label || !editForm.url) {
      setError('Label and URL are required');
      return;
    }

    // Basic URL validation
    try {
      new URL(editForm.url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await LinksService.updateLink(getRepoId(), editingId, {
        label: editForm.label,
        url: editForm.url,
        description: editForm.description || undefined,
        category: editForm.category || undefined,
      });

      if (result.success) {
        setEditingId(null);
        await loadLinks();
      } else {
        setError(result.error || 'Failed to update link');
      }
    } catch (err) {
      console.error('Failed to update link:', err);
      setError('Failed to update link');
    } finally {
      setSaving(false);
    }
  };

  const deleteLink = async (id: string, label: string) => {
    if (!confirm(`Delete link "${label}"?`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await LinksService.removeLink(getRepoId(), id);

      if (result.success) {
        await loadLinks();
      } else {
        setError(result.error || 'Failed to delete link');
      }
    } catch (err) {
      console.error('Failed to delete link:', err);
      setError('Failed to delete link');
    } finally {
      setSaving(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      await LinksService.openLink(url);
    } catch (err) {
      console.error('Failed to open link:', err);
      setError('Failed to open link');
    }
  };

  const copyLink = async (url: string, id: string) => {
    try {
      const result = await LinksService.copyLink(url);
      if (result.success) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setError(result.error || 'Failed to copy link');
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      setError('Failed to copy link');
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link2 size={20} color={theme.colors.primary} />
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Repository Links
            </h2>
            <span
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                padding: '2px 8px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '4px',
              }}
            >
              {repository.name}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '24px',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Info Banner */}
        <div
          style={{
            margin: '16px 24px 0',
            padding: '12px',
            backgroundColor: `${theme.colors.primary}10`,
            border: `1px solid ${theme.colors.primary}30`,
            borderRadius: '8px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle
            size={16}
            color={theme.colors.primary}
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div
            style={{
              fontSize: '13px',
              color: theme.colors.text,
              lineHeight: '1.5',
            }}
          >
            <strong>Quick Access:</strong> Store important URLs for
            documentation, CI/CD pipelines, deployment dashboards, and more.
          </div>
        </div>

        {/* Metadata */}
        {metadata && (
          <div
            style={{
              margin: '12px 24px 0',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            Last updated: {new Date(metadata.updatedAt).toLocaleString()} •{' '}
            {metadata.linkCount} link{metadata.linkCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: '16px 24px',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: theme.colors.textSecondary,
              }}
            >
              Loading links...
            </div>
          ) : (
            <>
              {/* Existing Links */}
              {links.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '12px',
                    }}
                  >
                    Saved Links
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {links.map((link) => {
                      const isEditing = editingId === link.id;
                      const isCopied = copiedId === link.id;

                      return (
                        <div
                          key={link.id}
                          style={{
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          {isEditing ? (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Label"
                                value={editForm.label}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    label: e.target.value,
                                  })
                                }
                                style={{
                                  padding: '8px',
                                  backgroundColor: theme.colors.background,
                                  border: `1px solid ${theme.colors.border}`,
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  color: theme.colors.text,
                                  outline: 'none',
                                }}
                              />
                              <input
                                type="text"
                                placeholder="URL"
                                value={editForm.url}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    url: e.target.value,
                                  })
                                }
                                style={{
                                  padding: '8px',
                                  backgroundColor: theme.colors.background,
                                  border: `1px solid ${theme.colors.border}`,
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  color: theme.colors.text,
                                  fontFamily: 'monospace',
                                  outline: 'none',
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Description (optional)"
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    description: e.target.value,
                                  })
                                }
                                style={{
                                  padding: '8px',
                                  backgroundColor: theme.colors.background,
                                  border: `1px solid ${theme.colors.border}`,
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  color: theme.colors.text,
                                  outline: 'none',
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Category (optional)"
                                value={editForm.category}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    category: e.target.value,
                                  })
                                }
                                style={{
                                  padding: '8px',
                                  backgroundColor: theme.colors.background,
                                  border: `1px solid ${theme.colors.border}`,
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  color: theme.colors.text,
                                  outline: 'none',
                                }}
                              />
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '8px',
                                  justifyContent: 'flex-end',
                                }}
                              >
                                <button
                                  onClick={() => setEditingId(null)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor:
                                      theme.colors.backgroundTertiary,
                                    color: theme.colors.text,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: theme.colors.primary,
                                    color: theme.colors.background,
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    opacity: saving ? 0.5 : 1,
                                  }}
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  marginBottom: '8px',
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      marginBottom: '4px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                      }}
                                    >
                                      {link.label}
                                    </span>
                                    {link.category && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          padding: '2px 6px',
                                          backgroundColor:
                                            theme.colors.backgroundTertiary,
                                          borderRadius: '3px',
                                          color: theme.colors.textSecondary,
                                        }}
                                      >
                                        {link.category}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '12px',
                                      fontFamily: 'monospace',
                                      color: theme.colors.primary,
                                      cursor: 'pointer',
                                      wordBreak: 'break-all',
                                    }}
                                    onClick={() => openLink(link.url)}
                                  >
                                    {link.url}
                                  </div>
                                  {link.description && (
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        marginTop: '4px',
                                      }}
                                    >
                                      {link.description}
                                    </div>
                                  )}
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '4px',
                                    marginLeft: '12px',
                                  }}
                                >
                                  <button
                                    onClick={() => copyLink(link.url, link.id)}
                                    style={{
                                      padding: '6px',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: isCopied
                                        ? theme.colors.success || '#10b981'
                                        : theme.colors.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    title={isCopied ? 'Copied!' : 'Copy URL'}
                                  >
                                    {isCopied ? (
                                      <Check size={16} />
                                    ) : (
                                      <Copy size={16} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => openLink(link.url)}
                                    style={{
                                      padding: '6px',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: theme.colors.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    title="Open in browser"
                                  >
                                    <ExternalLink size={16} />
                                  </button>
                                  <button
                                    onClick={() => startEdit(link)}
                                    style={{
                                      padding: '6px',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: theme.colors.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    title="Edit link"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      deleteLink(link.id, link.label)
                                    }
                                    style={{
                                      padding: '6px',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: theme.colors.error || '#ef4444',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    title="Delete link"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add New Link */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '12px',
                  }}
                >
                  Add New Link
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Label (e.g., 'Documentation', 'CI Pipeline')"
                    value={newLink.label}
                    onChange={(e) =>
                      setNewLink({ ...newLink, label: e.target.value })
                    }
                    style={{
                      padding: '8px 12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: theme.colors.text,
                      outline: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="URL (e.g., 'https://docs.example.com')"
                    value={newLink.url}
                    onChange={(e) =>
                      setNewLink({ ...newLink, url: e.target.value })
                    }
                    style={{
                      padding: '8px 12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: theme.colors.text,
                      outline: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newLink.description}
                    onChange={(e) =>
                      setNewLink({ ...newLink, description: e.target.value })
                    }
                    style={{
                      padding: '8px 12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: theme.colors.text,
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Category (optional)"
                      value={newLink.category}
                      onChange={(e) =>
                        setNewLink({ ...newLink, category: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLink.label && newLink.url) {
                          addLink();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: theme.colors.text,
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={addLink}
                      disabled={!newLink.label || !newLink.url || saving}
                      style={{
                        padding: '8px 16px',
                        backgroundColor:
                          newLink.label && newLink.url
                            ? theme.colors.primary
                            : theme.colors.backgroundTertiary,
                        color:
                          newLink.label && newLink.url
                            ? theme.colors.background
                            : theme.colors.textSecondary,
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor:
                          newLink.label && newLink.url
                            ? 'pointer'
                            : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: newLink.label && newLink.url ? 1 : 0.5,
                      }}
                    >
                      <Plus size={14} />
                      Add Link
                    </button>
                  </div>
                </div>
                {error && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: `${theme.colors.error || '#ef4444'}10`,
                      border: `1px solid ${theme.colors.error || '#ef4444'}30`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: theme.colors.error || '#ef4444',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

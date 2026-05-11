import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, type Theme } from '@principal-ade/industry-theme';
import { X, AlertCircle, CheckCircle, Info, Copy, Check, Edit2, Save, XCircle } from 'lucide-react';
import { GitService } from '../main-process-api/GitService';

export interface GitGlobalConfig {
  'user.name'?: string;
  'user.email'?: string;
  'core.editor'?: string;
  'init.defaultBranch'?: string;
  'credential.helper'?: string;
  'core.excludesfile'?: string;
  gitVersion?: string;
  sshKeysFound?: boolean;
  sshKeyPaths?: string[];
}

interface GitGlobalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitGlobalConfigModal: React.FC<GitGlobalConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<GitGlobalConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchGitConfig = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch git version (use empty string for global commands)
        const versionResult = await GitService.execCommand('', [
          '--version',
        ]);
        const gitVersion = versionResult.stdout.trim();

        // Fetch global config
        const configResult = await GitService.execCommand('', [
          'config',
          '--global',
          '--list',
        ]);

        // Parse config into key-value pairs
        const configLines = configResult.stdout.trim().split('\n');
        const parsedConfig: GitGlobalConfig = { gitVersion };

        for (const line of configLines) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('='); // Handle values with '=' in them

          // Only capture keys we care about
          if (key === 'user.name') {
            parsedConfig['user.name'] = value;
          } else if (key === 'user.email') {
            parsedConfig['user.email'] = value;
          } else if (key === 'core.editor') {
            parsedConfig['core.editor'] = value;
          } else if (key === 'init.defaultBranch') {
            parsedConfig['init.defaultBranch'] = value;
          } else if (key === 'credential.helper') {
            parsedConfig['credential.helper'] = value;
          } else if (key === 'core.excludesfile') {
            parsedConfig['core.excludesfile'] = value;
          }
        }

        // SSH key checking would need to be implemented in the main process
        // For now, we'll mark it as not implemented
        parsedConfig.sshKeysFound = false;
        parsedConfig.sshKeyPaths = [];

        setConfig(parsedConfig);
        setEditedName(parsedConfig['user.name'] || '');
        setEditedEmail(parsedConfig['user.email'] || '');
      } catch (err) {
        console.error('[GitGlobalConfigModal] Failed to fetch git config:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to fetch git configuration',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchGitConfig();
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!isLoading && !isSaving) {
      onClose();
    }
  }, [isLoading, isSaving, onClose]);

  // ESC key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset to original values
    setEditedName(config?.['user.name'] || '');
    setEditedEmail(config?.['user.email'] || '');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Save user.name
      if (editedName !== config?.['user.name']) {
        await GitService.execCommand('', [
          'config',
          '--global',
          'user.name',
          editedName,
        ]);
      }

      // Save user.email
      if (editedEmail !== config?.['user.email']) {
        await GitService.execCommand('', [
          'config',
          '--global',
          'user.email',
          editedEmail,
        ]);
      }

      // Update local config state
      setConfig((prev) => ({
        ...(prev || {}),
        'user.name': editedName,
        'user.email': editedEmail,
      }));

      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[GitGlobalConfigModal] Failed to save git config:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to save git configuration',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
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
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.colors.border}`,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Git Global Configuration
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading || isSaving}
            style={{
              background: 'none',
              border: 'none',
              cursor: isLoading || isSaving ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: isLoading || isSaving ? 0.5 : 1,
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && !isSaving) {
                e.currentTarget.style.backgroundColor = theme.colors.border;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} color={theme.colors.textSecondary} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}
        >
          {/* Plain-language intro — git's global config is the identity */}
          {/* and defaults git uses on this machine across every repository. */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 14px',
              marginBottom: 20,
              borderRadius: 8,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <Info
              size={16}
              color={theme.colors.primary}
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Git&apos;s <strong style={{ color: theme.colors.text }}>global
              configuration</strong> lives in{' '}
              <code
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: '0.92em',
                  color: theme.colors.text,
                }}
              >
                ~/.gitconfig
              </code>{' '}
              and applies to every repository on this machine. Your{' '}
              <strong style={{ color: theme.colors.text }}>name</strong> and{' '}
              <strong style={{ color: theme.colors.text }}>email</strong> are
              what git stamps on every commit you author — anyone reviewing the
              history will see them. You can change them here at any time;
              edits run{' '}
              <code
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: '0.92em',
                  color: theme.colors.text,
                }}
              >
                git config --global
              </code>{' '}
              under the hood.
            </div>
          </div>

          {isLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: theme.colors.textSecondary,
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
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: `3px solid ${theme.colors.border}`,
                    borderTop: `3px solid ${theme.colors.primary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span>Loading git configuration...</span>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                backgroundColor: `${theme.colors.error}15`,
                border: `1px solid ${theme.colors.error}40`,
                borderRadius: '8px',
                color: theme.colors.error,
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: theme.fontWeights.semibold, marginBottom: '4px' }}>
                  Failed to load configuration
                </div>
                <div style={{ fontSize: theme.fontSizes[1], opacity: 0.9 }}>
                  {error}
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && config && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Git Version */}
              {config.gitVersion && (
                <ConfigSection
                  title="Git Version"
                  icon={<Info size={18} />}
                  theme={theme}
                >
                  <ConfigItem
                    label="Version"
                    value={config.gitVersion}
                    theme={theme}
                    onCopy={handleCopy}
                    copyKey="gitVersion"
                    isCopied={copiedKey === 'gitVersion'}
                  />
                </ConfigSection>
              )}

              {/* User Identity */}
              <ConfigSection
                title="User Identity"
                icon={config['user.name'] && config['user.email'] ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                theme={theme}
                alert={!config['user.name'] || !config['user.email']}
              >
                {isEditing ? (
                  <>
                    <EditableConfigItem
                      label="Name"
                      value={editedName}
                      onChange={setEditedName}
                      theme={theme}
                      placeholder="Your Name"
                    />
                    <EditableConfigItem
                      label="Email"
                      value={editedEmail}
                      onChange={setEditedEmail}
                      theme={theme}
                      placeholder="you@example.com"
                    />
                  </>
                ) : (
                  <>
                    <ConfigItem
                      label="Name"
                      value={config['user.name'] || 'Not configured'}
                      theme={theme}
                      onCopy={handleCopy}
                      copyKey="user.name"
                      isCopied={copiedKey === 'user.name'}
                      missing={!config['user.name']}
                    />
                    <ConfigItem
                      label="Email"
                      value={config['user.email'] || 'Not configured'}
                      theme={theme}
                      onCopy={handleCopy}
                      copyKey="user.email"
                      isCopied={copiedKey === 'user.email'}
                      missing={!config['user.email']}
                    />
                  </>
                )}

                {/* Edit/Save/Cancel buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving || (!editedName.trim() || !editedEmail.trim())}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: theme.colors.success,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: theme.fontSizes[2],
                          fontWeight: theme.fontWeights.medium,
                          cursor: isSaving || (!editedName.trim() || !editedEmail.trim()) ? 'not-allowed' : 'pointer',
                          opacity: isSaving || (!editedName.trim() || !editedEmail.trim()) ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: 'transparent',
                          color: theme.colors.textSecondary,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '6px',
                          fontSize: theme.fontSizes[2],
                          fontWeight: theme.fontWeights.medium,
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          opacity: isSaving ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <XCircle size={16} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEdit}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        color: theme.colors.primary,
                        border: `1px solid ${theme.colors.primary}`,
                        borderRadius: '6px',
                        fontSize: theme.fontSizes[2],
                        fontWeight: theme.fontWeights.medium,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Edit2 size={16} />
                      Edit User Identity
                    </button>
                  )}
                </div>

                {saveSuccess && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: `${theme.colors.success}15`,
                      border: `1px solid ${theme.colors.success}40`,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.success,
                    }}
                  >
                    <CheckCircle size={18} />
                    <span style={{ fontSize: theme.fontSizes[2] }}>
                      Configuration saved successfully
                    </span>
                  </div>
                )}

                {!isEditing && (!config['user.name'] || !config['user.email']) && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: `${theme.colors.warning}10`,
                      border: `1px solid ${theme.colors.warning}30`,
                      borderRadius: '6px',
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <div style={{ fontWeight: theme.fontWeights.medium, marginBottom: '4px', color: theme.colors.warning }}>
                      Configuration required
                    </div>
                    Click "Edit User Identity" above to configure your name and email.
                  </div>
                )}
              </ConfigSection>

              {/* Other Settings */}
              <ConfigSection title="Repository Settings" theme={theme}>
                <ConfigItem
                  label="Default Branch"
                  value={config['init.defaultBranch'] || 'Not set (uses git default)'}
                  theme={theme}
                  onCopy={handleCopy}
                  copyKey="init.defaultBranch"
                  isCopied={copiedKey === 'init.defaultBranch'}
                />
                <ConfigItem
                  label="Default Editor"
                  value={config['core.editor'] || 'System default'}
                  theme={theme}
                  onCopy={handleCopy}
                  copyKey="core.editor"
                  isCopied={copiedKey === 'core.editor'}
                />
                <ConfigItem
                  label="Global .gitignore"
                  value={config['core.excludesfile'] || 'Not configured'}
                  theme={theme}
                  onCopy={handleCopy}
                  copyKey="core.excludesfile"
                  isCopied={copiedKey === 'core.excludesfile'}
                />
              </ConfigSection>

              {/* Credentials */}
              <ConfigSection title="Credentials" theme={theme}>
                <ConfigItem
                  label="Credential Helper"
                  value={config['credential.helper'] || 'Not configured'}
                  theme={theme}
                  onCopy={handleCopy}
                  copyKey="credential.helper"
                  isCopied={copiedKey === 'credential.helper'}
                />
              </ConfigSection>
            </div>
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
            onClick={handleClose}
            disabled={isLoading || isSaving}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.medium,
              cursor: isLoading || isSaving ? 'not-allowed' : 'pointer',
              opacity: isLoading || isSaving ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && !isSaving) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && !isSaving) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Helper components
interface ConfigSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  theme: Theme;
  alert?: boolean;
}

const ConfigSection: React.FC<ConfigSectionProps> = ({
  title,
  icon,
  children,
  theme,
  alert = false,
}) => (
  <div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        color: alert ? theme.colors.warning : theme.colors.text,
      }}
    >
      {icon}
      <h3
        style={{
          margin: 0,
          fontSize: theme.fontSizes[2],
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        {title}
      </h3>
    </div>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {children}
    </div>
  </div>
);

interface ConfigItemProps {
  label: string;
  value: string;
  theme: Theme;
  onCopy: (key: string, value: string) => void;
  copyKey: string;
  isCopied: boolean;
  missing?: boolean;
}

const ConfigItem: React.FC<ConfigItemProps> = ({
  label,
  value,
  theme,
  onCopy,
  copyKey,
  isCopied,
  missing = false,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '12px',
      backgroundColor: theme.colors.background,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '6px',
      gap: '12px',
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          marginBottom: '4px',
          fontWeight: theme.fontWeights.medium,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: theme.fontSizes[2],
          color: missing ? theme.colors.textSecondary : theme.colors.text,
          fontFamily: theme.fonts.monospace,
          wordBreak: 'break-all',
          fontStyle: missing ? 'italic' : 'normal',
        }}
      >
        {value}
      </div>
    </div>
    {!missing && value !== 'Not configured' && value !== 'System default' && (
      <button
        onClick={() => onCopy(copyKey, value)}
        style={{
          background: 'none',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '4px',
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: theme.fontSizes[1],
          color: isCopied ? theme.colors.success : theme.colors.textSecondary,
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isCopied) {
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.color = theme.colors.primary;
          }
        }}
        onMouseLeave={(e) => {
          if (!isCopied) {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }
        }}
      >
        {isCopied ? (
          <>
            <Check size={14} />
            Copied
          </>
        ) : (
          <>
            <Copy size={14} />
            Copy
          </>
        )}
      </button>
    )}
  </div>
);

interface EditableConfigItemProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
  placeholder?: string;
}

const EditableConfigItem: React.FC<EditableConfigItemProps> = ({
  label,
  value,
  onChange,
  theme,
  placeholder,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      backgroundColor: theme.colors.background,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '6px',
    }}
  >
    <label
      style={{
        fontSize: theme.fontSizes[1],
        color: theme.colors.textSecondary,
        fontWeight: theme.fontWeights.medium,
      }}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '8px 12px',
        fontSize: theme.fontSizes[2],
        fontFamily: theme.fonts.monospace,
        color: theme.colors.text,
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
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
);

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import type {
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';

interface CreateGitHubRepositoryModalProps {
  organizationLogin: string;
  onClose: () => void;
  onSuccess: (repository: GitHubRepositoryCreated) => void;
}

export const CreateGitHubRepositoryModal: React.FC<
  CreateGitHubRepositoryModalProps
> = ({ organizationLogin, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [repositoryName, setRepositoryName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoInit, setAutoInit] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('');
  const [licenseTemplate, setLicenseTemplate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available templates
  const [gitignoreTemplates, setGitignoreTemplates] = useState<string[]>([]);
  const [licenseTemplates, setLicenseTemplates] = useState<
    GitHubLicenseTemplate[]
  >([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const [gitignores, licenses] = await Promise.all([
          GithubService.getGitignoreTemplates(),
          GithubService.getLicenseTemplates(),
        ]);
        setGitignoreTemplates(gitignores);
        setLicenseTemplates(licenses);
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    void loadTemplates();
  }, []);

  const handleCreate = async () => {
    if (!repositoryName.trim()) {
      setError('Repository name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const input: CreateRepositoryInput = {
        name: repositoryName.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
        auto_init: autoInit,
        gitignore_template: gitignoreTemplate || undefined,
        license_template: licenseTemplate || undefined,
      };

      const repository = await GithubService.createRepository(
        organizationLogin,
        input,
        true, // isOrganization
      );

      onSuccess(repository);
      onClose();
    } catch (err) {
      console.error('Failed to create repository:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create repository. Please try again.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      void handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

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
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[3]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            Create GitHub Repository
          </h2>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              background: 'none',
              border: 'none',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: theme.colors.textSecondary,
              opacity: isCreating ? 0.5 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {/* Organization info */}
          <div style={{ marginBottom: '20px' }}>
            <p
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
              }}
            >
              Organization:{' '}
              <strong style={{ color: theme.colors.text }}>
                {organizationLogin}
              </strong>
            </p>
          </div>

          {/* Repository name input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="repo-name"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              Repository Name *
            </label>
            <input
              id="repo-name"
              type="text"
              value={repositoryName}
              onChange={(e) => {
                setRepositoryName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              placeholder="my-awesome-repo"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${
                  error ? theme.colors.error || '#ef4444' : theme.colors.border
                }`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            />
          </div>

          {/* Description input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="description"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              placeholder="A short description of your repository"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Visibility */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={isCreating}
              />
              Private repository
            </label>
          </div>

          {/* Initialize repository */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              <input
                type="checkbox"
                checked={autoInit}
                onChange={(e) => setAutoInit(e.target.checked)}
                disabled={isCreating}
              />
              Initialize with README
            </label>
          </div>

          {/* .gitignore template */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="gitignore"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              .gitignore Template
            </label>
            <select
              id="gitignore"
              value={gitignoreTemplate}
              onChange={(e) => setGitignoreTemplate(e.target.value)}
              disabled={isCreating || isLoadingTemplates}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            >
              <option value="">None</option>
              {gitignoreTemplates.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </div>

          {/* License template */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="license"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              License
            </label>
            <select
              id="license"
              value={licenseTemplate}
              onChange={(e) => setLicenseTemplate(e.target.value)}
              disabled={isCreating || isLoadingTemplates}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            >
              <option value="">None</option>
              {licenseTemplates.map((license) => (
                <option key={license.key} value={license.key}>
                  {license.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: `${theme.colors.error || '#ef4444'}20`,
                color: theme.colors.error || '#ef4444',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '16px 20px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: 'transparent',
              color: theme.colors.text,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={isCreating || !repositoryName.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              cursor:
                isCreating || !repositoryName.trim()
                  ? 'not-allowed'
                  : 'pointer',
              opacity: isCreating || !repositoryName.trim() ? 0.5 : 1,
            }}
          >
            {isCreating && <Loader2 size={16} className="animate-spin" />}
            {isCreating ? 'Creating...' : 'Create Repository'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

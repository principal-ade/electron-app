import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Loader2, AlertCircle, ChevronRight, Building2, ArrowLeft, Check } from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService } from '../../main-process-api/GitService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import type {
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  GitHubOrganization,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import path from 'path';

interface CreateRepositoryInWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
}

type ModalStep = 'select-org' | 'create-repo' | 'progress' | 'complete';

type ProgressStep = 'creating' | 'cloning' | 'registering' | 'adding' | 'done';

export const CreateRepositoryInWorkspaceModal: React.FC<
  CreateRepositoryInWorkspaceModalProps
> = ({ isOpen, onClose, workspace }) => {
  const { theme } = useTheme();

  // Step state
  const [step, setStep] = useState<ModalStep>('select-org');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // Organization loading state
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [hoveredOrg, setHoveredOrg] = useState<string | null>(null);

  // Repository form state
  const [repositoryName, setRepositoryName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoInit, setAutoInit] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('');
  const [licenseTemplate, setLicenseTemplate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress state
  const [progressStep, setProgressStep] = useState<ProgressStep>('creating');

  // Templates
  const [gitignoreTemplates, setGitignoreTemplates] = useState<string[]>([]);
  const [licenseTemplates, setLicenseTemplates] = useState<GitHubLicenseTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Load organizations when modal opens
  useEffect(() => {
    if (isOpen) {
      loadOrganizations();
      loadTemplates();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select-org');
      setSelectedOrg(null);
      setRepositoryName('');
      setDescription('');
      setIsPrivate(false);
      setAutoInit(true);
      setGitignoreTemplate('');
      setLicenseTemplate('');
      setError(null);
      setOrgsError(null);
      setProgressStep('creating');
      setIsCreating(false);
    }
  }, [isOpen]);

  const loadOrganizations = async () => {
    setIsLoadingOrgs(true);
    setOrgsError(null);
    try {
      const orgs = await GithubService.getUserOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setOrgsError(
        err instanceof Error
          ? err.message
          : 'Failed to load organizations. Please try again.'
      );
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
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

  const handleSelectOrg = useCallback((orgLogin: string) => {
    setSelectedOrg(orgLogin);
    setStep('create-repo');
  }, []);

  const handleBack = useCallback(() => {
    setStep('select-org');
    setError(null);
  }, []);

  const handleCreate = async () => {
    if (!repositoryName.trim()) {
      setError('Repository name is required');
      return;
    }

    if (!selectedOrg) {
      setError('No organization selected');
      return;
    }

    if (!workspace.suggestedClonePath) {
      setError('This workspace has no clone directory configured. Please set a home directory for the workspace first.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setStep('progress');
    setProgressStep('creating');

    try {
      // Step 1: Create repository on GitHub
      const input: CreateRepositoryInput = {
        name: repositoryName.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
        auto_init: autoInit,
        gitignore_template: gitignoreTemplate || undefined,
        license_template: licenseTemplate || undefined,
      };

      const repository: GitHubRepositoryCreated = await GithubService.createRepository(
        selectedOrg,
        input,
        true, // isOrganization
      );

      // Step 2: Clone the repository
      setProgressStep('cloning');

      // Determine the target path for cloning
      const targetPath = path.join(workspace.suggestedClonePath, repository.name);

      // Use HTTPS clone URL (more reliable in most environments)
      const cloneUrl = repository.clone_url;

      const cloneSuccess = await GitService.cloneRepository(cloneUrl, targetPath);

      if (!cloneSuccess) {
        throw new Error('Failed to clone repository');
      }

      // Step 3: Register with Alexandria
      setProgressStep('registering');

      const registeredRepo = await AlexandriaService.registerRepository(
        repository.name,
        targetPath,
      );

      // Step 4: Add to workspace
      setProgressStep('adding');

      await WorkspaceService.addRepositoryToWorkspace(registeredRepo, workspace.id);

      // Done!
      setProgressStep('done');
      setStep('complete');

      // Auto-close after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to create repository:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create repository. Please try again.',
      );
      setStep('create-repo'); // Go back to form on error
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating && step === 'create-repo') {
      void handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderOrgSelection = () => (
    <>
      {/* Body */}
      <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        {isLoadingOrgs ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '12px',
            }}
          >
            <Loader2
              size={32}
              style={{ color: theme.colors.textSecondary }}
              className="animate-spin"
            />
            <span
              style={{
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
              }}
            >
              Loading organizations...
            </span>
          </div>
        ) : orgsError ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '12px',
            }}
          >
            <AlertCircle
              size={32}
              style={{ color: theme.colors.error || '#ef4444' }}
            />
            <span
              style={{
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.error || '#ef4444',
                textAlign: 'center',
              }}
            >
              {orgsError}
            </span>
            <button
              onClick={loadOrganizations}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        ) : organizations.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '12px',
            }}
          >
            <Building2
              size={32}
              style={{ color: theme.colors.textSecondary, opacity: 0.5 }}
            />
            <span
              style={{
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
                textAlign: 'center',
              }}
            >
              No organizations found. You need to be a member of at least one
              GitHub organization to create a repository.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
              }}
            >
              Select an organization to create the repository in:
            </p>
            {organizations.map((org) => {
              const isHovered = hoveredOrg === org.login;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.login)}
                  onMouseEnter={() => setHoveredOrg(org.login)}
                  onMouseLeave={() => setHoveredOrg(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${isHovered ? theme.colors.primary : theme.colors.border}`,
                    backgroundColor: isHovered
                      ? theme.colors.backgroundTertiary
                      : theme.colors.backgroundSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {org.avatar_url ? (
                    <img
                      src={org.avatar_url}
                      alt={org.login}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Building2
                        size={20}
                        style={{ color: theme.colors.background }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: `${theme.fontSizes[2]}px`,
                        fontWeight: theme.fontWeights.semibold,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.text,
                      }}
                    >
                      {org.login}
                    </div>
                    {org.description && (
                      <div
                        style={{
                          fontSize: `${theme.fontSizes[0]}px`,
                          fontFamily: theme.fonts.body,
                          color: theme.colors.textSecondary,
                          marginTop: '2px',
                        }}
                      >
                        {org.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={20}
                    style={{
                      color: isHovered
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    }}
                  />
                </button>
              );
            })}
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
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: 'transparent',
            color: theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.semibold,
            fontFamily: theme.fonts.body,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );

  const renderCreateForm = () => (
    <>
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
              {selectedOrg}
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
          justifyContent: 'space-between',
          gap: '12px',
          padding: '16px 20px',
          borderTop: `1px solid ${theme.colors.border}`,
        }}
      >
        <button
          onClick={handleBack}
          disabled={isCreating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
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
          <ArrowLeft size={16} />
          Back
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
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
                isCreating || !repositoryName.trim() ? 'not-allowed' : 'pointer',
              opacity: isCreating || !repositoryName.trim() ? 0.5 : 1,
            }}
          >
            {isCreating && <Loader2 size={16} className="animate-spin" />}
            {isCreating ? 'Creating...' : 'Create Repository'}
          </button>
        </div>
      </div>
    </>
  );

  const getProgressLabel = (progressStep: ProgressStep): string => {
    switch (progressStep) {
      case 'creating':
        return 'Creating repository on GitHub...';
      case 'cloning':
        return 'Cloning repository...';
      case 'registering':
        return 'Registering with Alexandria...';
      case 'adding':
        return 'Adding to workspace...';
      case 'done':
        return 'Complete!';
      default:
        return 'Processing...';
    }
  };

  const renderProgress = () => (
    <div
      style={{
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}
    >
      {step === 'complete' ? (
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: `${theme.colors.success || '#22c55e'}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check
            size={32}
            style={{ color: theme.colors.success || '#22c55e' }}
          />
        </div>
      ) : (
        <Loader2
          size={48}
          style={{ color: theme.colors.primary }}
          className="animate-spin"
        />
      )}

      <div style={{ textAlign: 'center' }}>
        <h3
          style={{
            margin: 0,
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            fontFamily: theme.fonts.body,
            color: theme.colors.text,
          }}
        >
          {step === 'complete' ? 'Repository Created!' : getProgressLabel(progressStep)}
        </h3>
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
            color: theme.colors.textSecondary,
          }}
        >
          {step === 'complete'
            ? `${repositoryName} has been created and added to ${workspace.name}`
            : `Creating ${repositoryName} in ${selectedOrg}...`}
        </p>
      </div>

      {/* Progress steps indicator */}
      {step !== 'complete' && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          {(['creating', 'cloning', 'registering', 'adding'] as ProgressStep[]).map(
            (s) => {
              const steps: ProgressStep[] = ['creating', 'cloning', 'registering', 'adding'];
              const isActive = s === progressStep;
              const isPast = steps.indexOf(s) < steps.indexOf(progressStep);

              return (
                <div
                  key={s}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isPast || isActive
                      ? theme.colors.primary
                      : theme.colors.border,
                    opacity: isActive ? 1 : isPast ? 0.6 : 0.3,
                    transition: 'all 0.3s',
                  }}
                />
              );
            }
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'select-org':
        return renderOrgSelection();
      case 'create-repo':
        return renderCreateForm();
      case 'progress':
      case 'complete':
        return renderProgress();
      default:
        return renderOrgSelection();
    }
  };

  const getHeaderTitle = () => {
    switch (step) {
      case 'select-org':
        return 'Create New Repository';
      case 'create-repo':
        return 'Create GitHub Repository';
      case 'progress':
        return 'Creating Repository';
      case 'complete':
        return 'Success';
      default:
        return 'Create New Repository';
    }
  };

  const getHeaderSubtitle = () => {
    switch (step) {
      case 'select-org':
        return `Adding to workspace: ${workspace.name}`;
      case 'create-repo':
        return `Will be added to: ${workspace.name}`;
      case 'progress':
      case 'complete':
        return `${selectedOrg}/${repositoryName}`;
      default:
        return `Adding to workspace: ${workspace.name}`;
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
      onClick={step === 'progress' ? undefined : onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          width: '520px',
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
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              {getHeaderTitle()}
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: `${theme.fontSizes[0]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
              }}
            >
              {getHeaderSubtitle()}
            </p>
          </div>
          {step !== 'progress' && (
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
          )}
        </div>

        {renderContent()}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

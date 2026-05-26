import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  Building2,
  ArrowLeft,
  Check,
  Folder,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService } from '../../main-process-api/GitService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import type {
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  GitHubOrganization,
  GitHubUser,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import path from 'path';

interface CreateRepositoryInWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace;
  workspaces?: Workspace[];
  baseDefaultDirectory?: string | null;
  // When true, skip destination selection, force the base directory, and
  // place the repo under `{baseDir}/{owner}/{repoName}` (GitHub-style).
  // For local-only repos the owner segment falls back to the current user.
  useOwnerSubdir?: boolean;
}

type ModalStep = 'select-destination' | 'select-org' | 'create-repo' | 'progress' | 'complete';

type ProgressStep = 'creating' | 'cloning' | 'initializing' | 'registering' | 'adding' | 'done';

const LOCAL_ONLY_OPTION = 'LOCAL_ONLY';

export const CreateRepositoryInWorkspaceModal: React.FC<
  CreateRepositoryInWorkspaceModalProps
> = ({ isOpen, onClose, workspace, workspaces = [], baseDefaultDirectory = null, useOwnerSubdir = false }) => {
  const { theme } = useTheme();

  // In owner-subdir mode the destination is fixed to the base dir, so we
  // jump straight to org selection (or surface an error if no base dir is
  // configured).
  const ownerSubdirActive = useOwnerSubdir && !!baseDefaultDirectory;

  const initialStep: ModalStep = workspace || ownerSubdirActive
    ? 'select-org'
    : 'select-destination';
  const initialDestination: { type: 'workspace' | 'base'; value: Workspace | string } | null =
    workspace
      ? { type: 'workspace', value: workspace }
      : ownerSubdirActive
        ? { type: 'base', value: baseDefaultDirectory as string }
        : null;

  // Step state
  const [step, setStep] = useState<ModalStep>(initialStep);
  const [selectedDestination, setSelectedDestination] = useState<{ type: 'workspace' | 'base'; value: Workspace | string } | null>(
    initialDestination,
  );
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [isSelectedOrgUser, setIsSelectedOrgUser] = useState(false);

  // Organization loading state
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [hoveredOrg, setHoveredOrg] = useState<string | null>(null);
  const [hoveredDestination, setHoveredDestination] = useState<string | null>(null);

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
  const [licenseTemplates, setLicenseTemplates] = useState<
    GitHubLicenseTemplate[]
  >([]);
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
      setStep(initialStep);
      setSelectedDestination(initialDestination);
      setSelectedOrg(null);
      setIsSelectedOrgUser(false);
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
  }, [isOpen, initialStep, initialDestination]);

  const loadOrganizations = async () => {
    setIsLoadingOrgs(true);
    setOrgsError(null);
    try {
      const [user, orgs] = await Promise.all([
        GithubService.getCurrentUser(),
        GithubService.getUserOrganizations(),
      ]);
      setCurrentUser(user);
      setOrganizations(orgs);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setOrgsError(
        err instanceof Error
          ? err.message
          : 'Failed to load organizations. Please try again.',
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

  const handleSelectDestination = useCallback((destination: { type: 'workspace' | 'base'; value: Workspace | string }) => {
    setSelectedDestination(destination);
    setStep('select-org');
  }, []);

  const handleSelectOrg = useCallback((orgLogin: string, isUser: boolean = false) => {
    setSelectedOrg(orgLogin);
    setIsSelectedOrgUser(isUser);
    setStep('create-repo');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'select-org' && !workspace && !ownerSubdirActive) {
      // Go back to destination selection if we didn't have a pre-selected
      // workspace or a forced base-dir destination.
      setStep('select-destination');
    } else {
      setStep('select-org');
    }
    setError(null);
  }, [step, workspace, ownerSubdirActive]);

  const handleCreate = async () => {
    if (!repositoryName.trim()) {
      setError('Repository name is required');
      return;
    }

    if (!selectedOrg) {
      setError('No organization selected');
      return;
    }

    if (!selectedDestination) {
      setError('No destination selected');
      return;
    }

    // Determine the clone path based on selected destination
    let clonePath: string;
    let targetWorkspace: Workspace | null = null;

    if (selectedDestination.type === 'workspace') {
      targetWorkspace = selectedDestination.value as Workspace;
      if (!targetWorkspace.suggestedClonePath) {
        setError(
          'This workspace has no clone directory configured. Please set a home directory for the workspace first.',
        );
        return;
      }
      clonePath = targetWorkspace.suggestedClonePath;
    } else {
      // Using base default directory
      const basePath = selectedDestination.value as string;
      if (!basePath) {
        setError('Base default directory is not set. Please configure it first.');
        return;
      }
      clonePath = basePath;
    }

    setIsCreating(true);
    setError(null);
    setStep('progress');

    try {
      const repoName = repositoryName.trim();
      // GitHub-style layout: when invoked from the Principal titlebar we
      // group repos by their owner under the base dir
      // ({baseDir}/{owner}/{repoName}). For the local-only flow the owner
      // segment falls back to the signed-in user's login.
      const ownerSegment =
        ownerSubdirActive && selectedDestination.type === 'base'
          ? selectedOrg === LOCAL_ONLY_OPTION
            ? currentUser?.login || ''
            : selectedOrg
          : '';
      const targetPath = ownerSegment
        ? path.join(clonePath, ownerSegment, repoName)
        : path.join(clonePath, repoName);

      // Check if this is a local-only repository
      if (selectedOrg === LOCAL_ONLY_OPTION) {
        // Local-only flow: Create directory, initialize git, register, add to workspace

        // Step 1: Create local directory by writing a placeholder file
        setProgressStep('creating');
        const placeholderPath = path.join(targetPath, '.gitkeep');
        await FileSystemService.writeFile(placeholderPath, '');

        // Step 2: Initialize git repository
        setProgressStep('initializing');
        await GitService.execCommand(targetPath, ['init']);

        // Optionally create initial commit if auto_init is enabled
        if (autoInit) {
          // Create README.md
          const readmeContent = description.trim()
            ? `# ${repoName}\n\n${description.trim()}\n`
            : `# ${repoName}\n`;

          const readmePath = path.join(targetPath, 'README.md');
          await FileSystemService.writeFile(readmePath, readmeContent);

          // Create .gitignore if template selected
          if (gitignoreTemplate) {
            // Note: We can't easily fetch gitignore templates for local-only repos
            // so we'll create an empty .gitignore as a placeholder
            const gitignorePath = path.join(targetPath, '.gitignore');
            await FileSystemService.writeFile(gitignorePath, `# ${gitignoreTemplate}\n`);
          }

          // Remove the .gitkeep placeholder
          await FileSystemService.deleteFile(placeholderPath);

          // Initial commit
          await GitService.execCommand(targetPath, ['add', '.']);
          await GitService.execCommand(targetPath, ['commit', '-m', 'Initial commit']);
        } else {
          // If not auto-initializing, remove the placeholder
          await FileSystemService.deleteFile(placeholderPath);
        }

        // Step 3: Register with Alexandria — local-only, no remote yet.
        setProgressStep('registering');
        const registeredRepo =
          await AlexandriaService.registerRepository(targetPath);

        // Step 4: Add to workspace (if applicable)
        if (targetWorkspace) {
          setProgressStep('adding');
          await WorkspaceService.addRepositoryToWorkspace(
            registeredRepo,
            targetWorkspace.id,
          );
        }

        // Done!
        setProgressStep('done');
        setStep('complete');

        // Auto-close after a delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // GitHub flow: Create on GitHub, clone, register, add to workspace

        // Step 1: Create repository on GitHub
        setProgressStep('creating');
        const input: CreateRepositoryInput = {
          name: repoName,
          description: description.trim() || undefined,
          private: isPrivate,
          auto_init: autoInit,
          gitignore_template: gitignoreTemplate || undefined,
          license_template: licenseTemplate || undefined,
        };

        const repository: GitHubRepositoryCreated =
          await GithubService.createRepository(
            selectedOrg,
            input,
            !isSelectedOrgUser, // isOrganization (false if user account selected)
          );

        // Step 2: Clone the repository
        setProgressStep('cloning');

        // Use HTTPS clone URL (more reliable in most environments)
        const cloneUrl = repository.clone_url;

        const cloneSuccess = await GitService.cloneRepository(
          cloneUrl,
          targetPath,
        );

        if (!cloneSuccess) {
          throw new Error('Failed to clone repository');
        }

        // Step 3: Register with Alexandria
        setProgressStep('registering');

        const registeredRepo = await AlexandriaService.registerRepository(
          targetPath,
          cloneUrl,
        );

        // Step 4: Add to workspace (if applicable)
        if (targetWorkspace) {
          setProgressStep('adding');
          await WorkspaceService.addRepositoryToWorkspace(
            registeredRepo,
            targetWorkspace.id,
          );
        }

        // Done!
        setProgressStep('done');
        setStep('complete');

        // Auto-close after a delay
        setTimeout(() => {
          onClose();
        }, 2000);
      }
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

  // Get workspaces with suggestedClonePath
  const workspacesWithClonePath = workspaces.filter(w => w.suggestedClonePath);

  const renderDestinationSelection = () => (
    <>
      {/* Body */}
      <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
            color: theme.colors.textSecondary,
          }}
        >
          Where would you like to clone the new repository?
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Base Default Directory Option */}
          {baseDefaultDirectory && (
            <button
              onClick={() => handleSelectDestination({ type: 'base', value: baseDefaultDirectory })}
              onMouseEnter={() => setHoveredDestination('base')}
              onMouseLeave={() => setHoveredDestination(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '16px',
                borderRadius: '8px',
                border: `1px solid ${hoveredDestination === 'base' ? theme.colors.primary : theme.colors.border}`,
                backgroundColor: hoveredDestination === 'base'
                  ? theme.colors.backgroundTertiary
                  : theme.colors.backgroundSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FolderOpen size={20} style={{ color: theme.colors.textSecondary }} />
                <span
                  style={{
                    fontSize: `${theme.fontSizes[2]}px`,
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                  }}
                >
                  Home Folder
                </span>
              </div>
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.textSecondary,
                  marginLeft: '28px',
                }}
              >
                {baseDefaultDirectory}
              </span>
            </button>
          )}

          {/* Workspace Options */}
          {workspacesWithClonePath.length > 0 && (
            <>
              {workspacesWithClonePath.length > 0 && baseDefaultDirectory && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '8px 0',
                  }}
                >
                  <div style={{ flex: 1, height: '1px', backgroundColor: theme.colors.border }} />
                  <span
                    style={{
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    OR
                  </span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: theme.colors.border }} />
                </div>
              )}

              {workspacesWithClonePath.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelectDestination({ type: 'workspace', value: ws })}
                  onMouseEnter={() => setHoveredDestination(ws.id)}
                  onMouseLeave={() => setHoveredDestination(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '16px',
                    borderRadius: '8px',
                    border: `1px solid ${hoveredDestination === ws.id ? theme.colors.primary : theme.colors.border}`,
                    backgroundColor: hoveredDestination === ws.id
                      ? theme.colors.backgroundTertiary
                      : theme.colors.backgroundSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Folder size={20} style={{ color: theme.colors.primary }} />
                    <span
                      style={{
                        fontSize: `${theme.fontSizes[2]}px`,
                        fontWeight: theme.fontWeights.semibold,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.text,
                      }}
                    >
                      {ws.name}
                    </span>
                  </div>
                  {ws.description && (
                    <span
                      style={{
                        fontSize: `${theme.fontSizes[0]}px`,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.textSecondary,
                        marginLeft: '28px',
                      }}
                    >
                      {ws.description}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: `${theme.fontSizes[0]}px`,
                      fontFamily: theme.fonts.monospace,
                      color: theme.colors.textTertiary,
                      marginLeft: '28px',
                    }}
                  >
                    {ws.suggestedClonePath}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* No options available */}
          {!baseDefaultDirectory && workspacesWithClonePath.length === 0 && (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
              }}
            >
              <p style={{ margin: 0, marginBottom: '8px' }}>
                No clone destinations available.
              </p>
              <p style={{ margin: 0, fontSize: `${theme.fontSizes[0]}px` }}>
                Please set a home folder or create a workspace with a home directory first.
              </p>
            </div>
          )}
        </div>
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
        ) : !currentUser && organizations.length === 0 ? (
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
              No organizations found and unable to load user account.
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
              Select where to create the repository:
            </p>
            {currentUser && (
              <button
                key={currentUser.id}
                onClick={() => handleSelectOrg(currentUser.login, true)}
                onMouseEnter={() => setHoveredOrg(currentUser.login)}
                onMouseLeave={() => setHoveredOrg(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${hoveredOrg === currentUser.login ? theme.colors.primary : theme.colors.border}`,
                  backgroundColor: hoveredOrg === currentUser.login
                    ? theme.colors.backgroundTertiary
                    : theme.colors.backgroundSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  width: '100%',
                  marginBottom: '8px',
                }}
              >
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.login}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
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
                    {currentUser.login} (Your Account)
                  </div>
                  {currentUser.bio && (
                    <div
                      style={{
                        fontSize: `${theme.fontSizes[0]}px`,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.textSecondary,
                        marginTop: '2px',
                      }}
                    >
                      {currentUser.bio}
                    </div>
                  )}
                </div>
                <ChevronRight
                  size={20}
                  style={{
                    color: hoveredOrg === currentUser.login
                      ? theme.colors.primary
                      : theme.colors.textSecondary,
                  }}
                />
              </button>
            )}
            {/* Local Only Option */}
            <button
              key="local-only"
              onClick={() => handleSelectOrg(LOCAL_ONLY_OPTION, true)}
              onMouseEnter={() => setHoveredOrg(LOCAL_ONLY_OPTION)}
              onMouseLeave={() => setHoveredOrg(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${hoveredOrg === LOCAL_ONLY_OPTION ? theme.colors.primary : theme.colors.border}`,
                backgroundColor: hoveredOrg === LOCAL_ONLY_OPTION
                  ? theme.colors.backgroundTertiary
                  : theme.colors.backgroundSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                width: '100%',
                marginBottom: '8px',
              }}
            >
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
                <HardDrive
                  size={20}
                  style={{ color: theme.colors.background }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: `${theme.fontSizes[2]}px`,
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                  }}
                >
                  Local Only
                </div>
                <div
                  style={{
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.textSecondary,
                    marginTop: '2px',
                  }}
                >
                  Create a repository only on your local machine
                </div>
              </div>
              <ChevronRight
                size={20}
                style={{
                  color: hoveredOrg === LOCAL_ONLY_OPTION
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                }}
              />
            </button>
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
            <strong style={{ color: theme.colors.text }}>{selectedOrg}</strong>
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
    </>
  );

  const getProgressLabel = (progressStep: ProgressStep): string => {
    const isLocalOnly = selectedOrg === LOCAL_ONLY_OPTION;

    switch (progressStep) {
      case 'creating':
        return isLocalOnly ? 'Creating local directory...' : 'Creating repository on GitHub...';
      case 'cloning':
        return 'Cloning repository...';
      case 'initializing':
        return 'Initializing git repository...';
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
          {step === 'complete'
            ? 'Repository Created!'
            : getProgressLabel(progressStep)}
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
            ? selectedDestination?.type === 'workspace'
              ? `${repositoryName} has been created and added to ${(selectedDestination.value as Workspace).name}`
              : `${repositoryName} has been created and cloned successfully`
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
          {(
            selectedDestination?.type === 'workspace'
              ? ['creating', 'cloning', 'registering', 'adding'] as ProgressStep[]
              : ['creating', 'cloning', 'registering'] as ProgressStep[]
          ).map((s) => {
            const steps: ProgressStep[] =
              selectedDestination?.type === 'workspace'
                ? ['creating', 'cloning', 'registering', 'adding']
                : ['creating', 'cloning', 'registering'];
            const isActive = s === progressStep;
            const isPast = steps.indexOf(s) < steps.indexOf(progressStep);

            return (
              <div
                key={s}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    isPast || isActive
                      ? theme.colors.primary
                      : theme.colors.border,
                  opacity: isActive ? 1 : isPast ? 0.6 : 0.3,
                  transition: 'all 0.3s',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'select-destination':
        return renderDestinationSelection();
      case 'select-org':
        return renderOrgSelection();
      case 'create-repo':
        return renderCreateForm();
      case 'progress':
      case 'complete':
        return renderProgress();
      default:
        return workspace ? renderOrgSelection() : renderDestinationSelection();
    }
  };

  const getHeaderTitle = () => {
    switch (step) {
      case 'select-destination':
        return 'Create New Repository';
      case 'select-org':
        return 'Select Organization';
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
      case 'select-destination':
        return 'Choose where to clone the repository';
      case 'select-org':
        if (selectedDestination?.type === 'workspace') {
          const ws = selectedDestination.value as Workspace;
          return `Will be added to: ${ws.name}`;
        } else {
          return 'Select organization to create repository';
        }
      case 'create-repo':
        if (selectedDestination?.type === 'workspace') {
          const ws = selectedDestination.value as Workspace;
          return `Will be added to: ${ws.name}`;
        } else if (ownerSubdirActive && selectedOrg && repositoryName.trim()) {
          const ownerSegment =
            selectedOrg === LOCAL_ONLY_OPTION
              ? currentUser?.login || ''
              : selectedOrg;
          return ownerSegment
            ? `Will be cloned to ${ownerSegment}/${repositoryName.trim()}`
            : `Will be cloned to home folder`;
        } else {
          return `Will be cloned to home folder`;
        }
      case 'progress':
      case 'complete':
        return `${selectedOrg}/${repositoryName}`;
      default:
        if (workspace) {
          return `Adding to workspace: ${workspace.name}`;
        }
        return 'Create and clone a new GitHub repository';
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

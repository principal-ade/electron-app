import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  X,
  Loader2,
  AlertCircle,
  Check,
  Github,
  FolderOpen,
  GitFork,
  Info,
} from 'lucide-react';
import { GitService } from '../../main-process-api/GitService';
import { GithubService } from '../../main-process-api/GithubService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import type {
  GitHubRepositoryWithPermissions,
  GitHubUser,
  GitHubOrganization,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';

// Helper to join paths (works in renderer without Node.js path module)
function joinPath(...parts: string[]): string {
  return parts
    .map((part, i) => {
      if (i === 0) {
        return part.replace(/\/+$/, '');
      }
      return part.replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean)
    .join('/');
}

interface CloneFromGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
}

type ModalStep = 'input' | 'progress' | 'complete';

type ProgressStep = 'forking' | 'cloning' | 'registering' | 'adding' | 'done';

interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  url: string;
}

/**
 * Parse a GitHub URL to extract owner and repo name
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo (shorthand)
 */
function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  const trimmed = input.trim();

  // Handle shorthand format: owner/repo
  const shorthandMatch = trimmed.match(
    /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/,
  );
  if (shorthandMatch) {
    return {
      owner: shorthandMatch[1],
      repo: shorthandMatch[2].replace(/\.git$/, ''),
      url: `https://github.com/${shorthandMatch[1]}/${shorthandMatch[2].replace(/\.git$/, '')}.git`,
    };
  }

  // Handle HTTPS URL: https://github.com/owner/repo(.git)?
  const httpsMatch = trimmed.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/,
  );
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
      url: `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}.git`,
    };
  }

  // Handle SSH URL: git@github.com:owner/repo.git
  const sshMatch = trimmed.match(
    /^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/,
  );
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
      url: `https://github.com/${sshMatch[1]}/${sshMatch[2]}.git`,
    };
  }

  return null;
}

export const CloneFromGitHubModal: React.FC<CloneFromGitHubModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const { theme } = useTheme();

  // Step state
  const [step, setStep] = useState<ModalStep>('input');

  // Form state
  const [githubUrl, setGithubUrl] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [useCustomPath, setUseCustomPath] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed URL state
  const [parsedUrl, setParsedUrl] = useState<ParsedGitHubUrl | null>(null);

  // Repository info and permissions
  const [repoInfo, setRepoInfo] =
    useState<GitHubRepositoryWithPermissions | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [willFork, setWillFork] = useState(false);

  // Fork target state (user's personal account or an organization)
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [forkTarget, setForkTarget] = useState<string>('personal'); // 'personal' or org login

  // Progress state
  const [progressStep, setProgressStep] = useState<ProgressStep>('cloning');

  // Forked repo info (after forking)
  const [forkedRepoUrl, setForkedRepoUrl] = useState<string | null>(null);

  // Check if user has push access
  const hasPushAccess = repoInfo?.permissions?.push ?? false;
  const needsFork = repoInfo && !hasPushAccess;

  // Parse URL whenever input changes
  useEffect(() => {
    if (githubUrl.trim()) {
      const parsed = parseGitHubUrl(githubUrl);
      setParsedUrl(parsed);
      // Reset repo info when URL changes
      setRepoInfo(null);
      setWillFork(false);
      setForkedRepoUrl(null);
    } else {
      setParsedUrl(null);
      setRepoInfo(null);
      setWillFork(false);
      setForkedRepoUrl(null);
    }
  }, [githubUrl]);

  // Check permissions when URL is parsed
  const checkPermissions = useCallback(async () => {
    if (!parsedUrl) return;

    setIsCheckingPermissions(true);
    setError(null);

    try {
      // Get current user and repo info in parallel
      const [user, repo] = await Promise.all([
        GithubService.getCurrentUser(),
        GithubService.getRepository(parsedUrl.owner, parsedUrl.repo),
      ]);

      setCurrentUser(user);
      setRepoInfo(repo);

      if (!repo) {
        setError("Repository not found or you don't have access to it.");
      }
    } catch (err) {
      console.error('Failed to check permissions:', err);
      setError(
        'Failed to check repository permissions. You can still try to clone.',
      );
    } finally {
      setIsCheckingPermissions(false);
    }
  }, [parsedUrl]);

  // Auto-check permissions when URL is parsed (with debounce)
  useEffect(() => {
    if (!parsedUrl) return;

    const timer = setTimeout(() => {
      void checkPermissions();
    }, 500);

    return () => clearTimeout(timer);
  }, [parsedUrl, checkPermissions]);

  // Load organizations when fork is selected
  useEffect(() => {
    if (willFork && organizations.length === 0 && !isLoadingOrgs) {
      setIsLoadingOrgs(true);
      GithubService.getUserOrganizations()
        .then((orgs) => {
          setOrganizations(orgs);
        })
        .catch((err) => {
          console.error('Failed to load organizations:', err);
        })
        .finally(() => {
          setIsLoadingOrgs(false);
        });
    }
  }, [willFork, organizations.length, isLoadingOrgs]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setGithubUrl('');
      setCustomPath('');
      setUseCustomPath(false);
      setError(null);
      setProgressStep('cloning');
      setIsCloning(false);
      setParsedUrl(null);
      setRepoInfo(null);
      setCurrentUser(null);
      setWillFork(false);
      setForkedRepoUrl(null);
      setOrganizations([]);
      setForkTarget('personal');
    }
  }, [isOpen]);

  // Compute the target path
  const getTargetPath = (): string | null => {
    if (!parsedUrl) return null;

    const repoName = parsedUrl.repo;

    if (useCustomPath && customPath.trim()) {
      return customPath.trim();
    }

    if (workspace.suggestedClonePath) {
      return joinPath(workspace.suggestedClonePath, repoName);
    }

    return null;
  };

  const handleClone = async () => {
    if (!parsedUrl) {
      setError('Please enter a valid GitHub URL');
      return;
    }

    const targetPath = getTargetPath();
    if (!targetPath) {
      setError(
        'Please specify a clone directory or configure a workspace home directory',
      );
      return;
    }

    setIsCloning(true);
    setError(null);
    setStep('progress');

    try {
      let cloneUrl = parsedUrl.url;
      let repoName = parsedUrl.repo;

      // Step 0: Fork if needed
      if (willFork && needsFork) {
        setProgressStep('forking');

        const forkOptions =
          forkTarget !== 'personal' ? { organization: forkTarget } : undefined;

        const forkedRepo = await GithubService.forkRepository(
          parsedUrl.owner,
          parsedUrl.repo,
          forkOptions,
        );

        if (!forkedRepo) {
          throw new Error('Failed to fork repository. Please try again.');
        }

        // Use the forked repo's clone URL
        cloneUrl = forkedRepo.clone_url;
        repoName = forkedRepo.name;
        setForkedRepoUrl(forkedRepo.html_url);
      }

      // Step 1: Clone the repository
      setProgressStep('cloning');
      const cloneSuccess = await GitService.cloneRepository(
        cloneUrl,
        targetPath,
      );

      if (!cloneSuccess) {
        throw new Error(
          'Failed to clone repository. Check that the URL is correct and you have access.',
        );
      }

      // Step 2: Register with Alexandria
      setProgressStep('registering');

      const registeredRepo = await AlexandriaService.registerRepository(
        repoName,
        targetPath,
      );

      // Step 3: Add to workspace
      setProgressStep('adding');

      await WorkspaceService.addRepositoryToWorkspace(
        registeredRepo,
        workspace.id,
      );

      // Done!
      setProgressStep('done');
      setStep('complete');

      // Auto-close after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to clone repository:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to clone repository. Please try again.',
      );
      setStep('input'); // Go back to form on error
    } finally {
      setIsCloning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCloning && step === 'input' && parsedUrl) {
      void handleClone();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await window.mainProcess.system.openDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Clone Directory',
        defaultPath: workspace.suggestedClonePath || undefined,
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = parsedUrl
          ? joinPath(result.filePaths[0], parsedUrl.repo)
          : result.filePaths[0];
        setCustomPath(selectedPath);
        setUseCustomPath(true);
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err);
    }
  };

  if (!isOpen) return null;

  const getProgressLabel = (step: ProgressStep): string => {
    switch (step) {
      case 'forking':
        return 'Forking repository...';
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

  const renderInputForm = () => (
    <>
      {/* Body */}
      <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        {/* GitHub URL input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="github-url"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            GitHub Repository URL
          </label>
          <input
            id="github-url"
            type="text"
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isCloning}
            placeholder="https://github.com/owner/repo or owner/repo"
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
          {parsedUrl && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isCheckingPermissions ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Loader2
                    size={14}
                    style={{ color: theme.colors.textSecondary }}
                    className="animate-spin"
                  />
                  <span
                    style={{
                      fontSize: `${theme.fontSizes[0]}px`,
                      fontFamily: theme.fonts.body,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Checking permissions...
                  </span>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Will clone:{' '}
                  <strong style={{ color: theme.colors.text }}>
                    {parsedUrl.owner}/{parsedUrl.repo}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Fork notice - show when user doesn't have push access */}
        {needsFork && !isCheckingPermissions && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: `${theme.colors.warning || '#f59e0b'}15`,
              border: `1px solid ${theme.colors.warning || '#f59e0b'}40`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <Info
                size={18}
                style={{
                  color: theme.colors.warning || '#f59e0b',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              />
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                    fontWeight: theme.fontWeights.medium,
                  }}
                >
                  You don't have write access to this repository
                </p>
                <p
                  style={{
                    margin: '4px 0 12px 0',
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  To contribute changes, you can fork this repository to your
                  account or an organization.
                </p>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={willFork}
                    onChange={(e) => setWillFork(e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: theme.colors.primary,
                    }}
                  />
                  <span
                    style={{
                      fontSize: `${theme.fontSizes[1]}px`,
                      fontFamily: theme.fonts.body,
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <GitFork size={14} />
                    Fork before cloning
                  </span>
                </label>

                {/* Organization selector - show when fork is checked */}
                {willFork && (
                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <label
                      style={{
                        fontSize: `${theme.fontSizes[0]}px`,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.textSecondary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Fork to:
                    </label>
                    {isLoadingOrgs ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Loader2
                          size={14}
                          style={{ color: theme.colors.textSecondary }}
                          className="animate-spin"
                        />
                        <span
                          style={{
                            fontSize: `${theme.fontSizes[0]}px`,
                            color: theme.colors.textSecondary,
                          }}
                        >
                          Loading...
                        </span>
                      </div>
                    ) : (
                      <select
                        value={forkTarget}
                        onChange={(e) => setForkTarget(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.backgroundSecondary,
                          color: theme.colors.text,
                          fontSize: `${theme.fontSizes[1]}px`,
                          fontFamily: theme.fonts.body,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="personal">
                          {currentUser?.login || 'My account'} (personal)
                        </option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.login}>
                            {org.login}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Push access confirmed notice */}
        {repoInfo && hasPushAccess && !isCheckingPermissions && (
          <div
            style={{
              marginBottom: '20px',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: `${theme.colors.success || '#22c55e'}15`,
              border: `1px solid ${theme.colors.success || '#22c55e'}40`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Check
              size={16}
              style={{ color: theme.colors.success || '#22c55e' }}
            />
            <span
              style={{
                fontSize: `${theme.fontSizes[0]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.success || '#22c55e',
              }}
            >
              You have write access to this repository
            </span>
          </div>
        )}

        {/* Clone directory */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            Clone Directory
          </label>

          {workspace.suggestedClonePath && !useCustomPath ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.textSecondary,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.monospace,
                }}
              >
                {parsedUrl
                  ? joinPath(workspace.suggestedClonePath, parsedUrl.repo)
                  : workspace.suggestedClonePath}
              </div>
              <button
                onClick={handleSelectDirectory}
                disabled={isCloning}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  cursor: isCloning ? 'not-allowed' : 'pointer',
                }}
              >
                <FolderOpen size={14} />
                Choose Different Location
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                disabled={isCloning}
                placeholder="/path/to/clone/directory"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.monospace,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSelectDirectory}
                disabled={isCloning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: isCloning ? 'not-allowed' : 'pointer',
                }}
                title="Browse for directory"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          )}
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
          disabled={isCloning}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: 'transparent',
            color: theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.semibold,
            fontFamily: theme.fonts.body,
            cursor: isCloning ? 'not-allowed' : 'pointer',
            opacity: isCloning ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => void handleClone()}
          disabled={
            isCloning || !parsedUrl || !getTargetPath() || isCheckingPermissions
          }
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
              isCloning ||
              !parsedUrl ||
              !getTargetPath() ||
              isCheckingPermissions
                ? 'not-allowed'
                : 'pointer',
            opacity:
              isCloning ||
              !parsedUrl ||
              !getTargetPath() ||
              isCheckingPermissions
                ? 0.5
                : 1,
          }}
        >
          {isCloning && <Loader2 size={16} className="animate-spin" />}
          {willFork && needsFork && <GitFork size={16} />}
          {isCloning
            ? willFork && needsFork
              ? 'Forking & Cloning...'
              : 'Cloning...'
            : willFork && needsFork
              ? 'Fork & Clone'
              : 'Clone Repository'}
        </button>
      </div>
    </>
  );

  const renderProgress = () => {
    const allSteps: ProgressStep[] =
      willFork && needsFork
        ? ['forking', 'cloning', 'registering', 'adding']
        : ['cloning', 'registering', 'adding'];

    return (
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
              ? 'Repository Cloned!'
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
              ? `${parsedUrl?.repo} has been ${willFork && forkedRepoUrl ? 'forked and ' : ''}cloned and added to ${workspace.name}`
              : willFork && progressStep === 'forking'
                ? `Forking ${parsedUrl?.owner}/${parsedUrl?.repo} to ${forkTarget === 'personal' ? currentUser?.login || 'your account' : forkTarget}...`
                : `Cloning ${willFork && forkedRepoUrl ? 'your fork of ' : ''}${parsedUrl?.owner}/${parsedUrl?.repo}...`}
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
            {allSteps.map((s) => {
              const isActive = s === progressStep;
              const isPast =
                allSteps.indexOf(s) < allSteps.indexOf(progressStep);

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
  };

  const renderContent = () => {
    switch (step) {
      case 'input':
        return renderInputForm();
      case 'progress':
      case 'complete':
        return renderProgress();
      default:
        return renderInputForm();
    }
  };

  const getHeaderTitle = () => {
    switch (step) {
      case 'input':
        return 'Clone from GitHub';
      case 'progress':
        return willFork && progressStep === 'forking'
          ? 'Forking Repository'
          : 'Cloning Repository';
      case 'complete':
        return 'Success';
      default:
        return 'Clone from GitHub';
    }
  };

  const getHeaderSubtitle = () => {
    switch (step) {
      case 'input':
        return `Clone and add to: ${workspace.name}`;
      case 'progress':
      case 'complete':
        return parsedUrl ? `${parsedUrl.owner}/${parsedUrl.repo}` : '';
      default:
        return `Clone and add to: ${workspace.name}`;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Github size={20} style={{ color: theme.colors.text }} />
            </div>
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
          </div>
          {step !== 'progress' && (
            <button
              onClick={onClose}
              disabled={isCloning}
              style={{
                background: 'none',
                border: 'none',
                cursor: isCloning ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: theme.colors.textSecondary,
                opacity: isCloning ? 0.5 : 1,
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

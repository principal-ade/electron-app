import React, { useState, useEffect } from 'react';
import {
  X,
  Github,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Loader,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { AlexandriaEntry } from '@a24z/core-library';
import { GitService } from '../main-process-api/GitService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import type { Workspace } from '@a24z/core-library';

interface GitCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepositoryAdded?: (repo: AlexandriaEntry) => void;
  initialUrl?: string;
}

type CloneStep =
  | 'input'
  | 'validating'
  | 'directory'
  | 'existing-repo'
  | 'cloning'
  | 'complete'
  | 'error';

interface AuthMethod {
  available: boolean;
  reason?: string;
}

interface AuthMethods {
  ssh: AuthMethod;
  https: AuthMethod;
  suggestions: string[];
}

export const GitCloneModal: React.FC<GitCloneModalProps> = ({
  isOpen,
  onClose,
  onRepositoryAdded,
  initialUrl,
}) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<CloneStep>('input');
  const [gitUrl, setGitUrl] = useState('');
  const [cloneDirectory, setCloneDirectory] = useState('');
  const [repoName, setRepoName] = useState('');
  const [authMethods, setAuthMethods] = useState<AuthMethods | null>(null);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<'ssh' | 'https'>(
    'https',
  );
  const [error, setError] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<string>('');
  const [existingRepoPath, setExistingRepoPath] = useState<string>('');

  // Workspace state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [defaultWorkspace, setDefaultWorkspace] = useState<Workspace | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [customDirectory, setCustomDirectory] = useState<string>(''); // User-selected custom directory

  // Reset state when modal opens and focus the input
  useEffect(() => {
    if (isOpen) {
      // If initialUrl is provided, start at validating step, otherwise start at input
      setCurrentStep(initialUrl ? 'validating' : 'input');
      setGitUrl(initialUrl || '');
      setCloneDirectory('');
      setRepoName('');
      setAuthMethods(null);
      setSelectedAuthMethod('https');
      setError('');
      setErrorDetails('');
      setIsValidating(false);
      setIsCloning(false);
      setCloneProgress('');
      setExistingRepoPath('');
      setCustomDirectory('');

      // Only focus input if we're on the input step
      if (!initialUrl) {
        // Focus the input field after a brief delay to ensure the modal is rendered
        setTimeout(() => {
          const input = document.getElementById('git-url-input');
          if (input) {
            input.focus();
          }
        }, 100);
      }
    }
  }, [isOpen, initialUrl]);

  // Auto-validate when initialUrl is provided
  useEffect(() => {
    if (isOpen && currentStep === 'validating' && initialUrl && !isValidating) {
      const validateInitialUrl = async () => {
        if (!isValidGitUrl(initialUrl)) {
          setError('Please enter a valid Git repository URL');
          setCurrentStep('error');
          return;
        }

        // Normalize the URL (add .git if needed)
        const normalizedUrl = normalizeGitUrl(initialUrl);

        setIsValidating(true);
        setError('');

        try {
          // Check authentication methods with normalized URL
          const methods = await GitService.checkAuthMethods(normalizedUrl);
          setAuthMethods(methods);

          // Determine which method to use by default
          if (methods.ssh.available) {
            setSelectedAuthMethod('ssh');
          } else if (methods.https.available) {
            setSelectedAuthMethod('https');
          } else {
            // Show detailed authentication help
            const suggestions =
              methods.suggestions?.join('\n') ||
              'Unable to access repository. Check authentication and URL.';
            setError(suggestions);
            setCurrentStep('error');
            return;
          }

          // Extract repo name from normalized URL
          const name = extractRepoName(normalizedUrl);
          setRepoName(name);

          // Move to directory selection
          setCurrentStep('directory');
        } catch (err) {
          console.error('Error validating Git URL:', err);
          setError(
            'Failed to validate repository access. Please check the URL and try again.',
          );
          setCurrentStep('error');
        } finally {
          setIsValidating(false);
        }
      };

      validateInitialUrl();
    }
  }, [isOpen, currentStep, initialUrl, isValidating]);

  // Load workspaces when modal opens
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        WorkspaceService.getWorkspaces(),
        WorkspaceService.getDefaultWorkspace(),
      ]).then(([loadedWorkspaces, defaultWs]) => {
        setWorkspaces(loadedWorkspaces);
        setDefaultWorkspace(defaultWs);

        // Don't auto-select workspace - let user choose or use custom location
        setSelectedWorkspace(null);
      }).catch((error) => {
        console.error('[GitCloneModal] Error loading workspaces:', error);
        setWorkspaces([]);
        setDefaultWorkspace(null);
        setSelectedWorkspace(null);
      });
    }
  }, [isOpen]);

  // Normalize git URL (handle browser URLs, add .git if needed)
  const normalizeGitUrl = (url: string): string => {
    // Remove trailing slashes
    url = url.replace(/\/+$/, '');

    // Handle common git platforms - add .git if missing
    if (
      url.includes('github.com') ||
      url.includes('gitlab.com') ||
      url.includes('bitbucket.org')
    ) {
      // Check if it's a browser URL (doesn't have .git extension)
      if (!url.endsWith('.git') && !url.includes('.git/')) {
        // Remove any URL fragments or query parameters
        url = url.split('#')[0].split('?')[0];

        // Handle URLs with /tree/, /blob/, /commits/ etc (GitHub browser URLs)
        const patterns = [
          '/tree/',
          '/blob/',
          '/commits/',
          '/pulls',
          '/issues',
          '/wiki',
          '/settings',
          '/actions',
        ];
        for (const pattern of patterns) {
          const index = url.indexOf(pattern);
          if (index !== -1) {
            url = url.substring(0, index);
            break;
          }
        }

        // Add .git extension
        url = `${url}.git`;
      }
    }

    return url;
  };

  // Extract repo name from URL
  const extractRepoName = (url: string): string => {
    try {
      // First normalize the URL
      const normalizedUrl = normalizeGitUrl(url);
      const urlParts = normalizedUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      return lastPart.replace(/\.git$/, '');
    } catch {
      return 'unknown-repo';
    }
  };

  // Validate Git URL format (now accepts browser URLs too)
  const isValidGitUrl = (url: string): boolean => {
    // Basic validation - must start with http(s) or git@
    const basicGitUrlRegex = /^(https?:\/\/|git@).+/;
    if (!basicGitUrlRegex.test(url.trim())) {
      return false;
    }

    // Check if it looks like a git repository URL
    // Accept common patterns: github.com/owner/repo, gitlab.com/owner/repo, etc.
    const repoPatterns = [
      /github\.com\/[^/]+\/[^/]+/,
      /gitlab\.com\/[^/]+\/[^/]+/,
      /bitbucket\.org\/[^/]+\/[^/]+/,
      /\.git$/, // Already has .git extension
    ];

    return repoPatterns.some((pattern) => pattern.test(url));
  };

  // Handle URL validation and auth method checking
  const handleValidateUrl = async () => {
    if (!gitUrl.trim()) {
      setError('Please enter a Git URL');
      return;
    }

    if (!isValidGitUrl(gitUrl)) {
      setError('Please enter a valid Git repository URL');
      return;
    }

    // Normalize the URL (add .git if needed)
    const normalizedUrl = normalizeGitUrl(gitUrl);

    setIsValidating(true);
    setError('');
    setCurrentStep('validating');

    try {
      // Check authentication methods with normalized URL
      const methods = await GitService.checkAuthMethods(normalizedUrl);
      setAuthMethods(methods);

      // Determine which method to use by default
      if (methods.ssh.available) {
        setSelectedAuthMethod('ssh');
      } else if (methods.https.available) {
        setSelectedAuthMethod('https');
      } else {
        // Show detailed authentication help
        const suggestions =
          methods.suggestions?.join('\n') ||
          'Unable to access repository. Check authentication and URL.';
        setError(suggestions);
        setCurrentStep('error');
        return;
      }

      // Extract repo name from normalized URL
      const name = extractRepoName(normalizedUrl);
      setRepoName(name);

      // Move to directory selection
      setCurrentStep('directory');
    } catch (err) {
      console.error('Error validating Git URL:', err);
      setError(
        'Failed to validate repository access. Please check the URL and try again.',
      );
      setCurrentStep('error');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle directory selection
  const handleSelectDirectory = async () => {
    try {
      let baseDir: string | undefined;

      // Priority: 1) Custom directory, 2) Selected workspace, 3) defaultCloneDirectory (backwards compat), 4) Prompt user
      if (customDirectory) {
        // User explicitly selected a custom directory
        baseDir = customDirectory;
      } else if (selectedWorkspace) {
        baseDir = selectedWorkspace.suggestedClonePath;
      } else {
        const preferences = await UserPreferencesService.getPreferences();
        baseDir = preferences.defaultCloneDirectory;
      }

      if (!baseDir) {
        // No workspace or default directory set, prompt user to choose
        const result = await FileSystemService.selectDirectory({
          title: 'Select Clone Directory',
          buttonLabel: 'Select Directory',
          properties: ['openDirectory', 'createDirectory'],
        });

        if (!result || result.canceled || !result.filePaths?.[0]) {
          return; // User cancelled
        }

        baseDir = result.filePaths[0];
      }

      const fullPath = `${baseDir}/${repoName}`;
      setCloneDirectory(fullPath);

      // Check if directory already exists
      try {
        const stats = await FileSystemService.getFileStats(fullPath);
        if (stats) {
          // Directory exists - check if it's a git repository
          const gitInfo = await GitService.getRepositoryInfo(fullPath);

          if (gitInfo && gitInfo.isRepository) {
            // It's already a git repository - check if it matches the URL we're trying to clone
            const existingRemote = gitInfo.remotes?.find(
              (r) => r.name === 'origin',
            );

            // Better normalization for comparison that handles SSH and HTTPS
            const normalizeForComparison = (url: string): string => {
              // Convert to lowercase and remove trailing slashes
              let normalized = url.toLowerCase().replace(/\/$/, '');

              // Remove .git extension
              normalized = normalized.replace(/\.git$/, '');

              // Convert SSH format to HTTPS format for comparison
              // git@github.com:owner/repo -> https://github.com/owner/repo
              normalized = normalized.replace(/^git@([^:]+):/, 'https://$1/');

              // Also handle ssh:// format
              normalized = normalized.replace(
                /^ssh:\/\/git@([^/]+)\//,
                'https://$1/',
              );

              return normalized;
            };

            const normalizedInputUrl = normalizeForComparison(gitUrl);
            const normalizedExistingUrl = existingRemote?.url
              ? normalizeForComparison(existingRemote.url)
              : '';

            if (normalizedExistingUrl === normalizedInputUrl) {
              // Same repository - offer to register it
              setExistingRepoPath(fullPath);
              setCurrentStep('existing-repo');
              setCloneDirectory(fullPath);
            } else if (existingRemote) {
              // Different repository
              setError(
                `Directory already exists at ${fullPath} and contains a different repository (${existingRemote.url})`,
              );
            } else {
              // Git repo but no origin remote
              setError(
                `Directory already exists at ${fullPath} and is a git repository without an origin remote`,
              );
            }
          } else {
            // Directory exists but is not a git repository
            setError(
              `Directory already exists at ${fullPath} and is not a git repository`,
            );
          }
          return;
        }
      } catch {
        // Directory doesn't exist, which is good
      }

      // Start cloning
      await handleStartClone(fullPath);
    } catch (err) {
      console.error('Error selecting directory:', err);
      setError('Failed to select clone directory');
    }
  };

  // Handle the actual cloning process
  const handleStartClone = async (targetPath: string) => {
    setCurrentStep('cloning');
    setIsCloning(true);
    setCloneProgress('Initializing clone...');

    try {
      // Determine which URL to use based on selected auth method
      // Use normalized URL as base
      const baseUrl = normalizeGitUrl(gitUrl);
      let cloneUrl = baseUrl;
      if (selectedAuthMethod === 'ssh' && authMethods?.ssh.available) {
        // Convert HTTPS to SSH if needed
        if (baseUrl.startsWith('https://')) {
          // Convert https://github.com/owner/repo.git to git@github.com:owner/repo.git
          const match = baseUrl.match(
            /https:\/\/([^/]+)\/([^/]+)\/([^/.]+)\.git$/,
          );
          if (match) {
            cloneUrl = `git@${match[1]}:${match[2]}/${match[3]}.git`;
          }
        }
      }

      setCloneProgress('Cloning repository...');
      const success = await GitService.cloneRepository(cloneUrl, targetPath);

      if (success) {
        setCloneProgress('Registering repository...');

        // Register with Alexandria
        const registeredRepo = await AlexandriaService.registerRepository(
          repoName,
          targetPath,
        );

        // Add to selected workspace if one is selected
        if (selectedWorkspace && registeredRepo) {
          setCloneProgress('Adding to workspace...');
          try {
            await WorkspaceService.addRepositoryToWorkspace(
              registeredRepo,
              selectedWorkspace.id
            );
          } catch (error) {
            console.error('[GitCloneModal] Error adding to workspace:', error);
            // Don't fail the clone if workspace addition fails
          }
        }

        setCloneProgress('Clone complete!');
        setCurrentStep('complete');

        // Notify parent component
        if (onRepositoryAdded) {
          onRepositoryAdded(registeredRepo);
        }

        // Auto-close after a delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error('Clone failed');
      }
    } catch (err) {
      console.error('Error during cloning:', err);

      // Extract error message and details
      interface EnhancedError extends Error {
        details?: string;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to clone repository';
      const details = (err as EnhancedError)?.details || '';

      setError(errorMessage);
      setErrorDetails(details);
      setCurrentStep('error');
    } finally {
      setIsCloning(false);
    }
  };

  // Handle retry from error state
  const handleRetry = () => {
    setCurrentStep('input');
    setError('');
    setErrorDetails('');
    setExistingRepoPath('');
  };

  // Handle choosing a different directory
  const handleChooseDifferentDirectory = async () => {
    setCurrentStep('directory');
    setError('');
    setExistingRepoPath('');
    // Let user select a new directory
    await handleSelectDirectory();
  };

  // Handle registering an existing repository
  const handleRegisterExisting = async () => {
    const pathToRegister = existingRepoPath || cloneDirectory;
    if (!pathToRegister) return;

    setIsCloning(true);
    setCloneProgress('Registering existing repository...');
    setError('');

    try {
      // Register with Alexandria
      const registeredRepo = await AlexandriaService.registerRepository(
        repoName,
        pathToRegister,
      );

      // Add to selected workspace if one is selected
      if (selectedWorkspace && registeredRepo) {
        setCloneProgress('Adding to workspace...');
        try {
          await WorkspaceService.addRepositoryToWorkspace(
            registeredRepo,
            selectedWorkspace.id
          );
        } catch (error) {
          console.error('[GitCloneModal] Error adding to workspace:', error);
          // Don't fail the registration if workspace addition fails
        }
      }

      setCloneProgress('Registration complete!');
      setCurrentStep('complete');

      // Notify parent component
      if (onRepositoryAdded) {
        onRepositoryAdded(registeredRepo);
      }

      // Auto-close after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error registering existing repository:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to register existing repository',
      );
      setCurrentStep('error');
    } finally {
      setIsCloning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        className="rounded-lg shadow-xl max-w-lg w-full mx-4"
        style={{
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          className="p-6"
          style={{ borderBottom: `1px solid ${theme.colors.border}` }}
        >
          <div className="flex justify-between items-center">
            <h2
              className="text-xl font-semibold flex items-center gap-2"
              style={{ color: theme.colors.text }}
            >
              <Github size={24} />
              Clone Repository
            </h2>
            <button
              onClick={onClose}
              disabled={isValidating || isCloning}
              style={{
                color: theme.colors.textSecondary,
                cursor: isValidating || isCloning ? 'not-allowed' : 'pointer',
                opacity: isValidating || isCloning ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isValidating && !isCloning) {
                  e.currentTarget.style.color = theme.colors.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!isValidating && !isCloning) {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {currentStep === 'input' && (
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.colors.text }}
                >
                  Git Repository URL
                </label>
                <input
                  id="git-url-input"
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo or git@github.com:owner/repo.git"
                  disabled={isValidating}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    fontSize: '14px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Enter the repository URL (you can paste directly from your
                  browser)
                </p>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: theme.colors.error }}
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleValidateUrl}
                  disabled={!gitUrl.trim() || isValidating}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background,
                    cursor:
                      !gitUrl.trim() || isValidating
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: !gitUrl.trim() || isValidating ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    if (gitUrl.trim() && !isValidating) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (gitUrl.trim() && !isValidating) {
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
                >
                  {isValidating ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {isValidating ? 'Validating...' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'validating' && (
            <div className="text-center py-8">
              <Loader
                size={32}
                className="animate-spin mx-auto mb-4"
                style={{ color: theme.colors.primary }}
              />
              <p style={{ color: theme.colors.textSecondary }}>
                Checking repository access...
              </p>
            </div>
          )}

          {currentStep === 'directory' && authMethods && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-2"
                style={{ color: theme.colors.success }}
              >
                <CheckCircle size={20} />
                <span className="font-medium">Repository access confirmed</span>
              </div>

              <div>
                <h3
                  className="font-medium mb-2"
                  style={{ color: theme.colors.text }}
                >
                  Authentication Method
                </h3>
                <div className="space-y-2">
                  {authMethods.https.available && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="authMethod"
                        value="https"
                        checked={selectedAuthMethod === 'https'}
                        onChange={(e) =>
                          setSelectedAuthMethod(e.target.value as 'https')
                        }
                        style={{ accentColor: theme.colors.primary }}
                      />
                      <span
                        className="text-sm"
                        style={{ color: theme.colors.text }}
                      >
                        HTTPS
                      </span>
                    </label>
                  )}
                  {authMethods.ssh.available && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="authMethod"
                        value="ssh"
                        checked={selectedAuthMethod === 'ssh'}
                        onChange={(e) =>
                          setSelectedAuthMethod(e.target.value as 'ssh')
                        }
                        style={{ accentColor: theme.colors.primary }}
                      />
                      <span
                        className="text-sm"
                        style={{ color: theme.colors.text }}
                      >
                        SSH
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Clone Location Selector */}
              <div>
                <h3
                  className="font-medium mb-2"
                  style={{ color: theme.colors.text }}
                >
                  Clone Location
                </h3>

                {workspaces.length > 0 && (
                  <div className="mb-2">
                    <label
                      className="block text-sm mb-2"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Workspace (optional)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={selectedWorkspace?.id || 'none'}
                        onChange={(e) => {
                          if (e.target.value === 'none') {
                            setSelectedWorkspace(null);
                          } else {
                            const workspace = workspaces.find((w) => w.id === e.target.value);
                            setSelectedWorkspace(workspace || null);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 32px 10px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.colors.background,
                          color: theme.colors.text,
                          fontSize: '14px',
                          cursor: 'pointer',
                          appearance: 'none',
                        }}
                      >
                        <option value="none">None / Custom Location</option>
                        {workspaces.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                            {defaultWorkspace?.id === workspace.id ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: theme.colors.textSecondary,
                          pointerEvents: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    const result = await FileSystemService.selectDirectory({
                      title: 'Select Clone Directory',
                      buttonLabel: 'Select Directory',
                      properties: ['openDirectory', 'createDirectory'],
                    });

                    if (result && !result.canceled && result.filePaths?.[0]) {
                      // Set custom directory (can be used with or without workspace)
                      setCustomDirectory(result.filePaths[0]);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                  }}
                >
                  <FolderOpen size={16} />
                  {customDirectory ? 'Change Directory' : 'Browse for Directory'}
                </button>
              </div>

              {/* Path Preview */}
              <div>
                <h3
                  className="font-medium mb-2"
                  style={{ color: theme.colors.text }}
                >
                  Clone Path Preview
                </h3>
                <div
                  className="flex items-center gap-2 p-3 rounded-md"
                  style={{ backgroundColor: theme.colors.backgroundSecondary }}
                >
                  <FolderOpen
                    size={16}
                    style={{ color: theme.colors.textSecondary }}
                  />
                  <span
                    className="text-sm font-mono"
                    style={{ color: theme.colors.text }}
                  >
                    {customDirectory
                      ? `${customDirectory}/${repoName}`
                      : selectedWorkspace
                      ? `${selectedWorkspace.suggestedClonePath || ''}/${repoName}`
                      : 'Select a workspace or browse for a directory...'}
                  </span>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: theme.colors.error }}
                >
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setCurrentStep('input')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSelectDirectory}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <FolderOpen size={16} />
                  Clone Repository
                </button>
              </div>
            </div>
          )}

          {currentStep === 'existing-repo' && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-2"
                style={{ color: theme.colors.info || theme.colors.primary }}
              >
                <AlertCircle size={20} />
                <span className="font-medium">Existing Repository Found</span>
              </div>

              <div
                className="p-4 rounded-md"
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <p
                  className="text-sm mb-3"
                  style={{ color: theme.colors.text }}
                >
                  This directory already contains a clone of the repository
                  you're trying to add:
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen
                    size={16}
                    style={{ color: theme.colors.textSecondary }}
                  />
                  <span
                    className="text-sm font-mono"
                    style={{ color: theme.colors.text }}
                  >
                    {cloneDirectory}
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{ color: theme.colors.textSecondary }}
                >
                  You can register this existing clone to your workspace, or
                  choose a different location.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleChooseDifferentDirectory}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Choose Different Location
                </button>
                <button
                  onClick={handleRegisterExisting}
                  disabled={isCloning}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: theme.colors.success,
                    color: theme.colors.background,
                    cursor: isCloning ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: isCloning ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCloning) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCloning) {
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
                >
                  <CheckCircle size={16} />
                  {isCloning ? 'Registering...' : 'Register Existing Clone'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'cloning' && (
            <div className="text-center py-8">
              <Loader
                size={32}
                className="animate-spin mx-auto mb-4"
                style={{ color: theme.colors.primary }}
              />
              <p className="mb-2" style={{ color: theme.colors.textSecondary }}>
                Cloning repository...
              </p>
              <p
                className="text-sm"
                style={{ color: theme.colors.textSecondary }}
              >
                {cloneProgress}
              </p>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle
                size={48}
                className="mx-auto mb-4"
                style={{ color: theme.colors.success }}
              />
              <h3
                className="text-lg font-medium mb-2"
                style={{ color: theme.colors.text }}
              >
                Clone Complete!
              </h3>
              <p style={{ color: theme.colors.textSecondary }}>
                Repository "{repoName}" has been successfully cloned and added.
              </p>
            </div>
          )}

          {currentStep === 'error' && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-2"
                style={{ color: theme.colors.error }}
              >
                <AlertCircle size={20} />
                <span className="font-medium">Clone Failed</span>
              </div>

              {/* Main error message */}
              <div
                className="p-3 rounded-md"
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.error}`,
                }}
              >
                <p
                  className="text-sm font-medium"
                  style={{ color: theme.colors.text }}
                >
                  {error}
                </p>
              </div>

              {/* Detailed error information and suggestions */}
              {errorDetails && (
                <div
                  className="text-sm space-y-2 max-h-96 overflow-y-auto p-3 rounded-md"
                  style={{
                    color: theme.colors.textSecondary,
                    backgroundColor: theme.colors.backgroundSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {errorDetails.split('\n').map((line, index) => {
                    // Use a unique key based on index and content
                    const lineKey = `error-detail-${index}-${line.substring(0, 20).replace(/\s/g, '-')}`;

                    // Handle markdown-style headers
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return (
                        <p
                          key={lineKey}
                          className="font-semibold mt-3 first:mt-0"
                          style={{ color: theme.colors.text }}
                        >
                          {line.replace(/\*\*/g, '')}
                        </p>
                      );
                    }
                    // Handle list items
                    if (line.startsWith('•') || /^\d+\./.test(line)) {
                      return (
                        <p key={lineKey} className="ml-4">
                          {line}
                        </p>
                      );
                    }
                    // Handle empty lines
                    if (line.trim() === '') {
                      return <div key={lineKey} className="h-2" />;
                    }
                    // Regular text
                    return <p key={lineKey}>{line}</p>;
                  })}
                </div>
              )}

              <div className="flex justify-between items-center gap-3">
                {errorDetails && (
                  <button
                    onClick={() => {
                      const fullError = `${error}\n\n${errorDetails}`;
                      navigator.clipboard.writeText(fullError);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: '14px',
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
                    title="Copy error details to clipboard"
                  >
                    Copy Details
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={onClose}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRetry}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

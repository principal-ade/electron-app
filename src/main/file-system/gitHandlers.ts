import { ipcMain, net } from 'electron';
import { GitRepositoryService } from './gitRepositoryService';
import { GitRepositoryScannerService } from './gitRepositoryScannerService';
import { gitClientFactory } from '../utils/gitClientFactory';
import { GitEvents } from '../../shared/main-process-api-interfaces/GitAPI';
import { GitRemoteService } from '@principal-ai/repository-monitoring-server';
import AuthStateManager from '../services/AuthStateManager';
import { GitCredentialHelper } from '../services/GitCredentialHelper';

// Create a single instance of the git service
const gitService = new GitRepositoryService();

// Export the service instance for use by other services
export { gitService };

// Helper function to normalize git URLs (add .git if needed, handle browser URLs)
function normalizeGitUrl(url: string): string {
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
}

export function registerGitHandlers(): void {
  // Get repository info for a path
  ipcMain.handle(
    GitEvents.GET_REPOSITORY_INFO,
    async (_event, filePath: string) => {
      try {
        return await gitService.getRepositoryInfo(filePath);
      } catch (error) {
        console.error('[Git] Failed to get repository info:', error);
        throw error;
      }
    },
  );

  // Check if repository is private
  ipcMain.handle(
    GitEvents.CHECK_IF_PRIVATE_REPO,
    async (_event, remoteUrl: string) => {
      try {
        // Check if it's a GitHub repository
        if (!remoteUrl.includes('github.com')) {
          return false; // Default to public for non-GitHub repos
        }

        // Extract owner/repo from URL
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (!match) {
          console.warn('[Git] Could not parse GitHub URL:', remoteUrl);
          return false;
        }

        const [, owner, repo] = match;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

        return new Promise<boolean>((resolve) => {
          const request = net.request({
            method: 'GET',
            url: apiUrl,
            headers: {
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'PrincipleMD',
            },
          });

          request.on('response', (response) => {
            // If we get a 404, the repo is either private or doesn't exist
            resolve(response.statusCode === 404);
          });

          request.on('error', (error) => {
            console.warn('[Git] Error checking if repo is private:', error);
            resolve(false); // Default to public on error
          });

          request.end();
        });
      } catch (error) {
        console.error('[Git] Failed to check if repo is private:', error);
        return false;
      }
    },
  );

  // Get commit history
  ipcMain.handle(
    GitEvents.GET_COMMIT_HISTORY,
    async (_event, directory: string, limit?: number) => {
      try {
        return await gitService.getCommitHistory(directory, limit);
      } catch (error) {
        console.error('[Git] Failed to get commit history:', error);
        throw error;
      }
    },
  );

  // Execute git command
  ipcMain.handle(
    GitEvents.EXECUTE_COMMAND,
    async (_event, directory: string, args: string[]) => {
      try {
        const git = await gitClientFactory.getClient(directory);
        const result = await git.raw(args);
        return { stdout: result, stderr: '' };
      } catch (error) {
        console.error(
          `[Git] Failed to execute git command: git ${args.join(' ')} (in ${directory}):`,
          error,
        );
        throw error;
      }
    },
  );

  // Clone repository
  ipcMain.handle(
    GitEvents.CLONE_REPOSITORY,
    async (_event, remoteUrl: string, targetPath: string) => {
      // Track diagnostics for better error messages
      interface CloneDiagnostics {
        url: string;
        timestamp: string;
        normalizedUrl?: string;
        authMethod?: 'SSH' | 'HTTPS';
        sshAgent?: boolean;
      }

      const diagnostics: CloneDiagnostics = {
        url: remoteUrl,
        timestamp: new Date().toISOString(),
      };

      try {
        // Normalize the URL first
        const normalizedUrl = normalizeGitUrl(remoteUrl);
        diagnostics.normalizedUrl = normalizedUrl;

        // Use gitClientFactory to clone the repository
        const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
        const git = await gitClientFactory.getClient(parentDir);

        // Check if this is an SSH URL
        const isSSH =
          normalizedUrl.startsWith('git@') || normalizedUrl.includes('ssh://');
        diagnostics.authMethod = isSSH ? 'SSH' : 'HTTPS';

        // For HTTPS, git will use the configured credential helper (set up by GitCredentialHelper)
        // For SSH, use SSH agent
        const cloneEnv: Record<string, string> = {};
        if (process.env.PATH) cloneEnv.PATH = process.env.PATH;
        if (process.env.HOME) cloneEnv.HOME = process.env.HOME;
        if (process.env.USER) cloneEnv.USER = process.env.USER;
        if (process.env.SSH_AUTH_SOCK) cloneEnv.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
        if (process.env.SSH_AGENT_PID) cloneEnv.SSH_AGENT_PID = process.env.SSH_AGENT_PID;

        if (isSSH) {
          diagnostics.sshAgent = !!process.env.SSH_AUTH_SOCK;
        }

        console.log(
          `[Git] Cloning repository via ${diagnostics.authMethod}:`,
          normalizedUrl,
        );

        await git.raw(['clone', normalizedUrl, targetPath], {
          env: cloneEnv,
          timeout: 120000, // 2 minutes for clone operation
        });

        return true;
      } catch (error) {
        console.error('[Git] Failed to clone repository:', error);
        console.error('[Git] Clone diagnostics:', diagnostics);

        // Parse the error to provide helpful messages
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Create a detailed error response
        let userMessage = 'Failed to clone repository.';
        const suggestions: string[] = [];

        // Parse common git error patterns
        if (
          errorMsg.includes('Authentication failed') ||
          errorMsg.includes('authentication')
        ) {
          if (diagnostics.authMethod === 'HTTPS') {
            // Check if user is authenticated in the app
            const authState = AuthStateManager.getInstance().getFullState();
            const isAppAuthenticated = authState.isAuthenticated;

            if (isAppAuthenticated) {
              userMessage =
                'Authentication failed - Credentials may need to be refreshed.';
              suggestions.push(
                '**Git credentials need to be refreshed:**',
                '',
                '1. Log out of Principal (Settings → Log Out)',
                '2. Log back in to refresh your GitHub credentials',
                '3. Try cloning again',
                '',
                'If the issue persists, verify you have access to this repository on GitHub.',
              );
            } else {
              userMessage =
                'Authentication failed - Please log in to Principal.';
              suggestions.push(
                '**GitHub authentication required:**',
                '',
                '1. Open Settings in Principal',
                '2. Click "Log In with GitHub"',
                '3. Complete the authentication',
                '4. Try cloning again',
                '',
                'Principal will automatically configure git credentials for you.',
              );
            }
          } else {
            userMessage = 'SSH Authentication failed.';
            suggestions.push(
              '**SSH key not configured or not authorized:**',
              '',
              '1. Check if SSH key is added to ssh-agent: ssh-add -l',
              '2. Add your key: ssh-add ~/.ssh/id_ed25519',
              '3. Test connection: ssh -T git@github.com',
              '4. Add your public key to GitHub: Settings → SSH and GPG keys',
            );
          }
        } else if (
          errorMsg.includes('Repository not found') ||
          errorMsg.includes('not found')
        ) {
          // Check if user is authenticated in the app
          const authState = AuthStateManager.getInstance().getFullState();
          const isAppAuthenticated = authState.isAuthenticated;

          userMessage = 'Repository not found or access denied.';
          suggestions.push(
            '**The repository may not exist or you lack access:**',
            '',
            '• Verify the repository URL is correct',
            '• Check if the repository is private and you have access',
          );

          if (!isAppAuthenticated) {
            suggestions.push(
              '• Log into Principal if this is a private repository (Settings → Log In with GitHub)',
            );
          } else {
            suggestions.push(
              '• Verify your GitHub account has access to this repository',
            );
          }
        } else if (
          errorMsg.includes('Permission denied') ||
          errorMsg.includes('permission')
        ) {
          userMessage = 'Permission denied.';
          if (diagnostics.authMethod === 'SSH') {
            suggestions.push(
              '**SSH permission denied:**',
              '',
              '1. Verify your SSH key is added to GitHub',
              '2. Test: ssh -T git@github.com',
              '3. Check if you have repository access',
            );
          } else {
            // Check if user is authenticated in the app
            const authState = AuthStateManager.getInstance().getFullState();
            const isAppAuthenticated = authState.isAuthenticated;

            if (isAppAuthenticated) {
              suggestions.push(
                '**Access denied:**',
                '',
                '• Verify you have access to this repository on GitHub',
                '• Try logging out and back in to refresh credentials',
              );
            } else {
              suggestions.push(
                '**Access denied:**',
                '',
                '• This repository requires authentication',
                '• Log into Principal (Settings → Log In with GitHub)',
                '• Verify you have access to this repository',
              );
            }
          }
        } else if (
          errorMsg.includes('timeout') ||
          errorMsg.includes('timed out')
        ) {
          userMessage = 'Connection timed out.';
          suggestions.push(
            '**Network timeout occurred:**',
            '',
            '• Check your internet connection',
            '• The repository may be very large',
            '• Try again in a few moments',
          );
        } else if (errorMsg.includes('Could not resolve host')) {
          userMessage = 'Network error - Could not resolve host.';
          suggestions.push(
            '**DNS resolution failed:**',
            '',
            '• Check your internet connection',
            '• Verify the repository URL',
          );
        } else {
          // Unknown error - provide the raw message
          userMessage = `Clone failed: ${errorMsg.substring(0, 200)}`;
        }

        // Add diagnostics to suggestions
        suggestions.push(
          '',
          '**Diagnostic Information:**',
          `• URL: ${diagnostics.normalizedUrl || diagnostics.url}`,
          `• Auth Method: ${diagnostics.authMethod}`,
        );

        if (diagnostics.authMethod === 'SSH') {
          suggestions.push(
            `• SSH Agent Running: ${diagnostics.sshAgent ? 'Yes' : 'No'}`,
          );
        } else {
          suggestions.push(
            `• Using git credential helper (configured by Principal)`,
          );
        }

        // Throw enhanced error
        interface EnhancedError extends Error {
          details: string;
          diagnostics: CloneDiagnostics;
          originalError: string;
        }

        const enhancedError = new Error(userMessage) as EnhancedError;
        enhancedError.details = suggestions.join('\n');
        enhancedError.diagnostics = diagnostics;
        enhancedError.originalError = errorMsg;
        throw enhancedError;
      }
    },
  );

  // Check available authentication methods
  ipcMain.handle(
    GitEvents.CHECK_AUTH_METHODS,
    async (_event, remoteUrl: string) => {
      try {
        console.log(
          `[gitHandlers] Checking auth methods for ${remoteUrl} using GitRemoteService`,
        );

        // Extract service for better error messages
        let service = 'git';
        if (remoteUrl.includes('github.com')) {
          service = 'github.com';
        } else if (remoteUrl.includes('gitlab.com')) {
          service = 'gitlab.com';
        } else if (remoteUrl.includes('bitbucket.org')) {
          service = 'bitbucket.org';
        }

        // For GitHub, use API to check HTTPS access if user is authenticated
        // This is faster and more reliable than git ls-remote
        let githubApiResult: { available: boolean; reason?: string } | null =
          null;

        if (service === 'github.com') {
          const authState = AuthStateManager.getInstance().getFullState();
          const isAppAuthenticated =
            authState.isAuthenticated && authState.token;

          if (isAppAuthenticated && authState.token) {
            // Extract owner/repo from URL (handle repo names with dots like "crm.md")
            const match = remoteUrl.match(
              /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/,
            );
            if (match) {
              const [, owner, repoNameClean] = match;

              try {
                const response = await fetch(
                  `https://api.github.com/repos/${owner}/${repoNameClean}`,
                  {
                    headers: {
                      Authorization: `Bearer ${authState.token}`,
                      Accept: 'application/vnd.github.v3+json',
                    },
                  },
                );

                if (response.ok) {
                  githubApiResult = {
                    available: true,
                    reason: 'Repository is accessible via GitHub API',
                  };

                  // Configure git credentials for cloning (if not already configured)
                  const hasGitCredentials =
                    await GitCredentialHelper.areCredentialsConfigured();
                  if (!hasGitCredentials) {
                    try {
                      await GitCredentialHelper.configureGitCredentials(
                        authState.token,
                      );
                    } catch (error) {
                      console.error(
                        '[Git] Failed to configure git credentials:',
                        error,
                      );
                    }
                  }
                } else if (response.status === 404) {
                  githubApiResult = {
                    available: false,
                    reason: 'Repository not found or you do not have access',
                  };
                } else if (response.status === 403) {
                  githubApiResult = {
                    available: false,
                    reason: 'Access forbidden - check your GitHub permissions',
                  };
                } else {
                  githubApiResult = {
                    available: false,
                    reason: `GitHub API returned ${response.status}`,
                  };
                }
              } catch (error) {
                console.error('[Git] GitHub API check failed:', error);
                // Fall through to git ls-remote check
              }
            }
          }
        }

        // For GitHub with API access confirmed, check SSH keys locally instead of remote test
        // For other services, use GitRemoteService
        let sshResult: { available: boolean; reason?: string };

        if (githubApiResult && service === 'github.com') {
          // Check if SSH keys are configured locally
          try {
            const fs = await import('fs/promises');
            const os = await import('os');
            const path = await import('path');
            const sshDir = path.join(os.homedir(), '.ssh');

            // Check for common SSH key files
            const keyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa'];
            let hasKeys = false;

            for (const keyFile of keyFiles) {
              try {
                await fs.access(path.join(sshDir, keyFile));
                hasKeys = true;
                break;
              } catch {
                // Key file doesn't exist, continue
              }
            }

            if (hasKeys) {
              sshResult = {
                available: true,
                reason: 'SSH keys configured locally',
              };
            } else {
              sshResult = {
                available: false,
                reason: 'No SSH keys found in ~/.ssh',
              };
            }
          } catch (error) {
            console.error('[Git] Error checking SSH keys:', error);
            sshResult = {
              available: false,
              reason: 'Could not check SSH configuration',
            };
          }
        } else {
          // For non-GitHub or unauthenticated, use GitRemoteService
          const authResult = await GitRemoteService.checkAuthMethods(remoteUrl);
          sshResult = authResult.ssh;

          // Use HTTPS result from GitRemoteService if we don't have API result
          if (!githubApiResult) {
            githubApiResult = authResult.https;
          }
        }

        const result = {
          ssh: sshResult,
          https: githubApiResult || {
            available: false,
            reason: 'Unable to check HTTPS access',
          },
          suggestions: [] as string[],
        };

        // Generate helpful suggestions based on results
        if (!result.ssh.available && !result.https.available) {
          // Neither method works
          const authState = AuthStateManager.getInstance().getFullState();
          const isAppAuthenticated =
            authState.isAuthenticated && authState.token;

          const isGitHubPrivate =
            service === 'github.com' &&
            (result.https.reason?.includes('Authentication required') ||
              result.https.reason?.includes('private') ||
              result.ssh.reason?.includes('Authentication required') ||
              result.ssh.reason?.includes('private'));

          if (isGitHubPrivate) {
            if (isAppAuthenticated) {
              // User is authenticated but auth still failed
              // This likely means they don't have access to the repo
              result.suggestions.push(
                'You are logged into Principal, but cannot access this repository.',
                '',
                'Possible reasons:',
                '• You do not have access to this private repository',
                '• The repository does not exist',
                '• Your GitHub token needs to be refreshed',
                '',
                'Please verify:',
                '1. You have access to this repository on GitHub',
                '2. The repository URL is correct',
                '3. Try logging out and back in to refresh your credentials',
              );
            } else {
              // User not authenticated - guide them to log into the app
              result.suggestions.push(
                'This appears to be a private repository that requires authentication.',
                '',
                'To clone this repository:',
                '',
                '**Log into Principal:**',
                '1. Open Settings in Principal',
                '2. Click "Log In with GitHub"',
                '3. Complete the authentication',
                '4. Try cloning again',
                '',
                'Principal will automatically configure git credentials for you.',
              );
            }
          } else {
            result.suggestions.push(
              'Unable to access this repository. Possible reasons:',
              '• The repository is private and requires authentication',
              '• The repository URL is incorrect or does not exist',
              '• Network connectivity issues',
              '',
              'To set up authentication:',
              '• Log into Principal (Settings → Log In with GitHub)',
              '• For SSH: Generate keys with ssh-keygen and add to your Git provider',
            );
          }
        } else if (result.ssh.available && !result.https.available) {
          result.suggestions.push(
            'SSH access is available. The repository will be cloned using SSH.',
          );
        } else if (!result.ssh.available && result.https.available) {
          result.suggestions.push(
            'HTTPS access is available. The repository will be cloned using HTTPS.',
          );
        } else {
          // Both work
          result.suggestions.push(
            'Both SSH and HTTPS access are available.',
            "SSH will be used by default as it doesn't require entering credentials.",
          );
        }

        return result;
      } catch (error) {
        console.error('[Git] Failed to check auth methods:', error);
        return {
          ssh: { available: false, reason: 'Error checking SSH access' },
          https: { available: false, reason: 'Error checking HTTPS access' },
          suggestions: [
            'Unable to determine authentication methods. The clone may still work - please try.',
          ],
        };
      }
    },
  );

  ipcMain.handle(
    GitEvents.DELETE_GIT_REPOSITORY,
    async (event, repoPath: string) => {
      try {
        console.log(`[Git] Attempting to delete repository at: ${repoPath}`);

        // First verify it's actually a git repository
        const isGitRepo = await gitService.isGitRepository(repoPath);
        if (!isGitRepo) {
          console.error(`[Git] Path is not a git repository: ${repoPath}`);
          return {
            success: false,
            error: 'Directory is not a git repository',
          };
        }

        // Check for uncommitted changes with details
        const git = await gitClientFactory.getClient(repoPath);
        const statusResult = await git.raw(['status', '--porcelain']);
        const statusLines = statusResult
          .trim()
          .split('\n')
          .filter((line: string) => line.length > 0);
        const hasUncommittedChanges = statusLines.length > 0;

        // Parse status to get detailed change information
        const uncommittedFiles = {
          modified: [] as string[],
          added: [] as string[],
          deleted: [] as string[],
          untracked: [] as string[],
        };

        statusLines.forEach((line: string) => {
          const status = line.substring(0, 2);
          const file = line.substring(3);

          if (status.includes('M')) uncommittedFiles.modified.push(file);
          else if (status.includes('A')) uncommittedFiles.added.push(file);
          else if (status.includes('D')) uncommittedFiles.deleted.push(file);
          else if (status === '??') uncommittedFiles.untracked.push(file);
        });

        // Check for unpushed commits
        let unpushedCommits = 0;
        let unpushedCommitMessages: string[] = [];
        let currentBranch = 'HEAD';
        let hasRemote = false;

        try {
          // Get current branch
          const branchResult = await git.raw([
            'symbolic-ref',
            '--short',
            'HEAD',
          ]);
          currentBranch = branchResult.trim();

          // Check if branch has upstream
          const upstreamResult = await git.raw([
            'rev-parse',
            '--abbrev-ref',
            `${currentBranch}@{upstream}`,
          ]);

          if (upstreamResult.trim()) {
            hasRemote = true;

            // Count commits ahead of upstream
            const aheadResult = await git.raw([
              'rev-list',
              '--count',
              `${upstreamResult.trim()}..HEAD`,
            ]);
            unpushedCommits = parseInt(aheadResult.trim()) || 0;

            // Get unpushed commit messages (limit to 10)
            if (unpushedCommits > 0) {
              const commitMessages = await git.raw([
                'log',
                '--oneline',
                '--max-count=10',
                `${upstreamResult.trim()}..HEAD`,
              ]);
              unpushedCommitMessages = commitMessages
                .trim()
                .split('\n')
                .filter((msg: string) => msg.length > 0);
            }
          }
        } catch (error) {
          // Branch might not have upstream or other git errors
          console.log(`[Git] Could not check unpushed commits: ${error}`);
        }

        // Get repository name from path
        const repoName = repoPath.split('/').pop() || 'repository';

        // Return detailed warning info if there are changes or unpushed commits
        if (hasUncommittedChanges || unpushedCommits > 0) {
          const warningDetails = [];

          if (hasUncommittedChanges) {
            const totalChanges = statusLines.length;
            warningDetails.push(
              `${totalChanges} uncommitted change${totalChanges !== 1 ? 's' : ''}`,
            );

            if (uncommittedFiles.modified.length > 0) {
              warningDetails.push(
                `  - ${uncommittedFiles.modified.length} modified file${uncommittedFiles.modified.length !== 1 ? 's' : ''}`,
              );
            }
            if (uncommittedFiles.added.length > 0) {
              warningDetails.push(
                `  - ${uncommittedFiles.added.length} staged new file${uncommittedFiles.added.length !== 1 ? 's' : ''}`,
              );
            }
            if (uncommittedFiles.deleted.length > 0) {
              warningDetails.push(
                `  - ${uncommittedFiles.deleted.length} deleted file${uncommittedFiles.deleted.length !== 1 ? 's' : ''}`,
              );
            }
            if (uncommittedFiles.untracked.length > 0) {
              warningDetails.push(
                `  - ${uncommittedFiles.untracked.length} untracked file${uncommittedFiles.untracked.length !== 1 ? 's' : ''}`,
              );
            }
          }

          if (unpushedCommits > 0) {
            warningDetails.push(
              `${unpushedCommits} unpushed commit${unpushedCommits !== 1 ? 's' : ''} on branch '${currentBranch}'`,
            );
            if (unpushedCommitMessages.length > 0) {
              warningDetails.push('Recent unpushed commits:');
              unpushedCommitMessages.slice(0, 5).forEach((msg) => {
                warningDetails.push(`  ${msg}`);
              });
              if (unpushedCommits > 5) {
                warningDetails.push(`  ... and ${unpushedCommits - 5} more`);
              }
            }
          }

          console.warn(`[Git] ⚠️  Repository "${repoName}" has unsaved work:`);
          warningDetails.forEach((detail) => console.warn(`[Git] ${detail}`));
          console.warn(`[Git] Repository path: ${repoPath}`);
          return {
            success: false,
            error: 'warning',
            hasUncommittedChanges,
            uncommittedFiles,
            unpushedCommits,
            unpushedCommitMessages: unpushedCommitMessages.slice(0, 5),
            currentBranch,
            hasRemote,
            repoName,
            requiresConfirmation: true,
            warningMessage: warningDetails.join('\n'),
          };
        }

        // Safe to delete - no changes or unpushed commits
        console.log(`[Git] ✅ Repository "${repoName}" is safe to delete:`);
        console.log(`[Git]   - No uncommitted changes`);
        console.log(`[Git]   - No unpushed commits`);
        console.log(`[Git]   - Path: ${repoPath}`);

        const fs = await import('fs/promises');
        await fs.rm(repoPath, { recursive: true, force: true });

        console.log(`[Git] 🗑️  Successfully deleted repository "${repoName}"`);
        return {
          success: true,
          repoName,
          message: `Successfully deleted repository "${repoName}"`,
        };
      } catch (error: unknown) {
        console.error('[Git] Failed to delete repository:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete repository',
        };
      }
    },
  );

  ipcMain.handle(
    GitEvents.FORCE_DELETE_GIT_REPOSITORY,
    async (event, repoPath: string) => {
      try {
        console.log(`[Git] Force deleting repository at: ${repoPath}`);

        // First verify it's actually a git repository
        const isGitRepo = await gitService.isGitRepository(repoPath);
        if (!isGitRepo) {
          console.error(`[Git] Path is not a git repository: ${repoPath}`);
          return {
            success: false,
            error: 'Directory is not a git repository',
          };
        }

        // Force delete regardless of changes
        const fs = await import('fs/promises');
        await fs.rm(repoPath, { recursive: true, force: true });

        console.log(`[Git] Successfully force deleted repository: ${repoPath}`);
        return { success: true };
      } catch (error: unknown) {
        console.error('[Git] Failed to force delete repository:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete repository',
        };
      }
    },
  );

  // Scan folder for git repositories
  ipcMain.handle(
    GitEvents.SCAN_FOLDER_FOR_REPOS,
    async (_event, folderPath: string, maxDepth?: number) => {
      try {
        console.log(
          `[Git] Scanning folder for repos: ${folderPath} (depth: ${maxDepth ?? 2})`,
        );
        const scannerService = GitRepositoryScannerService.getInstance();
        const repos = await scannerService.scanFolderForGitRepos(
          folderPath,
          maxDepth ?? 2,
        );
        console.log(`[Git] Found ${repos.length} git repositories`);
        return repos;
      } catch (error) {
        console.error('[Git] Failed to scan folder for repos:', error);
        throw error;
      }
    },
  );

  // Get discovered (untracked) repositories
  ipcMain.handle(
    GitEvents.GET_DISCOVERED_REPOS,
    async (_event, basePath: string, maxDepth?: number) => {
      try {
        console.log(
          `[Git] Getting discovered repos in: ${basePath} (depth: ${maxDepth ?? 2})`,
        );
        const scannerService = GitRepositoryScannerService.getInstance();
        const discoveredRepos = await scannerService.getDiscoveredRepositories(
          basePath,
          maxDepth ?? 2,
        );
        console.log(
          `[Git] Found ${discoveredRepos.length} untracked repositories`,
        );
        return discoveredRepos;
      } catch (error) {
        console.error('[Git] Failed to get discovered repos:', error);
        throw error;
      }
    },
  );
}

// Export the service for cleanup
export function cleanupGitHandlers(): void {
  gitService.destroy();
}

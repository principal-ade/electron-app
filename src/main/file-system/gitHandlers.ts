import { ipcMain, net } from 'electron';
import { GitRepositoryService } from './gitRepositoryService';
import { gitClientFactory } from '../utils/gitClientFactory';
import { GitEvents } from '../../shared/main-process-api-interfaces/GitAPI';

// Create a single instance of the git service
const gitService = new GitRepositoryService();

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

// Helper function to test if a git URL is accessible
async function testGitAccess(
  url: string,
): Promise<{ accessible: boolean; message: string }> {
  // TODO: BLOCKING - ls-remote is a blocking network operation with 10s timeout
  // This should be moved to gitRemote cache slice
  // See: docs/design/GIT_REMOTE_INFORMATION_ARCHITECTURE.md

  console.warn(
    `[gitHandlers] testGitAccess is currently disabled to prevent blocking operations (url: ${url})`,
  );
  return {
    accessible: false,
    message:
      'Git access check disabled - will be implemented via gitRemote cache',
  };

  // try {
  //   // Don't normalize - use the URL as provided (already SSH or HTTPS)
  //   // Use ls-remote to test if we can access the repository
  //   // This doesn't clone, just checks if we can connect
  //   const git = await gitClientFactory.getClient(os.homedir());

  //   // Check if this is an SSH URL
  //   const isSSH = url.startsWith('git@') || url.includes('ssh://');

  //   // For SSH, we need certain env vars for authentication
  //   // For HTTPS, we need to prevent interactive prompts
  //   // Only pass serializable environment variables
  //   const baseEnv = {
  //     PATH: process.env.PATH,
  //     HOME: process.env.HOME,
  //     USER: process.env.USER,
  //     SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
  //     SSH_AGENT_PID: process.env.SSH_AGENT_PID,
  //   };

  //   const envVars = isSSH ?
  //     baseEnv :
  //     {
  //       ...baseEnv,
  //       GIT_TERMINAL_PROMPT: '0',
  //       GIT_ASKPASS: '/bin/echo',
  //       GCM_INTERACTIVE: 'never'
  //     };

  //   // Use a shorter timeout for the auth check
  //   // Note: We remove --exit-code because it returns 2 for empty repos
  //   // Instead, we'll check for authentication errors in stderr
  //   const result = await Promise.race([
  //     git.raw(
  //       ['ls-remote', url],
  //       {
  //         env: envVars,
  //         timeout: 10000  // Give SSH a bit more time (10 seconds)
  //       }
  //     ),
  //     new Promise<string>((_, reject) =>
  //       setTimeout(() => reject(new Error('Authentication timeout')), 10000)
  //     )
  //   ]);

  //   // If we get here without error, the URL is accessible
  //   // Empty result is OK (means empty repository)
  //   // Check for actual error messages in the result
  //   if (result !== undefined && !result.includes('fatal:') && !result.includes('Authentication failed')) {
  //     // Even empty string is OK - it means we connected but repo is empty
  //     return { accessible: true, message: 'Authentication successful' };
  //   }

  //   // Check for specific error messages
  //   if (
  //     result.includes('Authentication failed') ||
  //     result.includes('Invalid username or password')
  //   ) {
  //     return { accessible: false, message: 'Authentication required' };
  //   }

  //   if (result.includes('Permission denied')) {
  //     return {
  //       accessible: false,
  //       message: 'Permission denied - check your SSH keys or credentials',
  //     };
  //   }

  //   if (result.includes('Could not read from remote')) {
  //     return {
  //       accessible: false,
  //       message: 'Could not connect to remote repository',
  //     };
  //   }

  //   return { accessible: false, message: 'Unable to access repository' };
  // } catch (error: unknown) {
  //   // Parse the error message for common issues
  //   const errorMsg = error instanceof Error ? error.message : String(error);

  //   if (errorMsg.includes('Authentication timeout')) {
  //     return { accessible: false, message: 'Authentication required - repository is private' };
  //   }

  //   if (errorMsg.includes('Repository not found') || errorMsg.includes('404')) {
  //     return { accessible: false, message: 'Repository not found or private' };
  //   }

  //   if (errorMsg.includes('Authentication')) {
  //     return { accessible: false, message: 'Authentication required' };
  //   }

  //   if (errorMsg.includes('Permission denied')) {
  //     return { accessible: false, message: 'Permission denied - check SSH keys' };
  //   }

  //   if (errorMsg.includes('Host key verification failed')) {
  //     return { accessible: false, message: 'SSH host key verification failed - run: ssh-keyscan github.com >> ~/.ssh/known_hosts' };
  //   }

  //   return { accessible: false, message: `Connection failed: ${errorMsg.substring(0, 100)}` };
  // }
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

  // Get git status
  ipcMain.handle(GitEvents.GET_STATUS, async (_event, directory: string) => {
    try {
      return await gitService.getGitStatus(directory);
    } catch (error) {
      console.error('[Git] Failed to get git status:', error);
      throw error;
    }
  });

  // Get detailed changes (lines added/removed, files created/modified/deleted)
  ipcMain.handle(
    GitEvents.GET_DETAILED_CHANGES,
    async (_event, directory: string, files?: string[]) => {
      try {
        return await gitService.getDetailedChanges(directory, files);
      } catch (error) {
        console.error('[Git] Failed to get detailed changes:', error);
        throw error;
      }
    },
  );

  // Get uncommitted changes
  ipcMain.handle(
    GitEvents.GET_UNCOMMITTED_CHANGES,
    async (_event, directory: string) => {
      try {
        return await gitService.getUncommittedChanges(directory);
      } catch (error) {
        console.error('[Git] Failed to get uncommitted changes:', error);
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
      try {
        // Normalize the URL first
        const normalizedUrl = normalizeGitUrl(remoteUrl);

        // Use gitClientFactory to clone the repository
        const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
        const git = await gitClientFactory.getClient(parentDir);

        // Clone the repository with normalized URL and authentication handling
        // Check if this is an SSH URL
        const isSSH =
          normalizedUrl.startsWith('git@') || normalizedUrl.includes('ssh://');

        // Only pass serializable environment variables
        const baseEnv = {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          USER: process.env.USER,
          SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
          SSH_AGENT_PID: process.env.SSH_AGENT_PID,
        };

        const cloneEnv = isSSH
          ? baseEnv
          : {
              ...baseEnv,
              GIT_TERMINAL_PROMPT: '0',
              GIT_ASKPASS: '/bin/echo',
              GCM_INTERACTIVE: 'never',
            };

        await git.raw(['clone', normalizedUrl, targetPath], {
          env: cloneEnv,
          timeout: 120000, // 2 minutes for clone operation
        });

        return true;
      } catch (error) {
        console.error('[Git] Failed to clone repository:', error);
        throw error;
      }
    },
  );

  // Check available authentication methods
  ipcMain.handle(
    GitEvents.CHECK_AUTH_METHODS,
    async (_event, remoteUrl: string) => {
      try {
        const result = {
          ssh: { available: false, reason: '' },
          https: { available: false, reason: '' },
          suggestions: [] as string[],
        };

        // Extract owner/repo and service from ANY input format
        let service = '';
        let owner = '';
        let repo = '';

        // First, normalize if it's a browser URL (remove /tree/, /blob/, etc)
        let cleanUrl = remoteUrl.replace(/\/+$/, '');
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
          const index = cleanUrl.indexOf(pattern);
          if (index !== -1) {
            cleanUrl = cleanUrl.substring(0, index);
            break;
          }
        }

        // Try to extract from SSH format (git@service:owner/repo.git)
        let match = cleanUrl.match(/git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
        if (match) {
          service = match[1];
          owner = match[2];
          repo = match[3].replace(/\.git$/, '');
        }

        // Try to extract from HTTPS format (https://service/owner/repo.git)
        if (!owner) {
          match = cleanUrl.match(
            /https?:\/\/([^/]+)\/([^/]+)\/([^/.]+)(?:\.git)?/,
          );
          if (match) {
            service = match[1];
            owner = match[2];
            repo = match[3].replace(/\.git$/, '');
          }
        }

        // Try SSH with protocol format (ssh://git@service/owner/repo.git)
        if (!owner) {
          match = cleanUrl.match(
            /ssh:\/\/git@([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/,
          );
          if (match) {
            service = match[1];
            owner = match[2];
            repo = match[3].replace(/\.git$/, '');
          }
        }

        // If we couldn't extract owner/repo, return error
        if (!owner || !repo || !service) {
          return {
            ssh: { available: false, reason: 'Could not parse repository URL' },
            https: {
              available: false,
              reason: 'Could not parse repository URL',
            },
            suggestions: [
              'Invalid repository URL format. Please provide a valid Git URL.',
            ],
          };
        }

        // Now construct both SSH and HTTPS URLs from the extracted info
        const httpsUrl = `https://${service}/${owner}/${repo}.git`;
        const sshUrl = `git@${service}:${owner}/${repo}.git`;

        // Test both URLs in parallel for better performance
        const [httpsTest, sshTest] = await Promise.all([
          testGitAccess(httpsUrl),
          testGitAccess(sshUrl),
        ]);

        result.https.available = httpsTest.accessible;
        result.https.reason = httpsTest.message;
        result.ssh.available = sshTest.accessible;
        result.ssh.reason = sshTest.message;

        // Generate helpful suggestions based on results
        if (!result.ssh.available && !result.https.available) {
          // Neither method works - provide detailed guidance
          const isGitHubPrivate =
            service.includes('github.com') &&
            (result.https.reason?.includes('Authentication required') ||
              result.ssh.reason?.includes('Authentication required'));

          if (isGitHubPrivate) {
            result.suggestions.push(
              'This appears to be a private repository that requires authentication.',
              '',
              'To clone this repository, you need to set up authentication:',
              '',
              '**Option 1: GitHub CLI (Recommended)**',
              '1. Install GitHub CLI: brew install gh',
              '2. Authenticate: gh auth login',
              '3. Try cloning again',
              '',
              '**Option 2: Personal Access Token**',
              '1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens',
              '2. Generate a new token with "repo" scope',
              '3. Use the token as your password when prompted',
              '',
              '**Option 3: SSH Keys**',
              '1. Generate SSH key: ssh-keygen -t ed25519 -C "your_email@example.com"',
              '2. Add to SSH agent: ssh-add ~/.ssh/id_ed25519',
              '3. Add public key to GitHub: Settings → SSH and GPG keys',
              '4. Use the SSH URL instead: git@github.com:owner/repo.git',
            );
          } else {
            result.suggestions.push(
              'Unable to access this repository. Possible reasons:',
              '• The repository is private and requires authentication',
              '• The repository URL is incorrect or does not exist',
              '• Network connectivity issues',
              '',
              'To set up authentication:',
              '• For GitHub: Use gh auth login or a Personal Access Token',
              '• For SSH: Generate keys with ssh-keygen and add to your Git provider',
              '• For HTTPS: Configure a credential helper or use a personal access token',
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
}

// Export the service for cleanup
export function cleanupGitHandlers(): void {
  gitService.destroy();
}

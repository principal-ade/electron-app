import { ipcMain, net } from 'electron';
import { GitRepositoryService } from './gitRepositoryService';
import { gitClientFactory } from '../utils/gitClientFactory';
import { GitEvents } from '../../shared/main-process-api-interfaces/GitAPI';
import * as os from 'os';

// Create a single instance of the git service
const gitService = new GitRepositoryService();

// Helper function to test if a git URL is accessible
async function testGitAccess(
  url: string,
): Promise<{ accessible: boolean; message: string }> {
  try {
    console.log(`[Git] Testing access to ${url}`);
    // Use ls-remote to test if we can access the repository
    // This doesn't clone, just checks if we can connect
    const git = await gitClientFactory.getClient(os.homedir());
    const result = await git.raw(['ls-remote', '--exit-code', '--heads', url]);

    // If we get here without error, the URL is accessible
    if (
      result &&
      !result.includes('fatal:') &&
      !result.includes('Authentication failed')
    ) {
      return { accessible: true, message: 'Authentication successful' };
    }

    // Check for specific error messages
    if (
      result.includes('Authentication failed') ||
      result.includes('Invalid username or password')
    ) {
      return { accessible: false, message: 'Authentication required' };
    }

    if (result.includes('Permission denied')) {
      return {
        accessible: false,
        message: 'Permission denied - check your SSH keys or credentials',
      };
    }

    if (result.includes('Could not read from remote')) {
      return {
        accessible: false,
        message: 'Could not connect to remote repository',
      };
    }

    return { accessible: false, message: 'Unable to access repository' };
  } catch (error: unknown) {
    // Parse the error message for common issues
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes('Repository not found') || errorMsg.includes('404')) {
      return { accessible: false, message: 'Repository not found or private' };
    }

    if (errorMsg.includes('Authentication')) {
      return { accessible: false, message: 'Authentication required' };
    }

    return { accessible: false, message: 'Connection failed' };
  }
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

  // Stage files
  ipcMain.handle(
    GitEvents.STAGE_FILES,
    async (_event, directory: string, files: string[]) => {
      try {
        await gitService.stageFiles(directory, files);
        return true;
      } catch (error) {
        console.error('[Git] Failed to stage files:', error);
        throw error;
      }
    },
  );

  // Create commit
  ipcMain.handle(
    GitEvents.CREATE_COMMIT,
    async (_event, directory: string, message: string) => {
      try {
        return await gitService.createCommit(directory, message);
      } catch (error) {
        console.error('[Git] Failed to create commit:', error);
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
        console.error('[Git] Failed to execute git command:', error);
        throw error;
      }
    },
  );

  // Clone repository
  ipcMain.handle(
    GitEvents.CLONE_REPOSITORY,
    async (_event, remoteUrl: string, targetPath: string) => {
      try {
        console.log(`[Git] Cloning repository ${remoteUrl} to ${targetPath}`);

        // Use simple-git to clone the repository
        const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
        const git = await gitClientFactory.getClient(parentDir);

        // Clone the repository
        await git.clone(remoteUrl, targetPath);

        console.log(`[Git] Clone successful`);

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
        console.log(`[Git] Checking auth methods for ${remoteUrl}`);

        const result = {
          ssh: { available: false, reason: '' },
          https: { available: false, reason: '' },
          suggestions: [] as string[],
        };

        // Parse the URL to determine the service (GitHub, GitLab, etc)
        const isGitHub = remoteUrl.includes('github.com');
        const isGitLab = remoteUrl.includes('gitlab.com');

        // Test HTTPS access (always test the provided URL first)
        const httpsTest = await testGitAccess(remoteUrl);
        result.https.available = httpsTest.accessible;
        result.https.reason = httpsTest.message;

        // Create SSH URL variant and test it
        let sshUrl = '';
        if (isGitHub) {
          // Convert https://github.com/owner/repo to git@github.com:owner/repo.git
          const match = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
          if (match) {
            sshUrl = `git@github.com:${match[1]}/${match[2]}.git`;
          }
        } else if (isGitLab) {
          // Convert https://gitlab.com/owner/repo to git@gitlab.com:owner/repo.git
          const match = remoteUrl.match(/gitlab\.com\/([^/]+)\/([^/.]+)/);
          if (match) {
            sshUrl = `git@gitlab.com:${match[1]}/${match[2]}.git`;
          }
        } else {
          // Generic conversion for other git services
          const match = remoteUrl.match(
            /https?:\/\/([^/]+)\/([^/]+)\/([^/.]+)/,
          );
          if (match) {
            sshUrl = `git@${match[1]}:${match[2]}/${match[3]}.git`;
          }
        }

        // Test SSH access if we could construct an SSH URL
        if (sshUrl) {
          const sshTest = await testGitAccess(sshUrl);
          result.ssh.available = sshTest.accessible;
          result.ssh.reason = sshTest.message;
        } else {
          result.ssh.available = false;
          result.ssh.reason = 'Could not construct SSH URL for this repository';
        }

        // Generate helpful suggestions based on results
        if (!result.ssh.available && !result.https.available) {
          // Neither method works
          result.suggestions.push(
            'Unable to access this repository. This could mean:',
            '• The repository is private and requires authentication',
            '• The repository URL is incorrect',
            '• Network connectivity issues',
            '',
            'To set up authentication:',
            '1. For SSH: Generate keys with: ssh-keygen -t ed25519',
            '   Then add the public key to your GitHub/GitLab account',
            '2. For HTTPS: Use a personal access token or configure:',
            '   git config --global credential.helper store',
          );
        } else if (result.ssh.available && !result.https.available) {
          result.suggestions.push(
            'SSH access is working. Using SSH URL for cloning.',
          );
        } else if (!result.ssh.available && result.https.available) {
          result.suggestions.push(
            'HTTPS access is working. Using HTTPS URL for cloning.',
          );
        } else {
          // Both work
          result.suggestions.push(
            'Both SSH and HTTPS access are available.',
            "SSH is recommended for frequent use as it doesn't require entering credentials.",
          );
        }

        console.log(`[Git] Auth check result:`, result);
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

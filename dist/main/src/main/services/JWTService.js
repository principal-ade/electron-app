import { ipcMain } from 'electron';
const jwt = require('jsonwebtoken');
import fetch from 'node-fetch';
const JWT_SECRET = process.env.SYNC_JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '1h'; // 1 hour expiry
export class JWTService {
    /**
     * Validate GitHub token and get user repositories with permissions
     */
    static async validateGitHubToken(token) {
        try {
            // Get user info
            const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (!userResponse.ok) {
                throw new Error('Invalid GitHub token');
            }
            const user = await userResponse.json();
            // Get repositories with permissions
            // This includes repos where user is collaborator, including organization repos
            const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (!reposResponse.ok) {
                throw new Error('Failed to fetch repositories');
            }
            const repos = await reposResponse.json();
            console.log(`[JWTService] Found ${repos.length} repositories for user`);
            console.log(`[JWTService] Repository names:`, repos.map((r) => r.full_name).slice(0, 10));
            // Map repositories to our permission format
            const repositories = repos.map((repo) => {
                const permissions = [];
                // Determine permissions based on GitHub's response
                if (repo.permissions) {
                    if (repo.permissions.pull)
                        permissions.push('pull');
                    if (repo.permissions.push)
                        permissions.push('push');
                    if (repo.permissions.admin)
                        permissions.push('admin');
                }
                else {
                    // Fallback for owned repos
                    if (repo.owner.login === user.login) {
                        permissions.push('pull', 'push', 'admin');
                    }
                    else {
                        permissions.push('pull'); // Default to read-only
                    }
                }
                return {
                    repoId: repo.full_name, // Format: "owner/repo"
                    permissions
                };
            });
            return { user, repositories };
        }
        catch (error) {
            console.error('GitHub validation error:', error);
            throw error;
        }
    }
    /**
     * Create JWT from GitHub token
     */
    static async createJWT(githubToken) {
        try {
            // Validate GitHub token and get permissions
            const { user, repositories } = await this.validateGitHubToken(githubToken);
            // Create JWT payload
            const payload = {
                userId: user.login,
                githubId: user.id.toString(),
                repositories
            };
            // Sign JWT
            const token = jwt.sign(payload, JWT_SECRET, {
                expiresIn: JWT_EXPIRY
            });
            return {
                success: true,
                token,
                user: {
                    userId: user.login,
                    githubHandle: user.login,
                    email: user.email,
                    avatar: user.avatar_url,
                    repositories: repositories.map(r => r.repoId)
                }
            };
        }
        catch (error) {
            console.error('JWT creation error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create JWT'
            };
        }
    }
    /**
     * Verify and decode JWT
     */
    static verifyJWT(token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            return {
                valid: true,
                payload
            };
        }
        catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Invalid token'
            };
        }
    }
    /**
     * Check if user has specific permission for a repository
     */
    static hasPermission(payload, repoId, requiredPermission) {
        const repo = payload.repositories.find(r => r.repoId === repoId);
        if (!repo)
            return false;
        return repo.permissions.includes(requiredPermission);
    }
    /**
     * Register IPC handlers
     */
    static registerHandlers() {
        // Create JWT from GitHub token
        ipcMain.handle('jwt:create', async (_, githubToken) => {
            return this.createJWT(githubToken);
        });
        // Verify JWT
        ipcMain.handle('jwt:verify', async (_, token) => {
            return this.verifyJWT(token);
        });
        // Create JWT for git-sync (includes repo-specific claims)
        ipcMain.handle('jwt:create-for-sync', async (_, params) => {
            try {
                const result = await this.createJWT(params.githubToken);
                if (!result.success || !result.token) {
                    return result;
                }
                // Verify user has access to the specific repository
                const { payload } = this.verifyJWT(result.token);
                if (!payload) {
                    return {
                        success: false,
                        error: 'Failed to verify JWT'
                    };
                }
                console.log(`[JWTService] Checking access for repository: ${params.repoId}`);
                console.log(`[JWTService] Available repositories:`, payload.repositories.map(r => r.repoId));
                const hasAccess = this.hasPermission(payload, params.repoId, 'pull');
                if (!hasAccess) {
                    console.log(`[JWTService] Access denied for ${params.repoId}. User repositories:`, payload.repositories.map(r => `${r.repoId} (${r.permissions.join(', ')})`));
                    return {
                        success: false,
                        error: `No access to repository: ${params.repoId}`
                    };
                }
                console.log(`[JWTService] Access granted for ${params.repoId}`);
                return result;
            }
            catch (error) {
                console.error('Error creating sync JWT:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create JWT'
                };
            }
        });
    }
}

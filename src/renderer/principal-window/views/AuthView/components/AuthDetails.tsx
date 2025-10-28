import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  LogIn,
  LogOut,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Key,
  Building,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { gitSyncConnectionManager } from '../../../../services/git-sync/GitSyncConnectionManager';
import { GithubService } from '../../../../main-process-api/GithubService';
import { SSHSetupService } from '../../../../main-process-api/SSHSetupService';
import { AuthenticationService } from '../../../../main-process-api/AuthenticationService';
import { SSHSetupWizard } from '../../RepositoryExplorer/components/SSHSetupWizard';
import { KeychainPermissionModal } from '../../../../components/KeychainPermissionModal';
import type { TokenInfo, GitHubSSHKey } from '../../../../../shared/main-process-api-interfaces/GitHubAPI';

// Mapping of GitHub scopes to human-readable descriptions
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  // Repository scopes
  repo: 'Full control of private repositories',
  'repo:status': 'Access commit status',
  repo_deployment: 'Access deployment status',
  public_repo: 'Access public repositories',
  'repo:invite': 'Access repository invitations',
  security_events: 'Read and write security events',
  delete_repo: 'Delete repositories',

  // Workflow scope
  workflow: 'Update GitHub Actions workflows',

  // Package scopes
  'write:packages': 'Upload packages to GitHub Package Registry',
  'read:packages': 'Download packages from GitHub Package Registry',
  'delete:packages': 'Delete packages from GitHub Package Registry',

  // Organization scopes
  'admin:org': 'Full control of organizations',
  'write:org': 'Read and write organization data',
  'read:org': 'Read organization data',
  'manage_runners:org': 'Manage organization runners',

  // User scopes
  user: 'Update all user data',
  'read:user': 'Read all user profile data',
  'user:email': 'Access user email addresses',
  'user:follow': 'Follow and unfollow users',

  // GPG key scopes
  'admin:gpg_key': 'Full control of user GPG keys',
  'write:gpg_key': 'Write user GPG keys',
  'read:gpg_key': 'Read user GPG keys',

  // SSH key scopes
  'admin:ssh_signing_key': 'Full control of user SSH signing keys',
  'write:ssh_signing_key': 'Write user SSH signing keys',
  'read:ssh_signing_key': 'Read user SSH signing keys',

  // Gist scope
  gist: 'Create gists',

  // Notifications scope
  notifications: 'Access notifications',

  // Project scopes
  'admin:project': 'Full control of projects',
  'read:project': 'Read projects',
  'write:project': 'Write projects',

  // Discussion scopes
  'read:discussion': 'Read discussions',
  'write:discussion': 'Write discussions',
};
import { ShellService } from '../../../../main-process-api/ShellService';

interface GitHubUser {
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

interface AuthDetailsProps {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  login: (forceRetry?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  isLoggingIn: boolean;
  loginError: string | null;
  clearLoginError: () => void;
}

export const AuthDetails: React.FC<AuthDetailsProps> = ({
  isAuthenticated,
  user: authUser,
  login,
  logout,
  isLoggingIn,
  loginError,
  clearLoginError,
}) => {
  const { theme } = useTheme();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loadingTokenInfo, setLoadingTokenInfo] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [githubSSHKeys, setGitHubSSHKeys] = useState<GitHubSSHKey[]>([]);
  const [loadingSSHInfo, setLoadingSSHInfo] = useState(false);
  const [sshKeysError, setSSHKeysError] = useState<string | null>(null);
  const [needsSSHPermission, setNeedsSSHPermission] = useState(false);
  const [showSSHSetup, setShowSSHSetup] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, unknown> | null>(null);
  const [loadingTokenMetadata, setLoadingTokenMetadata] = useState(false);
  const [testingRefresh, setTestingRefresh] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showKeychainModal, setShowKeychainModal] = useState(false);
  const [keychainErrorType, setKeychainErrorType] = useState<
    'timeout' | 'permission_denied' | 'not_available' | 'unknown' | null
  >(null);
  const [keychainStatus, setKeychainStatus] = useState<{
    available: boolean;
    initialized: boolean;
    error?: string;
    errorType?: string;
  } | null>(null);
  const [loadingKeychainStatus, setLoadingKeychainStatus] = useState(false);

  const cardBackground = theme.colors.backgroundTertiary;
  const secondaryBackground = theme.colors.backgroundSecondary;

  // Define fetch functions with useCallback to prevent unnecessary re-renders
  const fetchTokenInfo = useCallback(async () => {
    setLoadingTokenInfo(true);
    setTokenError(null);
    try {
      // Get token info directly from the GithubService
      const info = await GithubService.getTokenInfo();
      if (info) {
        setTokenInfo(info);
      } else {
        console.warn('[AuthDetails] Failed to get token info');
        setTokenError('Failed to fetch token information');
      }
    } catch (error) {
      console.error('[AuthDetails] Failed to fetch token info:', error);
      setTokenError('Failed to fetch token permissions');
    } finally {
      setLoadingTokenInfo(false);
    }
  }, []);

  const fetchSSHKeyInfo = useCallback(async () => {
    setLoadingSSHInfo(true);
    setSSHKeysError(null);
    setNeedsSSHPermission(false);
    try {
      // Fetch SSH keys from GitHub API
      const response = await GithubService.getUserSSHKeys();

      if (response.success && response.data) {
        setGitHubSSHKeys(response.data);
      } else {
        setGitHubSSHKeys([]);
        if (response.needsPermission) {
          setNeedsSSHPermission(true);
          setSSHKeysError(response.error || 'Missing required GitHub permissions');
        } else if (response.error) {
          setSSHKeysError(response.error);
        }
      }
    } catch (error) {
      console.error('[AuthDetails] Failed to fetch SSH keys from GitHub:', error);
      setGitHubSSHKeys([]);
      setSSHKeysError('Failed to load SSH keys');
    } finally {
      setLoadingSSHInfo(false);
    }
  }, []);

  const fetchTokenMetadata = useCallback(async () => {
    setLoadingTokenMetadata(true);
    try {
      const metadata = await AuthenticationService.getTokenMetadata();
      setTokenMetadata(metadata);
    } catch (error) {
      console.error('[AuthDetails] Failed to fetch token metadata:', error);
    } finally {
      setLoadingTokenMetadata(false);
    }
  }, []);

  const fetchKeychainStatus = useCallback(async () => {
    setLoadingKeychainStatus(true);
    try {
      const status = await AuthenticationService.checkKeychainStatus();
      setKeychainStatus(status);
    } catch (error) {
      console.error('[AuthDetails] Failed to fetch keychain status:', error);
      setKeychainStatus({
        available: false,
        initialized: false,
        error: 'Failed to check keychain status',
        errorType: 'unknown',
      });
    } finally {
      setLoadingKeychainStatus(false);
    }
  }, []);

  // Detect keychain-related errors
  useEffect(() => {
    if (loginError) {
      const errorLower = loginError.toLowerCase();
      if (
        errorLower.includes('keychain') ||
        errorLower.includes('timeout') ||
        errorLower.includes('permission') ||
        errorLower.includes('encryption')
      ) {
        // Determine error type from message
        if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
          setKeychainErrorType('timeout');
        } else if (
          errorLower.includes('denied') ||
          errorLower.includes('permission')
        ) {
          setKeychainErrorType('permission_denied');
        } else if (
          errorLower.includes('not available') ||
          errorLower.includes('unavailable')
        ) {
          setKeychainErrorType('not_available');
        } else {
          setKeychainErrorType('unknown');
        }
        setShowKeychainModal(true);
      }
    }
  }, [loginError]);

  // Fetch token info when authenticated
  useEffect(() => {
    if (isAuthenticated && authUser) {
      fetchTokenInfo();
      fetchSSHKeyInfo();
      fetchTokenMetadata();
    } else {
      setTokenInfo(null);
      setGitHubSSHKeys([]);
      setTokenMetadata(null);
    }
    // Always fetch keychain status (regardless of auth state)
    fetchKeychainStatus();
  }, [isAuthenticated, authUser, fetchTokenInfo, fetchSSHKeyInfo, fetchTokenMetadata, fetchKeychainStatus]);

  const formatScope = (scope: string): string => {
    return SCOPE_DESCRIPTIONS[scope] || scope.replace(/[_:]/g, ' ');
  };

  const handleTestRefresh = async () => {
    setTestingRefresh(true);
    setRefreshResult(null);
    try {
      const result = await AuthenticationService.testRefreshToken();
      if (result.success) {
        setRefreshResult({
          success: true,
          message: `Token refreshed successfully! New expiry: ${result.newExpiresAt ? new Date(result.newExpiresAt).toLocaleString() : 'Unknown'}`,
        });
        // Refresh metadata to show updated info
        await fetchTokenMetadata();
      } else {
        setRefreshResult({
          success: false,
          message: result.error || 'Failed to refresh token',
        });
      }
    } catch (error) {
      console.error('[AuthDetails] Refresh test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to test refresh';
      setRefreshResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setTestingRefresh(false);
    }
  };

  const handleTestSSHConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const result = await SSHSetupService.testConnection();
      setConnectionTestResult(result);
    } catch (error) {
      console.error('[AuthDetails] Connection test failed:', error);
      setConnectionTestResult({
        success: false,
        message: 'Failed to test connection',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSSHSetupComplete = async () => {
    setShowSSHSetup(false);
    await fetchSSHKeyInfo();
    // Automatically test the connection after setup
    await handleTestSSHConnection();
  };

  const handleKeychainModalClose = () => {
    setShowKeychainModal(false);
    clearLoginError();
  };

  const handleKeychainRetry = async () => {
    try {
      await login(true); // Force retry
    } catch (error) {
      console.error('[AuthDetails] Retry login failed:', error);
    }
  };

  const handleTestKeychainAccess = async () => {
    setLoadingKeychainStatus(true);
    try {
      const result = await AuthenticationService.testKeychainAccess();

      if (result.success) {
        // Refresh status after successful test
        await fetchKeychainStatus();
        setConnectionTestResult({
          success: true,
          message: 'Keychain access test passed! Credentials can be stored securely.',
        });
      } else {
        setConnectionTestResult({
          success: false,
          message: `Keychain test failed: ${result.error || 'Unknown error'}`,
        });
      }
    } catch (error) {
      console.error('[AuthDetails] Keychain test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionTestResult({
        success: false,
        message: `Failed to test keychain: ${errorMessage}`,
      });
    } finally {
      setLoadingKeychainStatus(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        padding: '32px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            marginBottom: '32px',
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Shield size={32} />
            Account & Authentication
          </h1>
          <p
            style={{
              color: theme.colors.textSecondary,
              fontSize: '14px',
            }}
          >
            Manage your authentication status and account settings
          </p>
        </div>

        {/* Authentication Status Card */}
        <div
          style={{
            backgroundColor: cardBackground,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Authentication Status
              {isAuthenticated ? (
                <CheckCircle
                  size={20}
                  style={{ color: theme.colors.success || '#10b981' }}
                />
              ) : (
                <XCircle
                  size={20}
                  style={{ color: theme.colors.textSecondary }}
                />
              )}
            </h2>
          </div>

          {isAuthenticated && authUser ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                {authUser.avatarUrl ? (
                  <img
                    src={authUser.avatarUrl}
                    alt={authUser.login}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${theme.colors.border}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: theme.colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.colors.background,
                      fontWeight: 600,
                      fontSize: '24px',
                    }}
                  >
                    {authUser.login[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h3
                    style={{
                      fontSize: '20px',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  >
                    {authUser.name || authUser.login}
                  </h3>
                  <p
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: '14px',
                    }}
                  >
                    @{authUser.login} · GitHub Account
                  </p>
                  {authUser.email && (
                    <p
                      style={{
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
                        marginTop: '4px',
                      }}
                    >
                      {authUser.email}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    await logout();
                    gitSyncConnectionManager.disconnectAll();
                    console.info('Logged out successfully');
                  } catch (error) {
                    console.error('Logout failed:', error);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: theme.colors.error || '#ef4444',
                  color: theme.colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <p
                style={{
                  marginBottom: '20px',
                  fontSize: '14px',
                  color: theme.colors.textSecondary,
                }}
              >
                You are currently not authenticated. Sign in with your GitHub
                account to access repository features and synchronization.
              </p>

              {loginError &&
                loginError !== 'Authentication already in progress' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: theme.colors.error
                        ? `${theme.colors.error}20`
                        : '#ef444420',
                      border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        color: theme.colors.error || '#ef4444',
                      }}
                    >
                      {loginError}
                    </span>
                    <button
                      onClick={() => clearLoginError()}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: theme.colors.error || '#ef4444',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        lineHeight: 1,
                      }}
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                )}

              <button
                onClick={async () => {
                  try {
                    const forceRetry =
                      loginError === 'Authentication already in progress';
                    await login(forceRetry);
                    console.info('Login completed successfully');
                  } catch (error: unknown) {
                    console.error('Login error:', error);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: isLoggingIn
                    ? theme.colors.backgroundTertiary
                    : theme.colors.primary,
                  color: isLoggingIn
                    ? theme.colors.textSecondary
                    : theme.colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isLoggingIn ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isLoggingIn ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoggingIn) e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (!isLoggingIn) e.currentTarget.style.opacity = '1';
                }}
                title={
                  isLoggingIn
                    ? 'Authenticating...'
                    : loginError === 'Authentication already in progress'
                      ? 'Click to retry'
                      : 'Login with GitHub'
                }
                disabled={
                  isLoggingIn &&
                  loginError !== 'Authentication already in progress'
                }
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>
                      {loginError === 'Authentication already in progress'
                        ? 'Retry Sign In'
                        : 'Sign In with GitHub'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Token Permissions Card */}
        {isAuthenticated && tokenInfo && (
          <div
            style={{
              backgroundColor: cardBackground,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Key size={20} />
                Token Permissions
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    // Open GitHub settings to manage authorized applications
                    // (WorkOS uses this GitHub OAuth app for authentication)
                    await ShellService.openExternal(
                      'https://github.com/settings/connections/applications/Ov23liw7kWJ0kctIrSs3',
                    );
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: theme.colors.primary,
                    border: 'none',
                    borderRadius: '6px',
                    color: theme.colors.background,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  title="Manage permissions granted to this app"
                >
                  <ExternalLink size={14} />
                  Manage Permissions
                </button>
                <button
                  onClick={fetchTokenInfo}
                  disabled={loadingTokenInfo}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                    cursor: loadingTokenInfo ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingTokenInfo) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <RefreshCw
                    size={14}
                    className={loadingTokenInfo ? 'spinning' : ''}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {loadingTokenInfo ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: theme.colors.textSecondary,
                }}
              >
                <Loader2 size={16} className="spinning" />
                Loading token information...
              </div>
            ) : tokenError ? (
              <div
                style={{
                  color: theme.colors.error || '#ef4444',
                  fontSize: '14px',
                }}
              >
                {tokenError}
              </div>
            ) : (
              <>
                {/* Token Scopes */}
                <div style={{ marginBottom: '24px' }}>
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '12px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Granted Scopes
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {tokenInfo.scopes.length > 0 ? (
                      tokenInfo.scopes.map((scope) => (
                        <div
                          key={scope}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '13px',
                          }}
                          title={formatScope(scope)}
                        >
                          <span
                            style={{ fontFamily: 'monospace', fontWeight: 500 }}
                          >
                            {scope}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span
                        style={{
                          color: theme.colors.textSecondary,
                          fontSize: '14px',
                        }}
                      >
                        No specific scopes granted
                      </span>
                    )}
                  </div>
                  {tokenInfo.scopes.length > 0 && (
                    <p
                      style={{
                        marginTop: '12px',
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      To change permissions, create a new token with different
                      scopes via the Manage Token button.
                    </p>
                  )}
                </div>

                {/* Organizations Access */}
                {tokenInfo.organizations.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        marginBottom: '12px',
                        color: theme.colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Building size={16} />
                      Organization Access
                    </h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      {tokenInfo.organizations.map((org) => (
                        <div
                          key={org.login}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            backgroundColor: secondaryBackground,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '8px',
                          }}
                        >
                          <img
                            src={org.avatar_url}
                            alt={org.login}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 500,
                                fontSize: '14px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {org.login}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                              }}
                            >
                              @{org.login}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rate Limit Info */}
                {tokenInfo.rateLimit && (
                  <div
                    style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: `1px solid ${theme.colors.border}`,
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      API Rate Limit: {tokenInfo.rateLimit.remaining} /{' '}
                      {tokenInfo.rateLimit.limit}
                    </span>
                    <span>
                      Resets:{' '}
                      {new Date(tokenInfo.rateLimit.reset).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Token Metadata & Refresh Testing Card */}
        {isAuthenticated && tokenMetadata && (
          <div
            style={{
              backgroundColor: cardBackground,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw size={20} />
                Token Information & Refresh Testing
              </h2>
              <button
                onClick={fetchTokenMetadata}
                disabled={loadingTokenMetadata}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.textSecondary,
                  fontSize: '13px',
                  cursor: loadingTokenMetadata ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!loadingTokenMetadata) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <RefreshCw
                  size={14}
                  className={loadingTokenMetadata ? 'spinning' : ''}
                />
                Refresh Info
              </button>
            </div>

            {loadingTokenMetadata ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: theme.colors.textSecondary,
                }}
              >
                <Loader2 size={16} className="spinning" />
                Loading token metadata...
              </div>
            ) : (
              <>
                {/* Token Status */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: secondaryBackground,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        marginBottom: '4px',
                      }}
                    >
                      Token Status
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      {tokenMetadata.hasToken ? (
                        <>
                          <CheckCircle
                            size={16}
                            style={{ color: theme.colors.success || '#10b981' }}
                          />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle
                            size={16}
                            style={{ color: theme.colors.error || '#ef4444' }}
                          />
                          <span>No Token</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: secondaryBackground,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        marginBottom: '4px',
                      }}
                    >
                      Refresh Token
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      {tokenMetadata.hasRefreshToken ? (
                        <>
                          <CheckCircle
                            size={16}
                            style={{ color: theme.colors.success || '#10b981' }}
                          />
                          <span>Available</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle
                            size={16}
                            style={{ color: theme.colors.warning || '#f59e0b' }}
                          />
                          <span>Not Available</span>
                        </>
                      )}
                    </div>
                  </div>

                  {tokenMetadata.expiresAt && (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: secondaryBackground,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                          marginBottom: '4px',
                        }}
                      >
                        Expires In
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                      >
                        {tokenMetadata.isExpired ? (
                          <>
                            <XCircle
                              size={16}
                              style={{ color: theme.colors.error || '#ef4444' }}
                            />
                            <span>Expired</span>
                          </>
                        ) : tokenMetadata.isExpiringSoon ? (
                          <>
                            <AlertCircle
                              size={16}
                              style={{
                                color: theme.colors.warning || '#f59e0b',
                              }}
                            />
                            <span>{tokenMetadata.timeUntilExpiry}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle
                              size={16}
                              style={{ color: theme.colors.success || '#10b981' }}
                            />
                            <span>{tokenMetadata.timeUntilExpiry}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expiry Details */}
                {tokenMetadata.expiresAt && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: secondaryBackground,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <strong>Token Expires:</strong>{' '}
                    {tokenMetadata.expiresAtFormatted}
                  </div>
                )}

                {/* Refresh Token Test */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: secondaryBackground,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Shield size={16} />
                    Test Refresh Mechanism
                  </h3>
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      marginBottom: '12px',
                      lineHeight: '1.5',
                    }}
                  >
                    {tokenMetadata.hasRefreshToken
                      ? 'Test the automatic token refresh mechanism by forcing a token refresh. This will request a new access token from the server using your refresh token.'
                      : 'No refresh token is available. You may need to re-authenticate to get a refresh token.'}
                  </p>
                  <button
                    onClick={handleTestRefresh}
                    disabled={testingRefresh || !tokenMetadata.hasRefreshToken}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: tokenMetadata.hasRefreshToken
                        ? theme.colors.primary
                        : theme.colors.backgroundSecondary,
                      border: 'none',
                      borderRadius: '6px',
                      color: tokenMetadata.hasRefreshToken
                        ? theme.colors.background
                        : theme.colors.textSecondary,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: tokenMetadata.hasRefreshToken && !testingRefresh
                        ? 'pointer'
                        : 'not-allowed',
                      opacity: tokenMetadata.hasRefreshToken ? 1 : 0.5,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (tokenMetadata.hasRefreshToken && !testingRefresh) {
                        e.currentTarget.style.opacity = '0.9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (tokenMetadata.hasRefreshToken) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                  >
                    {testingRefresh ? (
                      <>
                        <Loader2 size={16} className="spinning" />
                        Testing Refresh...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        Test Token Refresh
                      </>
                    )}
                  </button>

                  {/* Refresh Result */}
                  {refreshResult && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${
                          refreshResult.success
                            ? theme.colors.success || '#10b981'
                            : theme.colors.error || '#ef4444'
                        }`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '13px',
                      }}
                    >
                      {refreshResult.success ? (
                        <CheckCircle
                          size={16}
                          style={{
                            color: theme.colors.success || '#10b981',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        />
                      ) : (
                        <XCircle
                          size={16}
                          style={{
                            color: theme.colors.error || '#ef4444',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        />
                      )}
                      <span>{refreshResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Information Notice */}
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: secondaryBackground,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    fontStyle: 'italic',
                    lineHeight: '1.6',
                  }}
                >
                  <strong>Note:</strong> Tokens are automatically refreshed when
                  they expire or are about to expire (within 5 minutes). This test
                  allows you to manually verify the refresh mechanism is working
                  correctly.
                </div>
              </>
            )}
          </div>
        )}

        {/* SSH Key Management Card */}
        {isAuthenticated && (
          <div
            style={{
              backgroundColor: cardBackground,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Key size={20} />
                SSH Key Management
              </h2>
              {githubSSHKeys.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: theme.colors.success || '#10b981',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  <CheckCircle size={14} />
                  {githubSSHKeys.length} {githubSSHKeys.length === 1 ? 'Key' : 'Keys'}
                </div>
              )}
            </div>

            {loadingSSHInfo ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: theme.colors.textSecondary,
                }}
              >
                <Loader2 size={16} className="spinning" />
                Loading SSH keys from GitHub...
              </div>
            ) : githubSSHKeys.length > 0 ? (
              <>
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    marginBottom: '16px',
                  }}
                >
                  You have {githubSSHKeys.length} SSH {githubSSHKeys.length === 1 ? 'key' : 'keys'} configured on GitHub. These keys can be used to clone private repositories and access organization repositories.
                </p>

                {githubSSHKeys.map((key) => (
                  <div
                    key={key.id}
                    style={{
                      backgroundColor: secondaryBackground,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            marginBottom: '4px',
                          }}
                        >
                          {key.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          Added {new Date(key.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {key.verified && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: theme.colors.success || '#10b981',
                          }}
                        >
                          <CheckCircle size={14} />
                          Verified
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        wordBreak: 'break-all',
                        lineHeight: '1.5',
                        padding: '8px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '4px',
                      }}
                    >
                      {key.key}
                    </div>
                  </div>
                ))}

                {connectionTestResult && (
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: connectionTestResult.success
                        ? `${theme.colors.success || '#10b981'}15`
                        : `${theme.colors.error || '#ef4444'}15`,
                      border: `1px solid ${connectionTestResult.success ? theme.colors.success || '#10b981' : theme.colors.error || '#ef4444'}40`,
                      borderRadius: '8px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: connectionTestResult.success
                        ? theme.colors.success || '#10b981'
                        : theme.colors.error || '#ef4444',
                    }}
                  >
                    {connectionTestResult.message}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleTestSSHConnection}
                    disabled={testingConnection}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: theme.colors.primary,
                      border: 'none',
                      borderRadius: '6px',
                      color: theme.colors.background,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: testingConnection ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: testingConnection ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!testingConnection) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      if (!testingConnection) e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 size={14} className="spinning" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        Test Connection
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowSSHSetup(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      color: theme.colors.textSecondary,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Key size={14} />
                    Add New Key
                  </button>
                </div>
              </>
            ) : (
              <>
                {sshKeysError && needsSSHPermission ? (
                  <>
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: `${theme.colors.error || '#ef4444'}15`,
                        border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                        borderRadius: '8px',
                        marginBottom: '16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'start',
                          gap: '12px',
                        }}
                      >
                        <AlertCircle
                          size={20}
                          style={{ color: theme.colors.error || '#ef4444', flexShrink: 0, marginTop: '2px' }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: theme.colors.error || '#ef4444',
                              marginBottom: '8px',
                            }}
                          >
                            Additional GitHub Permissions Required
                          </div>
                          <p
                            style={{
                              fontSize: '13px',
                              color: theme.colors.text,
                              marginBottom: '12px',
                              lineHeight: '1.5',
                            }}
                          >
                            {sshKeysError}
                          </p>
                          <p
                            style={{
                              fontSize: '13px',
                              color: theme.colors.textSecondary,
                              marginBottom: '12px',
                              lineHeight: '1.5',
                            }}
                          >
                            To view and manage your SSH keys, you need to re-authenticate with additional permissions. Click "Manage Permissions" above to grant the <code style={{ padding: '2px 6px', backgroundColor: theme.colors.background, borderRadius: '4px', fontFamily: 'monospace' }}>read:public_key</code> scope.
                          </p>
                        </div>
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        marginBottom: '16px',
                      }}
                    >
                      You can still set up SSH keys manually. The wizard will help you generate and configure a new SSH key for Git operations.
                    </p>
                    <button
                      onClick={() => setShowSSHSetup(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.background,
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <Key size={16} />
                      Set Up SSH Key
                    </button>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        marginBottom: '16px',
                      }}
                    >
                      {sshKeysError ||'SSH keys are not configured. Set up SSH authentication to clone private repositories and access organization repositories without token limitations.'}
                    </p>
                    <button
                      onClick={() => setShowSSHSetup(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.background,
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <Key size={16} />
                      Set Up SSH Key
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* System Permissions Card */}
        <div
          style={{
            backgroundColor: cardBackground,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Shield size={20} />
              System Permissions
            </h2>
            <button
              onClick={fetchKeychainStatus}
              disabled={loadingKeychainStatus}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                color: theme.colors.textSecondary,
                fontSize: '13px',
                cursor: loadingKeychainStatus ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loadingKeychainStatus) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <RefreshCw
                size={14}
                className={loadingKeychainStatus ? 'spinning' : ''}
              />
              Refresh
            </button>
          </div>

          <p
            style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
              marginBottom: '20px',
            }}
          >
            View and manage system permissions required for secure credential
            storage and authentication.
          </p>

          {loadingKeychainStatus ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: theme.colors.textSecondary,
                padding: '20px',
              }}
            >
              <Loader2 size={16} className="spinning" />
              Checking permissions...
            </div>
          ) : (
            <>
              {/* Keychain Access Status */}
              <div
                style={{
                  backgroundColor: secondaryBackground,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginTop: 0,
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Key size={16} />
                  Keychain Access
                </h3>

                {keychainStatus ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        marginBottom: '16px',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: theme.colors.background,
                          borderRadius: '6px',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            marginBottom: '4px',
                          }}
                        >
                          Keychain Available
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: keychainStatus.available
                              ? theme.colors.success
                              : theme.colors.error,
                          }}
                        >
                          {keychainStatus.available ? (
                            <>
                              <CheckCircle size={16} />
                              Available
                            </>
                          ) : (
                            <>
                              <XCircle size={16} />
                              Not Available
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: theme.colors.background,
                          borderRadius: '6px',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            marginBottom: '4px',
                          }}
                        >
                          Encryption Status
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: keychainStatus.initialized
                              ? theme.colors.success
                              : theme.colors.warning,
                          }}
                        >
                          {keychainStatus.initialized ? (
                            <>
                              <CheckCircle size={16} />
                              Initialized
                            </>
                          ) : (
                            <>
                              <AlertCircle size={16} />
                              Not Initialized
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {keychainStatus.error && (
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: `${theme.colors.error}15`,
                          border: `1px solid ${theme.colors.error}40`,
                          borderRadius: '6px',
                          marginBottom: '16px',
                          fontSize: '13px',
                          color: theme.colors.error,
                        }}
                      >
                        <AlertCircle
                          size={14}
                          style={{ display: 'inline', marginRight: '6px' }}
                        />
                        {keychainStatus.error}
                      </div>
                    )}

                    <button
                      onClick={handleTestKeychainAccess}
                      disabled={loadingKeychainStatus}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: theme.colors.primary,
                        border: 'none',
                        borderRadius: '6px',
                        color: theme.colors.background,
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: loadingKeychainStatus ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: loadingKeychainStatus ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!loadingKeychainStatus)
                          e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        if (!loadingKeychainStatus)
                          e.currentTarget.style.opacity = '1';
                      }}
                    >
                      {loadingKeychainStatus ? (
                        <>
                          <Loader2 size={14} className="spinning" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} />
                          Test Keychain Access
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Unable to check keychain status
                  </div>
                )}
              </div>

              {/* macOS System Permissions Info */}
              <div
                style={{
                  backgroundColor: secondaryBackground,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginTop: 0,
                    marginBottom: '12px',
                  }}
                >
                  Required Permissions
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    lineHeight: '1.8',
                  }}
                >
                  <li>
                    <strong style={{ color: theme.colors.text }}>
                      Keychain Access:
                    </strong>{' '}
                    Required to securely store authentication credentials
                  </li>
                  <li>
                    <strong style={{ color: theme.colors.text }}>
                      System Keychain:
                    </strong>{' '}
                    Must be unlocked for encryption/decryption operations
                  </li>
                </ul>
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  <strong style={{ color: theme.colors.text }}>
                    To manage permissions:
                  </strong>
                  <br />
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      display: 'block',
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      borderRadius: '4px',
                    }}
                  >
                    System Preferences → Security & Privacy → Privacy
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Connected Services Card */}
        {isAuthenticated && (
          <div
            style={{
              backgroundColor: cardBackground,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                marginBottom: '20px',
              }}
            >
              Connected Services
            </h2>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: secondaryBackground,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: '#24292e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 16 16"
                      fill="white"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      GitHub
                    </p>
                    <p
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Repository access and synchronization
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: theme.colors.success || '#10b981',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  <CheckCircle size={14} />
                  Connected
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SSH Setup Wizard */}
      <SSHSetupWizard
        isOpen={showSSHSetup}
        onClose={() => setShowSSHSetup(false)}
        onSuccess={handleSSHSetupComplete}
      />

      {/* Keychain Permission Modal */}
      <KeychainPermissionModal
        isOpen={showKeychainModal}
        onClose={handleKeychainModalClose}
        onRetry={handleKeychainRetry}
        error={loginError}
        errorType={keychainErrorType}
      />
    </div>
  );
};

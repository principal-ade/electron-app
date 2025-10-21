import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  LogIn,
  LogOut,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  Key,
  Building,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { gitSyncConnectionManager } from '../../../../services/git-sync/GitSyncConnectionManager';
import { GithubService } from '../../../../main-process-api/GithubService';
import type { TokenInfo } from '../../../../../shared/main-process-api-interfaces/GitHubAPI';

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

  const cardBackground = theme.colors.backgroundTertiary;
  const secondaryBackground = theme.colors.backgroundSecondary;

  // Fetch token info when authenticated
  useEffect(() => {
    if (isAuthenticated && authUser) {
      fetchTokenInfo();
    } else {
      setTokenInfo(null);
    }
  }, [isAuthenticated, authUser]);

  const fetchTokenInfo = async () => {
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
  };

  const formatScope = (scope: string): string => {
    return SCOPE_DESCRIPTIONS[scope] || scope.replace(/[_:]/g, ' ');
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
    </div>
  );
};

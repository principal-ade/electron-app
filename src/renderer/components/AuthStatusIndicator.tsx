import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, AlertCircle, User, 
  LogIn, RefreshCw, Clock
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { GitHubAuth } from '../services/p2p/GitHubAuthDirect';

interface AuthStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
  onAuthRequired?: () => void;
}

export const AuthStatusIndicator: React.FC<AuthStatusIndicatorProps> = ({
  compact = false,
  showDetails = true,
  onAuthRequired
}) => {
  const { theme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<{ githubHandle: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
    // Check auth status every 30 seconds
    const interval = setInterval(checkAuthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkAuthStatus = async () => {
    setIsChecking(true);
    try {
      const auth = GitHubAuth.getInstance();
      const status = await auth.checkStatus();
      
      if (status.user) {
        setIsAuthenticated(true);
        setUser(status.user);
        setError(null);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
      setError('Failed to check auth status');
    } finally {
      setIsChecking(false);
    }
  };

  const handleAuthClick = () => {
    if (!isAuthenticated && onAuthRequired) {
      onAuthRequired();
    }
  };

  if (compact) {
    // Compact mode - just show icon
    return (
      <div
        onClick={handleAuthClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: theme.space[1],
          cursor: !isAuthenticated ? 'pointer' : 'default',
          title: isAuthenticated 
            ? `Authenticated as ${user?.githubHandle}` 
            : 'Click to authenticate',
        }}
      >
        {isChecking ? (
          <RefreshCw size={16} color={theme.colors.textTertiary} className="animate-spin" />
        ) : isAuthenticated ? (
          <CheckCircle size={16} color={theme.colors.success} />
        ) : (
          <XCircle size={16} color={theme.colors.error} />
        )}
      </div>
    );
  }

  // Full mode with details
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.space[2],
      padding: `${theme.space[2]}px ${theme.space[3]}px`,
      backgroundColor: isAuthenticated ? `${theme.colors.success}15` : `${theme.colors.error}10`,
      border: `1px solid ${isAuthenticated ? `${theme.colors.success}40` : `${theme.colors.error}30`}`,
      borderRadius: theme.radii[2],
      fontSize: theme.fontSizes[1],
      cursor: !isAuthenticated ? 'pointer' : 'default',
    }}
    onClick={handleAuthClick}
    >
      {isChecking ? (
        <>
          <RefreshCw size={14} className="animate-spin" />
          <span style={{ color: theme.colors.textTertiary }}>Checking...</span>
        </>
      ) : isAuthenticated ? (
        <>
          <CheckCircle size={14} color={theme.colors.success} />
          <span style={{ color: theme.colors.success }}>
            {showDetails && user ? (
              <>
                <User size={12} style={{ display: 'inline', marginRight: theme.space[1] }} />
                {user.githubHandle}
                {user.status === 'waitlisted' && (
                  <span style={{ 
                    marginLeft: theme.space[2],
                    padding: `2px 6px`,
                    backgroundColor: `${theme.colors.warning}15`,
                    color: theme.colors.warning,
                    borderRadius: theme.radii[1],
                    fontSize: theme.fontSizes[0] - 1,
                  }}>
                    Waitlisted
                  </span>
                )}
              </>
            ) : (
              'Authenticated'
            )}
          </span>
        </>
      ) : (
        <>
          <LogIn size={14} color={theme.colors.error} />
          <span style={{ color: theme.colors.error }}>
            Not authenticated
          </span>
          {showDetails && (
            <span style={{ 
              fontSize: theme.fontSizes[0] - 1, 
              color: `${theme.colors.error}CC`,
              marginLeft: theme.space[1] 
            }}>
              Click to sign in
            </span>
          )}
        </>
      )}
      
      {error && showDetails && (
        <AlertCircle 
          size={12} 
          color={theme.colors.warning} 
          title={error}
        />
      )}
    </div>
  );
};
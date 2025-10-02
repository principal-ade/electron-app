import { useTheme } from '@a24z/industry-theme';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { useAuthState } from '../../hooks/useAuthState';
import { gitSyncConnectionManager } from '../../services/git-sync/GitSyncConnectionManager';

export const TitlebarAuth: React.FC = () => {
  const { theme } = useTheme();
  const {
    isAuthenticated,
    user: authUser,
    login,
    logout,
    isLoggingIn,
    loginError,
    clearLoginError,
  } = useAuthState();

  if (isAuthenticated && authUser) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          WebkitAppRegion: 'no-drag' as any,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 6px 3px 3px',
            backgroundColor: theme.colors.backgroundTertiary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '16px',
            fontSize: '12px',
            height: '28px',
          }}
        >
          {authUser?.avatarUrl ? (
            <img
              src={authUser.avatarUrl}
              alt={authUser.login}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: theme.colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.background,
                fontWeight: 600,
                fontSize: '10px',
              }}
            >
              {authUser.login[0].toUpperCase()}
            </div>
          )}
          <span style={{ fontWeight: 500, color: theme.colors.text }}>
            {authUser.login}
          </span>
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
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.error || '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Logout"
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        WebkitAppRegion: 'no-drag' as any,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {loginError && loginError !== 'Authentication already in progress' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 6px',
            backgroundColor: theme.colors.error
              ? `${theme.colors.error}20`
              : '#ef444420',
            border: `1px solid ${theme.colors.error || '#ef4444'}40`,
            borderRadius: '4px',
            fontSize: '11px',
            color: theme.colors.error || '#ef4444',
            height: '24px',
          }}
        >
          <span>{loginError}</span>
          <button
            onClick={() => clearLoginError()}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              color: theme.colors.error || '#ef4444',
              fontSize: '12px',
              fontWeight: 'bold',
              marginLeft: '2px',
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
            const forceRetry = loginError === 'Authentication already in progress';
            await login(forceRetry);
            console.info('Login initiated');
          } catch (error: unknown) {
            console.error('Login error:', error);
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '5px 10px',
          backgroundColor: isLoggingIn
            ? theme.colors.backgroundTertiary
            : theme.colors.primary,
          color: isLoggingIn
            ? theme.colors.textSecondary
            : theme.colors.background,
          border: 'none',
          borderRadius: '5px',
          fontSize: '12px',
          fontWeight: 500,
          cursor: isLoggingIn ? 'wait' : 'pointer',
          transition: 'all 0.2s',
          opacity: isLoggingIn ? 0.7 : 1,
          height: '26px',
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
          isLoggingIn && loginError !== 'Authentication already in progress'
        }
      >
        {isLoggingIn ? (
          <>
            <Loader2 size={12} className="spinning" />
            <span>Logging in...</span>
          </>
        ) : (
          <>
            <LogIn size={12} />
            <span>
              {loginError === 'Authentication already in progress'
                ? 'Retry'
                : 'Login'}
            </span>
          </>
        )}
      </button>
    </div>
  );
};
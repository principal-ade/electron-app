import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Shield, Lock } from 'lucide-react';
import { useAuthState } from '../../../hooks/useAuthState';
import { useKeychainConsentContext } from '../../../hooks/useKeychainConsent';
import { AuthDetails } from './components/AuthDetails';
import './AuthView.css';

/**
 * Component shown when keychain consent is not granted
 */
const KeychainConsentRequired: React.FC = () => {
  const { theme } = useTheme();
  const { requestConsent } = useKeychainConsentContext();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          backgroundColor: theme.colors.backgroundSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <Lock size={40} color={theme.colors.textSecondary} />
      </div>

      <h3
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.colors.text,
          margin: 0,
          marginBottom: '12px',
        }}
      >
        Secure Storage Required
      </h3>

      <p
        style={{
          fontSize: '14px',
          color: theme.colors.textSecondary,
          margin: 0,
          marginBottom: '24px',
          lineHeight: '1.6',
        }}
      >
        To use authentication features, you need to enable secure credential
        storage. This allows the app to securely store your login credentials
        using the macOS Keychain.
      </p>

      <button
        onClick={requestConsent}
        style={{
          padding: '12px 24px',
          backgroundColor: theme.colors.primary,
          border: 'none',
          borderRadius: '8px',
          color: theme.colors.background,
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        Enable Secure Storage
      </button>

      <p
        style={{
          fontSize: '12px',
          color: theme.colors.textTertiary,
          margin: 0,
          marginTop: '16px',
        }}
      >
        You can also enable this in Settings → Security
      </p>
    </div>
  );
};

export const AuthView: React.FC = () => {
  const { theme } = useTheme();
  const { status: consentStatus, isLoading: isLoadingConsent } =
    useKeychainConsentContext();
  const {
    isAuthenticated,
    user,
    login,
    logout,
    isLoggingIn,
    loginError,
    clearLoginError,
  } = useAuthState();

  const backgroundColor = theme.colors.background;

  // Check if keychain consent is required
  const requiresConsent =
    consentStatus === 'pending' || consentStatus === 'declined';

  return (
    <div
      className="auth-view"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        <Shield size={20} color={theme.colors.primary} />
        <h2
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Authentication
        </h2>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoadingConsent ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: theme.colors.textSecondary,
            }}
          >
            Loading...
          </div>
        ) : requiresConsent ? (
          <KeychainConsentRequired />
        ) : (
          <AuthDetails
            isAuthenticated={isAuthenticated}
            user={user}
            login={login}
            logout={logout}
            isLoggingIn={isLoggingIn || false}
            loginError={loginError || null}
            clearLoginError={clearLoginError}
          />
        )}
      </div>
    </div>
  );
};

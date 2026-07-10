import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Shield, Key, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useKeychainConsentContext } from '../../../../hooks/useKeychainConsent';
import { AuthenticationService } from '../../../../main-process-api/AuthenticationService';

interface KeychainStatus {
  available: boolean;
  initialized: boolean;
  error?: string;
}

export const SecuritySettings: React.FC = () => {
  const { theme } = useTheme();
  const { status: consentStatus, requestConsent, revokeConsent } = useKeychainConsentContext();
  const [isRevoking, setIsRevoking] = useState(false);
  const [keychainStatus, setKeychainStatus] = useState<KeychainStatus | null>(
    null,
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Load keychain status when consent is granted
  useEffect(() => {
    if (consentStatus === 'granted') {
      loadKeychainStatus();
    }
  }, [consentStatus]);

  const loadKeychainStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const status = await AuthenticationService.checkKeychainStatus();
      setKeychainStatus(status);
    } catch (err) {
      console.error('[SecuritySettings] Failed to load keychain status:', err);
      setKeychainStatus({
        available: false,
        initialized: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const getStatusIcon = () => {
    if (consentStatus === 'granted') {
      return <CheckCircle size={20} color={theme.colors.success} />;
    }
    if (consentStatus === 'declined') {
      return <XCircle size={20} color={theme.colors.warning} />;
    }
    return <AlertCircle size={20} color={theme.colors.textSecondary} />;
  };

  const getStatusText = () => {
    if (consentStatus === 'granted') {
      return 'Enabled';
    }
    if (consentStatus === 'declined') {
      return 'Disabled';
    }
    return 'Not configured';
  };

  const getStatusDescription = () => {
    // Tokens are stored as plaintext JSON (owner-only 0o600) under app userData.
    // Optional Keychain-backed storage may return later as an opt-in.
    return 'Authentication credentials are stored locally in an app data file with restricted permissions (owner read/write only).';
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Section Header */}
      <div style={{ marginBottom: '32px' }}>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
            marginBottom: '8px',
          }}
        >
          Security
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            margin: 0,
          }}
        >
          Manage security settings for credential storage and authentication.
        </p>
      </div>

      {/* Secure Credential Storage Card */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: theme.colors.background,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Shield size={24} color={theme.colors.primary} />
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Secure Credential Storage
              </h4>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {getStatusIcon()}
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color:
                      consentStatus === 'granted'
                        ? theme.colors.success
                        : consentStatus === 'declined'
                          ? theme.colors.warning
                          : theme.colors.textSecondary,
                  }}
                >
                  {getStatusText()}
                </span>
              </div>
            </div>

            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: 0,
                marginBottom: '16px',
                lineHeight: '1.5',
              }}
            >
              {getStatusDescription()}
            </p>

            {/* Action Button */}
            {consentStatus !== 'granted' && (
              <button
                onClick={requestConsent}
                style={{
                  padding: '10px 20px',
                  backgroundColor: theme.colors.primary,
                  border: 'none',
                  borderRadius: '6px',
                  color: theme.colors.background,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Enable Secure Storage
              </button>
            )}

            {/* Keychain Status Details (when granted) */}
            {consentStatus === 'granted' && (
              <div
                style={{
                  backgroundColor: theme.colors.background,
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '8px',
                }}
              >
                <h5
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    margin: 0,
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Key size={14} />
                  Keychain Status
                </h5>

                {isLoadingStatus ? (
                  <p
                    style={{
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      margin: 0,
                    }}
                  >
                    Loading status...
                  </p>
                ) : keychainStatus ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Available:
                      </span>
                      <span
                        style={{
                          color: keychainStatus.available
                            ? theme.colors.success
                            : theme.colors.error,
                          fontWeight: 500,
                        }}
                      >
                        {keychainStatus.available ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Initialized:
                      </span>
                      <span
                        style={{
                          color: keychainStatus.initialized
                            ? theme.colors.success
                            : theme.colors.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        {keychainStatus.initialized ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {keychainStatus.error && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: theme.colors.error,
                          margin: 0,
                          marginTop: '4px',
                        }}
                      >
                        Error: {keychainStatus.error}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Disable Button */}
                <button
                  onClick={async () => {
                    setIsRevoking(true);
                    try {
                      await revokeConsent();
                    } finally {
                      setIsRevoking(false);
                    }
                  }}
                  disabled={isRevoking}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: isRevoking ? 'not-allowed' : 'pointer',
                    opacity: isRevoking ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {isRevoking ? 'Disabling...' : 'Disable Secure Storage'}
                </button>
                <p
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textTertiary,
                    margin: 0,
                    marginTop: '8px',
                  }}
                >
                  Your stored credentials will be preserved but not used until re-enabled.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <AlertCircle
          size={18}
          color={theme.colors.textSecondary}
          style={{ flexShrink: 0, marginTop: '2px' }}
        />
        <p
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          macOS Keychain is the same secure storage system used by Safari and
          other apps to store passwords and sensitive data. Your credentials are
          encrypted and protected by your system password.
        </p>
      </div>
    </div>
  );
};

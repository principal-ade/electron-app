import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Shield,
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { AuthenticationService } from '../main-process-api/AuthenticationService';

const processName = window.electron?.process?.name || 'Electron App';

interface KeychainPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  error?: string | null;
  errorType?:
    | 'timeout'
    | 'permission_denied'
    | 'not_available'
    | 'unknown'
    | null;
}

interface KeychainStatus {
  available: boolean;
  initialized: boolean;
  error?: string;
  errorType?: string;
}

interface KeychainTestResult {
  success: boolean;
  error?: string;
  errorType?: string;
}

export const KeychainPermissionModal: React.FC<
  KeychainPermissionModalProps
> = ({ isOpen, onClose, onRetry, error, errorType }) => {
  const { theme } = useTheme();
  const [status, setStatus] = useState<KeychainStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<KeychainTestResult | null>(
    null,
  );

  // Check keychain status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkKeychainStatus();
    }
  }, [isOpen]);

  const checkKeychainStatus = async () => {
    try {
      const result = await AuthenticationService.checkKeychainStatus();
      setStatus(result);
    } catch (err) {
      console.error('[KeychainPermissionModal] Failed to check status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus({
        available: false,
        initialized: false,
        error: errorMessage,
        errorType: 'unknown',
      });
    }
  };

  const testKeychainAccess = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await AuthenticationService.testKeychainAccess();
      setTestResult(result);

      if (result.success) {
        // Refresh status after successful test
        await checkKeychainStatus();
      }
    } catch (err) {
      console.error('[KeychainPermissionModal] Test failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({
        success: false,
        error: errorMessage,
        errorType: 'unknown',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRetryLogin = () => {
    onRetry();
    onClose();
  };

  const getErrorIcon = () => {
    if (testResult?.success) {
      return <CheckCircle size={48} color={theme.colors.success} />;
    }

    switch (errorType) {
      case 'timeout':
        return <AlertTriangle size={48} color={theme.colors.warning} />;
      case 'permission_denied':
        return <XCircle size={48} color={theme.colors.error} />;
      case 'not_available':
        return <AlertTriangle size={48} color={theme.colors.error} />;
      default:
        return <Shield size={48} color={theme.colors.primary} />;
    }
  };

  const getErrorTitle = () => {
    if (testResult?.success) {
      return 'Keychain Access Granted';
    }

    switch (errorType) {
      case 'timeout':
        return 'Keychain Access Timed Out';
      case 'permission_denied':
        return 'Keychain Access Denied';
      case 'not_available':
        return 'Keychain Not Available';
      default:
        return 'Keychain Access Required';
    }
  };

  const getErrorDescription = () => {
    if (testResult?.success) {
      return 'Your keychain is now accessible. You can retry logging in.';
    }

    switch (errorType) {
      case 'timeout':
        return 'The app timed out waiting for keychain access. This usually happens when the system keychain is locked or the permission prompt was not responded to.';
      case 'permission_denied':
        return 'The app was denied access to your system keychain. To store your credentials securely, keychain access is required.';
      case 'not_available':
        return 'The system keychain is not available. Please ensure your macOS keychain is unlocked.';
      default:
        return 'This app needs access to your system keychain to securely store your authentication credentials.';
    }
  };

  const getInstructions = () => {
    const steps = [];

    if (errorType === 'timeout' || errorType === 'not_available') {
      steps.push('Unlock your system keychain if it is locked');
      steps.push(
        'Open "Keychain Access" app from Applications → Utilities',
      );
      steps.push('Ensure the "login" keychain is unlocked');
    }

    if (errorType === 'permission_denied') {
      steps.push('Open System Preferences → Security & Privacy');
      steps.push('Go to the Privacy tab');
      steps.push('Select "Automation" or "Full Disk Access" from the list');
      steps.push(`Find "${processName}" and enable it`);
    }

    steps.push('Click "Test Access" below to verify keychain access');
    steps.push('Click "Retry Login" to authenticate again');

    return steps;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          padding: '32px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header with Icon */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {getErrorIcon()}
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {getErrorTitle()}
          </h2>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '15px',
            lineHeight: '1.6',
            color: theme.colors.textSecondary,
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          {getErrorDescription()}
        </p>

        {/* Error message if provided */}
        {error && (
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.error}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '24px',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                color: theme.colors.error,
                margin: 0,
                fontFamily: 'monospace',
              }}
            >
              {error}
            </p>
          </div>
        )}

        {/* Quick Status Check */}
        {status && (
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginTop: 0,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Key size={16} />
              Current Status
            </h3>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                marginBottom: '8px',
              }}
            >
              <span style={{ color: theme.colors.textSecondary }}>
                Keychain Available:
              </span>
              <span
                style={{
                  color: status.available
                    ? theme.colors.success
                    : theme.colors.error,
                  fontWeight: 500,
                }}
              >
                {status.available ? '✓ Yes' : '✗ No'}
              </span>
            </div>

            {testResult && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: testResult.success
                    ? 'rgba(0, 255, 0, 0.05)'
                    : 'rgba(255, 0, 0, 0.05)',
                  border: `1px solid ${testResult.success ? theme.colors.success : theme.colors.error}`,
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: testResult.success
                      ? theme.colors.success
                      : theme.colors.error,
                  }}
                >
                  {testResult.success ? (
                    <CheckCircle size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>
                    {testResult.success
                      ? 'Access test passed!'
                      : `Test failed: ${testResult.error}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!testResult?.success && (
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginTop: 0,
                marginBottom: '12px',
              }}
            >
              How to Fix This
            </h3>
            <ol
              style={{
                margin: 0,
                paddingLeft: '20px',
                color: theme.colors.textSecondary,
                fontSize: '13px',
                lineHeight: '1.8',
              }}
            >
              {getInstructions().map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.textSecondary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
          >
            Cancel
          </button>

          <button
            onClick={testKeychainAccess}
            disabled={testing}
            style={{
              padding: '10px 20px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.text,
              fontSize: '14px',
              fontWeight: 500,
              cursor: testing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: testing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!testing) {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
          >
            <RefreshCw size={16} className={testing ? 'spinning' : ''} />
            {testing ? 'Testing...' : 'Test Access'}
          </button>

          <button
            onClick={handleRetryLogin}
            disabled={testing}
            style={{
              padding: '10px 24px',
              backgroundColor: testResult?.success
                ? theme.colors.success
                : theme.colors.primary,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: testing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: testing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!testing) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = testing ? '0.6' : '1';
            }}
          >
            <RefreshCw size={16} />
            Retry Login
          </button>
        </div>

        {/* Help link */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: `1px solid ${theme.colors.border}`,
            textAlign: 'center',
          }}
        >
          <a
            href="https://support.apple.com/guide/keychain-access/what-is-keychain-access-kyca1083/mac"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '13px',
              color: theme.colors.primary,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Learn more about macOS Keychain
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spinning {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { Shield, Key, Lock } from 'lucide-react';

const appName = window.appName || 'Principal';

interface KeychainConsentModalProps {
  isOpen: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export const KeychainConsentModal: React.FC<KeychainConsentModalProps> = ({
  isOpen,
  onConsent,
  onDecline,
}) => {
  const { theme } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConsent = async () => {
    setIsProcessing(true);
    try {
      await onConsent();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    try {
      await onDecline();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
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
          maxWidth: '480px',
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
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: theme.colors.backgroundSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={32} color={theme.colors.primary} />
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Secure Credential Storage
          </h2>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: theme.colors.textSecondary,
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          To keep your login credentials secure, {appName} stores them in your
          macOS Keychain. This is the same secure storage used by Safari and
          other apps.
        </p>

        {/* What happens section */}
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: theme.colors.text,
              marginTop: 0,
              marginBottom: '12px',
            }}
          >
            What happens next?
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
              color: theme.colors.textSecondary,
              fontSize: '13px',
              lineHeight: '1.8',
            }}
          >
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
              <Key size={14} style={{ marginTop: '4px', flexShrink: 0 }} />
              <span>macOS will ask you to allow keychain access (one-time only)</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Lock size={14} style={{ marginTop: '4px', flexShrink: 0 }} />
              <span>Your credentials will be encrypted and stored securely</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleDecline}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.textSecondary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            Skip for now
          </button>

          <button
            onClick={handleConsent}
            disabled={isProcessing}
            style={{
              padding: '10px 24px',
              backgroundColor: theme.colors.primary,
              border: 'none',
              borderRadius: '6px',
              color: theme.colors.background,
              fontSize: '14px',
              fontWeight: 500,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            {isProcessing ? 'Please wait...' : 'Allow'}
          </button>
        </div>

        {/* Footer note */}
        <p
          style={{
            fontSize: '12px',
            color: theme.colors.textTertiary,
            marginTop: '16px',
            marginBottom: 0,
            textAlign: 'center',
          }}
        >
          You can enable this later in Settings → Security
        </p>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

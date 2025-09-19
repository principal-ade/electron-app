import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Github, Key, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface OAuthCallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeSubmit: (code: string) => void;
}

export const OAuthCallbackModal: React.FC<OAuthCallbackModalProps> = ({
  isOpen,
  onClose,
  onCodeSubmit,
}) => {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!code.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    onCodeSubmit(code);
    onClose();
  };

  const handleCancel = () => {
    onClose();
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <Github size={24} color={theme.colors.primary} />
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            GitHub Authorization
          </h2>
        </div>

        {/* Instructions */}
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
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
            Complete GitHub Authorization
          </h3>
          <ol
            style={{
              margin: 0,
              paddingLeft: '20px',
              color: theme.colors.textSecondary,
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          >
            <li>A browser window should have opened to GitHub</li>
            <li>Authorize the application if prompted</li>
            <li>You'll be redirected to a success page with your token</li>
            <li>Copy the token from the success page</li>
            <li>Paste the token in the field below</li>
          </ol>

          <div
            style={{
              marginTop: '12px',
              padding: '8px',
              backgroundColor: theme.colors.background,
              borderRadius: '4px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            💡 Your token will be displayed on the success page after
            authorization
          </div>

          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: theme.colors.textTertiary,
            }}
          >
            Browser didn't open?
            <button
              onClick={() =>
                window.open(
                  'https://principle-md.com/api/orbit/auth/github',
                  '_blank',
                )
              }
              style={{
                marginLeft: '4px',
                padding: '2px 4px',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.colors.primary,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Click here
            </button>
          </div>
        </div>

        {/* Code Input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}
          >
            Access Token
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: 1,
              }}
            >
              <Key
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.colors.textSecondary,
                }}
              />
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
                placeholder="Paste your access token here"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${error ? theme.colors.error : theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.text,
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
                autoFocus
              />
            </div>
          </div>
          {error && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '13px',
                color: theme.colors.error,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <XCircle size={14} />
              {error}
            </div>
          )}
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
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
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
            onClick={handleSubmit}
            style={{
              padding: '8px 20px',
              backgroundColor: theme.colors.primary,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <CheckCircle size={16} />
            Authorize
          </button>
        </div>
      </div>
    </div>
  );
};

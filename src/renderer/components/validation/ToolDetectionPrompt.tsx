import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';

interface ToolDetectionPromptProps {
  workingDirectory: string;
  detectedPackages: Array<{
    path: string;
    name: string;
    hasPackageJson: boolean;
  }>;
  onAccept: () => void;
  onDismiss: () => void;
}

export const ToolDetectionPrompt: React.FC<ToolDetectionPromptProps> = ({
  workingDirectory,
  detectedPackages,
  onAccept,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || detectedPackages.length === 0) {
    return null;
  }

  const packageCount = detectedPackages.length;
  const packageWord =
    packageCount === 1 ? 'package.json file' : 'package.json files';

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: theme.colors.backgroundLight,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        padding: '20px 24px',
        maxWidth: '500px',
        zIndex: 1000,
        animation: 'slideInFromTop 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div
          style={{
            fontSize: '32px',
            lineHeight: 1,
            marginTop: '-4px',
          }}
        >
          🔍
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: theme.colors.text,
            }}
          >
            Tool Detection
          </h3>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            We found {packageCount} {packageWord} in your workspace. Would you
            like us to extract validation tools from them? This will help you
            maintain code quality with automated checks.
          </p>

          <div
            style={{
              marginBottom: '16px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            <div style={{ marginBottom: '4px', fontWeight: '600' }}>
              Detected packages:
            </div>
            {detectedPackages.slice(0, 3).map((pkg, index) => (
              <div
                key={index}
                style={{
                  padding: '4px 8px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '4px',
                  marginBottom: '4px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                }}
              >
                {pkg.path || 'root'}/{pkg.name}
              </div>
            ))}
            {packageCount > 3 && (
              <div
                style={{
                  padding: '4px 8px',
                  color: theme.colors.textSecondary,
                  fontSize: '11px',
                  fontStyle: 'italic',
                }}
              >
                ... and {packageCount - 3} more
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setIsVisible(false);
                onAccept();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Yes, Extract Validations
            </button>

            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundLight)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              Not Now
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss();
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = theme.colors.text)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = theme.colors.textSecondary)
          }
        >
          ×
        </button>
      </div>
    </div>
  );
};

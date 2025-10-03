import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'explore' | 'maintain';
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  mode = 'explore',
}) => {
  const { theme } = useTheme();

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '16px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.colors.border}`,
          animation: 'slideUp 0.3s ease-out',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: `${theme.colors.background}80`,
            backdropFilter: 'blur(8px)',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.background;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.colors.background}80`;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <X size={16} />
        </button>

        {/* Visual City Illustration */}
        <div
          style={{
            height: '180px',
            background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.accent}15)`,
            position: 'relative',
            overflow: 'hidden',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Simple city visualization */}
          <svg
            viewBox="0 0 400 180"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              bottom: 0,
            }}
          >
            {/* District borders */}
            <rect
              x="20"
              y="80"
              width="160"
              height="100"
              fill="none"
              stroke={`${theme.colors.border}`}
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.5"
            />
            <rect
              x="200"
              y="60"
              width="180"
              height="120"
              fill="none"
              stroke={`${theme.colors.border}`}
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.5"
            />

            {/* Buildings representing files */}
            {/* Small files */}
            <rect
              x="40"
              y="140"
              width="25"
              height="40"
              fill={theme.colors.primary}
              opacity="0.7"
              rx="2"
            />
            <rect
              x="75"
              y="130"
              width="25"
              height="50"
              fill={theme.colors.primary}
              opacity="0.7"
              rx="2"
            />
            <rect
              x="110"
              y="150"
              width="25"
              height="30"
              fill={theme.colors.primary}
              opacity="0.7"
              rx="2"
            />
            <rect
              x="145"
              y="120"
              width="25"
              height="60"
              fill={theme.colors.primary}
              opacity="0.7"
              rx="2"
            />

            {/* Large files */}
            <rect
              x="220"
              y="100"
              width="35"
              height="80"
              fill={theme.colors.accent}
              opacity="0.7"
              rx="2"
            />
            <rect
              x="265"
              y="110"
              width="35"
              height="70"
              fill={theme.colors.accent}
              opacity="0.7"
              rx="2"
            />
            <rect
              x="310"
              y="90"
              width="35"
              height="90"
              fill={theme.colors.accent}
              opacity="0.7"
              rx="2"
            />

            {/* Maintenance highlights */}
            {mode === 'maintain' && (
              <>
                {/* Warning outline */}
                <rect
                  x="75"
                  y="130"
                  width="25"
                  height="50"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="3"
                  rx="2"
                />
                {/* Active issue highlight */}
                <rect
                  x="265"
                  y="110"
                  width="35"
                  height="70"
                  fill="#ef4444"
                  opacity="0.8"
                  rx="2"
                />
              </>
            )}

            {/* Labels */}
            <text
              x="100"
              y="70"
              fill={theme.colors.textSecondary}
              fontSize="11"
              textAnchor="middle"
              fontFamily="system-ui"
            >
              src/
            </text>
            <text
              x="290"
              y="50"
              fill={theme.colors.textSecondary}
              fontSize="11"
              textAnchor="middle"
              fontFamily="system-ui"
            >
              components/
            </text>
          </svg>
        </div>

        {/* Simple explanation */}
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              color: theme.colors.text,
              margin: '0 0 16px 0',
              fontSize: '20px',
              fontWeight: 600,
            }}
          >
            Welcome to Code City
          </h2>

          <p
            style={{
              color: theme.colors.textSecondary,
              fontSize: '15px',
              lineHeight: 1.6,
              margin: '0 0 20px 0',
            }}
          >
            Every{' '}
            <strong style={{ color: theme.colors.primary }}>
              file is a building
            </strong>{' '}
            and{' '}
            <strong style={{ color: theme.colors.accent }}>
              directories are districts
            </strong>{' '}
            with borders.
          </p>

          {mode === 'maintain' && (
            <>
              <p
                style={{
                  color: theme.colors.text,
                  fontSize: '16px',
                  fontWeight: 600,
                  margin: '0 0 16px 0',
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Keep your repository healthy and production-ready
              </p>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    color: theme.colors.text,
                    fontSize: '14px',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Track{' '}
                  <span style={{ color: '#f97316', fontWeight: 600 }}>
                    outstanding issues
                  </span>{' '}
                  and{' '}
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>
                    maintenance alerts
                  </span>{' '}
                  to keep dependencies and automation in sync.
                </p>
              </div>
            </>
          )}

          {mode === 'explore' && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                marginBottom: '20px',
              }}
            >
              <p
                style={{
                  color: theme.colors.text,
                  fontSize: '14px',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Navigate and explore any repository visually, understanding its
                structure at a glance
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Got it!
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

import React from 'react';
import { X, GitBranch, Circle } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface GitChangesHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitChangesHelpModal: React.FC<GitChangesHelpModalProps> = ({
  isOpen,
  onClose,
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
          maxWidth: '600px',
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

        {/* Visual Git Changes Illustration */}
        <div
          style={{
            height: '180px',
            background: `linear-gradient(135deg, ${theme.colors.primary}15, #10b98115)`,
            position: 'relative',
            overflow: 'hidden',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Simple visualization showing git changes */}
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

            {/* Normal files (gray) */}
            <rect
              x="40"
              y="140"
              width="25"
              height="40"
              fill={theme.colors.textSecondary}
              opacity="0.3"
              rx="2"
            />
            <rect
              x="145"
              y="120"
              width="25"
              height="60"
              fill={theme.colors.textSecondary}
              opacity="0.3"
              rx="2"
            />

            {/* Modified files (orange) */}
            <rect
              x="75"
              y="130"
              width="25"
              height="50"
              fill="#f59e0b"
              opacity="0.7"
              rx="2"
            />
            <rect
              x="265"
              y="110"
              width="35"
              height="70"
              fill="#f59e0b"
              opacity="0.7"
              rx="2"
            />

            {/* New files (green) */}
            <rect
              x="110"
              y="150"
              width="25"
              height="30"
              fill="#10b981"
              opacity="0.7"
              rx="2"
            />
            <rect
              x="220"
              y="100"
              width="35"
              height="80"
              fill="#10b981"
              opacity="0.7"
              rx="2"
            />

            {/* Deleted files (red, dashed) */}
            <rect
              x="310"
              y="90"
              width="35"
              height="90"
              fill="#ef4444"
              opacity="0.5"
              rx="2"
              strokeDasharray="3,3"
              stroke="#ef4444"
            />

            {/* Labels */}
            <text
              x="100"
              y="70"
              fill={theme.colors.textSecondary}
              fontSize="11"
              textAnchor="middle"
              fontFamily="system-ui"
            >
              Working Tree
            </text>
            <text
              x="290"
              y="50"
              fill={theme.colors.textSecondary}
              fontSize="11"
              textAnchor="middle"
              fontFamily="system-ui"
            >
              HEAD Commit
            </text>
          </svg>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '24px',
          }}
        >
          <h2
            style={{
              color: theme.colors.text,
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            Understanding Git Changes
          </h2>

          {/* Source Badges Explanation */}
          <div
            style={{
              marginBottom: '24px',
            }}
          >
            <h3
              style={{
                color: theme.colors.text,
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <GitBranch size={16} />
              Project Folder Sources
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#64748b22',
                    color: '#64748b',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <GitBranch size={12} />
                  my-project (HEAD)
                </div>
                <span
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                  }}
                >
                  The last committed state of your files
                </span>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: theme.colors.primary + '22',
                    color: theme.colors.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <GitBranch size={12} />
                  my-project (main)
                </div>
                <span
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                  }}
                >
                  Your current working tree with uncommitted changes
                </span>
              </div>
            </div>
          </div>

          {/* Color Legend */}
          <div
            style={{
              marginBottom: '24px',
            }}
          >
            <h3
              style={{
                color: theme.colors.text,
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '12px',
              }}
            >
              Change Colors
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Circle size={12} fill="#10b981" color="#10b981" />
                <span style={{ color: theme.colors.text, fontSize: '13px' }}>
                  <strong>Green:</strong> New files
                </span>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Circle size={12} fill="#f59e0b" color="#f59e0b" />
                <span style={{ color: theme.colors.text, fontSize: '13px' }}>
                  <strong>Orange:</strong> Modified
                </span>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Circle size={12} fill="#ef4444" color="#ef4444" />
                <span style={{ color: theme.colors.text, fontSize: '13px' }}>
                  <strong>Red:</strong> Deleted
                </span>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Circle size={12} fill="#8b5cf6" color="#8b5cf6" />
                <span style={{ color: theme.colors.text, fontSize: '13px' }}>
                  <strong>Purple:</strong> Renamed
                </span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: `${theme.colors.primary}10`,
              border: `1px solid ${theme.colors.primary}30`,
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                color: theme.colors.text,
                fontSize: '14px',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              When you enable git changes, the visualization shows both your{' '}
              <strong>working tree</strong> (current files) and the{' '}
              <strong>HEAD commit</strong> (last committed state). Files are
              colored based on their git status, making it easy to see what has
              changed since your last commit.
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
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

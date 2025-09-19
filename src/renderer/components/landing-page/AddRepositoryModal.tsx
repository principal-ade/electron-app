import React, { useState } from 'react';
import {
  X,
  Github,
  FolderPlus,
  Globe,
  HardDrive,
  GitBranch,
  Cloud,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface AddRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocal: () => void;
  onSelectRemote: () => void;
}

export const AddRepositoryModal: React.FC<AddRepositoryModalProps> = ({
  isOpen,
  onClose,
  onSelectLocal,
  onSelectRemote,
}) => {
  const { theme } = useTheme();
  const [hoveredCard, setHoveredCard] = useState<'local' | 'remote' | null>(
    null,
  );

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
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '720px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: '0 0 8px 0',
              }}
            >
              Add Repository
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: 0,
              }}
            >
              Choose how you'd like to add a repository to PrincipalAI
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              color: theme.colors.textSecondary,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Educational Content */}
        <div
          style={{
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '28px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: theme.colors.primary + '20',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitBranch size={24} color={theme.colors.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: '0 0 8px 0',
                }}
              >
                Understanding Repository Types
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.6',
                  margin: 0,
                }}
              >
                PrincipalAI works with both <strong>local repositories</strong>{' '}
                (already on your computer) and
                <strong> remote repositories</strong> (hosted on GitHub). Local
                repos give you immediate access to code analysis and mapping,
                while remote repos can be explored and cloned when needed.
              </p>
            </div>
          </div>
        </div>

        {/* Option Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Local Repository Card */}
          <div
            onClick={onSelectLocal}
            onMouseEnter={() => setHoveredCard('local')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: '12px',
              padding: '24px',
              border: `2px solid ${hoveredCard === 'local' ? theme.colors.primary : theme.colors.border}`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform:
                hoveredCard === 'local' ? 'translateY(-4px)' : 'translateY(0)',
              boxShadow:
                hoveredCard === 'local'
                  ? '0 8px 24px rgba(0, 0, 0, 0.15)'
                  : '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#10b981' + '20',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HardDrive size={24} color="#10b981" />
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Add Local Repository
              </h3>
            </div>

            <p
              style={{
                fontSize: '13px',
                color: theme.colors.textSecondary,
                lineHeight: '1.6',
                marginBottom: '16px',
              }}
            >
              Select a Git repository that already exists on your computer.
              Perfect for projects you're actively working on or have cloned
              previously.
            </p>

            <div
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                }}
              >
                <strong>Use this when:</strong>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                <li>You have code on your machine</li>
                <li>You want immediate file access</li>
                <li>Working on private/local projects</li>
              </ul>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: `1px solid ${theme.colors.border}`,
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color:
                    hoveredCard === 'local'
                      ? theme.colors.primary
                      : theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FolderPlus size={16} />
                Browse for folder
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#10b981' + '20',
                  color: '#10b981',
                  fontWeight: 500,
                }}
              >
                Recommended
              </span>
            </div>
          </div>

          {/* Remote Repository Card */}
          <div
            onClick={onSelectRemote}
            onMouseEnter={() => setHoveredCard('remote')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: '12px',
              padding: '24px',
              border: `2px solid ${hoveredCard === 'remote' ? theme.colors.primary : theme.colors.border}`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform:
                hoveredCard === 'remote' ? 'translateY(-4px)' : 'translateY(0)',
              boxShadow:
                hoveredCard === 'remote'
                  ? '0 8px 24px rgba(0, 0, 0, 0.15)'
                  : '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  backgroundColor: theme.colors.primary + '20',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Cloud size={24} color={theme.colors.primary} />
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Add Remote Repository
              </h3>
            </div>

            <p
              style={{
                fontSize: '13px',
                color: theme.colors.textSecondary,
                lineHeight: '1.6',
                marginBottom: '16px',
              }}
            >
              Add a GitHub repository by URL. You can explore its structure and
              metadata, then clone it locally when you're ready to work with the
              code.
            </p>

            <div
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                }}
              >
                <strong>Use this when:</strong>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                <li>Exploring new repositories</li>
                <li>Tracking repos you may clone later</li>
                <li>Managing team repositories</li>
              </ul>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: `1px solid ${theme.colors.border}`,
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color:
                    hoveredCard === 'remote'
                      ? theme.colors.primary
                      : theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Github size={16} />
                Enter GitHub URL
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: theme.colors.primary + '20',
                  color: theme.colors.primary,
                  fontWeight: 500,
                }}
              >
                Clone later
              </span>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <Globe
            size={18}
            color={theme.colors.primary}
            style={{ marginTop: '2px', flexShrink: 0 }}
          />
          <div>
            <p
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
                margin: 0,
              }}
            >
              <strong>Pro tip:</strong> Start with local repositories for
              immediate analysis. Remote repositories are great for exploring
              open-source projects or tracking repositories you might work with
              in the future. You can always clone a remote repository to work
              with it locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

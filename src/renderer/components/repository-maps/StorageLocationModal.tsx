import { useTheme } from '@a24z/industry-theme';
import { Database, FolderOpen, X, Info } from 'lucide-react';
import { StorageLocation } from '../../types/planning-storage.types';

interface StorageLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: StorageLocation) => void;
  title?: string;
}

export const StorageLocationModal: React.FC<StorageLocationModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  title = 'Choose Storage Location for Excalidraw Diagram',
}) => {
  const { theme } = useTheme();

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
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          {/* Repository Option */}
          <div
            onClick={() => onSelectLocation('repository')}
            style={{
              flex: 1,
              padding: '20px',
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: '8px',
              border: `2px solid transparent`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <FolderOpen size={24} color={theme.colors.primary} />
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Repository Storage
              </h3>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
              }}
            >
              Store the diagram as a <code>.excalidraw</code> file in your
              repository.
            </p>
            <div
              style={{
                marginTop: '12px',
                fontSize: '12px',
                color: theme.colors.textSecondary,
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                ✓ Version controlled with Git
              </div>
              <div style={{ marginBottom: '4px' }}>
                ✓ Visible in file explorer
              </div>
              <div style={{ marginBottom: '4px' }}>
                ✓ Can be shared with team
              </div>
              <div>✓ Included in repository backups</div>
            </div>
          </div>

          {/* App Data Option */}
          <div
            onClick={() => onSelectLocation('app-data')}
            style={{
              flex: 1,
              padding: '20px',
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: '8px',
              border: `2px solid transparent`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <Database size={24} color={theme.colors.primary} />
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                App Data Storage
              </h3>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
              }}
            >
              Store the diagram in application data, separate from repository.
            </p>
            <div
              style={{
                marginTop: '12px',
                fontSize: '12px',
                color: theme.colors.textSecondary,
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                ✓ Doesn't clutter repository
              </div>
              <div style={{ marginBottom: '4px' }}>
                ✓ Available across projects
              </div>
              <div style={{ marginBottom: '4px' }}>
                ✓ Fast access and loading
              </div>
              <div>✓ Managed by the application</div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            backgroundColor: `${theme.colors.primary}10`,
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          <Info size={16} color={theme.colors.primary} />
          <span>
            You can change storage location later by saving the diagram to a
            different location.
          </span>
        </div>
      </div>
    </div>
  );
};

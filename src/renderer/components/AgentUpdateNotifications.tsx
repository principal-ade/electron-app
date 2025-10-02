import { useTheme } from '@a24z/industry-theme';
import { X, Download, Info } from 'lucide-react';
import { useAgentUpdateNotifications } from '../hooks/useAgentUpdateNotifications';

export const AgentUpdateNotifications: React.FC = () => {
  const { theme } = useTheme();
  const { notifications, dismissNotification } = useAgentUpdateNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '400px',
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.primary}`,
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <Info
              size={20}
              color={theme.colors.primary}
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: '0 0 4px 0',
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {notification.displayName} Update Available
              </h4>
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  fontSize: '13px',
                }}
              >
                Version {notification.latestVersion} is ready to install
                {notification.currentVersion &&
                  ` (current: ${notification.currentVersion})`}
              </p>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    // Navigate to agent settings or trigger update
                    dismissNotification(notification.id);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={14} />
                  Update Now
                </button>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Shield } from 'lucide-react';
import { useAuthUser } from '../../../providers/AuthProvider';
import { AuthDetails } from './components/AuthDetails';
import './AuthView.css';

export const AuthView: React.FC = () => {
  const { theme } = useTheme();
  // Read-only: this surface reports the GitHub session the app discovered
  // (gh CLI / stored token). There is no in-app login/logout to drive.
  const { isAuthenticated, user } = useAuthUser();

  const backgroundColor = theme.colors.background;

  return (
    <div
      className="auth-view"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        <Shield size={20} color={theme.colors.primary} />
        <h2
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          GitHub Status
        </h2>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AuthDetails isAuthenticated={isAuthenticated} user={user} />
      </div>
    </div>
  );
};

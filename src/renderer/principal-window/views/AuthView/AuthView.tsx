import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import { useAuthState } from '../../../hooks/useAuthState';
import { AuthDetails } from './components/AuthDetails';
import './AuthView.css';

export const AuthView: React.FC = () => {
  const { theme } = useTheme();
  const {
    isAuthenticated,
    user,
    login,
    logout,
    isLoggingIn,
    loginError,
    clearLoginError,
  } = useAuthState();

  const backgroundColor = theme.colors.background;

  return (
    <div
      className="auth-view"
      style={{
        height: '100%',
        backgroundColor,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <AuthDetails
        isAuthenticated={isAuthenticated}
        user={user}
        login={login}
        logout={logout}
        isLoggingIn={isLoggingIn || false}
        loginError={loginError || null}
        clearLoginError={clearLoginError}
      />
    </div>
  );
};

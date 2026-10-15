/**
 * AuthContext (ported from web-ade) — thin adapter over the desktop app's auth.
 *
 * The ported page originally called the hosted app's `/api/auth/*`. The desktop
 * app already has auth (`useAuthState` → `AuthenticationService` → main
 * `AuthService`), so this just re-exposes that state in the shape the ported
 * components expect (`useAuth()` → `{ user, isAuthenticated, isLoading, … }`).
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useAuthState } from '../../hooks/useAuthState';

export interface User {
  login: string;
  email: string;
  name: string;
  id: number;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (redirectTo?: string) => void;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  /** Kept for API compatibility with the web-ade context. */
  refreshTokens: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();

  const value = useMemo<AuthContextType>(() => {
    const user: User | null = auth.user
      ? {
          login: auth.user.login,
          email: auth.user.email ?? '',
          name: auth.user.name ?? auth.user.login,
          id: auth.user.id ?? 0,
          avatar_url: auth.user.avatarUrl,
        }
      : null;

    return {
      user,
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      login: () => {
        void auth.login();
      },
      logout: auth.logout,
      fetchUser: async () => {},
      refreshTokens: async () => true,
    };
  }, [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

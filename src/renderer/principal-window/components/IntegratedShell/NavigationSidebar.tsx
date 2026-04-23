import { useTheme } from '@principal-ade/industry-theme';
import {
  Settings,
  Activity,
  User,
  Globe,
  Radio,
  ToolCase,
  Rss,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuthState';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { ShellService } from '../../../main-process-api/ShellService';
import type { NavigationView } from './IntegratedShell';
import { useEffect, useState } from 'react';

const DiscordIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface NavigationSidebarProps {
  activeView: NavigationView;
  onViewChange: (view: NavigationView) => void;
}

interface NavItem {
  id: NavigationView;
  icon: React.ReactNode;
  label: string;
  position?: 'top' | 'bottom';
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeView,
  onViewChange,
}) => {
  const { theme, mode } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const [showMonitorButton, setShowMonitorButton] = useState(false);
  const [showConnectionsButton, setShowConnectionsButton] = useState(false);
  const [showProcessesButton, setShowProcessesButton] = useState(false);
  useEffect(() => {
    // Load user preferences for showing buttons
    UserPreferencesService.getPreferences().then((prefs) => {
      setShowMonitorButton(prefs.showMonitorButton ?? false);
      setShowConnectionsButton(prefs.showConnectionsButton ?? false);
      setShowProcessesButton(prefs.showProcessesButton ?? false);
    });

    // Listen for preference changes
    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) {
        if ('showMonitorButton' in detail) {
          setShowMonitorButton(detail.showMonitorButton ?? false);
        }
        if ('showConnectionsButton' in detail) {
          setShowConnectionsButton(detail.showConnectionsButton ?? false);
        }
        if ('showProcessesButton' in detail) {
          setShowProcessesButton(detail.showProcessesButton ?? false);
        }
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  const backgroundColor =
    mode === 'dark' && theme.modes?.dark?.backgroundSecondary
      ? theme.modes.dark.backgroundSecondary
      : theme.colors.backgroundSecondary;

  const accentColor =
    mode === 'dark' && theme.modes?.dark?.accent
      ? theme.modes.dark.accent
      : theme.colors.accent;

  // Create auth icon - either avatar or User icon
  const authIcon =
    isAuthenticated && user ? (
      user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.login}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: `1px solid ${theme.colors.border}`,
          }}
        />
      ) : (
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: theme.colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.background,
            fontFamily: theme.fonts.body,
            fontWeight: theme.fontWeights.semibold,
            fontSize: theme.fontSizes[0],
          }}
        >
          {user.login?.[0]?.toUpperCase() || 'U'}
        </div>
      )
    ) : (
      <User size={20} />
    );

  const navItems: NavItem[] = [
    { id: 'feed', icon: <Rss size={20} />, label: 'Feed' },
    { id: 'skills', icon: <ToolCase size={20} />, label: 'Skills' },
    { id: 'onboarding', icon: <GraduationCap size={20} />, label: 'Tutorials' },
    // Only include processes button if user has enabled it in preferences
    ...(showProcessesButton
      ? [
          {
            id: 'processes' as NavigationView,
            icon: <Globe size={20} />,
            label: 'Processes',
          },
        ]
      : []),
    // Only include connections button if user has enabled it in preferences
    ...(showConnectionsButton
      ? [
          {
            id: 'connections' as NavigationView,
            icon: <Radio size={20} />,
            label: 'Connections',
          },
        ]
      : []),
    // Only include monitoring button if user has enabled it in preferences
    ...(showMonitorButton
      ? [
          {
            id: 'monitoring' as NavigationView,
            icon: <Activity size={20} />,
            label: 'Monitor',
            position: 'bottom' as const,
          },
        ]
      : []),
    {
      id: 'settings',
      icon: <Settings size={20} />,
      label: 'Settings',
      position: 'bottom',
    },
    { id: 'auth', icon: authIcon, label: '', position: 'bottom' },
  ];

  const topItems = navItems.filter((item) => item.position !== 'bottom');
  const bottomItems = navItems.filter((item) => item.position === 'bottom');

  const renderNavItem = (item: NavItem) => (
    <button
      key={item.id}
      className={`nav-item ${activeView === item.id ? 'active' : ''}`}
      onClick={() => onViewChange(item.id)}
      style={{
        width: 'calc(100% - 20px)',
        height: '64px',
        margin: '4px 10px',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        border: 'none',
        background: 'transparent',
        color:
          activeView === item.id ? accentColor : theme.colors.textSecondary,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          background:
            activeView === item.id ? accentColor + '20' : 'transparent',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (activeView !== item.id) {
            e.currentTarget.style.background = theme.colors.border;
          }
        }}
        onMouseLeave={(e) => {
          if (activeView !== item.id) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        {item.icon}
      </div>
      {item.label && (
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight:
              activeView === item.id
                ? theme.fontWeights.semibold
                : theme.fontWeights.body,
            lineHeight: theme.lineHeights.tight,
            textAlign: 'center',
          }}
        >
          {item.label}
        </span>
      )}
    </button>
  );

  return (
    <div
      className="navigation-sidebar"
      style={{
        width: '80px',
        height: '100vh',
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '56px', // Account for titlebar height
        boxSizing: 'border-box', // Include padding in height calculation
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      <div style={{ flex: 1 }}>{topItems.map(renderNavItem)}</div>

      <div
        style={{
          paddingTop: '8px',
          paddingBottom: '16px',
        }}
      >
        <button
          onClick={() => ShellService.openExternal('https://discord.gg/G3qdcC2DXq')}
          title="Join our Discord community"
          style={{
            width: 'calc(100% - 20px)',
            height: '64px',
            margin: '4px 10px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            border: 'none',
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <DiscordIcon size={20} />
          </div>
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.body,
              lineHeight: theme.lineHeights.tight,
              textAlign: 'center',
            }}
          >
            Discord
          </span>
        </button>
        {bottomItems.map(renderNavItem)}
      </div>
    </div>
  );
};

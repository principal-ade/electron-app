import { useTheme } from '@a24z/industry-theme';
import {
  Github,
  Terminal,
  Search,
  Settings,
  Activity,
  User,
  Network,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuthState';
import type { NavigationView } from './IntegratedShell';

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
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          {user.login?.[0]?.toUpperCase() || 'U'}
        </div>
      )
    ) : (
      <User size={20} />
    );

  const navItems: NavItem[] = [
    { id: 'graphs', icon: <Network size={20} />, label: 'Graphs' },
    { id: 'repository', icon: <Github size={20} />, label: 'Repos' },
    { id: 'terminal', icon: <Terminal size={20} />, label: 'Term' },
    { id: 'search', icon: <Search size={20} />, label: 'Search' },
    {
      id: 'monitoring',
      icon: <Activity size={20} />,
      label: 'Monitor',
      position: 'bottom',
    },
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
            fontSize: '11px',
            fontWeight: activeView === item.id ? '600' : '400',
            lineHeight: 1,
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
        {bottomItems.map(renderNavItem)}
      </div>
    </div>
  );
};

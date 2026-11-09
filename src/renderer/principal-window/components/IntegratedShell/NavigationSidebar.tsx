import { useTheme } from '@principal-ade/industry-theme';
import {
  Settings,
  Activity,
  Cpu,
  History,
  ToolCase,
  GraduationCap,
  PenTool,
  Home,
  Network,
  Send,
  Puzzle,
} from 'lucide-react';
import { TopicsIcon } from '../../../components/TopicsIcon';
import { GitIcon } from '../../../components/GitIcon';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { GithubService } from '../../../main-process-api/GithubService';
import type { NavigationView, OverlayView } from './IntegratedShell';
import React, { useEffect, useState } from 'react';
import { useProcessRegistry } from '../../../hooks/useProcessRegistry';
import { blurAfterPointerActivation } from '../../../utils/blurAfterPointerActivation';
import type { SidebarNavigationItem } from '../../../../shared/types/userPreferences.types';
import { resolveSidebarNavigationOrder } from './sidebarNavigation';

interface NavigationSidebarProps {
  /**
   * The workspace surface currently shown in the portal — `null` before the
   * first one is mounted, and unchanged while a standalone overlay floats above
   * it (the surface is still where you are).
   */
  activeView: NavigationView | null;
  activeOverlay: OverlayView | null;
  onViewChange: (view: NavigationView) => void;
  leftPanelCollapsed: boolean;
  onToggleLeftPanel: () => void;
  repository?: { owner: string; name: string } | null;
  isRepositoryActive?: boolean;
  onSelectRepository?: () => void;
}

interface NavItem {
  id: NavigationView | 'repository';
  icon: React.ReactNode;
  label: string;
  title?: string;
}

const RepositoryOwnerAvatar: React.FC<{ owner: string }> = ({ owner }) => {
  const { theme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAvatarUrl(null);
    if (!owner) return;
    GithubService.getUser(owner)
      .then((user) => {
        if (!cancelled) setAvatarUrl(user?.avatar_url ?? null);
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [owner]);

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={`${owner} avatar`}
      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: theme.colors.backgroundTertiary,
        color: theme.colors.textSecondary,
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.semibold,
      }}
    >
      {owner.charAt(0).toUpperCase() || 'R'}
    </span>
  );
};

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeView,
  activeOverlay,
  onViewChange,
  leftPanelCollapsed,
  onToggleLeftPanel,
  repository,
  isRepositoryActive = false,
  onSelectRepository,
}) => {
  const { theme, mode } = useTheme();
  // Managed + detected processes — drives the conditional nav item.
  const { entries: processes } = useProcessRegistry();
  const hasProcesses = processes.length > 0;
  const [hoveredNavItemId, setHoveredNavItemId] = useState<
    NavigationView | 'repository' | null
  >(null);
  const [showOnboardingButton, setShowOnboardingButton] = useState(false);
  const [sidebarNavigation, setSidebarNavigation] = useState<{
    order?: SidebarNavigationItem[];
    visibility?: Partial<Record<SidebarNavigationItem, boolean>>;
  }>();
  useEffect(() => {
    UserPreferencesService.getPreferences().then((prefs) => {
      setShowOnboardingButton(prefs.showOnboardingButton ?? false);
      setSidebarNavigation(prefs.sidebarNavigation);
    });

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) {
        if ('showOnboardingButton' in detail) {
          setShowOnboardingButton(detail.showOnboardingButton ?? false);
        }
        if ('sidebarNavigation' in detail) {
          setSidebarNavigation(detail.sidebarNavigation);
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

  const defaultVisible = (id: SidebarNavigationItem) => {
    if (id === 'onboarding') return showOnboardingButton;
    return true;
  };
  const isVisible = (id: SidebarNavigationItem) =>
    sidebarNavigation?.visibility?.[id] ?? defaultVisible(id);

  const configuredNavItems: NavItem[] = [
    // Titlebar "Sky View" toggles the HomeView overlay; this is the
    // home-panel workspace browse surface (web-app-style left rail).
    {
      id: 'home-panel',
      icon: <Home size={20} />,
      label: 'Home',
    },
    {
      id: 'sessions',
      icon: <History size={20} />,
      label: 'Sessions',
    },
    // Projects surface — the clone/dev-oriented browser.
    {
      id: 'projects' as NavigationView,
      icon: <GitIcon size={20} />,
      label: 'Projects',
    },
    {
      id: 'subsystem-models',
      icon: <Network size={20} />,
      label: 'Models',
    },
    { id: 'topics', icon: <TopicsIcon />, label: 'Topics' },
    { id: 'drawings', icon: <PenTool size={20} />, label: 'Drawings' },
    { id: 'requests', icon: <Send size={20} />, label: 'Requests' },
    {
      id: 'onboarding',
      icon: <GraduationCap size={20} />,
      label: 'Tutorials',
    },
    // Processes: shown whenever processes run.
    {
      id: 'processes',
      icon: <Cpu size={20} />,
      label: 'Processes',
    },
    {
      id: 'skills',
      icon: <ToolCase size={20} />,
      label: 'Skills',
    },
  ];

  const fixedBottomNavItems: NavItem[] = [
    {
      id: 'monitoring',
      icon: <Activity size={20} />,
      label: 'Monitor',
    },
    {
      id: 'integrations',
      icon: <Puzzle size={20} />,
      label: 'Integrations',
    },
    {
      id: 'settings',
      icon: <Settings size={20} />,
      label: 'Settings',
    },
  ];

  const navItems = resolveSidebarNavigationOrder(sidebarNavigation?.order)
    .filter((id) => isVisible(id) && (id !== 'processes' || hasProcesses))
    .flatMap((id) => {
      const item = configuredNavItems.find((candidate) => candidate.id === id);
      return item ? [item] : [];
    });
  if (repository) {
    const homeIndex = navItems.findIndex((item) => item.id === 'home-panel');
    navItems.splice(homeIndex + 1, 0, {
      id: 'repository',
      icon: <RepositoryOwnerAvatar owner={repository.owner} />,
      label: repository.name,
      title: `${repository.owner}/${repository.name}`,
    });
  }

  const renderNavItem = (item: NavItem) => {
    const isStandaloneView =
      item.id === 'monitoring' ||
      item.id === 'integrations' ||
      item.id === 'settings';
    const active =
      item.id === 'repository'
        ? isRepositoryActive
        : isStandaloneView
          ? activeOverlay === item.id
          : !isRepositoryActive && activeView === item.id;
    const hovered = hoveredNavItemId === item.id;

    return (
      <button
        key={item.id}
        className={`nav-item ${active ? 'active' : ''}`}
        onClick={(event) => {
          blurAfterPointerActivation(event);
          if (active || leftPanelCollapsed) {
            onToggleLeftPanel();
          }
          if (item.id === 'repository') {
            onSelectRepository?.();
          } else {
            onViewChange(item.id);
          }
        }}
        title={item.title ?? item.label}
        onMouseEnter={() => setHoveredNavItemId(item.id)}
        onMouseLeave={() => setHoveredNavItemId(null)}
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
          color: active || hovered ? accentColor : theme.colors.textSecondary,
          cursor: 'pointer',
          position: 'relative',
          transition: 'color 0.2s ease',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            background: active
              ? `${accentColor}20`
              : hovered
                ? theme.colors.border
                : 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          {item.icon}
        </div>
        {item.label && (
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              fontWeight: active
                ? theme.fontWeights.semibold
                : theme.fontWeights.body,
              lineHeight: theme.lineHeights.tight,
              textAlign: 'center',
              ...(item.id === 'repository'
                ? {
                    maxWidth: '68px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }
                : {}),
            }}
          >
            {item.label}
          </span>
        )}
      </button>
    );
  };

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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {navItems.map(renderNavItem)}
      </div>
      <div style={{ paddingBottom: '16px' }}>
        {fixedBottomNavItems.map(renderNavItem)}
      </div>
    </div>
  );
};

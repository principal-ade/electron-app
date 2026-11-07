import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import type {
  SidebarNavigationItem,
  UserPreferences,
} from '../../../../../shared/types/userPreferences.types';
import {
  DEFAULT_SIDEBAR_NAVIGATION_ORDER,
  resolveSidebarNavigationOrder,
  SIDEBAR_NAVIGATION_ITEMS,
} from '../../../components/IntegratedShell/sidebarNavigation';

const defaultVisibility = (
  item: SidebarNavigationItem,
  preferences: UserPreferences,
): boolean => {
  if (item === 'monitoring') return preferences.showMonitorButton ?? false;
  if (item === 'onboarding') return preferences.showOnboardingButton ?? false;
  return true;
};

export const SidebarNavigationSettings: React.FC = () => {
  const { theme } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [order, setOrder] = useState<SidebarNavigationItem[]>([
    ...DEFAULT_SIDEBAR_NAVIGATION_ORDER,
  ]);
  const [visibility, setVisibility] = useState<
    Partial<Record<SidebarNavigationItem, boolean>>
  >({});

  useEffect(() => {
    const applyPreferences = (next: UserPreferences) => {
      setPreferences(next);
      setOrder(resolveSidebarNavigationOrder(next.sidebarNavigation?.order));
      setVisibility(next.sidebarNavigation?.visibility ?? {});
    };

    UserPreferencesService.getPreferences().then(applyPreferences);
    return UserPreferencesService.onPreferencesUpdated(applyPreferences);
  }, []);

  const save = async (
    nextOrder: SidebarNavigationItem[],
    nextVisibility: Partial<Record<SidebarNavigationItem, boolean>>,
  ) => {
    setOrder(nextOrder);
    setVisibility(nextVisibility);
    await UserPreferencesService.updatePreferences({
      sidebarNavigation: {
        order: nextOrder,
        visibility: nextVisibility,
      },
    });
  };

  const move = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[index], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[index],
    ];
    void save(nextOrder, visibility);
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      <h4
        style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '16px',
          color: theme.colors.text,
        }}
      >
        Sidebar Navigation
      </h4>
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <p
          style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            margin: '0 0 16px',
          }}
        >
          Choose which destinations appear in the sidebar and change their
          order. Processes only appears while processes are active. The
          repository shortcut and Discord link are managed separately.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {order.map((id, index) => {
            const item = SIDEBAR_NAVIGATION_ITEMS.find(
              (entry) => entry.id === id,
            );
            if (!item) return null;
            const visible =
              visibility[id] ?? defaultVisibility(id, preferences);
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '42px',
                  padding: '6px 10px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  color: theme.colors.text,
                }}
              >
                <input
                  type="checkbox"
                  aria-label={`Show ${item.label} in sidebar`}
                  checked={visible}
                  onChange={(event) => {
                    const nextVisibility = {
                      ...visibility,
                      [id]: event.target.checked,
                    };
                    void save(order, nextVisibility);
                  }}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ flex: 1, fontSize: '14px' }}>{item.label}</span>
                <button
                  type="button"
                  aria-label={`Move ${item.label} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  style={moveButtonStyle(theme, index === 0)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.label} down`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                  style={moveButtonStyle(theme, index === order.length - 1)}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void save([...DEFAULT_SIDEBAR_NAVIGATION_ORDER], {})}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '14px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <RotateCcw size={14} />
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

const moveButtonStyle = (
  theme: ReturnType<typeof useTheme>['theme'],
  disabled: boolean,
): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  borderRadius: '6px',
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.background,
  color: theme.colors.textSecondary,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
});

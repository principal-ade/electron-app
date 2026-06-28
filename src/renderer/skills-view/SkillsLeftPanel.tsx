/**
 * SkillsLeftPanel
 *
 * The Skills surface's swappable left-panel slot in `WorkspaceShell` — the
 * launcher: the view-mode header (Installed / Browse) atop the skills list
 * (`GlobalSkillsPanel` / `SkillsBrowsePanel`, or `RecentSkillsPanel` when
 * browsing with no repo loaded). Selecting a skill emits `skill:selected` on the
 * provider bus, which `SkillsSurfaceProvider` turns into the detail tab.
 *
 * All state comes from `useSkillsSurface`; this is purely presentational —
 * the list/header JSX lifted out of the former `SkillBrowserView`.
 */
import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { SkillsBrowsePanel, GlobalSkillsPanel } from '@industry-theme/agent-panels';
import { SkillBrowserViewHeader } from '../principal-window/views/SkillBrowserView/SkillBrowserViewHeader';
import { SkillsRepoOnboarding } from '../principal-window/views/SkillBrowserView/SkillsRepoOnboarding';
import { RecentSkillsPanel } from '../principal-window/views/SkillBrowserView/RecentSkillsPanel';
import { useSkillsSurface } from './SkillsSurfaceContext';

export const SkillsLeftPanel: React.FC = () => {
  const { theme } = useTheme();
  const s = useSkillsSurface();

  if (s.checkingConfig) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        Loading…
      </div>
    );
  }

  if (s.showOnboarding) {
    return (
      <SkillsRepoOnboarding
        onComplete={s.onOnboardingComplete}
        onCancel={() => s.setShowOnboarding(false)}
      />
    );
  }

  const showRecent = s.viewMode === 'browse' && !s.browseFileTree;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <SkillBrowserViewHeader
        viewMode={s.viewMode}
        onViewModeChange={s.setViewMode}
        currentRepo={s.githubRepoInfo}
        onClearRepo={s.clearRepo}
        hasDetectedDirectories={s.detectedDirectories.length > 0}
        onOpenSetup={s.openSetup}
        detectedDirectories={s.detectedDirectories}
      />

      {s.error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: theme.colors.error + '20',
            borderBottom: `1px solid ${theme.colors.error}`,
            color: theme.colors.error,
            fontSize: theme.fontSizes[1],
          }}
        >
          {s.error}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {showRecent ? (
          <RecentSkillsPanel
            recentRepos={s.recentRepos}
            onSelectRepo={s.handleSelectRecentRepo}
            githubUrl={s.githubUrl}
            onGithubUrlChange={s.setGithubUrl}
            onFetchSkills={s.handleFetchSkills}
            isLoading={s.isLoading}
          />
        ) : s.viewMode === 'browse' ? (
          <SkillsBrowsePanel
            context={s.context}
            actions={s.actions}
            events={s.events}
          />
        ) : (
          <GlobalSkillsPanel
            context={s.context}
            actions={s.actions}
            events={s.events}
          />
        )}
      </div>
    </div>
  );
};

export default SkillsLeftPanel;

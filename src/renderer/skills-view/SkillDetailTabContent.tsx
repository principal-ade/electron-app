/**
 * SkillDetailTabContent
 *
 * The singleton skill detail tab in `WorkspaceShell` — the right-hand
 * `SkillDetailPanel` of the former `SkillBrowserView`, now a tab. It renders the
 * currently-selected skill (from `useSkillsSurface`) with its install config
 * (install / update / uninstall), so selecting a different skill in the left
 * list just re-renders this one tab.
 *
 * The `installConfig` wiring is moved verbatim from `SkillBrowserView`'s
 * `skill-detail` panel.
 */
import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  panels as agentPanels,
  type SkillDetailPanelProps,
} from '@industry-theme/agent-panels';
import { useSkillsSurface } from './SkillsSurfaceContext';

const SkillDetailPanelComponent = agentPanels.find(
  (p) => p.metadata?.id === 'industry-theme.skill-detail',
)?.component as React.FC<SkillDetailPanelProps> | undefined;

export const SkillDetailTabContent: React.FC = () => {
  const { theme } = useTheme();
  const s = useSkillsSurface();
  const { selectedSkill } = s;

  if (!SkillDetailPanelComponent) {
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
        Failed to load skill detail panel
      </div>
    );
  }

  if (!selectedSkill) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
          fontFamily: theme.fonts.body,
        }}
      >
        Select a skill from the list to see its details.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: 0 }}>
      <SkillDetailPanelComponent
        context={s.context}
        actions={s.actions}
        events={s.events}
        installConfig={{
          isInstalled: s.isSkillInstalled(selectedSkill),
          hasUpdate: (() => {
            if (!s.isSkillInstalled(selectedSkill)) return false;
            const currentSkillSha = s.getSkillTreeSha(
              selectedSkill.skillFolderPath,
            );
            if (!s.selectedSkillMetadata?.sha || !currentSkillSha) return false;
            return s.selectedSkillMetadata.sha !== currentSkillSha;
          })(),
          installedDirectoryIds: s.getSkillInstalledDirectories(selectedSkill),
          githubSource: s.githubRepoInfo
            ? {
                owner: s.githubRepoInfo.owner,
                repo: s.githubRepoInfo.repo,
                branch: s.githubRepoInfo.branch,
                skillPath: selectedSkill.path,
                currentSha: s.getSkillTreeSha(selectedSkill.skillFolderPath),
              }
            : undefined,
          onInstall: () => {
            if (s.isSkillInstalled(selectedSkill)) {
              const installedDirs =
                s.getSkillInstalledDirectories(selectedSkill);
              if (installedDirs.length > 0) {
                s.handleInstallSkillToDirectories(installedDirs)
                  .then(async () => {
                    const metadata =
                      await s.getInstalledSkillMetadata(selectedSkill);
                    s.setSelectedSkillMetadata(metadata);
                  })
                  .catch((err) => {
                    console.error('[SkillDetailTab] Update failed:', err);
                    alert(
                      `Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                    );
                  });
                return;
              }
            }
            s.openInstallModal();
          },
          onUninstall: s.isSkillInstalled(selectedSkill)
            ? () => {
                const installedDirs =
                  s.getSkillInstalledDirectories(selectedSkill);
                if (installedDirs.length > 0) {
                  if (
                    window.confirm(
                      `Uninstall "${selectedSkill.name}" from its installed directories?`,
                    )
                  ) {
                    s.handleUninstallSkillFromDirectories(installedDirs);
                  }
                }
              }
            : undefined,
        }}
        hideEditButtons={s.viewMode === 'browse'}
      />
    </div>
  );
};

export default SkillDetailTabContent;

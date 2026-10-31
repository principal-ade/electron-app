/**
 * SkillDetailTabContent
 *
 * The body of a per-skill detail tab in `WorkspaceShell` — the right-hand
 * `SkillDetailPanel` of the former `SkillBrowserView`, now a tab. The skill
 * comes from the tab itself; install config (install / update / uninstall) and
 * metadata come from `useSkillsSurface`, whose selection follows the active
 * skill tab.
 *
 * The `installConfig` wiring is moved verbatim from `SkillBrowserView`'s
 * `skill-detail` panel.
 */
import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  panels as agentPanels,
  type Skill,
  type SkillDetailPanelProps,
} from '../panels/agent-panels';
import { useSkillsSurface } from './SkillsSurfaceContext';

const SkillDetailPanelComponent = agentPanels.find(
  (p) => p.metadata?.id === 'industry-theme.skill-detail',
)?.component as React.FC<SkillDetailPanelProps> | undefined;

export const SkillDetailTabContent: React.FC<{ skill: Skill }> = ({
  skill,
}) => {
  const { theme } = useTheme();
  const s = useSkillsSurface();

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

  return (
    <div style={{ height: '100%', width: '100%', minHeight: 0 }}>
      <SkillDetailPanelComponent
        context={s.context}
        actions={s.actions}
        events={s.events}
        skill={skill}
        installConfig={{
          isInstalled: s.isSkillInstalled(skill),
          hasUpdate: (() => {
            if (!s.isSkillInstalled(skill)) return false;
            const currentSkillSha = s.getSkillTreeSha(skill.skillFolderPath);
            if (!s.selectedSkillMetadata?.sha || !currentSkillSha) return false;
            return s.selectedSkillMetadata.sha !== currentSkillSha;
          })(),
          installedDirectoryIds: s.getSkillInstalledDirectories(skill),
          githubSource: s.githubRepoInfo
            ? {
                owner: s.githubRepoInfo.owner,
                repo: s.githubRepoInfo.repo,
                branch: s.githubRepoInfo.branch,
                skillPath: skill.path,
                currentSha: s.getSkillTreeSha(skill.skillFolderPath),
              }
            : undefined,
          onInstall: () => {
            if (s.isSkillInstalled(skill)) {
              const installedDirs = s.getSkillInstalledDirectories(skill);
              if (installedDirs.length > 0) {
                s.handleInstallSkillToDirectories(installedDirs)
                  .then(async () => {
                    const metadata = await s.getInstalledSkillMetadata(skill);
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
          onUninstall: s.isSkillInstalled(skill)
            ? () => {
                const installedDirs = s.getSkillInstalledDirectories(skill);
                if (installedDirs.length > 0) {
                  if (
                    window.confirm(
                      `Uninstall "${skill.name}" from its installed directories?`,
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

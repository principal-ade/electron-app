/**
 * RepositoryBuildsSection
 *
 * Builds list for a repository profile: every build configuration whose
 * repo matches the profile's purl, with an affordance to open each one.
 * Renders nothing when the repo has no configurations.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Hammer } from 'lucide-react';
import type { BuildConfigurationSummary } from '../../../shared/build-configurations/types';
import { BuildConfigurationService } from '../../main-process-api/BuildConfigurationService';
import { useWorkspaceTabsOptional } from '../../principal-window/PortalTabsContext';

export interface RepositoryBuildsSectionProps {
  /** pkg:github/<owner>/<repo> of the profiled repository. */
  purl: string;
}

export const RepositoryBuildsSection: React.FC<
  RepositoryBuildsSectionProps
> = ({ purl }) => {
  const { theme } = useTheme();
  // Null outside the workspace provider (Storybook, isolated tests): the
  // list still renders, but rows are not clickable.
  const workspace = useWorkspaceTabsOptional();
  const [configs, setConfigs] = useState<BuildConfigurationSummary[] | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await BuildConfigurationService.list();
        if (!cancelled) {
          setConfigs(all.filter((config) => config.repo === purl));
        }
      } catch {
        if (!cancelled) setConfigs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purl]);

  if (!configs || configs.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          fontFamily: theme.fonts?.body,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights?.semibold ?? 600,
          color: theme.colors.textSecondary,
        }}
      >
        <Hammer size={14} />
        Builds
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {configs.map((config) => {
          const color = config.confirmed
            ? theme.colors.success
            : theme.colors.warning;
          return (
            <button
              key={config.id}
              type="button"
              onClick={
                workspace
                  ? () =>
                      workspace.openBuildConfiguration(
                        config.id,
                        config.name,
                        config.repo,
                      )
                  : undefined
              }
              title={`Open ${config.name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 6,
                cursor: workspace ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: theme.fonts?.body,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.text,
                }}
              >
                {config.name}
              </span>
              <span
                style={{
                  fontFamily: theme.fonts?.body,
                  fontSize: theme.fontSizes[0],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color,
                  border: `1px solid ${color}60`,
                  background: `${color}12`,
                  borderRadius: 999,
                  padding: '2px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                {config.confirmed ? 'confirmed' : 'unconfirmed'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RepositoryBuildsSection;

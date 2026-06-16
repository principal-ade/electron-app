import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';
import type { CityData } from '@principal-ai/file-city-react';
import { TrailMinimap } from './TrailMinimap';

export interface RepoTrailCoverageCardProps {
  /** Display label for the repo (e.g. last path segment or "owner/repo"). */
  repoLabel: string;
  /** GitHub owner login — drives the avatar; falls back to a folder icon. */
  ownerLogin?: string;
  /**
   * City for the repo. Building paths are repo-relative. `null` once resolved
   * but the repo's file tree wasn't cached (never opened in the app) — the
   * card then shows a muted "open to map" body instead of a minimap.
   */
  cityData: CityData | null;
  /** Repo-relative path → number of trails touching it (the heat map input). */
  coverageByPath?: ReadonlyMap<string, number>;
  /** Number of trails in this repo (footer stat). */
  trailCount: number;
  /** True while the city/coverage is still resolving — shows a skeleton body. */
  loading?: boolean;
  /** Edge length of the square card in px. Defaults to 300. */
  size?: number;
  /** Fired on click / keyboard activate. */
  onClick?: () => void;
}

const EMPTY_COVERAGE: ReadonlyMap<string, number> = new Map();

const HEADER_HEIGHT = 48;
const FOOTER_HEIGHT = 40;

/**
 * A consistent, square repo card for the trails view: an owner/name header, a
 * square non-interactive File City minimap heat-mapping the repo's all-trails
 * coverage, and a footer with the trail count and the number of files covered.
 *
 * The minimap body is a fixed square (card size minus the header/footer), so
 * every card is the same shape regardless of repo or coverage.
 */
export const RepoTrailCoverageCard: React.FC<RepoTrailCoverageCardProps> = ({
  repoLabel,
  ownerLogin,
  cityData,
  coverageByPath = EMPTY_COVERAGE,
  trailCount,
  loading = false,
  size = 300,
  onClick,
}) => {
  const { theme } = useTheme();
  // The footer coverage stat shows a percent by default; clicking it flips to
  // the covered/total file fraction.
  const [showFraction, setShowFraction] = useState(false);

  // Files covered = distinct paths that resolve to a real building, over the
  // repo's total building count. Covered is computed the same way the minimap
  // filters, so the footer count matches what lights up on the map. Null when
  // there's no city yet (resolving / no cached tree).
  const fileStats = useMemo(() => {
    if (!cityData) return null;
    const buildings = new Set(cityData.buildings.map((b) => b.path));
    let count = 0;
    for (const [path, n] of coverageByPath) {
      if (n > 0 && buildings.has(path)) count += 1;
    }
    const totalFiles = buildings.size;
    const pct = totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0;
    return { coveredFiles: count, totalFiles, pct };
  }, [cityData, coverageByPath]);

  const bodyHeight = size - HEADER_HEIGHT - FOOTER_HEIGHT;

  const statStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[1],
    color: theme.colors.textSecondary,
  };
  const statNumStyle: React.CSSProperties = {
    color: theme.colors.text,
    fontWeight: theme.fontWeights.semibold,
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={onClick ? `Open ${repoLabel}` : repoLabel}
      style={{
        width: size,
        height: size,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.background,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Header: owner avatar + repo name */}
      <div
        style={{
          height: HEADER_HEIGHT,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        {ownerLogin ? (
          <img
            src={`https://github.com/${ownerLogin}.png?size=48`}
            alt=""
            width={24}
            height={24}
            style={{
              borderRadius: 6,
              flex: '0 0 auto',
              border: `1px solid ${theme.colors.border}`,
            }}
          />
        ) : (
          <FolderGit2
            size={22}
            color={theme.colors.primary}
            style={{ flex: '0 0 auto' }}
          />
        )}
        <span
          style={{
            minWidth: 0,
            flex: 1,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights.semibold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {repoLabel}
        </span>
      </div>

      {/* Body: square coverage minimap (or a muted placeholder while
          resolving / when the repo tree isn't cached). */}
      <div
        style={{
          flex: '0 0 auto',
          height: bodyHeight,
          display: cityData ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: cityData ? undefined : theme.colors.backgroundSecondary,
        }}
      >
        {cityData ? (
          <TrailMinimap
            cityData={cityData}
            coverageByPath={coverageByPath}
            height={bodyHeight}
          />
        ) : (
          <span
            style={{
              color: theme.colors.textTertiary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              padding: '0 16px',
              textAlign: 'center',
            }}
          >
            {loading ? 'Mapping coverage…' : 'Open this repo to map coverage'}
          </span>
        )}
      </div>

      {/* Footer: coverage (left) + trail count (right) */}
      <div
        style={{
          height: FOOTER_HEIGHT,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        {fileStats ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              // Toggle the stat without triggering the card's open handler.
              e.stopPropagation();
              setShowFraction((v) => !v);
            }}
            style={{ ...statStyle, cursor: 'pointer' }}
            title={
              showFraction
                ? `${fileStats.pct}% of files covered by trails — click for percent`
                : `${fileStats.coveredFiles} of ${fileStats.totalFiles} files covered by trails — click for file count`
            }
          >
            {showFraction ? (
              <>
                <span style={statNumStyle}>
                  {fileStats.coveredFiles} / {fileStats.totalFiles}
                </span>
                files
              </>
            ) : (
              <span style={statNumStyle}>{fileStats.pct}% covered</span>
            )}
          </span>
        ) : (
          <span style={statStyle}>—</span>
        )}
        <span style={statStyle}>
          <span style={statNumStyle}>{trailCount}</span>
          {trailCount === 1 ? 'trail' : 'trails'}
        </span>
      </div>
    </div>
  );
};

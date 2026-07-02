/**
 * TopicTrailsRail
 *
 * The right rail shared by every topic-tab surface. It has two sections:
 *
 * - Projects — the repos the topic spans, derived from `topic.repos` (PURLs)
 *   and rendered as project cards. Clicking a card invokes `onOpenProject`, or
 *   copies the PURL to the clipboard when no handler is supplied.
 * - Trails — the topic's curated trails, resolved to titles against the local
 *   trail library and rendered as a clickable list. Behavior-agnostic: each
 *   surface supplies `onOpenTrail`, so the Topics view opens a `local-trail`
 *   tab while the dev-workspace activates the trail in File City.
 *
 * Returns `null` when the topic has neither projects nor trails, letting the
 * description body take the full width.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Footprints, FolderGit2 } from 'lucide-react';
import { parsePurl } from '@principal-ai/alexandria-core-library';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { getPrincipalBridgeUrl } from '../../../shared/config/appBranding';
import {
  ProjectRepoCard,
  type ProjectRepoCardData,
} from '../../panels/cards/ProjectRepoCard';

/** A topic trail resolved against the local library for its title. */
interface TrailEntry {
  id: string;
  title: string;
}

/** A topic repo (a `topic.repos` PURL) resolved to card display data. */
interface ProjectEntry {
  /** The source PURL — stable React key. */
  purl: string;
  data: ProjectRepoCardData;
}

/**
 * Resolve a `topic.repos` PURL to project-card display data. A github repo
 * (`pkg:github/owner/repo`) yields owner + repo, so the card shows the org
 * avatar. A machine-local repo (`pkg:generic/local/<encoded-path>`) has no
 * owner and its name is an encoded absolute path, so we show only the path's
 * last segment as a best-effort label.
 */
function projectFromPurl(purl: string): ProjectEntry | null {
  const parsed = parsePurl(purl);
  if (!parsed) return null;
  if (parsed.namespace && parsed.namespace !== 'local') {
    return {
      purl,
      data: { repoName: parsed.name, ownerLogin: parsed.namespace },
    };
  }
  const segments = parsed.name.split('-').filter(Boolean);
  return { purl, data: { repoName: segments[segments.length - 1] || parsed.name } };
}

export interface TopicTrailsRailProps {
  topicId: string;
  /**
   * Invoked when a trail row is clicked. Each surface wires its own behavior:
   * the Topics view opens a `local-trail` tab; the dev-workspace activates the
   * trail in File City.
   */
  onOpenTrail: (trailId: string, title: string) => void;
  /** Predicate for active-row styling (e.g. the trail's tab is focused). */
  isTrailActive?: (trailId: string) => boolean;
  /**
   * Invoked when a project card is clicked, with the repo's PURL. When omitted,
   * clicking a project copies its PURL to the clipboard.
   */
  onOpenProject?: (purl: string) => void;
  /** Rail width in px. In `fill` mode this is the minimum width instead. */
  width?: number;
  /**
   * Grow to fill the remaining row space rather than holding a fixed width.
   * Used when the description column is capped (so the rail closes the gap
   * instead of leaving dead space beside the prose). `width` becomes the floor.
   */
  fill?: boolean;
  /**
   * Reports whether the topic has no projects and no trails, so the host can
   * react to the rail collapsing (e.g. center the description in the full view
   * instead of leaving it capped beside an absent rail).
   */
  onEmptyChange?: (empty: boolean) => void;
}

export const TopicTrailsRail: React.FC<TopicTrailsRailProps> = ({
  topicId,
  onOpenTrail,
  isTrailActive,
  onOpenProject,
  width = 280,
  fill = false,
  onEmptyChange,
}) => {
  const { theme } = useTheme();
  const [trails, setTrails] = React.useState<TrailEntry[]>([]);
  const [projects, setProjects] = React.useState<ProjectEntry[]>([]);

  // Resolve the topic's trail ids to titles via the local trail library, and
  // its `repos` PURLs to project cards. Kept live on `onTopicChange` so a trail
  // or repo added to the topic shows up here.
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [topic, listing] = await Promise.all([
          TopicService.getTopic(topicId),
          TrailLibraryService.list(),
        ]);
        if (cancelled) return;
        const byId = new Map(listing.entries.map((e) => [e.id, e.title]));
        const ids = topic?.trailIds ?? [];
        setTrails(
          ids.map((id) => ({ id, title: byId.get(id) ?? 'Untitled trail' })),
        );
        const repos = topic?.repos ?? [];
        setProjects(
          repos
            .map((purl) => projectFromPurl(purl))
            .filter((p): p is ProjectEntry => p !== null),
        );
      } catch (err) {
        console.error('[TopicTrailsRail] failed to load rail', err);
        if (!cancelled) {
          setTrails([]);
          setProjects([]);
        }
      }
    };
    void load();
    const off = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) void load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [topicId]);

  // Project click: the host may override (e.g. open the repo); by default we
  // copy the PURL to the clipboard so it can be pasted as agent context.
  const handleProjectClick = React.useCallback(
    (purl: string) => {
      if (onOpenProject) {
        onOpenProject(purl);
        return;
      }
      void navigator.clipboard.writeText(purl).catch(() => {
        // navigator.clipboard can reject in restricted webviews; no-op.
      });
    },
    [onOpenProject],
  );

  // Empty when the topic has neither projects nor trails. The rail collapses
  // (returns null) and reports it, so the host can center the description in
  // the full view instead of leaving it capped beside an absent rail.
  const isEmpty = trails.length === 0 && projects.length === 0;
  React.useEffect(() => {
    onEmptyChange?.(isEmpty);
  }, [isEmpty, onEmptyChange]);
  if (isEmpty) return null;

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    backgroundColor: theme.colors.background,
    color: theme.colors.textSecondary,
  };
  const sectionLabelStyle: React.CSSProperties = {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[0],
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return (
    <aside
      style={{
        // `1 0 0%`: grow into the leftover space, but never shrink — so the
        // description holds its width and only gives way once the rail has hit
        // its `minWidth` floor and there's genuinely no more room.
        ...(fill
          ? { flex: '1 0 0%', minWidth: width }
          : { width, flexShrink: 0 }),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {projects.length > 0 && (
          <section>
            <div style={sectionHeaderStyle}>
              <FolderGit2 size={14} />
              <span style={sectionLabelStyle}>Projects ({projects.length})</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 8,
              }}
            >
              {projects.map((project) => (
                <ProjectRepoCard
                  key={project.purl}
                  repo={project.data}
                  dense
                  onClick={() => handleProjectClick(project.purl)}
                />
              ))}
            </div>
          </section>
        )}

        {trails.length > 0 && (
          <section>
            <div style={sectionHeaderStyle}>
              <Footprints size={14} />
              <span style={sectionLabelStyle}>Trails ({trails.length})</span>
            </div>
            <div style={{ padding: 8 }}>
              {trails.map((trail) => {
          const active = isTrailActive?.(trail.id) ?? false;
          return (
            <button
              key={trail.id}
              type="button"
              draggable
              onDragStart={(e) => {
                if (!e.dataTransfer) return;
                // Same agent-prompt payload the Trails panel uses, so an
                // individual trail can be dragged into a terminal as context.
                const payload = `Use file-city trail "${trail.title}" (id: ${trail.id}) as context — fetch via:\ncurl -s ${getPrincipalBridgeUrl()}/api/file-city/trail/${trail.id}`;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', payload);
              }}
              onClick={() => onOpenTrail(trail.id, trail.title)}
              title={trail.title}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                marginBottom: 2,
                borderRadius: 6,
                border: `1px solid ${
                  active ? theme.colors.primary : 'transparent'
                }`,
                background: active
                  ? theme.colors.backgroundSecondary
                  : 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background =
                    theme.colors.backgroundSecondary;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Footprints
                size={14}
                style={{ flexShrink: 0, opacity: 0.8, marginTop: 2 }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  lineHeight: 1.35,
                }}
              >
                {trail.title}
              </span>
            </button>
          );
        })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};

export default TopicTrailsRail;

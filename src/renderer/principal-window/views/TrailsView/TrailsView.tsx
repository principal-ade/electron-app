import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitBranch, X, Folder } from 'lucide-react';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../../../contexts/TerminalContext';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

/**
 * Single footprint glyph — matches the SVG used on the web-ade home page.
 * Drawn pointing "up"; rotate the wrapper to orient it along a trail.
 */
const Footprint: React.FC<{
  side: 'left' | 'right';
  size?: number;
  color: string;
  strokeWidth?: number;
}> = ({ side, size = 20, color, strokeWidth = 2 }) => (
  <svg
    viewBox="2 1 9 18"
    width={size}
    height={size * (18 / 9)}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    aria-hidden
  >
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
    <path d="M4 13h4" />
  </svg>
);

/**
 * Diagonal trail of alternating left/right footprints. The row is centered
 * on (anchorX, anchorY) of the parent and rotated around that point, so two
 * trails with opposite rotations cross paths through the anchor.
 *
 * Each footprint fades in and out on a continuous loop, staggered along
 * the trail so the row appears to "walk" across.
 */
const FootprintTrail: React.FC<{
  /** Trail orientation. Restricted to horizontal/vertical multiples of 90°. */
  rotationDeg: 0 | 90 | 180 | 270;
  anchorX?: string;
  anchorY?: string;
  count?: number;
  color: string;
  size?: number;
  gap?: number;
  opacity?: number;
  /** Stagger between consecutive feet starting to fade in, in seconds */
  stepSec?: number;
  /** Per-foot fade-in duration, in seconds */
  fadeInSec?: number;
  /** Time the full trail stays visible after the last foot lights up */
  holdSec?: number;
  /** Time the whole trail takes to fade out, in seconds */
  fadeOutSec?: number;
  /** Global cycle duration shared across trails (so they take turns) */
  cycleSec: number;
  /** Phase offset within the cycle, in seconds */
  delaySec?: number;
}> = ({
  rotationDeg,
  anchorX = '50%',
  anchorY = '50%',
  count = 16,
  color,
  size = 22,
  gap = 30,
  opacity = 0.28,
  stepSec = 0.15,
  fadeInSec = 0.3,
  holdSec = 1.2,
  fadeOutSec = 0.6,
  cycleSec,
  delaySec = 0,
}) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  // The whole trail fades out together at this moment within the cycle:
  const fadeOutStart = (count - 1) * stepSec + fadeInSec + holdSec;
  const fadeOutEnd = fadeOutStart + fadeOutSec;
  const foOutStartPct = (fadeOutStart / cycleSec) * 100;
  const foOutEndPct = (fadeOutEnd / cycleSec) * 100;

  // One keyframe per foot — same fade-out for all, but per-foot fade-in time.
  const keyframes = Array.from({ length: count }, (_, i) => {
    const fadeInStart = i * stepSec;
    const fadeInEnd = fadeInStart + fadeInSec;
    const inStartPct = (fadeInStart / cycleSec) * 100;
    const inEndPct = (fadeInEnd / cycleSec) * 100;
    return `
      @keyframes trail-${id}-foot-${i} {
        0%, ${inStartPct.toFixed(3)}% { opacity: 0; }
        ${inEndPct.toFixed(3)}% { opacity: var(--trails-foot-opacity, 0.28); }
        ${foOutStartPct.toFixed(3)}% { opacity: var(--trails-foot-opacity, 0.28); }
        ${foOutEndPct.toFixed(3)}%, 100% { opacity: 0; }
      }
    `;
  }).join('\n');

  return (
    <>
      <style>{keyframes}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: anchorY,
          left: anchorX,
          display: 'flex',
          alignItems: 'center',
          gap,
          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
          transformOrigin: 'center',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
          return (
            <span
              key={i}
              style={{
                transform: `translateY(${side === 'left' ? '-7px' : '7px'}) rotate(90deg)`,
                transformOrigin: 'center',
                flexShrink: 0,
                opacity: 0,
                animationName: `trail-${id}-foot-${i}`,
                animationDuration: `${cycleSec}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${delaySec}s`,
                ['--trails-foot-opacity' as never]: String(opacity),
              }}
            >
              <Footprint side={side} size={size} color={color} />
            </span>
          );
        })}
      </div>
    </>
  );
};

/**
 * Inner content — assumes TerminalProvider is mounted above it.
 * Renders a stubbed TabbedTerminalPanel with a search overlay on top
 * for picking a local Alexandria project.
 */
const TrailsViewInner: React.FC<{
  selectedProject: AlexandriaEntry | null;
  onSelectProject: (entry: AlexandriaEntry) => void;
  onClearProject: () => void;
}> = ({ selectedProject, onSelectProject, onClearProject }) => {
  const { theme } = useTheme();

  const events = useMemo(() => new PanelEventBus(), []);
  const { context: terminalCtx, actions: terminalActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local Alexandria entries
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Tab state for the TabbedTerminalPanel — one tab per opened project.
  // The panel only reads `initialTabs` on mount, so we bump `remountKey` to
  // remount the panel when we add a tab. Existing terminal sessions reconnect
  // via their tab-id-keyed `terminalContext` so processes are preserved.
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const [remountKey, setRemountKey] = useState(0);

  // Whether the search dropdown is visible (focused or hovered)
  const [searchOpen, setSearchOpen] = useState(false);

  // Load local Alexandria repositories
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        if (!cancelled) setRepositories(repos);
      } catch (error) {
        console.error('[TrailsView] Failed to load Alexandria entries:', error);
      } finally {
        if (!cancelled) setReposLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Convert terminal activities to workingStates record
  const workingStates = useMemo(() => {
    const states: Record<string, TerminalWorkingState> = {};
    for (const activity of terminalActivities) {
      states[activity.sessionId] = {
        isWorking: activity.isWorking,
        message: activity.workingMessage,
        subtitle: activity.workingSubtitle,
      };
    }
    return states;
  }, [terminalActivities]);

  // Terminal context for the panel
  const terminalPanelContext = useMemo(
    () => ({
      currentScope: { type: 'workspace' as const },
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
      refresh: async () => {},
      terminal: {
        scope: 'workspace' as const,
        name: 'terminal',
        data: terminalCtx.terminalSessions.map((session) => ({
          id: session.id,
          pid: 0,
          cwd: session.directory || '',
          shell: '',
          createdAt: session.createdAt || Date.now(),
          lastActivity: Date.now(),
        })),
        loading: false,
        error: null,
        refresh: async () => {},
      },
    }),
    [terminalCtx.terminalSessions, terminalCtx.terminalContext],
  );

  // When typing: full-text filter. When empty: recents from last 24h.
  const visibleRepos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return repositories.filter((r) => {
        const name = r.name?.toLowerCase() ?? '';
        const fullName = r.github
          ? `${r.github.owner}/${r.github.name}`.toLowerCase()
          : '';
        const path = String(r.path ?? '').toLowerCase();
        return name.includes(q) || fullName.includes(q) || path.includes(q);
      });
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return repositories
      .filter((r) => {
        if (!r.lastOpenedAt) return false;
        const t = Date.parse(r.lastOpenedAt);
        return Number.isFinite(t) && t >= cutoff;
      })
      .sort((a, b) => Date.parse(b.lastOpenedAt!) - Date.parse(a.lastOpenedAt!));
  }, [repositories, query]);

  const showingRecents = query.trim().length === 0;

  // When user clicks an entry: open a terminal tab at the project path
  // (or focus the existing one), then dismiss the search overlay.
  const handleSelect = useCallback(
    (entry: AlexandriaEntry) => {
      const path = String(entry.path);
      const existing = tabs.find((t) => t.directory === path);
      if (existing) {
        setFocusTabId(existing.id);
      } else {
        const newTab: TerminalTab = {
          id: `trails-${Date.now()}`,
          label: entry.name,
          contentType: 'terminal',
          directory: path,
          closable: true,
        };
        setTabs((prev) => [...prev, newTab]);
        setFocusTabId(newTab.id);
        setRemountKey((k) => k + 1);
      }
      onSelectProject(entry);
    },
    [tabs, onSelectProject],
  );

  const overlayBg = theme.colors.background;

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Tabbed terminal panel (underlay) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <TabbedTerminalPanel<TerminalTab>
          key={remountKey}
          context={terminalPanelContext}
          actions={terminalActions as TerminalPanelActions}
          events={events}
          terminalContext={terminalCtx.terminalContext}
          directory={selectedProject?.path ?? process.env.HOME ?? '/'}
          defaultScrollLocked={false}
          workingStates={workingStates}
          initialTabs={tabs}
          onTabsChange={setTabs}
          requestFocusTabId={focusTabId}
          onFocusTabHandled={() => setFocusTabId(null)}
        />
      </div>

      {/* Selected-project chip + reopen-search affordance (top-right) */}
      {selectedProject && (
        <button
          onClick={onClearProject}
          title="Pick a different project"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: 'pointer',
          }}
        >
          <Folder size={14} />
          <span>{selectedProject.name}</span>
          <X size={14} color={theme.colors.textSecondary} />
        </button>
      )}

      {/* Search overlay (covers panel until a project is picked) */}
      {!selectedProject && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: overlayBg,
            overflow: 'hidden',
          }}
        >
          {/* Footprint trails — span the entire overlay, behind all content. */}
          {/* When the user focuses the search input, the trails fade out and */}
          {/* their animations pause until the input is blurred. */}
          <div
            aria-hidden
            className={searchOpen ? 'trails-paused' : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 0,
              opacity: searchOpen ? 0 : 1,
              transition: 'opacity 300ms ease-out',
            }}
          >
            {/*
              Trails take turns. Cycle is shared globally; each trail's
              delaySec offsets it within the cycle. With 6 trails of ~4s
              each, a 24s cycle gives each its own slot.
            */}
            {(() => {
              const CYCLE = 24;
              const SLOT = CYCLE / 6;
              return (
                <>
                  {/* First trail — runs just below the title, walking right */}
                  <FootprintTrail
                    rotationDeg={0}
                    anchorX="50%"
                    anchorY="33%"
                    color={theme.colors.primary}
                    count={20}
                    opacity={0.32}
                    cycleSec={CYCLE}
                    delaySec={0 * SLOT}
                  />
                  {/* Short vertical trail in the bottom-left, walking down */}
                  <FootprintTrail
                    rotationDeg={90}
                    anchorX="14%"
                    anchorY="82%"
                    color={theme.colors.primary}
                    count={5}
                    size={20}
                    opacity={0.22}
                    cycleSec={CYCLE}
                    delaySec={1 * SLOT}
                  />
                  {/* Horizontal trail at the top of the marquee, walking left */}
                  <FootprintTrail
                    rotationDeg={180}
                    anchorX="50%"
                    anchorY="5%"
                    color={theme.colors.primary}
                    count={22}
                    opacity={0.32}
                    cycleSec={CYCLE}
                    delaySec={2 * SLOT}
                  />
                  {/* Short vertical trail in the bottom-right, walking up */}
                  <FootprintTrail
                    rotationDeg={270}
                    anchorX="86%"
                    anchorY="82%"
                    color={theme.colors.primary}
                    count={5}
                    size={20}
                    opacity={0.22}
                    cycleSec={CYCLE}
                    delaySec={3 * SLOT}
                  />
                  {/* Horizontal trail well below the input, walking right */}
                  <FootprintTrail
                    rotationDeg={0}
                    anchorX="50%"
                    anchorY="68%"
                    color={theme.colors.primary}
                    count={22}
                    opacity={0.22}
                    cycleSec={CYCLE}
                    delaySec={4 * SLOT}
                  />
                  {/* Horizontal trail near the bottom, walking left */}
                  <FootprintTrail
                    rotationDeg={180}
                    anchorX="50%"
                    anchorY="94%"
                    color={theme.colors.primary}
                    count={20}
                    size={20}
                    opacity={0.18}
                    cycleSec={CYCLE}
                    delaySec={5 * SLOT}
                  />
                </>
              );
            })()}
          </div>

          {/* Marquee section */}
          <div
            style={{
              flex: '0 0 auto',
              height: '40vh',
              minHeight: 220,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <div
              style={{
                color: theme.colors.primary,
                fontFamily: theme.fonts.heading ?? theme.fonts.body,
                fontSize: 'clamp(48px, 8vw, 96px)',
                fontWeight: theme.fontWeights.bold,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              Code Trails
            </div>
          </div>

          {/* Search section */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 32,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 'min(640px, 90%)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Search input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '18px 22px',
                  borderRadius: 14,
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
                onClick={() => inputRef.current?.focus()}
              >
                <GitBranch size={22} color={theme.colors.textSecondary} />
                <style>{`
                  .trails-search-input::placeholder {
                    color: ${theme.colors.textSecondary};
                    opacity: 0.5;
                  }
                  .trails-paused span {
                    animation-play-state: paused !important;
                  }
                `}</style>
                <input
                  ref={inputRef}
                  className="trails-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    // Delay so click-on-result lands before close
                    setTimeout(() => setSearchOpen(false), 150);
                  }}
                  placeholder="Pick a project to make a trail"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[3] ?? 20,
                    fontFamily: theme.fonts.body,
                  }}
                />
              </div>

              {/* Results dropdown — hide entirely when showing recents but there are none */}
              {(searchOpen || query.length > 0) &&
                !(showingRecents && !reposLoading && visibleRepos.length === 0) && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  maxHeight: '40vh',
                  overflowY: 'auto',
                  borderRadius: 10,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 11,
                }}
              >
                {showingRecents && (
                  <div
                    style={{
                      padding: '8px 14px 6px',
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontWeight: theme.fontWeights.semibold,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    Recent (last 24h)
                  </div>
                )}
                {reposLoading ? (
                  <div
                    style={{
                      padding: 16,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                    }}
                  >
                    Loading projects...
                  </div>
                ) : visibleRepos.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                    }}
                  >
                    {showingRecents
                      ? 'No projects opened in the last 24 hours.'
                      : 'No matching projects.'}
                  </div>
                ) : (
                  visibleRepos.map((entry) => (
                  <button
                    key={`${entry.name}-${entry.path}`}
                    onClick={() => handleSelect(entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 14px',
                      border: 'none',
                      borderBottom: `1px solid ${theme.colors.border}`,
                      background: 'transparent',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: theme.fonts.body,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary ?? theme.colors.border;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Folder
                      size={16}
                      color={theme.colors.textSecondary}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontWeight: theme.fontWeights.semibold,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.github
                          ? `${entry.github.owner}/${entry.github.name}`
                          : entry.name}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {String(entry.path)}
                      </div>
                    </div>
                  </button>
                ))
              )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TrailsView: React.FC = () => {
  const [selectedProject, setSelectedProject] =
    useState<AlexandriaEntry | null>(null);

  return (
    <TerminalProvider
      repositoryPath={selectedProject?.path ?? ''}
      terminalContext="terminal:trails"
      repoName={selectedProject?.name ?? 'Trails'}
    >
      <TrailsViewInner
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        onClearProject={() => setSelectedProject(null)}
      />
    </TerminalProvider>
  );
};

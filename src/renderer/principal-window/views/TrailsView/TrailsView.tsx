import React, {
  useCallback,
  useEffect,
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

  // Tab state for the TabbedTerminalPanel (stub — no tabs are spawned yet)
  const [tabs, setTabs] = useState<TerminalTab[]>([]);

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

  // When user clicks an entry, hide the overlay (stub — no terminal session yet).
  const handleSelect = useCallback(
    (entry: AlexandriaEntry) => {
      onSelectProject(entry);
    },
    [onSelectProject],
  );

  const overlayBg =
    'color-mix(in srgb, ' + theme.colors.background + ' 92%, transparent)';

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
          context={terminalPanelContext}
          actions={terminalActions as TerminalPanelActions}
          events={events}
          terminalContext={terminalCtx.terminalContext}
          directory={selectedProject?.path ?? process.env.HOME ?? '/'}
          defaultScrollLocked={false}
          workingStates={workingStates}
          initialTabs={tabs}
          onTabsChange={setTabs}
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
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          {/* Marquee section (placeholder) */}
          <div
            style={{
              flex: '0 0 auto',
              height: '40vh',
              minHeight: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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

          {/* Search section */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 32,
              overflow: 'hidden',
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

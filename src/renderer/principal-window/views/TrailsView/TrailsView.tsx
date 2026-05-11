import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  GitBranch,
  X,
  Folder,
  PanelLeftOpen,
  PanelLeftClose,
  Trash2,
  Footprints,
  Copy,
  Check,
  ExternalLink,
  Search,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
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
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { GitService } from '../../../main-process-api/GitService';
import { GithubService } from '../../../main-process-api/GithubService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import { ShellService } from '../../../main-process-api/ShellService';
import { WindowService } from '../../../main-process-api/WindowService';
import { GitGlobalConfigModal } from '../../../components/GitGlobalConfigModal';
import { DIRECTORY_ID_TO_DESTINATION } from '../SkillBrowserView/InstallSkillToolbar';

/** Constants for the file-city-trail skill bundled in principal-ai/skills. */
const TRAIL_SKILL_NAME = 'file-city-trail';
const TRAIL_SKILL_REPO_OWNER = 'principal-ai';
const TRAIL_SKILL_REPO_NAME = 'skills';
const TRAIL_SKILL_BRANCH = 'main';
const TRAIL_SKILL_GITHUB_URL = `https://github.com/${TRAIL_SKILL_REPO_OWNER}/${TRAIL_SKILL_REPO_NAME}`;
const TRAIL_SKILL_DOCS_URL = `${TRAIL_SKILL_GITHUB_URL}/blob/${TRAIL_SKILL_BRANCH}/${TRAIL_SKILL_NAME}/SKILL.md`;

/**
 * Starter prompts shown on the post-install "Trail Prompt Ideas" screen.
 * Each is prefixed at render time with "Use the file-city-trail skill to …"
 * so users can paste them straight into their agent's terminal.
 */
const TRAIL_PROMPT_IDEAS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Explain something',
    prompt:
      'Use the file-city-trail skill to explain how <feature or system> works in this codebase.',
  },
  {
    label: 'Request lifecycle',
    prompt:
      'Use the file-city-trail skill to map the lifecycle of a typical API request from entry point to response.',
  },
  {
    label: 'Investigate a bug',
    prompt:
      'Use the file-city-trail skill to investigate where <bug or symptom> is coming from in this codebase.',
  },
];
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
  onClearProject: () => void;
}> = ({ selectedProject, onClearProject }) => {
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
  const [remountKey] = useState(0);

  // Whether the search dropdown is visible (focused or hovered)
  const [searchOpen, setSearchOpen] = useState(false);

  // Whether the project-search overlay is shown. When projects exist, the
  // welcome view is the default; the user opts in via the Open Project button.
  const [showSearch, setShowSearch] = useState(false);

  // Whether the left-side project registry panel is open
  const [registryOpen, setRegistryOpen] = useState(false);

  // Auto-close the registry panel when the list becomes empty (e.g. after
  // Clear all) — nothing left to browse.
  useEffect(() => {
    if (!reposLoading && repositories.length === 0 && registryOpen) {
      setRegistryOpen(false);
    }
  }, [reposLoading, repositories.length, registryOpen]);

  // Path of the row currently hovered in the registry panel — used to
  // reveal the per-row remove button only on the hovered row.
  const [hoveredRowPath, setHoveredRowPath] = useState<string | null>(null);

  // Project pending a remove-from-registry confirmation. Null when the
  // confirm modal is closed.
  const [removeConfirm, setRemoveConfirm] = useState<AlexandriaEntry | null>(
    null,
  );
  const [removeBusy, setRemoveBusy] = useState(false);

  // Clear-all-registry confirmation modal state.
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearAllBusy, setClearAllBusy] = useState(false);

  const handleClearAll = useCallback(async () => {
    setClearAllBusy(true);
    try {
      await AlexandriaService.clearAllData();
      setRepositories([]);
      onClearProject();
      setClearAllConfirm(false);
    } catch (error) {
      console.error('[TrailsView] Failed to clear registry:', error);
    } finally {
      setClearAllBusy(false);
    }
  }, [onClearProject]);

  // Global git user.name, used to personalize the welcome view heading.
  // Null until loaded or if no global git identity is configured.
  const [gitUserName, setGitUserName] = useState<string | null>(null);
  const [gitConfigOpen, setGitConfigOpen] = useState(false);

  const loadGitUserName = useCallback(async () => {
    try {
      const result = await GitService.execCommand(
        process.env.HOME || '/',
        ['config', '--global', 'user.name'],
      );
      setGitUserName(result.stdout.trim() || null);
    } catch {
      // No global git identity — leave gitUserName null and fall back.
    }
  }, []);

  useEffect(() => {
    void loadGitUserName();
  }, [loadGitUserName]);


  // file-city-trail skill installation state.
  // `null` while we're still loading the skill lock file.
  const [skillInstalled, setSkillInstalled] = useState<boolean | null>(null);
  const [installingSkill, setInstallingSkill] = useState(false);
  const [skillInstallError, setSkillInstallError] = useState<string | null>(
    null,
  );

  // Which trail-prompt-idea card was most recently copied (resets after a
  // short delay so the check icon goes back to the copy icon).
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(
    null,
  );

  const handleCopyPrompt = useCallback(
    async (prompt: string, index: number) => {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopiedPromptIndex(index);
        window.setTimeout(
          () =>
            setCopiedPromptIndex((current) =>
              current === index ? null : current,
            ),
          1500,
        );
      } catch (error) {
        console.error('[TrailsView] Failed to copy prompt:', error);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const installed = await SkillLockService.isSkillInstalled(
          TRAIL_SKILL_NAME,
        );
        if (!cancelled) setSkillInstalled(installed);
      } catch (error) {
        console.error('[TrailsView] Failed to load skill state:', error);
        if (!cancelled) setSkillInstalled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep skillInstalled state in sync with global install/uninstall events
  // (e.g. user installs the skill from SkillBrowserView in another tab).
  useEffect(() => {
    const offInstalled = SkillLockService.onSkillInstalled((payload) => {
      if (payload.skillName === TRAIL_SKILL_NAME) {
        setSkillInstalled(true);
      }
    });
    const offUninstalled = SkillLockService.onSkillUninstalled((payload) => {
      if (payload.skillName === TRAIL_SKILL_NAME) {
        setSkillInstalled(false);
      }
    });
    return () => {
      offInstalled();
      offUninstalled();
    };
  }, []);

  // Install file-city-trail into both the Claude-specific and universal
  // (.agents) skill directories. Cursor/Windsurf/etc. now also read from
  // .agents/skills, so installing to those two locations covers everyone.
  const handleInstallSkill = useCallback(async () => {
    setInstallingSkill(true);
    setSkillInstallError(null);
    try {
      const treeResult = await GithubService.getTree(
        TRAIL_SKILL_REPO_OWNER,
        TRAIL_SKILL_REPO_NAME,
        TRAIL_SKILL_BRANCH,
      );
      if (!treeResult?.success || !treeResult.data) {
        throw new Error('Could not fetch skills repository tree.');
      }

      const tree = treeResult.data.tree;
      const prefix = `${TRAIL_SKILL_NAME}/`;
      const fileList = tree
        .filter((item) => item.type === 'blob' && item.path.startsWith(prefix))
        .map((item) => item.path);
      if (fileList.length === 0) {
        throw new Error(
          `Skill folder "${TRAIL_SKILL_NAME}" not found in the repo.`,
        );
      }
      const folderEntry = tree.find(
        (item) => item.type === 'tree' && item.path === TRAIL_SKILL_NAME,
      );

      const destinations = [
        DIRECTORY_ID_TO_DESTINATION['claude-specific'],
        DIRECTORY_ID_TO_DESTINATION['agent-universal'],
      ] as const;

      const failures: string[] = [];
      for (const destination of destinations) {
        const result = await GithubService.installSkill({
          githubUrl: TRAIL_SKILL_GITHUB_URL,
          skillPath: TRAIL_SKILL_NAME,
          destination,
          skillName: TRAIL_SKILL_NAME,
          fileList,
          skillTreeSha: folderEntry?.sha,
        });
        if (!result.success) {
          failures.push(`${destination}: ${result.error || 'failed'}`);
        }
      }

      if (failures.length === destinations.length) {
        throw new Error(failures.join('; '));
      }
      // At least one succeeded — advance the flow. The event subscription
      // will also flip skillInstalled, but we set it here for immediacy.
      setSkillInstalled(true);
      if (failures.length > 0) {
        setSkillInstallError(`Partial install: ${failures.join('; ')}`);
      }
    } catch (error) {
      console.error('[TrailsView] Skill install failed:', error);
      setSkillInstallError(
        error instanceof Error ? error.message : 'Install failed.',
      );
    } finally {
      setInstallingSkill(false);
    }
  }, []);

  // Remove a project from the Alexandria registry without touching the
  // folder on disk. If the removed project is currently selected, clear
  // the selection.
  const handleRemoveFromRegistry = useCallback(
    async (entry: AlexandriaEntry) => {
      const path = String(entry.path);
      setRemoveBusy(true);
      try {
        await AlexandriaService.removeRepository(path, false);
        setRepositories((prev) => prev.filter((r) => r.path !== entry.path));
        if (selectedProject && selectedProject.path === entry.path) {
          onClearProject();
        }
        setRemoveConfirm(null);
      } catch (error) {
        console.error('[TrailsView] Failed to remove from registry:', error);
      } finally {
        setRemoveBusy(false);
      }
    },
    [selectedProject, onClearProject],
  );

  // Prompt the user for a folder, register it as a project, then refresh.
  const handleAddProject = useCallback(async () => {
    const result = await FileSystemService.selectDirectory({
      title: 'Add Project',
      buttonLabel: 'Add',
      properties: ['openDirectory'],
    });
    if (!result || ('canceled' in result && result.canceled)) return;
    const path = (result as { filePaths?: string[] }).filePaths?.[0];
    if (!path) return;
    try {
      await AlexandriaService.registerRepository(path);
      const repos = await AlexandriaService.getRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('[TrailsView] Failed to add project:', error);
    }
  }, []);

  // Scan the user's home directory for git repos not yet in Alexandria, then
  // auto-register them. The modal stays open so the user can see what was added.
  type AddedRepo = { path: string; name: string; ok: boolean; error?: string };
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [scanningHome, setScanningHome] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [addedRepos, setAddedRepos] = useState<AddedRepo[]>([]);

  const handleSearchHome = useCallback(async () => {
    setSearchModalOpen(true);
    setScanningHome(true);
    setScanError(null);
    setAddedRepos([]);
    try {
      const home = await FileSystemService.getHomePath();
      const found = await GitService.getDiscoveredRepos(home, 3);
      const results: AddedRepo[] = [];
      for (const repo of found) {
        try {
          await AlexandriaService.registerRepository(repo.path);
          results.push({ path: repo.path, name: repo.name, ok: true });
        } catch (error) {
          results.push({
            path: repo.path,
            name: repo.name,
            ok: false,
            error: error instanceof Error ? error.message : 'Register failed',
          });
        }
        setAddedRepos([...results]);
      }
      const refreshed = await AlexandriaService.getRepositories();
      setRepositories(refreshed);
    } catch (error) {
      console.error('[TrailsView] Home scan failed:', error);
      setScanError(error instanceof Error ? error.message : 'Scan failed.');
    } finally {
      setScanningHome(false);
    }
  }, []);

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

  // Full registry list for the left side panel — sorted by most recently
  // opened, then alphabetically by display name as a tiebreaker.
  const allRepos = useMemo(() => {
    const displayName = (r: AlexandriaEntry) =>
      r.github ? `${r.github.owner}/${r.github.name}` : r.name;
    return [...repositories].sort((a, b) => {
      const aT = a.lastOpenedAt ? Date.parse(a.lastOpenedAt) : 0;
      const bT = b.lastOpenedAt ? Date.parse(b.lastOpenedAt) : 0;
      if (aT !== bT) return bT - aT;
      return displayName(a).localeCompare(displayName(b));
    });
  }, [repositories]);

  // When user clicks an entry: open the project in its own dev workspace
  // window. The search overlay closes itself via showSearch reset.
  const handleSelect = useCallback(
    async (entry: AlexandriaEntry) => {
      if (!entry?.path) return;
      try {
        await WindowService.openDevWorkspace({ alexandriaEntry: entry });
        setShowSearch(false);
      } catch (error) {
        console.error('[TrailsView] Failed to open project window:', error);
      }
    },
    [],
  );

  const overlayBg = theme.colors.background;

  // Shared welcome header rendered at the top of every onboarding step.
  // "Welcome" sits above the git user.name (clickable to open the global git
  // config modal). Falls back to "to Code Trails" when no identity is set.
  const welcomeHeader = (
    <div style={{ textAlign: 'center', maxWidth: 640 }}>
      <div
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.heading ?? theme.fonts.body,
          fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          marginBottom: 12,
        }}
      >
        <div>
          Welcome{' '}
          <button
            type="button"
            onClick={() => setGitConfigOpen(true)}
            title={
              gitUserName
                ? "This name comes from your global git config (user.name). Click to view or edit."
                : "No global git identity is configured. Click to set one."
            }
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              color: theme.colors.primary,
              font: 'inherit',
              fontStyle: gitUserName ? 'normal' : 'italic',
              letterSpacing: 'inherit',
              lineHeight: 'inherit',
              cursor: 'pointer',
              transition: 'color 150ms ease, opacity 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onFocus={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onBlur={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {gitUserName ?? 'stranger'}
          </button>
        </div>
        <div>to</div>
        <div style={{ color: theme.colors.primary }}>
          Code <span style={{ color: theme.colors.text }}>Trails</span>
        </div>
      </div>
    </div>
  );

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
      {/* Tabbed terminal panel (underlay) — only rendered once a project is */}
      {/* selected inside this window. Project clicks now open a dedicated */}
      {/* dev-workspace window, so the trails view itself rarely hosts tabs. */}
      {selectedProject && (
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
      )}

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

      {/* Skill install step — shown before the project-add step when the */}
      {/* file-city-trail skill isn't installed yet. */}
      {!selectedProject && skillInstalled === false && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            backgroundColor: overlayBg,
            padding: 32,
            overflowY: 'auto',
          }}
        >
          <div style={{ flex: '0 0 auto', marginTop: '9vh' }}>{welcomeHeader}</div>

          <div
            style={{
              flex: '0 0 auto',
              marginTop: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              width: '100%',
            }}
          >
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => void handleInstallSkill()}
              disabled={installingSkill}
              title="Installs the file-city-trail skill to ~/.claude/skills and ~/.agents/skills. Cursor and Windsurf also read skills from ~/.agents/skills."
              style={{
                width: 360,
                padding: 36,
                borderRadius: 12,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                cursor: installingSkill ? 'default' : 'pointer',
                opacity: installingSkill ? 0.7 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                textAlign: 'center',
                transition: 'border-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (installingSkill) return;
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <Footprints size={36} color={theme.colors.primary} />
              <div
                style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                {installingSkill ? 'Installing…' : 'Install Trail Skill'}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void ShellService.openExternal(TRAIL_SKILL_DOCS_URL)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: theme.colors.primary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'underline',
            }}
          >
            Preview on GitHub
            <ExternalLink size={12} />
          </button>

          {skillInstallError && (
            <div
              style={{
                color: theme.colors.error ?? theme.colors.primary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                maxWidth: 520,
                textAlign: 'center',
              }}
            >
              {skillInstallError}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Trail prompt ideas — shown after the skill is installed when the */}
      {/* registry is empty. Lets users grab a starter prompt to paste into */}
      {/* their agent's terminal. */}
      {!selectedProject &&
        skillInstalled === true &&
        !reposLoading &&
        !showSearch && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              backgroundColor: overlayBg,
              padding: 32,
              overflowY: 'auto',
            }}
          >
            <div style={{ flex: '0 0 auto', marginTop: '9vh' }}>
              {welcomeHeader}
            </div>

            <div
              style={{
                flex: '0 0 auto',
                marginTop: 40,
                width: '100%',
                maxWidth: 960,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                Create a Trail
              </div>

              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                {TRAIL_PROMPT_IDEAS.map((idea, i) => {
                  const isCopied = copiedPromptIndex === i;
                  return (
                    <div
                      key={idea.label}
                      style={{
                        position: 'relative',
                        flex: '1 1 260px',
                        minWidth: 220,
                        maxWidth: 300,
                        padding: '14px 16px 48px 16px',
                        borderRadius: 10,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[0],
                          fontWeight: theme.fontWeights.semibold,
                          color: theme.colors.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {idea.label}
                      </div>
                      <div
                        style={{
                          fontFamily: theme.fonts.monospace,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.text,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {idea.prompt}
                      </div>
                      <button
                        onClick={() => void handleCopyPrompt(idea.prompt, i)}
                        title={isCopied ? 'Copied' : 'Copy prompt'}
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          right: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 6,
                          background: theme.colors.background,
                          color: isCopied
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                          cursor: 'pointer',
                        }}
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  maxWidth: 360,
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginTop: 8,
                }}
              >
                <div style={{ flex: 1, height: 1, background: theme.colors.border }} />
                or
                <div style={{ flex: 1, height: 1, background: theme.colors.border }} />
              </div>

              <div
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                  textAlign: 'center',
                }}
              >
                {repositories.length > 0 ? 'Open a Project' : 'Add a Project'}
              </div>
              {repositories.length === 0 && (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    textAlign: 'center',
                    maxWidth: 520,
                    marginTop: -4,
                  }}
                >
                  Pick a folder on your computer, or let us scan your home directory for git repos.
                </div>
              )}

              {repositories.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  style={{
                    width: 360,
                    padding: 24,
                    borderRadius: 12,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights.semibold,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'border-color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <Folder size={20} color={theme.colors.primary} />
                  Open Project
                </button>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => void handleAddProject()}
                      title="Pick a folder on your computer"
                      style={{
                        width: 240,
                        padding: 20,
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'border-color 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      <Folder size={28} color={theme.colors.primary} />
                      <div style={{ fontSize: theme.fontSizes[2], fontWeight: theme.fontWeights.semibold }}>
                        Find
                      </div>
                      <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary }}>
                        Pick a folder
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSearchHome()}
                      disabled={scanningHome}
                      title="Scan your home directory for git repositories"
                      style={{
                        width: 240,
                        padding: 20,
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        cursor: scanningHome ? 'default' : 'pointer',
                        opacity: scanningHome ? 0.7 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'border-color 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (scanningHome) return;
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      {scanningHome ? (
                        <Loader2
                          size={28}
                          color={theme.colors.primary}
                          style={{ animation: 'trails-spin 1s linear infinite' }}
                        />
                      ) : (
                        <Search size={28} color={theme.colors.primary} />
                      )}
                      <style>{`@keyframes trails-spin { to { transform: rotate(360deg); } }`}</style>
                      <div style={{ fontSize: theme.fontSizes[2], fontWeight: theme.fontWeights.semibold }}>
                        {scanningHome ? 'Searching…' : 'Search'}
                      </div>
                      <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary }}>
                        Scan home folder
                      </div>
                    </button>
                  </div>

                </>
              )}
            </div>
          </div>
        )}


      {/* Search overlay (covers panel until a project is picked) */}
      {!selectedProject &&
        skillInstalled === true &&
        showSearch && (
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
          {/* Back to welcome — returns to the Create-a-Trail screen. */}
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            title="Back"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
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
            <ArrowLeft size={14} />
            Back
          </button>
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

      {/* Left side panel: full project registry. Slides in from the left. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 320,
          zIndex: 20,
          backgroundColor: theme.colors.backgroundSecondary,
          borderRight: `1px solid ${theme.colors.border}`,
          boxShadow: registryOpen ? '4px 0 16px rgba(0,0,0,0.25)' : 'none',
          transform: registryOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 220ms ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.heading ?? theme.fonts.body,
              fontWeight: theme.fontWeights.semibold,
              fontSize: theme.fontSizes[2],
            }}
          >
            Projects
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setClearAllConfirm(true)}
              disabled={repositories.length === 0}
              title="Clear all projects from this list (does not delete folders)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                border: 'none',
                background: 'transparent',
                color: theme.colors.textSecondary,
                cursor: repositories.length === 0 ? 'default' : 'pointer',
                opacity: repositories.length === 0 ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (repositories.length > 0) {
                  e.currentTarget.style.color = theme.colors.text;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setRegistryOpen(false)}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                border: 'none',
                background: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
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
          ) : allRepos.length === 0 ? (
            <div
              style={{
                padding: 16,
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
            >
              No projects in registry.
            </div>
          ) : (
            allRepos.map((entry) => {
              const isSelected =
                selectedProject &&
                selectedProject.path === entry.path &&
                selectedProject.name === entry.name;
              const rowKey = String(entry.path);
              const isHovered = hoveredRowPath === rowKey;
              return (
                <div
                  key={`${entry.name}-${entry.path}`}
                  onMouseEnter={() => setHoveredRowPath(rowKey)}
                  onMouseLeave={() =>
                    setHoveredRowPath((p) => (p === rowKey ? null : p))
                  }
                  style={{
                    position: 'relative',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    background: isSelected
                      ? (theme.colors.backgroundTertiary ?? theme.colors.border)
                      : isHovered
                      ? (theme.colors.backgroundTertiary ?? theme.colors.border)
                      : 'transparent',
                  }}
                >
                  <button
                    onClick={() => handleSelect(entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      border: 'none',
                      background: 'transparent',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: theme.fonts.body,
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
                  {isHovered && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemoveConfirm(entry);
                      }}
                      title="Remove from registry (does not delete folder)"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: 8,
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        border: 'none',
                        borderRadius: 6,
                        background: 'transparent',
                        color: theme.colors.textSecondary,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme.colors.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = theme.colors.textSecondary;
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirm modal for remove-from-registry */}
      {removeConfirm && (
        <div
          onClick={() => {
            if (!removeBusy) setRemoveConfirm(null);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 90%)',
              padding: 20,
              borderRadius: 12,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                marginBottom: 8,
              }}
            >
              Remove from list?
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                lineHeight: 1.4,
                marginBottom: 16,
              }}
            >
              This does not delete the project — it just removes{' '}
              <span style={{ color: theme.colors.text }}>
                {removeConfirm.github
                  ? `${removeConfirm.github.owner}/${removeConfirm.github.name}`
                  : removeConfirm.name}
              </span>{' '}
              from this list.
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                onClick={() => setRemoveConfirm(null)}
                disabled={removeBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: 'transparent',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: removeBusy ? 'default' : 'pointer',
                  opacity: removeBusy ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRemoveFromRegistry(removeConfirm)}
                disabled={removeBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: theme.colors.primary,
                  color: theme.colors.background,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                  cursor: removeBusy ? 'default' : 'pointer',
                  opacity: removeBusy ? 0.6 : 1,
                }}
              >
                {removeBusy ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home-scan results modal — opened by the Search button. */}
      {searchModalOpen && (
        <div
          onClick={() => {
            if (!scanningHome) setSearchModalOpen(false);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 12,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                {scanningHome ? (
                  <Loader2
                    size={18}
                    color={theme.colors.primary}
                    style={{ animation: 'trails-spin 1s linear infinite' }}
                  />
                ) : (
                  <Search size={18} color={theme.colors.primary} />
                )}
                {scanningHome ? 'Searching your home folder…' : 'Search Results'}
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                disabled={scanningHome}
                title="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: scanningHome ? 'default' : 'pointer',
                  opacity: scanningHome ? 0.4 : 1,
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '12px 20px', overflowY: 'auto' }}>
              {scanError && (
                <div
                  style={{
                    color: theme.colors.error ?? theme.colors.primary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    padding: '8px 0',
                  }}
                >
                  {scanError}
                </div>
              )}
              {!scanError && !scanningHome && addedRepos.length === 0 && (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    padding: '8px 0',
                    textAlign: 'center',
                  }}
                >
                  No new repositories found in your home folder.
                </div>
              )}
              {addedRepos.length > 0 && (
                <>
                  <div
                    style={{
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                      padding: '4px 0 8px',
                    }}
                  >
                    {scanningHome
                      ? `Adding ${addedRepos.length} so far…`
                      : `Added ${addedRepos.filter((r) => r.ok).length} of ${addedRepos.length} repositor${addedRepos.length === 1 ? 'y' : 'ies'}.`}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {addedRepos.map((repo) => (
                      <div
                        key={repo.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${theme.colors.border}`,
                          background: theme.colors.backgroundSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        {repo.ok ? (
                          <Check size={14} color={theme.colors.primary} />
                        ) : (
                          <X size={14} color={theme.colors.error ?? theme.colors.primary} />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div
                            style={{
                              color: theme.colors.text,
                              fontWeight: theme.fontWeights.semibold,
                            }}
                          >
                            {repo.name}
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
                            {repo.error ? repo.error : repo.path}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: `1px solid ${theme.colors.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                disabled={scanningHome}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: scanningHome ? 'default' : 'pointer',
                  opacity: scanningHome ? 0.5 : 1,
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global git config modal — opened by clicking the welcome name. */}
      <GitGlobalConfigModal
        isOpen={gitConfigOpen}
        onClose={() => {
          setGitConfigOpen(false);
          // Re-read user.name in case the user edited it in the modal.
          void loadGitUserName();
        }}
      />

      {/* Confirm modal for clear-all-registry */}
      {clearAllConfirm && (
        <div
          onClick={() => {
            if (!clearAllBusy) setClearAllConfirm(false);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 90%)',
              padding: 20,
              borderRadius: 12,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                marginBottom: 8,
              }}
            >
              Clear the project list?
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                lineHeight: 1.4,
                marginBottom: 16,
              }}
            >
              Removes all{' '}
              <span style={{ color: theme.colors.text }}>
                {repositories.length}
              </span>{' '}
              project{repositories.length === 1 ? '' : 's'} and any saved
              workspaces from the registry. Your folders on disk are not
              deleted; recently-opened history will be lost.
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                onClick={() => setClearAllConfirm(false)}
                disabled={clearAllBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: 'transparent',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: clearAllBusy ? 'default' : 'pointer',
                  opacity: clearAllBusy ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleClearAll()}
                disabled={clearAllBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: theme.colors.primary,
                  color: theme.colors.background,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                  cursor: clearAllBusy ? 'default' : 'pointer',
                  opacity: clearAllBusy ? 0.6 : 1,
                }}
              >
                {clearAllBusy ? 'Clearing…' : 'Clear list'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button for the registry panel — sits on the left edge. */}
      {/* Hidden when the registry is empty: nothing to browse, and the */}
      {/* welcome view is already the right affordance. */}
      {!registryOpen && repositories.length > 0 && (
        <button
          onClick={() => setRegistryOpen(true)}
          title="Show projects"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 21,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            cursor: 'pointer',
          }}
        >
          <PanelLeftOpen size={18} />
        </button>
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
        onClearProject={() => setSelectedProject(null)}
      />
    </TerminalProvider>
  );
};

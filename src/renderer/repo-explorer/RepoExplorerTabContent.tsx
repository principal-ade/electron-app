/**
 * RepoExplorerTabContent — tab body for the `repo-explorer` content type.
 *
 * Renders the ported web-ade owner/repo page (`RepoExplorerPage`) for a repo
 * identity. It maps the tab's `{ purl, github, localEntry }` to the page's
 * `{ owner, repo }` props and lazy-loads the page (it pulls in Monaco + the 3D
 * File City, so it must not be in the shell's eager graph).
 *
 * It also owns the desktop-only header actions: a **Clone** button (with inline
 * progress) for remote-only repos, or an **Open profile** action when the repo
 * is cloned (opens the profile panel, where the clone is managed). The ported
 * page exposes a `headerActions` slot so this stays out of the page itself.
 *
 * The page's data goes through `repoExplorerService` (IPC-backed); see
 * `data/repoExplorerService.ts`.
 */

import React, { Suspense } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  GithubRepository,
  Purl,
} from '@principal-ai/alexandria-core-library';
import { AuthProvider } from './contexts/AuthContext';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { GithubService } from '../main-process-api/GithubService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import {
  payloadFromGithub,
  payloadFromLocalEntry,
} from '../events/repositorySelected';
import {
  findClonedGithubEntry,
  findEntriesByPurl,
  githubRepoPurl,
} from '../utils/alexandriaIdentity';
import { setNavigationHandler } from './shims/navigation';
import {
  GitCloneModal,
  type CloneProgressState,
} from '../components/GitCloneModal';

// Safe-area / base styles the page consumes (`--safe-top`). The app's global
// CSS doesn't define it; this mirrors web-ade's globals.css for the port.
import './styles.css';

const RepoExplorerPage = React.lazy(() =>
  import('./app/[owner]/[repo]/RepoExplorerPage').then((m) => ({
    default: m.RepoExplorerPage,
  })),
);

export interface RepoExplorerTabContentProps {
  purl: Purl;
  github?: GithubRepository;
  localEntry?: AlexandriaEntry;
}

export const RepoExplorerTabContent: React.FC<RepoExplorerTabContentProps> = ({
  purl,
  github,
  localEntry,
}) => {
  const { theme } = useTheme();
  const identity = github ?? localEntry?.github;
  const owner = identity?.owner;
  const repo = identity?.name;

  const ws = useWorkspaceTabs();

  // ---- desktop header actions (clone) ----
  const [clone, setClone] = React.useState<AlexandriaEntry | undefined>(
    localEntry,
  );
  const [showCloneModal, setShowCloneModal] = React.useState(false);
  const [cloneProgress, setCloneProgress] =
    React.useState<CloneProgressState | null>(null);

  React.useEffect(() => {
    setClone(localEntry);
  }, [localEntry]);

  // Keep the clone state live: re-resolve against the registry when it changes.
  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const all = await AlexandriaService.getRepositories();
        if (cancelled) return;
        setClone(findEntriesByPurl(all, purl)[0]);
      } catch {
        // best-effort
      }
    };
    void refresh();
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [purl]);

  // Clear the inline "cloned" confirmation after a beat.
  React.useEffect(() => {
    if (cloneProgress?.phase !== 'complete') return;
    const t = window.setTimeout(() => setCloneProgress(null), 3000);
    return () => window.clearTimeout(t);
  }, [cloneProgress?.phase]);

  // Route the ported page's `next/link` / `next/navigation` calls to workspace
  // intents (owner profile, repo tab). External links fall through to the
  // anchor's default `target="_blank"` handling (→ system browser).
  React.useEffect(() => {
    setNavigationHandler((href) => {
      if (!href.startsWith('/')) return false;
      const match = href.match(/^\/([^/?#]+)(?:\/([^/?#]+))?/);
      if (!match) return false;
      const targetOwner = decodeURIComponent(match[1]);
      const targetRepo = match[2] ? decodeURIComponent(match[2]) : undefined;

      if (targetRepo) {
        void (async () => {
          try {
            const all = await AlexandriaService.getRepositories();
            const purlForRepo = githubRepoPurl(targetOwner, targetRepo);
            const matches = findEntriesByPurl(all, purlForRepo);
            const entry =
              findClonedGithubEntry(all, targetOwner, targetRepo) ?? matches[0];
            ws.openProjectInfo(
              entry
                ? payloadFromLocalEntry(entry, matches)
                : payloadFromGithub({ owner: targetOwner, name: targetRepo }),
            );
          } catch {
            ws.openProjectInfo(
              payloadFromGithub({ owner: targetOwner, name: targetRepo }),
            );
          }
        })();
        return true;
      }

      // Owner-only path → user or org profile.
      void (async () => {
        try {
          const u = await GithubService.getUser(targetOwner);
          const type = (u as { type?: string } | null)?.type;
          if (type === 'Organization') ws.openOrgProfile(targetOwner);
          else ws.openUserProfile(targetOwner);
        } catch {
          ws.openUserProfile(targetOwner);
        }
      })();
      return true;
    });

    return () => setNavigationHandler(undefined);
  }, [ws]);

  const cloning =
    cloneProgress?.phase === 'cloning' ||
    cloneProgress?.phase === 'registering';

  const openProfile = () => {
    if (!clone) return;
    try {
      ws.openProjectInfo(payloadFromLocalEntry(clone));
    } catch {
      // no purl derivable — nothing to open
    }
  };

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {cloning ? (
        <span
          style={{
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts?.body,
            color: theme.colors.textSecondary,
            whiteSpace: 'nowrap',
          }}
        >
          {cloneProgress?.message ?? 'Cloning…'}
        </span>
      ) : clone ? (
        <button
          type="button"
          onClick={openProfile}
          title="Open the repository profile (manage the clone)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts?.body,
            fontWeight: theme.fontWeights?.semibold ?? 600,
            color: theme.colors.primary,
            background: 'transparent',
            border: `1px solid ${theme.colors.primary}`,
            borderRadius: 6,
            padding: '5px 12px',
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          Open profile
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowCloneModal(true)}
          title="Clone this repository locally"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts?.body,
            fontWeight: theme.fontWeights?.semibold ?? 600,
            color: '#ffffff',
            background: theme.colors.primary,
            border: 'none',
            borderRadius: 6,
            padding: '6px 12px',
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          Clone
        </button>
      )}
      {cloneProgress?.phase === 'error' && (
        <span
          style={{
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts?.body,
            color: '#f0a0a0',
            maxWidth: 220,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={cloneProgress.message}
        >
          {cloneProgress.message}
        </span>
      )}
    </div>
  );

  if (!owner || !repo) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: '#8b8b8b',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
      >
        This repository has no GitHub identity, so the explorer can’t load.
        <br />
        <code style={{ opacity: 0.7 }}>{String(purl)}</code>
      </div>
    );
  }

  return (
    <AuthProvider>
      {/* Positioning/size context for the page. The ported page (and its
          loading overlays / file drawer) uses `position: absolute` + `100%`,
          so this container must be `relative` and fill the tab. */}
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b8b8b',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 13,
              }}
            >
              Loading explorer…
            </div>
          }
        >
          <RepoExplorerPage
            owner={owner}
            repo={repo}
            headerActions={headerActions}
          />
        </Suspense>

        <GitCloneModal
          isOpen={showCloneModal}
          onClose={() => setShowCloneModal(false)}
          onRepositoryAdded={(added) => setClone(added)}
          onCloneProgress={(state) => setCloneProgress(state)}
          registerRepository={(path, remoteUrl) =>
            AlexandriaService.registerRepository(path, remoteUrl)
          }
          initialUrl={
            github ? `https://github.com/${github.owner}/${github.name}.git` : undefined
          }
        />
      </div>
    </AuthProvider>
  );
};

export default RepoExplorerTabContent;

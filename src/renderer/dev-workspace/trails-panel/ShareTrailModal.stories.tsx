import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { BaseTrailIndexEntry } from '@industry-theme/file-city-panel';
import { ShareTrailModal } from './ShareTrailModal';
import { TrailShareService } from '../../services/TrailShareService';
import {
  TrailShareError,
  type FileCityTrailShareResult,
  type TrailShareOptions,
} from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';

/**
 * The modal calls `TrailShareService.share` when the user clicks the
 * primary Share button. Each story sets a per-story override on this cell
 * before render so the share path resolves / rejects / hangs accordingly.
 */
type ShareImpl = (
  id: string,
  options?: TrailShareOptions,
) => Promise<FileCityTrailShareResult>;

let activeShare: ShareImpl = async () => {
  throw new TrailShareError(
    'WEB_ADE_ERROR',
    'No share implementation wired in this story.',
  );
};

(TrailShareService as unknown as { share: ShareImpl }).share = (id, options) =>
  activeShare(id, options);

const baseTrail: BaseTrailIndexEntry = {
  id: 'trail-session-start-binding',
  title: 'How could we bind a terminal tab to a Claude session via SessionStart?',
  summaryPreview:
    'Walks through the SessionStart hook, the terminal tab registry, and where the session id gets stamped onto the tab record.',
  markerCount: 11,
  repoNames: ['electron-app'],
  hasDiffSnippets: true,
  createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  sizeBytes: 8_412,
};

const SHARE_URL =
  'https://web-ade.principal.dev/anthropics/electron-app/trails/trail-session-start-binding';

const SKIP_KEY = 'trail-share.skip-confirmation';
const clearSkipPref = () => {
  try {
    window.localStorage.removeItem(SKIP_KEY);
  } catch {
    /* ignore */
  }
};
const setSkipPref = () => {
  try {
    window.localStorage.setItem(SKIP_KEY, 'true');
  } catch {
    /* ignore */
  }
};

const meta: Meta<typeof ShareTrailModal> = {
  title: 'DevWorkspace/TrailsPanel/ShareTrailModal',
  component: ShareTrailModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      // Reset the persisted "Don't show this again" pref so stories don't
      // leak state between each other. Stories that want it ON set it in
      // their own render body.
      clearSkipPref();
      return (
        <ThemeProvider theme={slateNeonTheme}>
          {/* The modal portals to document.body, so this wrapper only
              exists to give Storybook a layout root. */}
          <div style={{ minHeight: '100vh' }}>
            <Story />
          </div>
        </ThemeProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof ShareTrailModal>;

/**
 * Pre-share confirmation for a **private** repo — the lock callout
 * appears above the "Learn more" disclosure.
 */
export const IdlePrivateRepo: Story = {
  render: () => {
    activeShare = async () => ({ url: SHARE_URL });
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        repoVisibility="private"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/**
 * Pre-share confirmation for a **public** repo — no security callout
 * since the data is already public on GitHub.
 */
export const IdlePublicRepo: Story = {
  render: () => {
    activeShare = async () => ({ url: SHARE_URL });
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        repoVisibility="public"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/**
 * Visibility unknown — same as public: no callout. Shown so the omitted-
 * prop default is exercised in storybook.
 */
export const IdleUnknownVisibility: Story = {
  render: () => {
    activeShare = async () => ({ url: SHARE_URL });
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/**
 * Click Share to drive the modal into the in-flight state — the share
 * promise never resolves so the spinner stays visible.
 */
export const Sharing: Story = {
  render: () => {
    activeShare = () => new Promise<FileCityTrailShareResult>(() => {});
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/**
 * Click Share to surface the "some referenced files are missing on disk"
 * confirmation. Share again confirms with `allowMissing: true` and lands
 * in success.
 */
export const MissingFilesConfirmation: Story = {
  render: () => {
    let calls = 0;
    activeShare = async (_id, options) => {
      calls += 1;
      if (!options?.allowMissing && calls === 1) {
        throw new TrailShareError(
          'MISSING_FILES_NEEDS_CONFIRM',
          'Some referenced files no longer exist on disk.',
          {
            missing: [
              'src/renderer/terminal/SessionRegistry.ts',
              'src/main/hooks/SessionStart.ts',
              'src/shared/trail-bindings/legacy-handshake.ts',
            ],
          },
        );
      }
      return { url: SHARE_URL };
    };
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/** Click Share to land on a typed `TrailShareError` (no GitHub token). */
export const ErrorState: Story = {
  render: () => {
    activeShare = async () => {
      throw new TrailShareError(
        'NO_GITHUB_TOKEN',
        'No GitHub token available. Sign in via the Alexandria panel and try again.',
      );
    };
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/**
 * Modal opened directly with `initialUrl`, e.g. from the "Shared with this
 * repo" list. No share IPC runs — the success body is the only state.
 */
export const AlreadyShared: Story = {
  render: () => (
    <ShareTrailModal
      trail={baseTrail}
      initialUrl={SHARE_URL}
      onClose={() => {}}
    />
  ),
};

/**
 * Fresh publish success — the share path ran in this session, so the
 * banner reads "Trail published. Local draft removed…" instead of the
 * "already shared" copy. Click Share on the idle screen to reach this
 * state (the share impl resolves immediately).
 */
export const FreshPublishSuccess: Story = {
  render: () => {
    activeShare = async () => ({ url: SHARE_URL });
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/**
 * Demonstrates the "Don't show this again" behavior. The localStorage flag
 * is set before render, so the modal skips the idle body and lands
 * directly in `sharing`. We resolve to a URL so the success body appears.
 */
export const AutoShareWhenSuppressed: Story = {
  render: () => {
    setSkipPref();
    activeShare = async () => ({ url: SHARE_URL });
    return (
      <ShareTrailModal
        trail={baseTrail}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

/** Long title + zero diff snippets — checks the meta line and title wrap. */
export const LongTitleNoDiffs: Story = {
  render: () => {
    activeShare = async () => ({ url: SHARE_URL });
    return (
      <ShareTrailModal
        trail={{
          ...baseTrail,
          title:
            'A deliberately long trail title that should wrap inside the modal header without pushing the close button off the row or overflowing the dialog',
          hasDiffSnippets: false,
          markerCount: 1,
        }}
        repositoryPath="/Users/fernando/Developer/desktop-app/electron-app"
        onClose={() => {}}
        onShared={() => {}}
      />
    );
  },
};

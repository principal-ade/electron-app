import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { HomeView } from './HomeView';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GitService } from '../../../main-process-api/GitService';
import { TopicService } from '../../../main-process-api/TopicService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';

/**
 * HomeView is the trails entry/onboarding surface. It has three render
 * branches keyed on `skillInstalled` + `hasAnyTrail`:
 *
 *   - `skillInstalled === false`           → the "Install Trail Skills" screen
 *   - `skillInstalled === true && no trails` → the `TrailPromptIdeas` empty state
 *   - `skillInstalled === true && has trails` → the trails dashboard
 *
 * It reads those flags (and its dashboard data) from a set of static service
 * classes — no `window.mainProcess` calls of its own. We rewire those statics
 * once at module load and read per-story state from a mutable `activeMocks`
 * cell, so `withMocks(...)` before each render drives the branch without
 * re-patching.
 */
interface MockState {
  /** Drives the install screen vs the post-install screens. */
  skillInstalled: boolean;
  /** Saved-trail entries returned by `TrailLibraryService.list`. */
  trails: TrailIndexEntry[];
  /** Repositories returned by `AlexandriaService.getRepositories`. */
  repositories?: AlexandriaEntry[];
  /** Topics returned by `TopicService.getTopics`. */
  topics?: Topic[];
}

let activeMocks: MockState = { skillInstalled: false, trails: [] };

/** Set per-story before returning the rendered element. */
const withMocks = (state: MockState): void => {
  activeMocks = state;
};

// ---------- static service patches (installed once) ----------

(
  TrailLibraryService as unknown as { list: typeof TrailLibraryService.list }
).list = async () => ({ entries: activeMocks.trails });
(
  TrailLibraryService as unknown as {
    onLibraryChanged: typeof TrailLibraryService.onLibraryChanged;
  }
).onLibraryChanged = () => () => {};

(
  SkillLockService as unknown as {
    isSkillInstalled: typeof SkillLockService.isSkillInstalled;
  }
).isSkillInstalled = async () => activeMocks.skillInstalled;
(
  SkillLockService as unknown as {
    onSkillInstalled: typeof SkillLockService.onSkillInstalled;
  }
).onSkillInstalled = () => () => {};
(
  SkillLockService as unknown as {
    onSkillUninstalled: typeof SkillLockService.onSkillUninstalled;
  }
).onSkillUninstalled = () => () => {};

(
  AlexandriaService as unknown as {
    getRepositories: typeof AlexandriaService.getRepositories;
  }
).getRepositories = async () => activeMocks.repositories ?? [];

(
  TopicService as unknown as { getTopics: typeof TopicService.getTopics }
).getTopics = async () => activeMocks.topics ?? [];
(
  TopicService as unknown as {
    onTopicChange: typeof TopicService.onTopicChange;
  }
).onTopicChange = () => () => {};

(
  UserPreferencesService as unknown as {
    getPreferences: typeof UserPreferencesService.getPreferences;
  }
).getPreferences = async () =>
  ({ baseDefaultDirectory: '/Users/fernando/Developer' }) as Awaited<
    ReturnType<typeof UserPreferencesService.getPreferences>
  >;
(
  UserPreferencesService as unknown as {
    onPreferencesUpdated: typeof UserPreferencesService.onPreferencesUpdated;
  }
).onPreferencesUpdated = () => () => {};

// `Welcome <name>` in the header comes from the global git user.name.
(
  GitService as unknown as { execCommand: typeof GitService.execCommand }
).execCommand = async () => ({
  stdout: 'Fernando',
  stderr: '',
  code: 0,
  success: true,
});

// ---------- fixtures ----------

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const REPO_PATH = '/Users/fernando/Developer/desktop-app/electron-app';
const REPO_PATH_2 = '/Users/fernando/Developer/principal/terminal-panel';

const baseTrail: TrailIndexEntry = {
  id: 'trail-base',
  title: 'Auth handshake from login button to session cookie',
  summaryPreview:
    'Walkthrough of the renderer login click, the OAuth exchange, and where the session cookie lands.',
  markerCount: 7,
  fileCount: 5,
  repoNames: ['electron-app'],
  hasDiffSnippets: false,
  createdAt: daysAgo(2),
  updatedAt: minutesAgo(12),
  sizeBytes: 4_821,
  repositoryPath: REPO_PATH,
};

const fixtureTrails: TrailIndexEntry[] = [
  {
    ...baseTrail,
    id: 't-today-1',
    title: 'Auth handshake from login button to session cookie',
    updatedAt: minutesAgo(12),
    purpose: 'informative',
    signOffCount: 2,
  },
  {
    ...baseTrail,
    id: 't-today-2',
    title: 'Why does the renderer occasionally see a stale namespace?',
    updatedAt: hoursAgo(2),
    purpose: 'investigation',
  },
  {
    ...baseTrail,
    id: 't-yest-1',
    title: 'How a trail payload becomes a 3D city marker',
    updatedAt: hoursAgo(28),
    purpose: 'informative',
  },
  {
    ...baseTrail,
    id: 't-other-repo',
    title: 'Terminal panel resize debounce',
    repoNames: ['terminal-panel'],
    repositoryPath: REPO_PATH_2,
    updatedAt: daysAgo(3),
    purpose: 'investigation',
  },
];

const fixtureRepositories = [
  {
    path: REPO_PATH,
    name: 'electron-app',
    github: { owner: 'principalmd', name: 'electron-app' },
  },
  {
    path: REPO_PATH_2,
    name: 'terminal-panel',
    github: { owner: 'principalmd', name: 'terminal-panel' },
  },
] as unknown as AlexandriaEntry[];

const fixtureTopics: Topic[] = [
  {
    id: 'topic-1',
    title: 'Trails onboarding polish',
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(3),
  },
];

// ---------- meta ----------

const meta: Meta<typeof HomeView> = {
  title: 'PrincipalWindow/HomeView/HomeView',
  component: HomeView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HomeView>;

/**
 * Skills missing (`skillInstalled === false`): the welcome header plus the
 * "Install Trail Skills" card and the "what skills" details expander.
 */
export const SkillsNotInstalled: Story = {
  render: () => {
    withMocks({ skillInstalled: false, trails: [] });
    return <HomeView />;
  },
};

/**
 * Skills installed, library empty: the shared `TrailPromptIdeas` empty state
 * — the "Create a Trail" hero plus the Investigation / Informative prompt
 * cards (the same component TrailsView shows on its empty landing).
 */
export const InstalledNoTrails: Story = {
  render: () => {
    withMocks({ skillInstalled: true, trails: [] });
    return <HomeView />;
  },
};

/**
 * Skills installed with saved trails: the trails dashboard — explored-repo
 * cards plus a topics section.
 */
export const Dashboard: Story = {
  render: () => {
    withMocks({
      skillInstalled: true,
      trails: fixtureTrails,
      repositories: fixtureRepositories,
      topics: fixtureTopics,
    });
    return <HomeView />;
  },
};

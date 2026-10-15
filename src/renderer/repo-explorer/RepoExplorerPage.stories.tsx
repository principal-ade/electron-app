/**
 * Storybook entry for the ported web-ade owner/repo page.
 *
 * This renders `RepoExplorerPage` (copied from web-ade's
 * `src/app/[owner]/[repo]/`) inside the desktop app's Storybook. Data comes from
 * `storybook/mockFetch.ts` (route handlers) and the `lib/trpc/client.ts` stub
 * (tRPC) so the full UI can be reviewed without an Electron main process or a
 * Next server — the baseline for the desktop port.
 *
 * Next-only seams are shimmed under `shims/` (next/link, next/navigation,
 * next/dynamic).
 */

import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { RepoExplorerPage } from './app/[owner]/[repo]/RepoExplorerPage';
import { AuthProvider } from './contexts/AuthContext';
import { installRepoExplorerFetchMock } from './storybook/mockFetch';

// The ported page is laid out with Tailwind utility classes. Storybook doesn't
// load the app's stylesheet by default, so pull it in here (plus the markdown
// theme used by the README pane). Loading it from this story keeps the global
// impact off the rest of the Storybook until this story is opened.
import '../styles/tailwind.css';
import './styles.css';
import 'themed-markdown/dist/index.css';
import 'highlight.js/styles/atom-one-dark.css';

// Install once at module load — the page and its hooks fire their fetches on
// mount, so the mock must be in place before the first render.
installRepoExplorerFetchMock();

const meta: Meta<typeof RepoExplorerPage> = {
  title: 'Repo Explorer/OwnerRepoPage',
  component: RepoExplorerPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1a' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <AuthProvider>
          <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <Story />
          </div>
        </AuthProvider>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default landing view (Tours/About + idle File City). */
export const Default: Story = {
  args: { owner: 'principal-ade', repo: 'principal-view' },
};

/** A user-owned repository (avatar/type differ from an org). */
export const UserRepo: Story = {
  args: { owner: 'octocat', repo: 'hello-world' },
};

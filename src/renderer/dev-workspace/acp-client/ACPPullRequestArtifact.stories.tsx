import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { AcpLinkedPullRequest } from '../../events/portalTabs';
import { ShellService } from '../../main-process-api/ShellService';
import { getAcpThemeStyle } from './acpTheme';
import { ACPPullRequestArtifact } from './ACPPullRequestArtifact';
import './ACPClientView.css';

// Storybook has no main process: log the actions the card would dispatch.
ShellService.openExternal = async (url: string) => {
  console.info('[Mock] openExternal', url);
  return { success: true };
};

const linkedPullRequest: AcpLinkedPullRequest = {
  owner: 'principal-ade',
  repo: 'electron-app',
  number: 412,
  url: 'https://github.com/principal-ade/electron-app/pull/412',
};

const meta: Meta<typeof ACPPullRequestArtifact> = {
  title: 'Dev Workspace/ACP Pull Request Artifact',
  component: ACPPullRequestArtifact,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The pull request attached to an ACP tab, rendered in the Artifacts panel beside topics, subsystem models, and drawings. Linked cards open GitHub; unlinked cards offer the paste form. The link is stored on the tab and does not start PR watching.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div
          className="acp-session"
          style={{
            ...getAcpThemeStyle(slateNeonTheme),
            width: 360,
            minHeight: 220,
            padding: 16,
          }}
        >
          <div className="acp-session__artifact-activity">
            <Story />
          </div>
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    onLink: () => {},
    onUnlink: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ACPPullRequestArtifact>;

/** No pull request attached; the row is the add affordance. */
export const Unlinked: Story = {
  render: (args) => (
    <ol className="acp-session__artifact-list">
      <ACPPullRequestArtifact {...args} />
    </ol>
  ),
};

/** A linked pull request represented as an artifact card. */
export const Linked: Story = {
  args: { pullRequest: linkedPullRequest },
  render: (args) => (
    <ol className="acp-session__artifact-list">
      <ACPPullRequestArtifact {...args} />
    </ol>
  ),
};

/** The PR card in the Artifacts list with other artifact kinds around it. */
export const InArtifactList: Story = {
  args: { pullRequest: linkedPullRequest },
  render: (args) => (
    <ol className="acp-session__artifact-list">
      <ACPPullRequestArtifact {...args} />
      <li className="acp-session__artifact-card">
        <button className="acp-session__artifact-open" type="button">
          <span>
            <strong>ACP bridge events</strong>
            <small>Topic · attached</small>
          </span>
        </button>
      </li>
      <li className="acp-session__artifact-card">
        <button className="acp-session__artifact-open" type="button">
          <span>
            <strong>ACP subsystem model</strong>
            <small>Subsystem model</small>
          </span>
        </button>
      </li>
      <li className="acp-session__artifact-card">
        <button className="acp-session__artifact-open" type="button">
          <span>
            <strong>PR review flow</strong>
            <small>Drawing</small>
          </span>
        </button>
      </li>
    </ol>
  ),
};

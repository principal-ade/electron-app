import React from 'react';
import '@testing-library/jest-dom';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  act,
  fireEvent,
  render as testingRender,
  screen,
  waitFor,
} from '@testing-library/react';
import { ArchitectureMapHighlightLayers } from '@principal-ai/file-city-react';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { AcpSessionEventEnvelope } from '../../../shared/main-process-api-interfaces/AcpAPI';
import type { AcpTab } from '../../events/portalTabs';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { AcpService } from '../../main-process-api/AcpService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';
import { TopicService } from '../../main-process-api/TopicService';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';
import { ACPTabContent } from './ACPTabContent';
import { buildCityDataFromContext } from '../file-city-panel/buildCityDataFromContext';

function render(ui: React.ReactElement) {
  return testingRender(
    <ThemeProvider theme={slateNeonTheme}>{ui}</ThemeProvider>,
  );
}

jest.mock('../../main-process-api/AcpService', () => ({
  AcpService: {
    connect: jest.fn(),
    newSession: jest.fn(),
    loadSession: jest.fn(),
    prompt: jest.fn(),
    cancel: jest.fn(),
    respondPermission: jest.fn(),
    disconnect: jest.fn(),
    onSessionEvent: jest.fn(),
  },
}));

jest.mock('../../components/StreamdownMarkdown', () => ({
  StreamdownMarkdown: ({
    className,
    streaming,
    text,
  }: {
    className: string;
    streaming?: boolean;
    text: string;
  }) =>
    jest.requireActual<typeof React>('react').createElement(
      'div',
      {
        className,
        'data-testid': 'acp-agent-markdown',
        'data-streaming': String(Boolean(streaming)),
      },
      text,
    ),
}));

jest.mock('themed-markdown', () => ({
  IndustryMarkdownSlide: ({
    content,
    onSelectionChange,
  }: {
    content: string;
    onSelectionChange?: (selection: {
      anchor: { exact: string; prefix?: string; suffix?: string };
      rect: DOMRect;
    }) => void;
  }) =>
    jest.requireActual<typeof React>('react').createElement(
      'div',
      { 'data-testid': 'industry-markdown-slide' },
      jest
        .requireActual<typeof React>('react')
        .createElement('div', null, content),
      jest.requireActual<typeof React>('react').createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            onSelectionChange?.({
              anchor: {
                exact: 'selected excerpt',
                prefix: 'before ',
                suffix: ' after',
              },
              rect: {} as DOMRect,
            }),
        },
        'Select passage',
      ),
    ),
}));

jest.mock('../../hooks/useRepositoryGitStatus', () => ({
  useRepositoryGitStatus: jest.fn(),
}));

jest.mock('../../panels/home-panel/useRepoWatch', () => ({
  useRepoWatch: jest.fn(),
}));

jest.mock('@principal-ai/file-city-react', () => ({
  ArchitectureMapHighlightLayers: jest.fn(() => null),
}));

jest.mock('../file-city-panel/buildCityDataFromContext', () => ({
  buildCityDataFromContext: jest.fn(),
}));

jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getFileTree: jest.fn(),
  },
}));

jest.mock('../../main-process-api/TopicService', () => ({
  TopicService: {
    getTopic: jest.fn(),
  },
}));

jest.mock('../../main-process-api/SubsystemModelService', () => ({
  SubsystemModelService: {
    list: jest.fn(),
    get: jest.fn(),
    getFilePath: jest.fn(),
  },
}));

jest.mock('../../subsystem-models/SubsystemModelTabContent', () => ({
  SubsystemModelTabContent: ({
    modelId,
    onTrailSelect,
  }: {
    modelId: string;
    onTrailSelect?: (
      selection: {
        trailId: string;
        stepIndices?: number[];
      } | null,
    ) => void;
  }) =>
    jest.requireActual<typeof React>('react').createElement(
      'div',
      { 'data-testid': 'subsystem-model-preview' },
      modelId,
      jest.requireActual<typeof React>('react').createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            onTrailSelect?.({ trailId: 'trail-1', stepIndices: [2] }),
        },
        'Select trail step',
      ),
    ),
}));

const mocked = AcpService as jest.Mocked<typeof AcpService>;
const mockedTopicService = TopicService as jest.Mocked<typeof TopicService>;
const mockedSubsystemModelService = SubsystemModelService as jest.Mocked<
  typeof SubsystemModelService
>;
const mockedRepositoryMonitoring = RepositoryMonitoringService as jest.Mocked<
  typeof RepositoryMonitoringService
>;
const mockedBuildCityData = buildCityDataFromContext as jest.MockedFunction<
  typeof buildCityDataFromContext
>;
const mockedUseRepositoryGitStatus =
  useRepositoryGitStatus as jest.MockedFunction<typeof useRepositoryGitStatus>;

function makeTab(overrides: Partial<AcpTab> = {}): AcpTab {
  return {
    id: 'acp-/repo',
    label: 'repo',
    contentType: 'acp',
    closable: true,
    directory: '/repo',
    ...overrides,
  };
}

let emit: ((envelope: AcpSessionEventEnvelope) => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  mockedTopicService.getTopic.mockResolvedValue({
    title: 'Investigate the bridge',
    description: '## Goal\nReview the bridge behavior.',
  } as never);
  mockedSubsystemModelService.get.mockResolvedValue({
    id: 'model-1',
    title: 'Bridge Subsystem',
  } as never);
  Element.prototype.scrollIntoView = jest.fn();
  emit = null;
  mocked.connect.mockResolvedValue({ protocolVersion: 1 });
  mocked.newSession.mockResolvedValue({ sessionId: 'ses_1' });
  mocked.loadSession.mockResolvedValue({ sessionId: 'ses_saved' });
  mocked.prompt.mockResolvedValue({ stopReason: 'end_turn' });
  mocked.cancel.mockResolvedValue();
  mocked.respondPermission.mockResolvedValue();
  mocked.disconnect.mockResolvedValue();
  mockedRepositoryMonitoring.getFileTree.mockResolvedValue({} as never);
  mockedBuildCityData.mockResolvedValue({} as never);
  mockedUseRepositoryGitStatus.mockReturnValue({
    gitStatusWithFiles: null,
  } as ReturnType<typeof useRepositoryGitStatus>);
  mocked.onSessionEvent.mockImplementation((callback) => {
    emit = callback;
    return () => {
      emit = null;
    };
  });
});

describe('ACPTabContent', () => {
  it('connects and starts a session automatically for Quick Open tabs', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    expect(screen.queryByText('Choose an agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mocked.connect).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        directory: '/repo',
        agent: 'opencode',
      });
    });
    await waitFor(() =>
      expect(mocked.newSession).toHaveBeenCalledWith('acp-/repo'),
    );
    expect(await screen.findByText('Session ready')).toBeInTheDocument();
  });

  it('offers OpenCode reconnect for restored tabs without showing the picker', () => {
    render(<ACPTabContent tab={makeTab()} />);
    expect(mocked.connect).not.toHaveBeenCalled();
    expect(screen.getByText('Connect OpenCode')).toBeInTheDocument();
    expect(screen.queryByText('Choose an agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
  });

  it('automatically reconnects restored tabs and loads the saved ACP session', async () => {
    const onSessionIdChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({ sessionId: 'ses_saved' })}
        onSessionIdChange={onSessionIdChange}
      />,
    );

    expect(await screen.findByText('Session ready')).toBeInTheDocument();
    expect(mocked.connect).toHaveBeenCalledWith({
      sessionKey: 'acp-/repo',
      directory: '/repo',
      agent: 'opencode',
    });
    expect(mocked.loadSession).toHaveBeenCalledWith({
      sessionKey: 'acp-/repo',
      sessionId: 'ses_saved',
    });
    expect(mocked.newSession).not.toHaveBeenCalled();
    expect(onSessionIdChange).toHaveBeenCalledWith('ses_saved');
  });

  it('shows repository identity without an OpenCode badge in the header', async () => {
    render(
      <ACPTabContent
        tab={makeTab({
          autoStart: true,
          repository: {
            owner: 'principal-ai',
            name: 'subsystem-modeling',
            avatarUrl: 'https://github.com/principal-ai.png',
          },
        })}
      />,
    );
    await screen.findByText('Session ready');

    const repoName = screen.getAllByText('subsystem-modeling')[0];
    const identity = repoName.closest('.acp-session__identity');
    expect(identity).toHaveTextContent('subsystem-modeling');
    expect(identity).not.toHaveTextContent('OpenCode');
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Disconnect' }),
    ).not.toBeInTheDocument();
    expect(identity?.querySelector('img')).toHaveAttribute(
      'src',
      'https://github.com/principal-ai.png',
    );
    expect(
      document.querySelector('.acp-session__tool-city-avatar img'),
    ).toHaveAttribute('src', 'https://github.com/principal-ai.png');
  });

  it('renders streamed updates and sends prompts for this tab only', async () => {
    const onSessionTitleChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({ autoStart: true })}
        onSessionTitleChange={onSessionTitleChange}
      />,
    );
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-other',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'not mine' },
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'session_info_update',
            title: 'Investigate ACP reconnect',
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'session_info_update',
            updatedAt: '2026-11-14T12:00:00.000Z',
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'user_message_chunk',
            messageId: 'message-user-1',
            content: { type: 'text', text: 'Earlier request' },
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'message-agent-1',
            content: { type: 'text', text: '**Hello from the agent**' },
          },
        },
      });
    });

    expect(onSessionTitleChange).toHaveBeenCalledWith(
      'Investigate ACP reconnect',
    );
    expect(onSessionTitleChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Earlier request')).toBeInTheDocument();
    expect(screen.getByTestId('acp-agent-markdown')).toHaveTextContent(
      '**Hello from the agent**',
    );
    expect(screen.getByTestId('acp-agent-markdown')).toHaveAttribute(
      'data-streaming',
      'false',
    );
    expect(screen.queryByText('not mine')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'List the files' },
    });
    mocked.prompt.mockImplementation(() => new Promise(() => {}));
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
    });

    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith('acp-/repo', 'List the files'),
    );
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    expect(screen.getByTestId('acp-agent-markdown')).toHaveAttribute(
      'data-streaming',
      'false',
    );

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-thinking-test',
            title: 'Reading files',
            status: 'in_progress',
          },
        },
      });
    });
    expect(screen.getByText('Running Reading files')).toBeInTheDocument();

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'call-thinking-test',
            status: 'completed',
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'New response in progress' },
          },
        },
      });
    });

    const agentMessages = screen.getAllByTestId('acp-agent-markdown');
    expect(agentMessages[agentMessages.length - 1]).toHaveTextContent(
      'New response in progress',
    );
    expect(agentMessages[agentMessages.length - 1]).toHaveAttribute(
      'data-streaming',
      'true',
    );
    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
  });

  it('lists ACP tool calls in the activity panel and updates their status', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-read',
            title: 'Reading package.json',
            name: 'read_file',
            kind: 'read',
            status: 'in_progress',
            locations: [{ path: '/repo/package.json', line: 1 }],
            rawInput: { path: 'package.json' },
          },
        },
      });
    });

    expect(screen.getByLabelText('ACP activity')).toBeInTheDocument();
    expect(screen.getByText('Reading package.json')).toBeInTheDocument();
    expect(screen.getByText('read_file')).toBeInTheDocument();
    expect(screen.getByText('/repo/package.json')).toBeInTheDocument();
    expect(screen.getByText('in progress')).toBeInTheDocument();
    expect(
      screen
        .getByText('Reading package.json')
        .closest('.acp-session__messages'),
    ).toBeNull();

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'call-read',
            status: 'completed',
            content: [
              {
                type: 'content',
                content: { type: 'text', text: 'Read 42 lines' },
              },
            ],
          },
        },
      });
    });

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('Read 42 lines')).toBeInTheDocument();

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'tool-processing',
          result: {
            sessionId: 'ses_1',
            toolCallId: 'call-read',
            outcome: 'highlighted',
          },
        },
      });
    });

    expect(screen.getByText('Highlighted')).toBeInTheDocument();
    expect(
      screen.getByText('Reading package.json').closest('details'),
    ).not.toHaveAttribute('open');
  });

  it('filters activity to calls made through the Principal MCP bridge', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-read',
            title: 'Read a file',
            name: 'read_file',
            status: 'completed',
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-principal-mcp',
            title: 'Search topics',
            name: 'mcp__principal-mcp__search_topics',
            status: 'completed',
          },
        },
      });
    });

    expect(screen.getByText('Read a file')).toBeInTheDocument();
    expect(screen.getByText('Search topics')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    );

    expect(screen.queryByText('Read a file')).not.toBeInTheDocument();
    expect(screen.getByText('Search topics')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    );
    expect(screen.getByText('Read a file')).toBeInTheDocument();
  });

  it('shows topics opened through Principal MCP in the Artifacts view', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-topic-open',
            title: 'Open a topic',
            name: 'http_request',
            status: 'completed',
            rawInput: {
              method: 'POST',
              path: '/api/topics/topic-123/activate',
            },
          },
        },
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    );
    expect(screen.getByText('Open a topic')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    ).toHaveAttribute('aria-pressed', 'true');

    expect(
      screen.getByRole('tablist', { name: 'Activity view' }).parentElement,
    ).toHaveClass('acp-session__topbar');
    fireEvent.click(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    expect(
      await screen.findByText('Investigate the bridge'),
    ).toBeInTheDocument();
    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.queryByText('Open a topic')).not.toBeInTheDocument();
    expect(screen.getByLabelText('repo')).toBeInTheDocument();
    expect(mockedTopicService.getTopic).toHaveBeenCalledWith('topic-123');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Topic Investigate the bridge in chat',
      }),
    );
    const topicPreview = await screen.findByRole('region', {
      name: 'Topic preview: Investigate the bridge',
    });
    expect(topicPreview).toHaveStyle({ height: '75%' });
    fireEvent.keyDown(
      screen.getByRole('separator', { name: 'Resize preview' }),
      { key: 'ArrowDown' },
    );
    expect(topicPreview).toHaveStyle({ height: '80%' });
    expect(topicPreview.parentElement).toHaveClass(
      'acp-session__chat-viewport',
    );
    expect(
      screen.getByRole('button', {
        name: 'Close Topic Investigate the bridge preview',
      }),
    ).toHaveClass('is-selected');
    expect(topicPreview).toHaveTextContent('Review the bridge behavior.');
    const composer = screen.getByLabelText('Message the agent');
    expect(composer).toBeInTheDocument();
    expect(topicPreview).not.toContainElement(composer);
    fireEvent.click(screen.getByRole('button', { name: 'Select passage' }));
    expect(
      screen.getByText('Reference · Investigate the bridge'),
    ).toBeInTheDocument();
    fireEvent.change(composer, { target: { value: 'Explain this passage' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith(
        'acp-/repo',
        expect.stringContaining('selected excerpt'),
      ),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close Topic Investigate the bridge preview',
      }),
    );
    expect(topicPreview).toHaveClass('is-closing');
    const animationEnd = new Event('animationend', { bubbles: true });
    Object.defineProperty(animationEnd, 'animationName', {
      value: 'acp-topic-preview-exit',
    });
    act(() => topicPreview.dispatchEvent(animationEnd));
    expect(
      screen.queryByRole('region', {
        name: 'Topic preview: Investigate the bridge',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows subsystem models read through Principal MCP in the Artifacts view', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-model-read',
            title: 'Read a subsystem model',
            name: 'http_request',
            status: 'completed',
            rawInput: {
              method: 'GET',
              path: '/api/subsystem-models/model-1',
            },
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    expect(await screen.findByText('Bridge Subsystem')).toBeInTheDocument();
    expect(screen.getByText('Subsystem model')).toBeInTheDocument();
    expect(mockedSubsystemModelService.get).toHaveBeenCalledWith('model-1');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Subsystem model Bridge Subsystem in chat',
      }),
    );
    const modelPreview = await screen.findByRole('region', {
      name: 'Subsystem model preview: Bridge Subsystem',
    });
    expect(modelPreview).toHaveStyle({ height: '75%' });
    expect(screen.getByTestId('subsystem-model-preview')).toHaveTextContent(
      'model-1',
    );
    expect(modelPreview.parentElement).toHaveClass(
      'acp-session__chat-viewport',
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close Subsystem model Bridge Subsystem preview',
      }),
    );
    expect(modelPreview).toHaveClass('is-closing');
    const animationEnd = new Event('animationend', { bubbles: true });
    Object.defineProperty(animationEnd, 'animationName', {
      value: 'acp-topic-preview-exit',
    });
    act(() => modelPreview.dispatchEvent(animationEnd));
    expect(
      screen.queryByRole('region', {
        name: 'Subsystem model preview: Bridge Subsystem',
      }),
    ).not.toBeInTheDocument();
  });

  it('asks about a subsystem model trail step selected in the preview', async () => {
    mockedSubsystemModelService.get.mockResolvedValue({
      id: 'model-1',
      title: 'Bridge Subsystem',
      components: [],
      trails: [
        {
          id: 'trail-1',
          title: 'Create and audit',
          steps: [
            {
              from: 'cli',
              to: 'store',
              mechanism: 'calls',
              file: 'src/a.ts',
              purl: 'pkg:github/o/r#src/a.ts',
              symbol: 'create',
              span: { startLine: 10, endLine: 14, contentHash: 'x' },
            },
            {
              from: 'store',
              to: 'audit',
              mechanism: 'feeds',
              file: 'src/b.ts',
              purl: 'pkg:github/o/r#src/b.ts',
              symbol: 'save',
            },
            {
              from: 'audit',
              to: 'report',
              mechanism: 'calls',
              file: 'src/c.ts',
              purl: 'pkg:github/o/r#src/c.ts',
              symbol: 'verify',
              span: { startLine: 30, endLine: 36, contentHash: 'y' },
              annotation: 'Check the seam site.',
            },
          ],
        },
      ],
    } as never);
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-model-read',
            title: 'Read a subsystem model',
            name: 'http_request',
            status: 'completed',
            rawInput: {
              method: 'GET',
              path: '/api/subsystem-models/model-1',
            },
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Subsystem model Bridge Subsystem in chat',
      }),
    );
    await screen.findByRole('region', {
      name: 'Subsystem model preview: Bridge Subsystem',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select trail step' }));

    expect(
      await screen.findByText('Reference · Create and audit'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Step 3 of 3: audit → report (calls)'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'Why does this step call report?' },
    });
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
    });

    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith(
        'acp-/repo',
        expect.stringContaining(
          'User-selected reference from subsystem model "Bridge Subsystem" trail "Create and audit", step 3',
        ),
      ),
    );
    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith(
        'acp-/repo',
        expect.stringContaining('Site: src/c.ts:30-36 — verify'),
      ),
    );
    expect(
      screen.getByText('Why does this step call report?'),
    ).toBeInTheDocument();
    // The sent message keeps the reference, but the composer chip is cleared.
    expect(
      screen.queryByRole('button', { name: 'Remove model reference' }),
    ).not.toBeInTheDocument();
  });

  it('lists artifacts the agent associates with the session', async () => {
    mockedTopicService.getTopic.mockResolvedValue(null as never);
    mockedSubsystemModelService.get.mockResolvedValue(null as never);
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    const associateCall = (
      toolCallId: string,
      kind: string,
      id: string,
      title: string,
    ) => ({
      sessionUpdate: 'tool_call' as const,
      toolCallId,
      title: `Associate ${id}`,
      name: 'shell',
      status: 'completed' as const,
      rawInput: {
        command: `curl -s -X POST http://[::1]:3054/api/acp/sessions/ses_1/artifacts -d '{"kind":"${kind}","id":"${id}","title":"${title}"}'`,
      },
    });

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: associateCall(
            'call-topic-999',
            'topic',
            'topic-999',
            'Agent topic',
          ),
        },
      });
      // Re-associating the same artifact must not duplicate the row.
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: associateCall(
            'call-topic-999-dup',
            'topic',
            'topic-999',
            'Agent topic',
          ),
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: associateCall(
            'call-model-2',
            'subsystem-model',
            'model-2',
            'Agent model',
          ),
        },
      });
      emit?.({
        sessionKey: 'acp-other',
        event: {
          type: 'update',
          update: associateCall(
            'call-other',
            'topic',
            'topic-other',
            'Other tab',
          ),
        },
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    expect(await screen.findByText('Agent topic')).toBeInTheDocument();
    expect(screen.getByText('Agent model')).toBeInTheDocument();
    expect(screen.queryByText('Other tab')).not.toBeInTheDocument();
    expect(screen.getAllByText('Agent topic')).toHaveLength(1);
  });

  it('restores associated artifacts from the replayed conversation', async () => {
    mockedTopicService.getTopic.mockResolvedValue(null as never);
    mockedSubsystemModelService.get.mockResolvedValue(null as never);
    mocked.loadSession.mockResolvedValue({
      sessionId: 'ses_saved',
    });
    render(<ACPTabContent tab={makeTab({ sessionId: 'ses_saved' })} />);
    await screen.findByText('Session ready');

    // session/load replays tool calls including their inputs, so association
    // calls reappear here and the Artifacts list is derived from them.
    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-model-7',
            title: 'Associate model-7',
            name: 'shell',
            status: 'completed',
            rawInput: {
              command: `curl -s -X POST http://[::1]:3054/api/acp/sessions/ses_saved/artifacts -d '{"kind":"subsystem-model","id":"model-7","title":"Restored model"}'`,
            },
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-topic-7',
            title: 'Associate topic-7',
            name: 'shell',
            status: 'completed',
            rawInput: {
              command: `curl -s -X POST http://[::1]:3054/api/acp/sessions/ses_saved/artifacts -d '{"kind":"topic","id":"topic-7","title":"Restored topic"}'`,
            },
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    expect(await screen.findByText('Restored model')).toBeInTheDocument();
    expect(screen.getByText('Restored topic')).toBeInTheDocument();
    expect(screen.getByText('Subsystem model')).toBeInTheDocument();
  });

  it('shows the ACP-local File City below tool calls in the same scroll view', async () => {
    const dirtyStatus: GitStatusWithFiles = {
      repoPath: '/repo',
      branch: 'main',
      isDirty: true,
      hasUntracked: false,
      hasStaged: false,
      ahead: 0,
      behind: 0,
      watchingEnabled: true,
      modifiedFiles: ['src/main.ts'],
      untrackedFiles: [],
      stagedFiles: [],
      createdFiles: [],
      deletedFiles: [],
      hash: 'dirty-status',
    };
    mockedUseRepositoryGitStatus.mockReturnValue({
      gitStatusWithFiles: dirtyStatus,
    } as ReturnType<typeof useRepositoryGitStatus>);
    const { container } = render(
      <ACPTabContent tab={makeTab({ autoStart: true })} />,
    );
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-city',
            title: 'Read a source file',
            name: 'read_file',
            kind: 'read',
            status: 'completed',
            locations: [{ path: '/repo/src/main.ts' }],
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'tool-processing',
          result: {
            sessionId: 'ses_1',
            toolCallId: 'call-city',
            outcome: 'highlighted',
            highlightPaths: ['src/main.ts'],
          },
        },
      });
    });

    await waitFor(() => {
      expect(mockedRepositoryMonitoring.getFileTree).toHaveBeenCalledWith(
        '/repo',
      );
      expect(mockedBuildCityData).toHaveBeenCalledWith(
        expect.objectContaining({ repositoryPath: '/repo' }),
      );
      expect(ArchitectureMapHighlightLayers).toHaveBeenCalled();
    });

    const fileCityRegion = screen.getByRole('region', {
      name: 'repo',
    });
    expect(screen.getByRole('heading', { name: 'repo' })).toBeInTheDocument();
    const toolPanelContent = container.querySelector(
      '.acp-session__tool-panel-content',
    );
    expect(fileCityRegion).toBeInTheDocument();
    expect(screen.getByText('Read a source file')).toBeInTheDocument();
    expect(
      container
        .querySelector('.acp-session__tool-list')
        ?.closest('.acp-session__tool-panel-content'),
    ).toBe(toolPanelContent);
    expect(fileCityRegion.parentElement).toBe(toolPanelContent);
    expect(toolPanelContent?.lastElementChild).toBe(fileCityRegion);

    const fileCityProps = (
      ArchitectureMapHighlightLayers as jest.Mock
    ).mock.calls.at(-1)?.[0];
    expect(fileCityProps.highlightLayers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          items: [
            expect.objectContaining({ path: 'src/main.ts', type: 'file' }),
          ],
        }),
        expect.objectContaining({
          id: 'acp-git-status-modified',
          items: [expect.objectContaining({ path: 'src/main.ts' })],
        }),
      ]),
    );
    expect(screen.getByText('Modified (1)')).toBeInTheDocument();
  });

  it('answers permission requests with the chosen option', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Session ready');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'permission',
          requestId: 'req-1',
          request: {
            sessionId: 'ses_1',
            toolCall: { toolCallId: 'tool-1', title: 'Run the tests' },
            options: [
              { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
              { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
            ],
          },
        },
      });
    });

    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Allow once'));

    expect(mocked.respondPermission).toHaveBeenCalledWith({
      sessionKey: 'acp-/repo',
      requestId: 'req-1',
      optionId: 'allow',
    });
  });
});

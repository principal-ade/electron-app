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
import { ACP_ARTIFACT_MIME } from '../../utils/acpArtifactDrag';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';
import { TopicService } from '../../main-process-api/TopicService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { getDrawingSummary } from '../../drawings-view/drawingsStorage';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';
import { useFileTree } from '@pierre/trees/react';
import { parsePatchFiles } from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import { GitService } from '../../main-process-api/GitService';
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
    setModel: jest.fn(),
    setSessionArtifacts: jest.fn(),
    prompt: jest.fn(),
    cancel: jest.fn(),
    respondPermission: jest.fn(),
    disconnect: jest.fn(),
    onSessionEvent: jest.fn(),
  },
}));

jest.mock('../../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    onPreferencesUpdated: jest.fn(),
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

jest.mock(
  '@pierre/trees/react',
  () => ({
    useFileTree: jest.fn(() => ({
      model: {
        resetPaths: jest.fn(),
        setGitStatus: jest.fn(),
        getItem: jest.fn(() => null),
      },
    })),
    FileTree: jest.fn(() => null),
  }),
  { virtual: true },
);

jest.mock('../file-city-panel/buildCityDataFromContext', () => ({
  buildCityDataFromContext: jest.fn(),
}));

jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getFileTree: jest.fn(),
  },
}));

jest.mock('../../main-process-api/GitService', () => ({
  GitService: {
    getWorkingTreeDiff: jest.fn(),
  },
}));

jest.mock(
  '@pierre/diffs',
  () => ({
    parsePatchFiles: jest.fn(() => []),
  }),
  { virtual: true },
);

jest.mock(
  '@pierre/diffs/react',
  () => ({
    FileDiff: jest.fn(() => null),
    File: jest.fn(() => null),
  }),
  { virtual: true },
);

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

jest.mock('../../drawings-view/drawingsStorage', () => ({
  getDrawingSummary: jest.fn(),
}));

jest.mock('./ACPDrawingPreview', () => ({
  ACPDrawingPreview: ({
    drawingId,
    onElementSelect,
  }: {
    drawingId: string;
    onElementSelect?: (
      selection: {
        elements: { id: string; type: string; text?: string }[];
      } | null,
    ) => void;
  }) =>
    jest.requireActual<typeof React>('react').createElement(
      'div',
      { 'data-testid': 'drawing-preview' },
      drawingId,
      jest.requireActual<typeof React>('react').createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            onElementSelect?.({
              elements: [
                { id: 'el-1', type: 'text', text: 'Buy milk' },
                { id: 'el-2', type: 'rectangle', text: 'Groceries' },
              ],
            }),
        },
        'Select drawing elements',
      ),
    ),
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
const mockedPreferences = UserPreferencesService as jest.Mocked<
  typeof UserPreferencesService
>;
const mockedTopicService = TopicService as jest.Mocked<typeof TopicService>;
const mockedSubsystemModelService = SubsystemModelService as jest.Mocked<
  typeof SubsystemModelService
>;
const mockedGetDrawingSummary = getDrawingSummary as jest.MockedFunction<
  typeof getDrawingSummary
>;
const mockedRepositoryMonitoring = RepositoryMonitoringService as jest.Mocked<
  typeof RepositoryMonitoringService
>;
const mockedBuildCityData = buildCityDataFromContext as jest.MockedFunction<
  typeof buildCityDataFromContext
>;
const mockedUseRepositoryGitStatus =
  useRepositoryGitStatus as jest.MockedFunction<typeof useRepositoryGitStatus>;
const mockedUseFileTree = useFileTree as jest.Mock;
const mockedParsePatchFiles = parsePatchFiles as jest.Mock;
const mockedFileDiff = FileDiff as jest.Mock;
const mockedGitService = GitService as jest.Mocked<typeof GitService>;

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

function artifactDataTransfer(artifact: {
  kind: string;
  id: string;
  title?: string;
}) {
  const values: Record<string, string> = {
    [ACP_ARTIFACT_MIME]: JSON.stringify(artifact),
  };
  return {
    types: [ACP_ARTIFACT_MIME],
    dropEffect: 'none',
    effectAllowed: 'none',
    setData: jest.fn(),
    getData: (type: string) => values[type] ?? '',
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
  mocked.setModel.mockResolvedValue({
    model: { currentValue: 'opencode-go/a', options: [] },
  });
  mocked.setSessionArtifacts.mockImplementation(async ({ artifacts }) => ({
    artifacts,
  }));
  mocked.prompt.mockResolvedValue({ stopReason: 'end_turn' });
  mocked.cancel.mockResolvedValue();
  mocked.respondPermission.mockResolvedValue();
  mocked.disconnect.mockResolvedValue();
  mockedPreferences.getPreferences.mockResolvedValue({});
  mockedPreferences.updatePreferences.mockResolvedValue();
  mockedPreferences.onPreferencesUpdated.mockReturnValue(() => {});
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
  it('links a pull request from the Artifacts panel', async () => {
    const onPullRequestChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({ autoStart: true })}
        onPullRequestChange={onPullRequestChange}
      />,
    );
    await screen.findByText('Pick model');

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link pull request' }));
    fireEvent.change(
      screen.getByLabelText('GitHub pull request URL or owner/repo#123'),
      { target: { value: 'acme/widgets#42' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(onPullRequestChange).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      number: 42,
      url: 'https://github.com/acme/widgets/pull/42',
    });
  });

  it('shows and unlinks a linked pull request artifact', async () => {
    const onPullRequestChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({
          autoStart: true,
          pullRequest: {
            owner: 'acme',
            repo: 'widgets',
            number: 42,
            url: 'https://github.com/acme/widgets/pull/42',
          },
        })}
        onPullRequestChange={onPullRequestChange}
      />,
    );
    await screen.findByText('Pick model');

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));
    expect(
      screen.getByRole('button', { name: 'Open acme/widgets#42 on GitHub' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Unlink acme/widgets#42' }),
    );
    expect(onPullRequestChange).toHaveBeenCalledWith(null);
  });

  it('connects and starts a session automatically for Quick Open tabs', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    expect(screen.queryByText('Choose an agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect OpenCode' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Preparing an OpenCode session/),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mocked.connect).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        directory: '/repo',
        agent: 'opencode',
      });
    });
    await waitFor(() =>
      expect(mocked.newSession).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
      }),
    );
    expect(await screen.findByText('Pick model')).toBeInTheDocument();
    expect(
      screen.queryByText(/Ask OpenCode to explore/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Loading' }),
    ).not.toBeInTheDocument();
  });

  it('shows a model picker before the first message and switches models', async () => {
    const modelOptions = [
      {
        value: 'opencode-go/deepseek-v4.1-flash',
        name: 'DeepSeek V4.1 Flash',
        provider: 'opencode-go',
      },
      {
        value: 'opencode-go/claude-haiku-5-5',
        name: 'Claude Haiku 5.5',
        provider: 'opencode-go',
      },
    ];
    mocked.newSession.mockResolvedValue({
      sessionId: 'ses_1',
      model: {
        currentValue: 'opencode-go/deepseek-v4.1-flash',
        options: modelOptions,
      },
    });
    mocked.setModel.mockResolvedValue({
      model: {
        currentValue: 'opencode-go/claude-haiku-5-5',
        options: modelOptions,
      },
    });

    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);

    const trigger = await screen.findByRole('button', {
      name: 'Model: DeepSeek V4.1 Flash',
    });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const search = screen.getByRole('combobox', { name: 'Search models' });
    expect(
      screen.getByRole('option', { name: 'DeepSeek V4.1 Flash' }),
    ).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'haiku' } });
    expect(
      screen.queryByRole('option', { name: 'DeepSeek V4.1 Flash' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Claude Haiku 5.5' }));

    await waitFor(() =>
      expect(mocked.setModel).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        model: 'opencode-go/claude-haiku-5-5',
      }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Model: Claude Haiku 5.5',
      }),
    ).toBeInTheDocument();
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

    expect(await screen.findByText('Pick model')).toBeInTheDocument();
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

  it('shows the session title with an OpenCode badge in the header', async () => {
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
    await screen.findByText('Pick model');

    const identity = document.querySelector('.acp-session__identity');
    expect(identity).toHaveTextContent('New session');
    expect(identity?.querySelector('img')).not.toBeInTheDocument();
    expect(
      identity?.querySelector('.acp-session__identity-logo'),
    ).not.toBeNull();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Disconnect' }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('.acp-session__tool-city-avatar img'),
    ).toHaveAttribute('src', 'https://github.com/principal-ai.png');
  });

  it('renders streamed updates and sends prompts for this tab only', async () => {
    mockedPreferences.getPreferences.mockResolvedValue({
      acpHideThinking: false,
    });
    const onSessionTitleChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({ autoStart: true })}
        onSessionTitleChange={onSessionTitleChange}
      />,
    );
    await screen.findByText('Pick model');

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

  it('hides thought text behind a compact summary by default', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'Investigate the bridge' },
    });
    mocked.prompt.mockImplementation(() => new Promise(() => {}));
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
    });
    await waitFor(() => expect(mocked.prompt).toHaveBeenCalled());

    const toggle = screen.getByRole('button', { name: 'Thinking' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'agent_thought_chunk',
            content: { type: 'text', text: 'secret reasoning' },
          },
        },
      });
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-summary-test',
            title: 'Reading files',
            status: 'in_progress',
          },
        },
      });
    });

    expect(screen.queryByText('secret reasoning')).not.toBeInTheDocument();
    expect(screen.getByText(/1 thought · 1 tool call/)).toBeInTheDocument();
    expect(screen.getByText('Running Reading files')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(mockedPreferences.updatePreferences).toHaveBeenCalledWith({
      acpHideThinking: false,
    });
    expect(screen.getByText('secret reasoning')).toBeInTheDocument();
    expect(
      screen.queryByText(/1 thought · 1 tool call/),
    ).not.toBeInTheDocument();
  });

  it('hides the topbar thinking toggle while the activity map is open', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    expect(
      screen.getByRole('button', { name: 'Thinking' }),
    ).toBeInTheDocument();

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-map-test',
            title: 'Reading files',
            status: 'in_progress',
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /open activity map/ }));
    expect(
      screen.getByRole('region', { name: 'Agent activity map' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Thinking' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close activity map' }),
    );
    expect(
      screen.getByRole('button', { name: 'Thinking' }),
    ).toBeInTheDocument();
  });

  it('shows thought text when the preference explicitly opts out', async () => {
    mockedPreferences.getPreferences.mockResolvedValue({
      acpHideThinking: false,
    });
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thinking' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'agent_thought_chunk',
            content: { type: 'text', text: 'visible reasoning' },
          },
        },
      });
    });

    expect(screen.getByText('visible reasoning')).toBeInTheDocument();
  });

  it('lists ACP tool calls in the activity panel and updates their status', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');
    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));

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
    await screen.findByText('Pick model');
    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));

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
    await screen.findByText('Pick model');

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

    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
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
    // The chat collapses all the way down: End pins the preview at full height.
    fireEvent.keyDown(
      screen.getByRole('separator', { name: 'Resize preview' }),
      { key: 'End' },
    );
    expect(topicPreview).toHaveStyle({ height: '100%' });
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
    await screen.findByText('Pick model');

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

  it('shows drawings the agent reads in the Artifacts view', async () => {
    mockedGetDrawingSummary.mockImplementation(async (id: string) =>
      id === 'launch-plan'
        ? {
            id,
            name: 'Launch plan',
            path: '/home/.alexandria/drawings/launch-plan.excalidraw',
          }
        : null,
    );
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');
    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-drawing-read',
            title: 'Read the launch plan',
            name: 'shell',
            status: 'completed',
            rawInput: {
              command: 'cat ~/.alexandria/drawings/launch-plan.excalidraw',
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
            toolCallId: 'call-drawing-associate',
            title: 'Associate the notes drawing',
            name: 'shell',
            status: 'completed',
            rawInput: {
              command:
                'curl -s -X POST http://[::1]:3054/api/acp/sessions/ses_1/artifacts -d \'{"kind":"drawing","id":"notes","title":"Agent notes"}\'',
            },
          },
        },
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter Principal MCP calls' }),
    );
    expect(screen.getByText('Read the launch plan')).toBeInTheDocument();
    expect(screen.getByText('Associate the notes drawing')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    // Looked-up names win; the agent-provided title is the fallback.
    expect(await screen.findByText('Launch plan')).toBeInTheDocument();
    expect(screen.getByText('Agent notes')).toBeInTheDocument();
    expect(screen.getAllByText('Drawing')).toHaveLength(2);
    expect(mockedGetDrawingSummary).toHaveBeenCalledWith('launch-plan');
    expect(mockedGetDrawingSummary).toHaveBeenCalledWith('notes');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Drawing Launch plan in chat',
      }),
    );
    const drawingPreview = await screen.findByRole('region', {
      name: 'Drawing preview: Launch plan',
    });
    expect(drawingPreview).toHaveStyle({ height: '75%' });
    expect(screen.getByTestId('drawing-preview')).toHaveTextContent(
      'launch-plan',
    );
    expect(drawingPreview.parentElement).toHaveClass(
      'acp-session__chat-viewport',
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close Drawing Launch plan preview',
      }),
    );
    expect(drawingPreview).toHaveClass('is-closing');
    const animationEnd = new Event('animationend', { bubbles: true });
    Object.defineProperty(animationEnd, 'animationName', {
      value: 'acp-topic-preview-exit',
    });
    act(() => drawingPreview.dispatchEvent(animationEnd));
    expect(
      screen.queryByRole('region', {
        name: 'Drawing preview: Launch plan',
      }),
    ).not.toBeInTheDocument();
  });

  it('asks about drawing pieces selected in the preview', async () => {
    mockedGetDrawingSummary.mockImplementation(async (id: string) =>
      id === 'groceries'
        ? {
            id,
            name: 'Grocery run',
            path: '/home/.alexandria/drawings/groceries.excalidraw',
          }
        : null,
    );
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-drawing-read',
            title: 'Read the grocery run',
            name: 'shell',
            status: 'completed',
            rawInput: {
              command: 'cat ~/.alexandria/drawings/groceries.excalidraw',
            },
          },
        },
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    // Wait for the drawing name lookup before opening the preview.
    expect(await screen.findByText('Grocery run')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Drawing Grocery run in chat',
      }),
    );
    await screen.findByRole('region', {
      name: 'Drawing preview: Grocery run',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Select drawing elements' }),
    );

    expect(
      await screen.findByText('Reference · Grocery run'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Element 1: text "Buy milk" (id: el-1)'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'What does this list say?' },
    });
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
    });

    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith(
        'acp-/repo',
        expect.stringContaining(
          'User-selected reference from drawing "Grocery run" (drawing id: groceries, 2 elements)',
        ),
      ),
    );
    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith(
        'acp-/repo',
        expect.stringContaining('Element 2: rectangle "Groceries" (id: el-2)'),
      ),
    );
    expect(screen.getByText('What does this list say?')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove drawing reference' }),
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
    await screen.findByText('Pick model');

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
    await screen.findByText('Pick model');

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

  it('opens a preview and associates an artifact dropped on the messages area', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    const chat = document.querySelector(
      '.acp-session__chat-viewport',
    ) as HTMLElement;
    const dataTransfer = artifactDataTransfer({
      kind: 'topic',
      id: 'topic-drop',
      title: 'Dropped topic',
    });
    fireEvent.dragOver(chat, { dataTransfer });
    fireEvent.drop(chat, { dataTransfer });

    await waitFor(() =>
      expect(mocked.setSessionArtifacts).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        artifacts: [
          { kind: 'topic', id: 'topic-drop', title: 'Dropped topic' },
        ],
      }),
    );
    expect(
      await screen.findByRole('region', { name: /Topic preview/ }),
    ).toBeInTheDocument();
  });

  it('associates without opening a preview when dropped on the activity panel', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    const panel = screen.getByLabelText('ACP activity');
    const dataTransfer = artifactDataTransfer({
      kind: 'subsystem-model',
      id: 'model-drop',
      title: 'Dropped model',
    });
    fireEvent.drop(panel, { dataTransfer });

    await waitFor(() =>
      expect(mocked.setSessionArtifacts).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        artifacts: [
          {
            kind: 'subsystem-model',
            id: 'model-drop',
            title: 'Dropped model',
          },
        ],
      }),
    );
    expect(screen.queryByRole('region', { name: /preview/i })).toBeNull();
  });

  it('stages an artifact dropped on the composer for the next prompt', async () => {
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    const composer = document.querySelector(
      '.acp-session__composer',
    ) as HTMLElement;
    const dataTransfer = artifactDataTransfer({
      kind: 'drawing',
      id: 'notes',
      title: 'Agent notes',
    });
    fireEvent.drop(composer, { dataTransfer });

    expect(await screen.findByText('For next message')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'Take a look' },
    });
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
      shiftKey: false,
    });

    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith('acp-/repo', 'Take a look', [
        { kind: 'drawing', id: 'notes', title: 'Agent notes' },
      ]),
    );
    expect(screen.queryByText('For next message')).not.toBeInTheDocument();
  });

  it('restores session artifacts returned by loadSession', async () => {
    mocked.loadSession.mockResolvedValue({
      sessionId: 'ses_saved',
      artifacts: [
        {
          kind: 'subsystem-model',
          id: 'model-9',
          title: 'Saved model',
        },
      ],
    });
    mockedSubsystemModelService.get.mockResolvedValue({
      id: 'model-9',
      title: 'Saved model',
    } as never);

    render(<ACPTabContent tab={makeTab({ sessionId: 'ses_saved' })} />);
    await screen.findByText('Pick model');
    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));

    expect(await screen.findByText('Saved model')).toBeInTheDocument();
  });

  it('removes a user-attached session artifact', async () => {
    mockedTopicService.getTopic.mockResolvedValue(null as never);
    mocked.loadSession.mockResolvedValue({
      sessionId: 'ses_saved',
      artifacts: [
        {
          kind: 'topic',
          id: 'topic-attached',
          title: 'Attached topic',
        },
      ],
    });

    render(<ACPTabContent tab={makeTab({ sessionId: 'ses_saved' })} />);
    await screen.findByText('Pick model');
    fireEvent.click(screen.getByRole('tab', { name: 'Artifacts' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Remove Topic Attached topic from this session',
      }),
    );

    await waitFor(() =>
      expect(mocked.setSessionArtifacts).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        artifacts: [],
      }),
    );
  });

  it('queues artifacts dropped before the session starts', async () => {
    render(<ACPTabContent tab={makeTab()} />);

    const main = screen.getByRole('main', { name: 'ACP agent session' });
    fireEvent.drop(main, {
      dataTransfer: artifactDataTransfer({
        kind: 'topic',
        id: 'pending-topic',
        title: 'Pending topic',
      }),
    });
    expect(
      screen.getByText(/1 artifact will be associated when the session starts/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connect OpenCode' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start a session' }),
    );

    await waitFor(() =>
      expect(mocked.setSessionArtifacts).toHaveBeenCalledWith({
        sessionKey: 'acp-/repo',
        artifacts: [
          { kind: 'topic', id: 'pending-topic', title: 'Pending topic' },
        ],
      }),
    );
  });

  it('restores associated artifacts from the replayed conversation', async () => {
    mockedTopicService.getTopic.mockResolvedValue(null as never);
    mockedSubsystemModelService.get.mockResolvedValue(null as never);
    mocked.loadSession.mockResolvedValue({
      sessionId: 'ses_saved',
    });
    render(<ACPTabContent tab={makeTab({ sessionId: 'ses_saved' })} />);
    await screen.findByText('Pick model');

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
    await screen.findByText('Pick model');
    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));

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
    await screen.findByText('Pick model');

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

  it('reports agent activity to the tab bar', async () => {
    const onActivityChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({ autoStart: true })}
        onActivityChange={onActivityChange}
      />,
    );
    await screen.findByText('Pick model');
    expect(onActivityChange).toHaveBeenLastCalledWith(null);

    mocked.prompt.mockImplementation(() => new Promise(() => {}));
    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'Check the repo' },
    });
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
    });
    await waitFor(() =>
      expect(onActivityChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: 'working' }),
      ),
    );

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'permission',
          requestId: 'req-activity',
          request: {
            sessionId: 'ses_1',
            toolCall: { toolCallId: 'tool-activity', title: 'Run the tests' },
            options: [
              { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
            ],
          },
        },
      });
    });
    await waitFor(() =>
      expect(onActivityChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: 'blocked', kind: 'permission' }),
      ),
    );
  });

  it('opens a working-tree diff over the chat when a highlighted file is selected', async () => {
    mockedRepositoryMonitoring.getFileTree.mockResolvedValue({
      allFiles: [{ path: '/repo/src/main.ts', relativePath: 'src/main.ts' }],
      allDirectories: [],
    } as never);
    mockedGitService.getWorkingTreeDiff.mockResolvedValue(
      [
        'diff --git a/src/main.ts b/src/main.ts',
        'index 111..222 100644',
        '--- a/src/main.ts',
        '+++ b/src/main.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
        '',
      ].join('\n'),
    );
    mockedParsePatchFiles.mockReturnValue([
      { files: [{ name: 'src/main.ts' }] },
    ]);
    render(<ACPTabContent tab={makeTab({ autoStart: true })} />);
    await screen.findByText('Pick model');

    act(() => {
      emit?.({
        sessionKey: 'acp-/repo',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'call-tree-diff',
            title: 'Edit a source file',
            name: 'edit',
            kind: 'edit',
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
            toolCallId: 'call-tree-diff',
            outcome: 'highlighted',
            highlightPaths: ['src/main.ts'],
          },
        },
      });
    });

    fireEvent.click(await screen.findByRole('button', { name: 'FileTree' }));
    await waitFor(() => {
      expect(mockedUseFileTree).toHaveBeenCalledWith(
        expect.objectContaining({
          paths: ['/repo/src/main.ts'],
        }),
      );
    });

    // The tree layers over the tool activity instead of replacing it: the
    // file city and its git legend stay mounted below the overlay.
    const treeOverlay = document.querySelector(
      '.acp-session__tool-activity-stage > .acp-session__file-tree-overlay',
    );
    expect(treeOverlay).not.toBeNull();
    expect(
      document.querySelector(
        '.acp-session__tool-city-section .acp-session__file-city .acp-session__git-legend',
      ),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'FileTree' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const treeOptions = mockedUseFileTree.mock.calls.at(-1)?.[0] as {
      onSelectionChange?: (selected: string[]) => void;
    };
    expect(treeOptions.onSelectionChange).toBeDefined();
    act(() => {
      treeOptions.onSelectionChange?.(['/repo/src/main.ts']);
    });

    expect(
      await screen.findByRole('region', { name: 'File preview: src/main.ts' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedGitService.getWorkingTreeDiff).toHaveBeenCalledWith('/repo');
      expect(mockedFileDiff).toHaveBeenCalledWith(
        expect.objectContaining({
          fileDiff: { name: 'src/main.ts' },
        }),
        undefined,
      );
    });

    // Toggling FileTree off plays the slide-down before unmounting.
    fireEvent.click(screen.getByRole('button', { name: 'FileTree' }));
    expect(treeOverlay).toHaveClass('is-closing');
    const animationEnd = new Event('animationend', { bubbles: true });
    Object.defineProperty(animationEnd, 'animationName', {
      value: 'acp-file-tree-sink',
    });
    act(() => treeOverlay?.dispatchEvent(animationEnd));
    expect(
      document.querySelector('.acp-session__file-tree-overlay'),
    ).not.toBeInTheDocument();
  });
});

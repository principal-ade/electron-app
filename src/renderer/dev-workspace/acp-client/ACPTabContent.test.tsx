import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ArchitectureMapHighlightLayers } from '@principal-ai/file-city-react';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { AcpSessionEventEnvelope } from '../../../shared/main-process-api-interfaces/AcpAPI';
import type { AcpTab } from '../../events/portalTabs';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { AcpService } from '../../main-process-api/AcpService';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';
import { ACPTabContent } from './ACPTabContent';
import { buildCityDataFromContext } from '../file-city-panel/buildCityDataFromContext';

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

const mocked = AcpService as jest.Mocked<typeof AcpService>;
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

  it('loads the saved ACP session instead of creating a new one', async () => {
    const onSessionIdChange = jest.fn();
    render(
      <ACPTabContent
        tab={makeTab({ autoStart: true, sessionId: 'ses_saved' })}
        onSessionIdChange={onSessionIdChange}
      />,
    );

    expect(await screen.findByText('Session ready')).toBeInTheDocument();
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

    const repoName = screen.getByText('subsystem-modeling');
    const identity = repoName.closest('.acp-session__identity');
    expect(identity).toHaveTextContent('subsystem-modeling');
    expect(identity).not.toHaveTextContent('OpenCode');
    expect(identity?.querySelector('img')).toHaveAttribute(
      'src',
      'https://github.com/principal-ai.png',
    );
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
      name: 'Workspace File City',
    });
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

    fireEvent.click(await screen.findByText('Allow once'));

    expect(mocked.respondPermission).toHaveBeenCalledWith({
      sessionKey: 'acp-/repo',
      requestId: 'req-1',
      optionId: 'allow',
    });
  });
});

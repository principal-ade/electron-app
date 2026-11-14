import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AcpSessionEventEnvelope } from '../../../shared/main-process-api-interfaces/AcpAPI';
import type { AcpTab } from '../../events/portalTabs';
import { AcpService } from '../../main-process-api/AcpService';
import { ACPTabContent } from './ACPTabContent';

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

const mocked = AcpService as jest.Mocked<typeof AcpService>;

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
            content: { type: 'text', text: 'Hello from the agent' },
          },
        },
      });
    });

    expect(onSessionTitleChange).toHaveBeenCalledWith(
      'Investigate ACP reconnect',
    );
    expect(onSessionTitleChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Earlier request')).toBeInTheDocument();
    expect(screen.getByText('Hello from the agent')).toBeInTheDocument();
    expect(screen.queryByText('not mine')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'List the files' },
    });
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), {
      key: 'Enter',
    });

    await waitFor(() =>
      expect(mocked.prompt).toHaveBeenCalledWith(
        'acp-/repo',
        'List the files',
      ),
    );
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

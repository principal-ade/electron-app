import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

jest.mock('@principal-ai/agent-monitoring', () => ({
  AgentEventPipeline: class {},
  OpenCodeACPEventProcessor: class {},
  SUPPORTED_AGENTS: [],
  SupportedAgent: { OPENCODE: 'opencode' },
}));

import { HttpEventServer } from './HttpEventServer';

describe('HttpEventServer ACP events', () => {
  const globalWithEventPorts = global as typeof global & {
    sendEventToPorts?: (repository: string, event: unknown) => void;
  };
  const originalSendEventToPorts = globalWithEventPorts.sendEventToPorts;

  afterEach(() => {
    if (originalSendEventToPorts) {
      globalWithEventPorts.sendEventToPorts = originalSendEventToPorts;
    } else {
      delete globalWithEventPorts.sendEventToPorts;
    }
  });

  it('returns unique ACP highlight paths without publishing to Dev Workspace ports', async () => {
    const sendEventToPorts = jest.fn();
    const sendToMain = jest.fn();
    globalWithEventPorts.sendEventToPorts = sendEventToPorts;

    const firstEvent = normalizedEvent('call-1', ['src/a.ts']);
    const secondEvent = normalizedEvent('call-1', ['src/a.ts', 'src/b.ts']);
    const thirdEvent = normalizedEvent('call-1', ['src/a.ts', 'src/b.ts']);
    const acpPipeline = {
      processRawEvent: jest
        .fn()
        .mockResolvedValueOnce(firstEvent)
        .mockResolvedValueOnce(secondEvent)
        .mockResolvedValueOnce(thirdEvent),
    };
    const server = Object.assign(
      Object.create(HttpEventServer.prototype),
      {
        acpPipeline,
        sendToMain,
        acpToolCallPaths: new Map<string, Set<string>>(),
        errorCount: 0,
      },
    ) as Pick<HttpEventServer, 'processACPEvent'>;

    await server.processACPEvent(acpInput('call-1'));
    await server.processACPEvent(acpInput('call-1'));
    await server.processACPEvent(acpInput('call-1'));

    expect(acpPipeline.processRawEvent).toHaveBeenCalledTimes(3);
    expect(sendEventToPorts).not.toHaveBeenCalled();
    expect(sendToMain).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'ACP_TOOL_PROCESSING_RESULT',
        sessionId: 'session-1',
        toolCallId: 'call-1',
        outcome: 'highlighted',
        highlightPaths: ['src/a.ts'],
      }),
    );
    expect(sendToMain).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'ACP_TOOL_PROCESSING_RESULT',
        sessionId: 'session-1',
        toolCallId: 'call-1',
        outcome: 'highlighted',
        highlightPaths: ['src/b.ts'],
      }),
    );
    expect(sendToMain).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'ACP_TOOL_PROCESSING_RESULT',
        sessionId: 'session-1',
        toolCallId: 'call-1',
        outcome: 'already-highlighted',
      }),
    );
  });
});

function acpInput(toolCallId: string) {
  return {
    sessionId: 'session-1',
    workingDirectory: '/repo',
    update: {
      sessionUpdate: 'tool_call_update' as const,
      toolCallId,
      status: 'in_progress',
    },
  };
}

function normalizedEvent(
  toolCallId: string,
  paths: string[],
): RepoNormalizedUniversalAgentSessionEvent {
  return {
    eventType: 'pre-tool-use',
    sessionId: 'session-1',
    workingDirectory: '/repo',
    timestamp: Date.now(),
    provider:
      'opencode' as RepoNormalizedUniversalAgentSessionEvent['provider'],
    toolName: 'read_file',
    data: { toolCallId },
    raw: {},
    repository: { root: '/repo' },
    files: paths.map((relativePath) => ({
      absolutePath: `/repo/${relativePath}`,
      originalPath: `/repo/${relativePath}`,
      displayPath: relativePath,
      context: 'repo_file' as NonNullable<
        RepoNormalizedUniversalAgentSessionEvent['files']
      >[number]['context'],
      repository: { gitRoot: '/repo', relativePath },
    })),
  };
}

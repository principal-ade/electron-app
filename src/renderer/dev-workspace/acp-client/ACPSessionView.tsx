import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  Loader2,
  ShieldQuestion,
  Sparkles,
  Square,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { RequestPermissionRequest } from '@agentclientprotocol/sdk';
import type { AcpAgentDefinition } from '../../../shared/main-process-api-interfaces/AcpAPI';
import { ACPWorkspaceIdentity } from './ACPWorkspaceIdentity';

export type AcpChatMessage =
  | {
      id: string;
      role: 'user' | 'agent' | 'thought';
      text: string;
      protocolMessageId?: string;
    }
  | {
      id: string;
      role: 'tool';
      toolCallId: string;
      title: string;
      status?: string;
      kind?: string;
      detail?: string;
    }
  | { id: string; role: 'notice'; text: string; level?: string };

export interface AcpPendingPermission {
  requestId: string;
  request: RequestPermissionRequest;
}

export interface ACPSessionViewProps {
  agent: AcpAgentDefinition;
  workspacePath: string;
  repository?: {
    owner: string;
    name: string;
    avatarUrl?: string;
  };
  messages: AcpChatMessage[];
  permissions: AcpPendingPermission[];
  isPrompting: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onRespondPermission: (requestId: string, optionId: string | null) => void;
  onDisconnect: () => void;
}

function toolStatusIcon(status?: string) {
  if (status === 'completed') return <CheckCircle2 size={13} />;
  if (status === 'failed') return <XCircle size={13} />;
  if (status === 'in_progress') {
    return <Loader2 className="acp-client__spinning" size={13} />;
  }
  return <Wrench size={13} />;
}

export function ACPSessionView({
  agent,
  workspacePath,
  repository,
  messages,
  permissions,
  isPrompting,
  onSend,
  onStop,
  onRespondPermission,
  onDisconnect,
}: ACPSessionViewProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, permissions, isPrompting]);

  useEffect(() => {
    if (!isPrompting) textareaRef.current?.focus();
  }, [isPrompting]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isPrompting) return;
    setDraft('');
    onSend(text);
  };

  return (
    <main className="acp-session" aria-label="ACP agent session">
      <header className="acp-session__topbar">
        <ACPWorkspaceIdentity
          workspacePath={workspacePath}
          repository={repository}
        />
        <div className="acp-session__topbar-right">
          <span className="acp-client__connection acp-client__connection--ready">
            <span className="acp-client__connection-dot" />
            Connected
          </span>
          <button
            className="acp-session__ghost-button"
            onClick={onDisconnect}
            type="button"
          >
            Disconnect
          </button>
        </div>
      </header>

      <div className="acp-session__messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="acp-session__empty">
            <Sparkles size={18} />
            <strong>Session ready</strong>
            <span>
              Ask {agent.name} to explore, explain, or change something in this
              workspace.
            </span>
          </div>
        ) : null}

        {messages.map((message) => {
          switch (message.role) {
            case 'user':
              return (
                <div
                  className="acp-session__row acp-session__row--user"
                  key={message.id}
                >
                  <div className="acp-session__bubble acp-session__bubble--user">
                    {message.text}
                  </div>
                </div>
              );
            case 'agent':
              return (
                <div className="acp-session__row" key={message.id}>
                  <div className="acp-session__bubble">
                    <span className="acp-session__role">{agent.name}</span>
                    <div className="acp-session__text">{message.text}</div>
                  </div>
                </div>
              );
            case 'thought':
              return (
                <div className="acp-session__thought" key={message.id}>
                  <Sparkles size={12} />
                  <span>{message.text}</span>
                </div>
              );
            case 'tool':
              return (
                <div className="acp-session__tool" key={message.id}>
                  <div className="acp-session__tool-head">
                    <span
                      className={`acp-session__tool-icon acp-session__tool-icon--${message.status ?? 'pending'}`}
                    >
                      {toolStatusIcon(message.status)}
                    </span>
                    <strong>{message.title}</strong>
                    {message.kind ? (
                      <span className="acp-session__tool-kind">
                        {message.kind}
                      </span>
                    ) : null}
                    {message.status ? (
                      <span className="acp-session__tool-status">
                        {message.status.replace('_', ' ')}
                      </span>
                    ) : null}
                  </div>
                  {message.detail ? (
                    <pre className="acp-session__tool-detail">
                      {message.detail}
                    </pre>
                  ) : null}
                </div>
              );
            case 'notice':
              return (
                <div
                  className={`acp-session__notice acp-session__notice--${message.level ?? 'info'}`}
                  key={message.id}
                >
                  {message.text}
                </div>
              );
            default:
              return null;
          }
        })}

        <div ref={endRef} />
      </div>

      {permissions.length > 0 ? (
        <div className="acp-session__permissions">
          {permissions.map(({ requestId, request }) => (
            <div className="acp-session__permission" key={requestId}>
              <div className="acp-session__permission-head">
                <ShieldQuestion size={17} />
                <div>
                  <strong>
                    {request.toolCall.title ?? 'Agent needs permission'}
                  </strong>
                  {request.toolCall.kind ? (
                    <span>{request.toolCall.kind}</span>
                  ) : null}
                </div>
              </div>
              <div className="acp-session__permission-options">
                {request.options.map((option) => (
                  <button
                    className={`acp-session__permission-option ${
                      option.kind.startsWith('allow')
                        ? 'is-allow'
                        : 'is-reject'
                    }`}
                    key={option.optionId}
                    onClick={() =>
                      onRespondPermission(requestId, option.optionId)
                    }
                    type="button"
                  >
                    {option.name}
                  </button>
                ))}
                <button
                  className="acp-session__permission-option is-cancel"
                  onClick={() => onRespondPermission(requestId, null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="acp-session__composer">
        <textarea
          aria-label="Message the agent"
          className="acp-session__input"
          disabled={isPrompting}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={`Ask ${agent.name} to work in this workspace…`}
          ref={textareaRef}
          rows={3}
          value={draft}
        />
        <div className="acp-session__composer-actions">
          <span className="acp-session__hint">
            Enter to send · Shift+Enter for a new line
          </span>
          {isPrompting ? (
            <button
              className="acp-session__stop-button"
              onClick={onStop}
              type="button"
            >
              <Square size={12} /> Stop
            </button>
          ) : (
            <button
              className="acp-session__send-button"
              disabled={!draft.trim()}
              onClick={submit}
              type="button"
            >
              Send <ArrowUp size={14} />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default ACPSessionView;

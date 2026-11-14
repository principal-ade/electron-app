import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Circle,
  FolderOpen,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import {
  ACP_AGENTS,
  DEFAULT_ACP_AGENT,
  type AcpAgentId,
} from '../../../shared/main-process-api-interfaces/AcpAPI';
import './ACPClientView.css';

export type ACPAgentId = AcpAgentId;
export type ACPClientViewState = 'setup' | 'initializing' | 'ready' | 'error';

export interface ACPClientViewProps {
  state?: ACPClientViewState;
  initialAgent?: ACPAgentId;
  workspacePath: string;
  repository?: {
    owner: string;
    name: string;
    avatarUrl?: string;
  };
  errorMessage?: string;
  /** True while `session/new` is in flight after a successful connect. */
  isStartingSession?: boolean;
  onAgentChange?: (agent: ACPAgentId) => void;
  onInitialize?: (agent: ACPAgentId) => void;
  onStartSession?: () => void;
  onRetry?: () => void;
}

const agents = ACP_AGENTS;

const initializationSteps = [
  { title: 'Start local agent', detail: 'Launch the selected ACP process' },
  {
    title: 'Negotiate capabilities',
    detail: 'Agree on protocol version and features',
  },
  {
    title: 'Prepare workspace session',
    detail: 'Use this folder as the session context',
  },
];

export function ACPClientView({
  state = 'setup',
  initialAgent = DEFAULT_ACP_AGENT,
  workspacePath,
  repository,
  errorMessage = 'The agent process could not be started. Check the command and try again.',
  isStartingSession = false,
  onAgentChange,
  onInitialize,
  onStartSession,
  onRetry,
}: ACPClientViewProps) {
  const [selectedAgent, setSelectedAgent] = useState<ACPAgentId>(initialAgent);
  const agent = agents.find((item) => item.id === selectedAgent) ?? agents[0];
  const isInitializing = state === 'initializing';
  const isReady = state === 'ready';
  const hasError = state === 'error';

  const selectAgent = (id: ACPAgentId) => {
    setSelectedAgent(id);
    onAgentChange?.(id);
  };

  return (
    <main className="acp-client" aria-label="ACP agent workspace">
      <header className="acp-client__topbar">
        <div className="acp-client__brand">
          {repository ? (
            <span className="acp-client__owner-avatar" aria-hidden="true">
              {repository.owner.slice(0, 2).toUpperCase()}
              {repository.avatarUrl ? (
                <img
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                  src={repository.avatarUrl}
                />
              ) : null}
            </span>
          ) : (
            <span className="acp-client__brand-icon" aria-hidden="true">
              <FolderOpen size={16} />
            </span>
          )}
          <span className="acp-client__project-copy">
            <strong>
              {repository
                ? `${repository.owner} / ${repository.name}`
                : workspacePath}
            </strong>
            {repository ? <small>{workspacePath}</small> : null}
          </span>
        </div>
        <div
          className={`acp-client__connection acp-client__connection--${state}`}
        >
          <span className="acp-client__connection-dot" />
          {isReady
            ? 'Connected'
            : isInitializing
              ? 'Initializing'
              : hasError
                ? 'Connection failed'
                : 'Not connected'}
        </div>
      </header>

      <div className="acp-client__content">
        <section className="acp-client__intro">
          <div className="acp-client__eyebrow">
            <Sparkles size={13} />
            <span>ACP AGENT CONNECTION</span>
          </div>
          <h1>Connect an agent to this project.</h1>

          <div className="acp-client__steps" aria-label="Connection steps">
            {[
              { title: 'Choose an agent', done: isInitializing || isReady },
              {
                title: 'Initialize ACP',
                done: isReady,
                active: isInitializing || hasError,
              },
              { title: 'Start a session', done: false, active: isReady },
            ].map((step, index) => (
              <div className="acp-client__step" key={step.title}>
                <span
                  className={`acp-client__step-marker${step.done ? ' is-done' : ''}${step.active ? ' is-active' : ''}`}
                  aria-hidden="true"
                >
                  {step.done ? <Check size={12} /> : index + 1}
                </span>
                <span className={step.active ? 'is-active' : ''}>
                  {step.title}
                </span>
                {index < 2 ? <span className="acp-client__step-line" /> : null}
              </div>
            ))}
          </div>

          <div className="acp-client__trust-note">
            <ShieldCheck size={17} />
            <div>
              <strong>Your machine. Your approval.</strong>
              <span>
                ACP lets the agent request permission before sensitive actions.
              </span>
            </div>
          </div>
        </section>

        <section
          className="acp-client__setup-card"
          aria-labelledby="acp-connect-title"
        >
          <div className="acp-client__card-heading">
            <div>
              <span className="acp-client__section-kicker">CONNECT AGENT</span>
              <h2 id="acp-connect-title">Choose an agent</h2>
            </div>
            <span className="acp-client__protocol-pill">
              ACP <span>v1</span>
            </span>
          </div>

          <fieldset
            className="acp-client__agent-fieldset"
            disabled={isInitializing || isReady}
          >
            <legend>Choose an agent</legend>
            <div className="acp-client__agent-grid">
              {agents.map((option) => (
                <button
                  aria-pressed={selectedAgent === option.id}
                  className={`acp-client__agent-option${selectedAgent === option.id ? ' is-selected' : ''}`}
                  key={option.id}
                  onClick={() => selectAgent(option.id)}
                  type="button"
                >
                  <span
                    className={`acp-client__agent-mark acp-client__agent-mark--${option.className}`}
                  >
                    {option.monogram}
                  </span>
                  <span className="acp-client__agent-copy">
                    <strong>{option.name}</strong>
                    <span>{option.description}</span>
                  </span>
                  <span className="acp-client__radio" aria-hidden="true">
                    {selectedAgent === option.id ? <span /> : null}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="acp-client__launch-command">
            <div className="acp-client__field-label">
              <span>AGENT LAUNCH COMMAND</span>
              <span>EXAMPLE</span>
            </div>
            <code>
              <TerminalSquare size={14} /> {agent.command}
            </code>
          </div>

          {isInitializing ? (
            <div
              className="acp-client__init-panel"
              role="status"
              aria-live="polite"
            >
              <div className="acp-client__init-heading">
                <RefreshCw className="acp-client__spinning" size={16} />
                <div>
                  <strong>Initializing {agent.name}</strong>
                  <span>Talking to the local agent process…</span>
                </div>
              </div>
              <ol className="acp-client__init-list">
                {initializationSteps.map((step, index) => (
                  <li
                    className={index < 2 ? 'is-complete' : 'is-pending'}
                    key={step.title}
                  >
                    <span className="acp-client__init-check">
                      {index < 2 ? <Check size={11} /> : <Circle size={9} />}
                    </span>
                    <span>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {hasError ? (
            <div className="acp-client__error" role="alert">
              <span className="acp-client__error-icon">!</span>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="acp-client__card-footer">
            <span className="acp-client__footer-hint">
              <LockKeyhole size={12} /> No agent starts until you connect.
            </span>
            {isReady ? (
              <button
                className="acp-client__primary-button"
                disabled={isStartingSession}
                onClick={onStartSession}
                type="button"
              >
                {isStartingSession ? 'Starting session…' : 'Start a session'}{' '}
                {isStartingSession ? null : <ArrowRight size={15} />}
              </button>
            ) : hasError ? (
              <button
                className="acp-client__primary-button"
                onClick={onRetry}
                type="button"
              >
                Try again <RefreshCw size={14} />
              </button>
            ) : (
              <button
                className="acp-client__primary-button"
                disabled={isInitializing || !workspacePath}
                onClick={() => onInitialize?.(selectedAgent)}
                type="button"
              >
                {isInitializing ? 'Initializing…' : 'Initialize agent'}
                {!isInitializing ? <ArrowRight size={15} /> : null}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default ACPClientView;

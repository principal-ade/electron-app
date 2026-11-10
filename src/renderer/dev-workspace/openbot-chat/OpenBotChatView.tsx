import React from 'react';
import { OpenBotMarkdown } from './OpenBotMarkdown';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  LaptopMinimal,
  Mic,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Plus,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import './OpenBotChatView.css';

export interface OpenBotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'activity';
  text: string;
  detail?: string;
}

export interface OpenBotChatConversation {
  id: string;
  name: string;
  summary?: string | null;
  lastMessage?: string | null;
}

export interface OpenBotChatViewProps {
  botName?: string;
  messages?: readonly OpenBotChatMessage[];
  busy?: boolean;
  placeholder?: string;
  channels?: readonly OpenBotChatConversation[];
  activeChannelId?: string;
  /** Open with the conversations sidebar visible. Storybook composition aid. */
  defaultSidebarOpen?: boolean;
  connectionState?: 'fixture' | 'connecting' | 'connected' | 'error';
  connectionError?: string | null;
  loadingConversation?: boolean;
  onSelectChannel?: (channelId: string) => void;
  onSendMessage?: (text: string) => void | Promise<void>;
  onRetry?: () => void;
}

const fixtureChannels = [
  { id: 'openbot-ui-integration', name: 'OpenBot UI integration' },
  { id: 'workspace-review', name: 'Workspace review' },
] as const;

const defaultMessages: readonly OpenBotChatMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    text: 'Can you check how the local OpenBot chat could fit into a Principal tab?',
  },
  {
    id: 'activity-1',
    role: 'activity',
    text: 'Searched the workspace',
    detail: '3 files',
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    text: 'The conversation view can live directly in a Principal tab. The first pass can keep OpenBot’s web chat layout—conversation header, transcript, and composer—while using fixture messages until the live thread connection is ready.',
  },
  {
    id: 'assistant-2',
    role: 'assistant',
    text: 'That keeps the prototype focused on the experience without bringing the web app’s routing, authentication, or agent runtime into Storybook.',
  },
];

export function OpenBotChatView({
  botName = 'OpenBot',
  messages = defaultMessages,
  busy = false,
  placeholder = 'Ask anything',
  channels,
  activeChannelId,
  defaultSidebarOpen = false,
  connectionState = 'fixture',
  connectionError,
  loadingConversation = false,
  onSelectChannel,
  onSendMessage,
  onRetry,
}: OpenBotChatViewProps) {
  const [sidebarOpen, setSidebarOpen] =
    React.useState(defaultSidebarOpen);
  const [detailPanel, setDetailPanel] = React.useState<
    'computer' | 'settings' | null
  >(null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [selectedFixtureThread, setSelectedFixtureThread] =
    React.useState<string>(fixtureChannels[0].id);
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const transcriptRef = React.useRef<HTMLDivElement>(null);
  const followBottom = React.useRef(true);
  const visibleChannels = channels ?? fixtureChannels;
  const selectedThread = activeChannelId ?? selectedFixtureThread;
  const streamingMessageId = busy
    ? [...messages].reverse().find((message) => message.role === 'assistant')
        ?.id
    : undefined;

  React.useLayoutEffect(() => {
    followBottom.current = true;
  }, [activeChannelId]);

  React.useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || loadingConversation || !followBottom.current) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [activeChannelId, loadingConversation, messages, busy]);

  const toggleDetailPanel = (panel: 'computer' | 'settings') => {
    setDetailPanel((current) => (current === panel ? null : panel));
    setMoreOpen(false);
  };

  const copyPreviewLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setActionNotice('Story link copied to clipboard');
    } catch {
      setActionNotice('Clipboard access is unavailable in this preview');
    }
    setMoreOpen(false);
  };

  const submitDraft = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || !onSendMessage) return;
    setDraft('');
    void onSendMessage(text);
  };

  const selectChannel = (channelId: string) => {
    setSelectedFixtureThread(channelId);
    onSelectChannel?.(channelId);
  };

  return (
    <section className="openbot-chat" aria-label={`${botName} conversation`}>
      {sidebarOpen ? (
        <aside className="openbot-chat__sidebar" aria-label="Conversations">
          <div className="openbot-chat__sidebar-heading">
            <span>Conversations</span>
            <button
              aria-label="Start a new conversation"
              className="openbot-chat__icon-button"
              onClick={() => {
                setActionNotice(
                  'Starting new OpenBot conversations is not supported in this native preview yet.',
                );
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
          {visibleChannels.map((channel) => (
            <button
              aria-current={selectedThread === channel.id ? 'page' : undefined}
              className={`openbot-chat__thread${selectedThread === channel.id ? ' is-selected' : ''}`}
              key={channel.id}
              onClick={() => selectChannel(channel.id)}
              type="button"
            >
              <span className="openbot-chat__thread-dot" />
              <span>{channel.name}</span>
            </button>
          ))}
        </aside>
      ) : null}

      <div className="openbot-chat__workspace">
        <header className="openbot-chat__header">
          <div className="openbot-chat__heading">
            <button
              aria-label="Toggle conversations sidebar"
              aria-pressed={sidebarOpen}
              className={`openbot-chat__icon-button${sidebarOpen ? ' is-active' : ''}`}
              onClick={() => setSidebarOpen((open) => !open)}
              title="Toggle conversations sidebar"
              type="button"
            >
              <PanelLeft aria-hidden="true" size={17} />
            </button>
            <span className="openbot-chat__avatar" aria-hidden="true">
              <Sparkles size={15} />
            </span>
            <span className="openbot-chat__bot-name">{botName}</span>
          </div>
          <div className="openbot-chat__header-actions">
            <button
              aria-pressed={detailPanel === 'computer'}
              className={`openbot-chat__computer-button${detailPanel === 'computer' ? ' is-active' : ''}`}
              onClick={() => toggleDetailPanel('computer')}
              type="button"
            >
              <LaptopMinimal aria-hidden="true" size={15} />
              <span>Computer</span>
            </button>
            <button
              aria-label="Conversation settings"
              aria-pressed={detailPanel === 'settings'}
              className={`openbot-chat__icon-button${detailPanel === 'settings' ? ' is-active' : ''}`}
              onClick={() => toggleDetailPanel('settings')}
              title="Conversation settings"
              type="button"
            >
              <Settings2 aria-hidden="true" size={17} />
            </button>
            <div className="openbot-chat__more-wrap">
              <button
                aria-label="More conversation actions"
                aria-expanded={moreOpen}
                className={`openbot-chat__icon-button${moreOpen ? ' is-active' : ''}`}
                onClick={() => setMoreOpen((open) => !open)}
                title="More conversation actions"
                type="button"
              >
                <MoreHorizontal aria-hidden="true" size={18} />
              </button>
              {moreOpen ? (
                <div className="openbot-chat__menu" role="menu">
                  <button
                    onClick={copyPreviewLink}
                    role="menuitem"
                    type="button"
                  >
                    <Copy aria-hidden="true" size={14} />
                    Copy preview link
                  </button>
                  <button
                    onClick={() => {
                      setActionNotice('This is a fixture conversation preview');
                      setMoreOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Sparkles aria-hidden="true" size={14} />
                    About this preview
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {connectionState !== 'fixture' ? (
          <div
            className={`openbot-chat__connection openbot-chat__connection--${connectionState}`}
          >
            <span className="openbot-chat__connection-dot" />
            {connectionState === 'connecting'
              ? 'Connecting to local OpenBot…'
              : connectionState === 'connected'
                ? 'Connected to local OpenBot'
                : 'OpenBot is unavailable'}
          </div>
        ) : null}

        {connectionError ? (
          <div className="openbot-chat__notice" role="alert">
            <span>{connectionError}</span>
            {onRetry ? (
              <button
                className="openbot-chat__retry-button"
                onClick={onRetry}
                type="button"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : actionNotice ? (
          <div className="openbot-chat__notice" role="status">
            <span>{actionNotice}</span>
            <button
              aria-label="Dismiss notification"
              className="openbot-chat__icon-button"
              onClick={() => setActionNotice(null)}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        ) : null}

        <div className="openbot-chat__body">
          <div className="openbot-chat__conversation">
            <div
              className="openbot-chat__transcript"
              onScroll={(event) => {
                const element = event.currentTarget;
                followBottom.current =
                  element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight <=
                  56;
              }}
              role="log"
              aria-live="polite"
              ref={transcriptRef}
            >
              <div className="openbot-chat__messages">
                {connectionState === 'connecting' && messages.length === 0 ? (
                  <p className="openbot-chat__empty">
                    Loading OpenBot conversations…
                  </p>
                ) : null}
                {loadingConversation ? (
                  <p className="openbot-chat__empty">
                    Loading conversation history…
                  </p>
                ) : null}
                {connectionState === 'connected' && !activeChannelId ? (
                  <p className="openbot-chat__empty">
                    {channels?.length
                      ? 'Choose a conversation from the sidebar.'
                      : 'No OpenBot conversations yet.'}
                  </p>
                ) : null}
                {messages.map((message) => {
                  if (message.role === 'activity') {
                    return (
                      <div className="openbot-chat__activity" key={message.id}>
                        <span
                          className="openbot-chat__activity-icon"
                          aria-hidden="true"
                        >
                          <Check size={13} />
                        </span>
                        <span>{message.text}</span>
                        {message.detail ? (
                          <span className="openbot-chat__activity-detail">
                            {message.detail}
                          </span>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <article
                      className={`openbot-chat__message openbot-chat__message--${message.role}`}
                      key={message.id}
                    >
                      {message.role === 'user' ? (
                        <p className="openbot-chat__user-bubble">
                          {message.text}
                        </p>
                      ) : (
                        <div className="openbot-chat__assistant-copy">
                          <OpenBotMarkdown
                            streaming={message.id === streamingMessageId}
                            text={message.text}
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
                {busy ? (
                  <p className="openbot-chat__thinking" role="status">
                    Thinking
                  </p>
                ) : null}
              </div>
            </div>

            <footer className="openbot-chat__footer">
              <form className="openbot-chat__composer" onSubmit={submitDraft}>
                <textarea
                  aria-label="Message"
                  placeholder={placeholder}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                />
                <div className="openbot-chat__composer-actions">
                  <div className="openbot-chat__composer-tools">
                    <button
                      aria-label="Attach a file"
                      className="openbot-chat__icon-button"
                      type="button"
                    >
                      <Paperclip aria-hidden="true" size={17} />
                    </button>
                    <button
                      className="openbot-chat__model-button"
                      type="button"
                    >
                      Auto <ChevronDown aria-hidden="true" size={12} />
                    </button>
                  </div>
                  <div className="openbot-chat__composer-tools">
                    <button
                      aria-label="Voice input"
                      className="openbot-chat__icon-button"
                      type="button"
                    >
                      <Mic aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label="Send message"
                      className="openbot-chat__send-button"
                      disabled={!draft.trim() || busy || !onSendMessage}
                      type="submit"
                    >
                      <ArrowUp aria-hidden="true" size={17} />
                    </button>
                  </div>
                </div>
              </form>
              <p className="openbot-chat__disclaimer">
                OpenBot can make mistakes. Check important details.
              </p>
            </footer>
          </div>

          {detailPanel ? (
            <aside
              className="openbot-chat__detail"
              aria-label={`${detailPanel} panel`}
            >
              <div className="openbot-chat__detail-heading">
                <span>
                  {detailPanel === 'computer'
                    ? 'Computer'
                    : 'Conversation settings'}
                </span>
                <button
                  aria-label={`Close ${detailPanel} panel`}
                  className="openbot-chat__icon-button"
                  onClick={() => setDetailPanel(null)}
                  type="button"
                >
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
              {detailPanel === 'computer' ? (
                <div className="openbot-chat__computer-preview">
                  <div className="openbot-chat__browser-chrome">
                    <span />
                    <span />
                    <span />
                    <div>Computer preview</div>
                  </div>
                  <div className="openbot-chat__computer-empty">
                    <LaptopMinimal aria-hidden="true" size={24} />
                    <strong>No active computer session</strong>
                    <span>
                      The Bot’s screen will appear here when it starts working.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="openbot-chat__settings-content">
                  <label htmlFor="openbot-model">Model</label>
                  <select id="openbot-model" defaultValue="automatic">
                    <option value="automatic">Automatic</option>
                    <option value="fast">Fast</option>
                    <option value="reasoning">Reasoning</option>
                  </select>
                  <label className="openbot-chat__setting-toggle">
                    <input defaultChecked type="checkbox" />
                    <span>Allow computer use</span>
                  </label>
                  <p>
                    These controls are a local preview of conversation settings.
                  </p>
                </div>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}

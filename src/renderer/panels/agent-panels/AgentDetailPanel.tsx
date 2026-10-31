import React, { useState, useEffect, useRef } from 'react';
import type {
  PanelComponentProps,
  AgentPanelActions,
  AgentsPanelContext,
} from './types';
import { useAgentsData, type Agent } from './agents/hooks/useAgentsData';
import { useSubagentsData, type Subagent } from './agents/hooks/useSubagentsData';
import { DocumentView } from 'themed-markdown';
import { useTheme } from '@principal-ade/industry-theme';
import { usePanelFocusListener } from '@principal-ade/panel-layouts';
import { BookOpen, Bot, FileText, Wrench, Zap, Code2 } from 'lucide-react';

export type AgentDetailPanelProps = PanelComponentProps<AgentPanelActions, AgentsPanelContext>;

type SelectedItem =
  | { type: 'agent'; data: Agent }
  | { type: 'subagent'; data: Subagent }
  | null;

export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  context,
  events,
}) => {
  const { theme } = useTheme();
  const { isLoading: agentsLoading, error: agentsError } = useAgentsData({ context });
  const { isLoading: subagentsLoading, error: subagentsError } = useSubagentsData({ context });
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isLoading = agentsLoading || subagentsLoading;
  const error = agentsError || subagentsError;

  // Listen for panel focus events
  usePanelFocusListener('agent-detail', events, () => panelRef.current?.focus());

  // Listen for agent/subagent selection events
  useEffect(() => {
    const unsubscribeAgent = events.on('agent:selected', (event) => {
      const payload = event.payload as { id?: string; data?: Agent } | undefined;
      if (payload?.id && payload?.data) {
        setSelectedItem({ type: 'agent', data: payload.data });
      }
    });

    const unsubscribeSubagent = events.on('subagent:selected', (event) => {
      const payload = event.payload as { id?: string; data?: Subagent } | undefined;
      if (payload?.id && payload?.data) {
        setSelectedItem({ type: 'subagent', data: payload.data });
      }
    });

    return () => {
      unsubscribeAgent();
      unsubscribeSubagent();
    };
  }, [events]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          backgroundColor: theme.colors.background,
          color: theme.colors.error,
          fontFamily: theme.fonts.body,
        }}
      >
        <div style={{ textAlign: 'center' }}>Error loading agents: {error}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        Loading agents...
      </div>
    );
  }

  if (!selectedItem) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1rem',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          padding: '2rem',
        }}
      >
        <BookOpen size={48} color={theme.colors.border} />
        <p style={{ margin: 0, textAlign: 'center' }}>
          Select an agent or subagent from the list to view details
        </p>
      </div>
    );
  }

  // Render AGENTS.md documentation
  if (selectedItem.type === 'agent') {
    const agent = selectedItem.data;

    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.background,
          fontFamily: theme.fonts.body,
          outline: 'none',
        }}
      >
        {/* Header - Static */}
        <div
          style={{
            flexShrink: 0,
            padding: 'clamp(16px, 3vw, 24px)',
            paddingBottom: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <BookOpen size={24} color={theme.colors.primary} />
            <h1
              style={{
                margin: 0,
                fontSize: theme.fontSizes[5],
                color: theme.colors.text,
                fontWeight: 600,
              }}
            >
              {agent.name}
            </h1>
          </div>
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.monospace,
            }}
          >
            {agent.path}
          </div>
        </div>

        {/* Markdown Content - Scrollable */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'clamp(16px, 3vw, 24px)',
            color: theme.colors.text,
          }}
        >
          <DocumentView content={agent.content} theme={theme} />
        </div>
      </div>
    );
  }

  // Render Subagent
  if (selectedItem.type === 'subagent') {
    const subagent = selectedItem.data;
    const fm = subagent.frontmatter;

    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.background,
          fontFamily: theme.fonts.body,
          outline: 'none',
        }}
      >
        {/* Header - Static */}
        <div
          style={{
            flexShrink: 0,
            padding: 'clamp(16px, 3vw, 24px)',
            paddingBottom: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Bot size={24} color={theme.colors.primary} />
            <h1
              style={{
                margin: 0,
                fontSize: theme.fontSizes[5],
                color: theme.colors.text,
                fontWeight: 600,
              }}
            >
              {subagent.name}
            </h1>
          </div>
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.monospace,
              marginBottom: '12px',
            }}
          >
            {subagent.path}
          </div>

          {/* Description */}
          <p
            style={{
              margin: '12px 0 16px 0',
              fontSize: theme.fontSizes[2],
              color: theme.colors.text,
              lineHeight: 1.6,
            }}
          >
            {fm.description}
          </p>

          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            {/* Model */}
            {fm.model && (
              <div
                style={{
                  padding: '12px',
                  background: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px',
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[0],
                  }}
                >
                  <Zap size={14} />
                  <span>Model</span>
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                  }}
                >
                  {fm.model}
                </div>
              </div>
            )}

            {/* Tools */}
            {fm.tools && (
              <div
                style={{
                  padding: '12px',
                  background: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px',
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[0],
                  }}
                >
                  <Wrench size={14} />
                  <span>Tools</span>
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                  }}
                >
                  {fm.tools}
                </div>
              </div>
            )}

            {/* Permission Mode */}
            {fm.permissionMode && fm.permissionMode !== 'default' && (
              <div
                style={{
                  padding: '12px',
                  background: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px',
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[0],
                  }}
                >
                  <FileText size={14} />
                  <span>Permission Mode</span>
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                  }}
                >
                  {fm.permissionMode}
                </div>
              </div>
            )}

            {/* Skills */}
            {fm.skills && (
              <div
                style={{
                  padding: '12px',
                  background: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px',
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[0],
                  }}
                >
                  <Code2 size={14} />
                  <span>Skills</span>
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    fontFamily: theme.fonts.monospace,
                  }}
                >
                  {fm.skills}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'clamp(16px, 3vw, 24px)',
          }}
        >
          {/* Prompt Section */}
          <div>
            <h2
              style={{
                margin: '0 0 16px 0',
                fontSize: theme.fontSizes[3],
                color: theme.colors.text,
                fontWeight: 600,
              }}
            >
              Prompt
            </h2>
            <div
              style={{
                padding: '16px',
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                color: theme.colors.text,
              }}
            >
              <DocumentView content={subagent.prompt} theme={theme} />
            </div>
          </div>

          {/* Disallowed Tools */}
          {fm.disallowedTools && (
            <div style={{ marginTop: '24px' }}>
              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.text,
                  fontWeight: 600,
                }}
              >
                Disallowed Tools
              </h3>
              <div
                style={{
                  padding: '12px',
                  background: `${theme.colors.error}10`,
                  border: `1px solid ${theme.colors.error}40`,
                  borderRadius: theme.radii[2],
                  color: theme.colors.text,
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[1],
                }}
              >
                {fm.disallowedTools}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

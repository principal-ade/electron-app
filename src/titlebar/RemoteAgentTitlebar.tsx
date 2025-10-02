import React, { useEffect, useState } from 'react';
import { useTheme } from 'themed-markdown';
import type { RemoteAgentConfig } from '../shared/types/remoteAgent.types';

export const RemoteAgentTitlebar: React.FC = () => {
  const { theme } = useTheme();
  const [agents, setAgents] = useState<RemoteAgentConfig[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to agent list changes
    const unsubscribeList = window.mainProcess.remoteAgentWindow.onRemoteAgentListChanged(
      (agentList, activeId) => {
        setAgents(agentList);
        setActiveAgentId(activeId);
      }
    );

    // Subscribe to active agent changes
    const unsubscribeActive = window.mainProcess.remoteAgentWindow.onRemoteAgentActiveChanged(
      (agentId) => {
        setActiveAgentId(agentId);
      }
    );

    // Load initial state
    (async () => {
      try {
        const agentList = await window.mainProcess.remoteAgentWindow.listRemoteAgents();
        const activeId = await window.mainProcess.remoteAgentWindow.getActiveAgentId();
        setAgents(agentList);
        setActiveAgentId(activeId);
      } catch (error) {
        console.error('Failed to load initial agent state:', error);
      }
    })();

    return () => {
      unsubscribeList();
      unsubscribeActive();
    };
  }, []);

  const handleSwitchAgent = async (agentId: string) => {
    try {
      await window.mainProcess.remoteAgentWindow.switchToAgent(agentId);
    } catch (error) {
      console.error('Failed to switch agent:', error);
    }
  };

  const handleCloseAgent = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.mainProcess.remoteAgentWindow.closeRemoteAgent(agentId);
    } catch (error) {
      console.error('Failed to close agent:', error);
    }
  };

  return (
    <div
      style={{
        height: '40px',
        background: theme.colors?.background || '#2d2d2d',
        borderBottom: `1px solid ${theme.colors?.border || '#444'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px 0 80px',
        WebkitAppRegion: 'drag',
        color: theme.colors?.text || '#fff',
        fontFamily: theme.fonts?.body || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ flex: 1 }}>
        {agents.length === 0 ? (
          <span style={{ opacity: 0.6 }}>Remote Agents</span>
        ) : null}
      </div>
      <div
        style={{
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          gap: '6px',
        }}
      >
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => handleSwitchAgent(agent.id)}
            style={{
              padding: '6px 12px',
              background: activeAgentId === agent.id
                ? (theme.colors?.primary || '#007acc')
                : (theme.colors?.surface || '#1e1e1e'),
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => {
              if (activeAgentId !== agent.id) {
                e.currentTarget.style.background = theme.colors?.secondary || '#333';
              }
            }}
            onMouseLeave={(e) => {
              if (activeAgentId !== agent.id) {
                e.currentTarget.style.background = theme.colors?.surface || '#1e1e1e';
              }
            }}
          >
            <span>{agent.name}</span>
            <button
              onClick={(e) => handleCloseAgent(agent.id, e)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors?.text || '#fff',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '16px',
                lineHeight: '1',
                opacity: 0.6,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

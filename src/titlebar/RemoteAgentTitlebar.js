import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
export const RemoteAgentTitlebar = () => {
  const { theme } = useTheme();
  const [agents, setAgents] = useState([]);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [hoveredAgentId, setHoveredAgentId] = useState(null);
  const accentColor = theme.colors?.primary || '#007acc';
  const surfaceColor = theme.colors?.surface || '#1e1e1e';
  const borderColor = theme.colors?.border || '#444';
  const textColor = theme.colors?.text || '#fff';
  const buildAgentButtonStyle = (agentId) => {
    const isSelected = activeAgentId === agentId;
    const isHovered = hoveredAgentId === agentId;
    return {
      padding: '6px 12px',
      background: surfaceColor,
      borderRadius: '6px',
      border: `1px solid ${isSelected || isHovered ? accentColor : borderColor}`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition:
        'color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      fontSize: '13px',
      color: isSelected ? accentColor : textColor,
      boxShadow: isSelected
        ? `0 0 0 1px ${accentColor}40`
        : isHovered
          ? `0 0 0 1px ${accentColor}20`
          : 'none',
      fontWeight: isSelected ? 600 : 500,
      WebkitAppRegion: 'no-drag',
    };
  };
  const buildCloseButtonStyle = (agentId) => {
    const isSelected = activeAgentId === agentId;
    return {
      background: 'transparent',
      border: 'none',
      color: isSelected ? accentColor : textColor,
      cursor: 'pointer',
      padding: '2px 4px',
      fontSize: '16px',
      lineHeight: '1',
      opacity: isSelected ? 0.8 : 0.6,
      transition: 'opacity 0.2s ease, color 0.2s ease',
      display: 'flex',
      alignItems: 'center',
    };
  };
  useEffect(() => {
    if (
      hoveredAgentId &&
      !agents.some((agent) => agent.id === hoveredAgentId)
    ) {
      setHoveredAgentId(null);
    }
  }, [agents, hoveredAgentId]);
  useEffect(() => {
    // Subscribe to agent list changes
    const unsubscribeList =
      window.mainProcess.remoteAgentWindow.onRemoteAgentListChanged(
        (agentList, activeId) => {
          setAgents(agentList);
          setActiveAgentId(activeId);
        },
      );
    // Subscribe to active agent changes
    const unsubscribeActive =
      window.mainProcess.remoteAgentWindow.onRemoteAgentActiveChanged(
        (agentId) => {
          setActiveAgentId(agentId);
        },
      );
    // Load initial state
    (async () => {
      try {
        const agentList =
          await window.mainProcess.remoteAgentWindow.listRemoteAgents();
        const activeId =
          await window.mainProcess.remoteAgentWindow.getActiveAgentId();
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
  const handleSwitchAgent = async (agentId) => {
    try {
      await window.mainProcess.remoteAgentWindow.switchToAgent(agentId);
    } catch (error) {
      console.error('Failed to switch agent:', error);
    }
  };
  const handleCloseAgent = async (agentId, e) => {
    e.stopPropagation();
    try {
      await window.mainProcess.remoteAgentWindow.closeRemoteAgent(agentId);
    } catch (error) {
      console.error('Failed to close agent:', error);
    }
  };
  return _jsxs('div', {
    style: {
      height: '40px',
      background: theme.colors?.background || '#2d2d2d',
      borderBottom: `1px solid ${theme.colors?.border || '#444'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 10px 0 80px',
      WebkitAppRegion: 'drag',
      color: theme.colors?.text || '#fff',
      fontFamily:
        theme.fonts?.body ||
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    children: [
      _jsx('div', {
        style: { flex: 1 },
        children:
          agents.length === 0
            ? _jsx('span', {
                style: { opacity: 0.6 },
                children: 'Remote Agents',
              })
            : null,
      }),
      _jsx('div', {
        style: {
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          gap: '6px',
        },
        children: agents.map((agent) =>
          _jsxs(
            'div',
            {
              onClick: () => handleSwitchAgent(agent.id),
              style: buildAgentButtonStyle(agent.id),
              onMouseEnter: () => setHoveredAgentId(agent.id),
              onMouseLeave: () => {
                setHoveredAgentId((current) =>
                  current === agent.id ? null : current,
                );
              },
              children: [
                _jsx('span', { children: agent.name }),
                _jsx('button', {
                  onClick: (e) => handleCloseAgent(agent.id, e),
                  style: buildCloseButtonStyle(agent.id),
                  onMouseEnter: (e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = accentColor;
                  },
                  onMouseLeave: (e) => {
                    const style = buildCloseButtonStyle(agent.id);
                    e.currentTarget.style.opacity = `${style.opacity}`;
                    e.currentTarget.style.color = `${style.color}`;
                  },
                  children: '\u00D7',
                }),
              ],
            },
            agent.id,
          ),
        ),
      }),
    ],
  });
};

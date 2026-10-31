import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { usePanelFocusListener } from '@principal-ade/panel-layouts';
import { AlertCircle, Search, X, RefreshCw, FileCode, BookOpen, Bot, Wrench } from 'lucide-react';
import type {
  PanelComponentProps,
  AgentPanelActions,
  AgenticResourcesPanelContext,
} from './types';
import { useAgentsData, type Agent } from './agents/hooks/useAgentsData';
import { useSubagentsData, type Subagent } from './agents/hooks/useSubagentsData';
import { AgentCard } from './agents/components/AgentCard';
import { SubagentCard } from './agents/components/SubagentCard';
import { useSkillsData, type Skill } from './skills/hooks/useSkillsData';
import { SkillCard } from './skills/components/SkillCard';

type PanelMode = 'agents' | 'skills';
type AgentFilter = 'documentation' | 'subagents';
type SkillFilter = 'project' | 'global';

type AgentItem =
  | { type: 'agent'; data: Agent }
  | { type: 'subagent'; data: Subagent };

/**
 * AgenticResourcesPanel - A unified panel for displaying both Agents and Skills
 *
 * This panel shows:
 * - AGENTS.md files (documentation for AI agents)
 * - Subagent definitions (from .claude/agents/)
 * - SKILL.md files (Agent Skills)
 * - Search and filter functionality
 * - Mode toggle to switch between Agents and Skills views
 * - Click to select and emit events for detail views
 */
export const AgenticResourcesPanel: React.FC<PanelComponentProps<AgentPanelActions, AgenticResourcesPanelContext>> = ({
  context,
  events,
}) => {
  const { theme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const hasLoadedAgentsRef = useRef(false);
  const hasLoadedSkillsRef = useRef(false);

  // Check if fileTree contains any agent-related files (for determining initial mode)
  const fileTreeHasAgentFiles = useMemo(() => {
    const fileTree = context.fileTree?.data;
    const allFiles = fileTree?.allFiles;
    if (!allFiles || !Array.isArray(allFiles)) return false;
    return allFiles.some(
      (f: { name: string; relativePath: string }) =>
        f.name?.toUpperCase() === 'AGENTS.MD' ||
        f.relativePath?.startsWith('.claude/agents/')
    );
  }, [context.fileTree?.data]);

  // Check if there are global agents/subagents
  const hasGlobalAgents = useMemo(() => {
    const globalAgents = context.globalAgents?.data?.agents;
    const globalSubagents = context.globalSubagents?.data?.subagents;
    return (globalAgents && globalAgents.length > 0) || (globalSubagents && globalSubagents.length > 0);
  }, [context.globalAgents?.data?.agents, context.globalSubagents?.data?.subagents]);

  // Determine initial mode: if no agent files exist anywhere, start in skills mode
  const initialMode = useMemo((): PanelMode => {
    if (!fileTreeHasAgentFiles && !hasGlobalAgents) {
      return 'skills';
    }
    return 'agents';
  }, [fileTreeHasAgentFiles, hasGlobalAgents]);

  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('documentation');
  const [skillFilter, setSkillFilter] = useState<SkillFilter>('project');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync mode with initialMode when it changes (e.g., fileTree loads)
  const prevInitialModeRef = useRef(initialMode);
  useEffect(() => {
    if (prevInitialModeRef.current !== initialMode && initialMode === 'skills') {
      setMode('skills');
    }
    prevInitialModeRef.current = initialMode;
  }, [initialMode]);

  // Load agents and subagents data
  const {
    agents,
    isLoading: agentsLoading,
    error: agentsError,
  } = useAgentsData({ context });

  const {
    subagents,
    isLoading: subagentsLoading,
    error: subagentsError,
  } = useSubagentsData({ context });

  // Load skills data
  const {
    skills,
    isLoading: skillsLoading,
    error: skillsError,
    refreshSkills,
  } = useSkillsData({ context });

  // Track when initial load completes
  if (!agentsLoading && !subagentsLoading && !hasLoadedAgentsRef.current) {
    hasLoadedAgentsRef.current = true;
  }
  if (!skillsLoading && !hasLoadedSkillsRef.current) {
    hasLoadedSkillsRef.current = true;
  }

  // Only show loading on initial load, not on refreshes
  const showAgentsLoading = (agentsLoading || subagentsLoading) && !hasLoadedAgentsRef.current;
  const showSkillsLoading = skillsLoading && !hasLoadedSkillsRef.current;
  const isLoading = mode === 'agents' ? showAgentsLoading : showSkillsLoading;
  const error = mode === 'agents' ? (agentsError || subagentsError) : skillsError;

  // Listen for panel focus events
  usePanelFocusListener('agentic-resources', events, () => panelRef.current?.focus());

  // Listen for skill installation/uninstallation events to refresh the skills list
  useEffect(() => {
    if (mode !== 'skills') return;

    const unsubscribeInstalled = events.on('skill:installed', () => {
      refreshSkills();
    });

    const unsubscribeUninstalled = events.on('skill:uninstalled', () => {
      refreshSkills();
    });

    return () => {
      unsubscribeInstalled();
      unsubscribeUninstalled();
    };
  }, [events, mode, refreshSkills]);

  // Combine agents and subagents into a unified list
  const allItems: AgentItem[] = useMemo(() => {
    const items: AgentItem[] = [];

    // Add agents (AGENTS.md files)
    agents.forEach((agent) => {
      items.push({ type: 'agent', data: agent });
    });

    // Add subagents
    subagents.forEach((subagent) => {
      items.push({ type: 'subagent', data: subagent });
    });

    return items;
  }, [agents, subagents]);

  // Filter agent items by search query and type
  const filteredItems = useMemo(() => {
    let filtered = allItems;

    // Filter by type
    if (agentFilter === 'documentation') {
      filtered = filtered.filter((item) => item.type === 'agent');
    } else {
      // agentFilter === 'subagents'
      filtered = filtered.filter((item) => item.type === 'subagent');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        if (item.type === 'agent') {
          const agent = item.data;
          // Search in name, path, content
          if (agent.name.toLowerCase().includes(query)) return true;
          if (agent.path.toLowerCase().includes(query)) return true;
          if (agent.content.toLowerCase().includes(query)) return true;
          return false;
        } else {
          const subagent = item.data;
          // Search in name, path, description, prompt
          if (subagent.name.toLowerCase().includes(query)) return true;
          if (subagent.path.toLowerCase().includes(query)) return true;
          if (subagent.frontmatter.description.toLowerCase().includes(query)) return true;
          if (subagent.prompt.toLowerCase().includes(query)) return true;
          return false;
        }
      });
    }

    return filtered;
  }, [allItems, searchQuery, agentFilter]);

  // Check if there's a repository loaded (for skills filter)
  const hasRepository = useMemo(() => {
    return !!context.fileTree?.data;
  }, [context.fileTree?.data]);

  // Filter skills by search query and source type
  const filteredSkills = useMemo(() => {
    let filtered = skills;

    // Filter by source type
    if (skillFilter === 'project') {
      filtered = filtered.filter((skill) => {
        if (skill.installedLocations && skill.installedLocations.length > 0) {
          return skill.installedLocations.some(
            (loc) =>
              loc.source === 'project-universal' ||
              loc.source === 'project-claude' ||
              loc.source === 'project-other'
          );
        }
        return (
          skill.source === 'project-universal' ||
          skill.source === 'project-claude' ||
          skill.source === 'project-other'
        );
      });
    } else if (skillFilter === 'global') {
      filtered = filtered.filter((skill) => {
        if (skill.installedLocations && skill.installedLocations.length > 0) {
          return skill.installedLocations.some(
            (loc) => loc.source === 'global-universal' || loc.source === 'global-claude'
          );
        }
        return skill.source === 'global-universal' || skill.source === 'global-claude';
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((skill) => {
        if (skill.name.toLowerCase().includes(query)) return true;
        if (skill.description?.toLowerCase().includes(query)) return true;
        if (skill.capabilities?.some((cap) => cap.toLowerCase().includes(query))) return true;
        if (skill.path.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    return filtered;
  }, [skills, searchQuery, skillFilter]);

  const handleItemClick = (item: AgentItem) => {
    const itemId = item.type === 'agent' ? item.data.id : item.data.id;
    setSelectedItemId(itemId);

    // Emit event for other panels
    if (events) {
      events.emit({
        type: item.type === 'agent' ? 'agent:selected' : 'subagent:selected',
        source: 'agentic-resources-panel',
        timestamp: Date.now(),
        payload: {
          id: itemId,
          type: item.type,
          data: item.data,
        },
      });
    }
  };

  const handleSkillClick = (skill: Skill) => {
    setSelectedItemId(skill.id);
    if (events) {
      events.emit({
        type: 'skill:selected',
        source: 'agentic-resources-panel',
        timestamp: Date.now(),
        payload: { skillId: skill.id, skill },
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Minimum animation duration for visual feedback
      const minDelay = new Promise(resolve => setTimeout(resolve, 600));

      // Emit refresh event so host refreshes the fileTree/globalSkills from disk
      if (events) {
        events.emit({
          type: mode === 'agents' ? 'agents:refresh' : 'skills:refresh',
          source: 'agentic-resources-panel',
          timestamp: Date.now(),
          payload: {},
        });
      }
      await minDelay;
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleModeChange = (newMode: PanelMode) => {
    setMode(newMode);
    setSearchQuery(''); // Clear search when switching modes
    setSelectedItemId(null); // Clear selection when switching modes
  };

  const agentsCount = agents.length;
  const subagentsCount = subagents.length;

  // Check if there are any agents at all (for hiding agents mode toggle)
  // Use both loaded data AND fileTree check for robustness
  const hasAnyAgents = agents.length > 0 || subagents.length > 0 || fileTreeHasAgentFiles || hasGlobalAgents;

  // Check if there are any project skills (for hiding project filter)
  const hasProjectSkills = useMemo(() => {
    return skills.some((skill) => {
      if (skill.installedLocations && skill.installedLocations.length > 0) {
        return skill.installedLocations.some(
          (loc) =>
            loc.source === 'project-universal' ||
            loc.source === 'project-claude' ||
            loc.source === 'project-other'
        );
      }
      return (
        skill.source === 'project-universal' ||
        skill.source === 'project-claude' ||
        skill.source === 'project-other'
      );
    });
  }, [skills]);

  // Auto-switch to skills mode if in agents mode but no agents exist
  // This handles cases where data loads after initial render
  useEffect(() => {
    // Only switch if we have fileTree data (not still loading) and confirmed no agents
    const fileTreeLoaded = context.fileTree?.data != null;
    if (mode === 'agents' && fileTreeLoaded && !fileTreeHasAgentFiles && !hasGlobalAgents) {
      setMode('skills');
    }
  }, [mode, context.fileTree?.data, fileTreeHasAgentFiles, hasGlobalAgents]);

  // Auto-switch to global filter if no project skills
  useEffect(() => {
    if (skillFilter === 'project' && !hasProjectSkills && !showSkillsLoading) {
      setSkillFilter('global');
    }
  }, [skillFilter, hasProjectSkills, showSkillsLoading]);

  // Auto-switch agent filter to available type when one is empty
  useEffect(() => {
    if (showAgentsLoading) return;
    if (agentFilter === 'documentation' && agentsCount === 0 && subagentsCount > 0) {
      setAgentFilter('subagents');
    } else if (agentFilter === 'subagents' && subagentsCount === 0 && agentsCount > 0) {
      setAgentFilter('documentation');
    }
  }, [agentFilter, agentsCount, subagentsCount, showAgentsLoading]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      style={{
        padding: 'clamp(12px, 3vw, 20px)',
        fontFamily: theme.fonts.body,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        outline: 'none',
      }}
    >
      {/* Header - Mode Toggle and Refresh */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Mode Toggle - only show toggle if there are agents */}
        <div style={{ display: 'flex', gap: '4px', background: hasAnyAgents ? theme.colors.backgroundSecondary : 'transparent', padding: hasAnyAgents ? '4px' : 0, borderRadius: theme.radii[2], border: hasAnyAgents ? `1px solid ${theme.colors.border}` : 'none' }}>
          {hasAnyAgents && (
            <button
              onClick={() => handleModeChange('agents')}
              style={{
                padding: '6px 14px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: 'none',
                borderRadius: theme.radii[1],
                background: mode === 'agents' ? theme.colors.background : 'transparent',
                color: mode === 'agents' ? theme.colors.text : theme.colors.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: mode === 'agents' ? 600 : 400,
                transition: 'all 0.2s ease',
                boxShadow: mode === 'agents' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Bot size={14} />
              Agents
            </button>
          )}
          {hasAnyAgents ? (
            <button
              onClick={() => handleModeChange('skills')}
              style={{
                padding: '6px 14px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: 'none',
                borderRadius: theme.radii[1],
                background: mode === 'skills' ? theme.colors.background : 'transparent',
                color: mode === 'skills' ? theme.colors.text : theme.colors.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: mode === 'skills' ? 600 : 400,
                transition: 'all 0.2s ease',
                boxShadow: mode === 'skills' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Wrench size={14} />
              Skills
            </button>
          ) : (
            /* When no agents, just show Skills as a title */
            <div
              style={{
                padding: '6px 14px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              <Wrench size={14} />
              {hasProjectSkills ? 'Skills' : 'Global Skills'}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          style={{
            background: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii[1],
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            opacity: isRefreshing ? 0.7 : 1,
          }}
          title={mode === 'agents' ? 'Refresh agents' : 'Refresh skills'}
        >
          <RefreshCw
            size={16}
            color={theme.colors.textSecondary}
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>
      </div>

      {/* Search bar - separate row, only show if there are >= 5 items */}
      {((mode === 'agents' && allItems.length >= 5) || (mode === 'skills' && skills.length >= 5)) && (
        <div
          style={{
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <Search
            size={16}
            color={theme.colors.textSecondary}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder={mode === 'agents' ? 'Search agents...' : 'Search skills...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 32px 8px 32px',
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[2],
              background: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Filter Toggle */}
      {mode === 'agents' ? (
        /* Only show filter toggle if both agent types exist */
        agentsCount > 0 && subagentsCount > 0 ? (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => setAgentFilter('documentation')}
              style={{
                flex: 1,
                padding: '8px 16px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: `1px solid ${agentFilter === 'documentation' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.radii[1],
                background: agentFilter === 'documentation' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
                color: agentFilter === 'documentation' ? theme.colors.primary : theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: agentFilter === 'documentation' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              <BookOpen size={14} />
              Main Agent ({agentsCount})
            </button>
            <button
              onClick={() => setAgentFilter('subagents')}
              style={{
                flex: 1,
                padding: '8px 16px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: `1px solid ${agentFilter === 'subagents' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.radii[1],
                background: agentFilter === 'subagents' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
                color: agentFilter === 'subagents' ? theme.colors.primary : theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: agentFilter === 'subagents' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              <Bot size={14} />
              Subagents ({subagentsCount})
            </button>
          </div>
        ) : null
      ) : (
        hasRepository && hasProjectSkills && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => setSkillFilter('project')}
              style={{
                flex: 1,
                padding: '8px 16px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: `1px solid ${skillFilter === 'project' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.radii[1],
                background: skillFilter === 'project' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
                color: skillFilter === 'project' ? theme.colors.primary : theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: skillFilter === 'project' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              Project
            </button>
            <button
              onClick={() => setSkillFilter('global')}
              style={{
                flex: 1,
                padding: '8px 16px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                border: `1px solid ${skillFilter === 'global' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.radii[1],
                background: skillFilter === 'global' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
                color: skillFilter === 'global' ? theme.colors.primary : theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: skillFilter === 'global' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              Global
            </button>
          </div>
        )
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            flexShrink: 0,
            padding: '12px',
            background: `${theme.colors.error}20`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: theme.radii[2],
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.error,
            fontSize: theme.fontSizes[1],
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {mode === 'agents' ? (
          // Agents view
          isLoading ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[2],
              }}
            >
              Loading agents...
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                color: theme.colors.textSecondary,
                padding: '24px',
              }}
            >
              <FileCode size={48} color={theme.colors.border} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
                  {searchQuery ? 'No agents match your search' : 'No agents found'}
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: theme.fontSizes[1] }}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Add AGENTS.md or create subagents in .claude/agents/ to get started'}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
                padding: '4px',
              }}
            >
              {filteredItems.map((item) => {
                if (item.type === 'agent') {
                  return (
                    <AgentCard
                      key={item.data.id}
                      agent={item.data}
                      onClick={() => handleItemClick(item)}
                      isSelected={selectedItemId === item.data.id}
                    />
                  );
                } else {
                  return (
                    <SubagentCard
                      key={item.data.id}
                      subagent={item.data}
                      onClick={() => handleItemClick(item)}
                      isSelected={selectedItemId === item.data.id}
                    />
                  );
                }
              })}
            </div>
          )
        ) : (
          // Skills view
          isLoading ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[2],
              }}
            >
              Loading skills...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                color: theme.colors.textSecondary,
                padding: '24px',
              }}
            >
              <FileCode size={48} color={theme.colors.border} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>
                  {searchQuery ? 'No skills match your search' : 'No skills found'}
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: theme.fontSizes[1] }}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Add SKILL.md files to your repository to get started'}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '16px',
                padding: '4px',
              }}
            >
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onClick={handleSkillClick}
                  isSelected={selectedItemId === skill.id}
                  filterContext={skillFilter}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Animation styles */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

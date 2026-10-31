import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { usePanelFocusListener } from '@principal-ade/panel-layouts';
import { AlertCircle, Search, X, RefreshCw, FileCode } from 'lucide-react';
import type {
  PanelComponentProps,
  AgentPanelActions,
  SkillsPanelContext,
} from './types';
import { useSkillsData, type Skill } from './skills/hooks/useSkillsData';
import { SkillCard } from './skills/components/SkillCard';

export interface GlobalSkillsPanelProps extends PanelComponentProps<AgentPanelActions, SkillsPanelContext> {
  /**
   * When true, shows the refresh button and enables refresh functionality.
   * The host must support handling 'skills:refresh' events.
   */
  supportsRefresh?: boolean;
}

/**
 * GlobalSkillsPanel - A panel for displaying ONLY global Agent Skills
 *
 * This panel shows:
 * - List/grid of global skills only (no project skills)
 * - Search functionality to filter skills
 * - Skill metadata (name, description, capabilities)
 * - Click to select and emit events for detail views
 *
 * Use this panel when you want to show only global skills without a project/global filter toggle.
 * This is ideal for views that are specifically about browsing and managing global skill installations.
 */
export const GlobalSkillsPanel: React.FC<GlobalSkillsPanelProps> = ({
  context,
  events,
  supportsRefresh = false,
}) => {
  const { theme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load skills data
  const { skills, isLoading, error, refreshSkills } = useSkillsData({ context });

  // Listen for panel focus events
  usePanelFocusListener('global-skills', events, () => panelRef.current?.focus());

  // Listen for skill installation/uninstallation events to refresh the list
  useEffect(() => {
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
  }, [events, refreshSkills]);

  // Filter skills to ONLY show global skills (no project filter toggle)
  const filteredSkills = useMemo(() => {
    // First, filter to only global skills
    let filtered = skills.filter((skill) => {
      // If skill has multiple installations, check if any are global
      if (skill.installedLocations && skill.installedLocations.length > 0) {
        return skill.installedLocations.some(
          (loc) => loc.source === 'global-universal' || loc.source === 'global-claude'
        );
      }
      // Otherwise check the primary source
      return skill.source === 'global-universal' || skill.source === 'global-claude';
    });

    // Then filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((skill) => {
        // Search in name
        if (skill.name.toLowerCase().includes(query)) return true;
        // Search in description
        if (skill.description?.toLowerCase().includes(query)) return true;
        // Search in capabilities
        if (skill.capabilities?.some((cap) => cap.toLowerCase().includes(query)))
          return true;
        // Search in path
        if (skill.path.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    return filtered;
  }, [skills, searchQuery]);

  const handleSkillClick = (skill: Skill) => {
    setSelectedSkillId(skill.id);
    // Emit skill:selected event for other panels
    if (events) {
      events.emit({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'skill:selected' as any,
        source: 'global-skills-panel',
        timestamp: Date.now(),
        payload: { skillId: skill.id, skill },
      });
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);

    // Emit refresh event so parent can handle filesystem rescans, etc.
    // The host will update the filetree, which will trigger automatic reload via useEffect
    if (events) {
      events.emit({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'skills:refresh' as any,
        source: 'global-skills-panel',
        timestamp: Date.now(),
        payload: {},
      });
    }

    // Show refresh animation for a brief period to provide visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

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
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              color: theme.colors.text,
            }}
          >
            <a
              href="https://agentskills.io/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'inherit',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Global Skills
            </a>
          </h2>

          {!isLoading && (
            <span
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                background: theme.colors.backgroundSecondary,
                padding: '4px 10px',
                borderRadius: theme.radii[1],
              }}
            >
              {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px', maxWidth: '400px' }}>
          {/* Search input */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              minWidth: '150px',
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
              placeholder="Search global skills..."
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

          {/* Refresh button - only show if host supports refresh */}
          {supportsRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              style={{
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[1],
                padding: '8px',
                cursor: isRefreshing || isLoading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              title="Refresh skills"
            >
              <RefreshCw
                size={16}
                color={theme.colors.textSecondary}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          )}
        </div>
      </div>

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
        {isLoading ? (
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
            Loading global skills...
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
                {searchQuery ? 'No global skills match your search' : 'No global skills found'}
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: theme.fontSizes[1] }}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'Install skills from repositories to see them here'}
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
                isSelected={selectedSkillId === skill.id}
                filterContext="global"
              />
            ))}
          </div>
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

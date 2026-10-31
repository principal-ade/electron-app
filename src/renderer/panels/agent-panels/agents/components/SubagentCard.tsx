import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot, Globe, Folder, Wrench, Zap } from 'lucide-react';
import type { Subagent } from '../hooks/useSubagentsData';

interface SubagentCardProps {
  subagent: Subagent;
  onClick: (subagent: Subagent) => void;
  isSelected: boolean;
}

/**
 * Helper function to get source badge info
 */
const getSourceBadge = (
  source: Subagent['source']
): { label: string; icon: React.ReactNode; color: string; bgColor: string } => {
  switch (source) {
    case 'project-claude':
      return {
        label: 'Project',
        icon: <Folder size={12} />,
        color: '#06b6d4',
        bgColor: '#06b6d420',
      };
    case 'global-claude':
      return {
        label: 'Global',
        icon: <Globe size={12} />,
        color: '#8b5cf6',
        bgColor: '#8b5cf620',
      };
  }
};

/**
 * Helper function to get model badge color
 */
const getModelColor = (model?: string): string => {
  switch (model) {
    case 'opus':
      return '#f59e0b';
    case 'sonnet':
      return '#10b981';
    case 'haiku':
      return '#3b82f6';
    case 'inherit':
      return '#6b7280';
    default:
      return '#10b981'; // default to sonnet color
  }
};

export const SubagentCard: React.FC<SubagentCardProps> = ({ subagent, onClick, isSelected }) => {
  const { theme } = useTheme();
  const sourceBadge = getSourceBadge(subagent.source);
  const modelColor = getModelColor(subagent.frontmatter.model);

  // Extract tool count
  const hasTools = subagent.frontmatter.tools;
  const toolsArray = hasTools ? hasTools.split(',').map(t => t.trim()) : null;

  return (
    <div
      onClick={() => onClick(subagent)}
      style={{
        padding: '16px',
        background: isSelected
          ? `${theme.colors.primary}10`
          : theme.colors.backgroundSecondary,
        border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
        borderRadius: theme.radii[2],
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.colors.textSecondary;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.colors.border;
        }
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Bot size={18} color={theme.colors.primary} />
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              color: theme.colors.text,
              fontWeight: 600,
            }}
          >
            {subagent.name}
          </h3>
        </div>

        {/* Source Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            fontSize: theme.fontSizes[0],
            color: sourceBadge.color,
            background: sourceBadge.bgColor,
            border: `1px solid ${sourceBadge.color}40`,
            borderRadius: theme.radii[1],
            flexShrink: 0,
          }}
        >
          {sourceBadge.icon}
          <span>{sourceBadge.label}</span>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {subagent.frontmatter.description}
      </div>

      {/* Path */}
      <div
        style={{
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
          wordBreak: 'break-all',
          opacity: 0.7,
        }}
      >
        {subagent.path}
      </div>

      {/* Metadata badges */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: '4px',
        }}
      >
        {/* Model badge */}
        {subagent.frontmatter.model && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: theme.fontSizes[0],
              padding: '3px 8px',
              background: `${modelColor}20`,
              border: `1px solid ${modelColor}40`,
              borderRadius: theme.radii[1],
              color: modelColor,
            }}
          >
            <Zap size={11} />
            <span>{subagent.frontmatter.model}</span>
          </div>
        )}

        {/* Tools badge */}
        {toolsArray && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: theme.fontSizes[0],
              padding: '3px 8px',
              background: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[1],
              color: theme.colors.textSecondary,
            }}
          >
            <Wrench size={11} />
            <span>{toolsArray.length} {toolsArray.length === 1 ? 'tool' : 'tools'}</span>
          </div>
        )}

        {/* Permission mode badge */}
        {subagent.frontmatter.permissionMode && subagent.frontmatter.permissionMode !== 'default' && (
          <div
            style={{
              fontSize: theme.fontSizes[0],
              padding: '3px 8px',
              background: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[1],
              color: theme.colors.textSecondary,
            }}
          >
            {subagent.frontmatter.permissionMode}
          </div>
        )}
      </div>
    </div>
  );
};

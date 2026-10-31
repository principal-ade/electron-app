import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileText, FolderTree, Folder } from 'lucide-react';
import type { Agent } from '../hooks/useAgentsData';

interface AgentCardProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
  isSelected: boolean;
}

/**
 * Helper function to get source badge info
 */
const getSourceBadge = (
  source: Agent['source']
): { label: string; icon: React.ReactNode; color: string; bgColor: string } => {
  switch (source) {
    case 'project-root':
      return {
        label: 'Root',
        icon: <FileText size={12} />,
        color: '#10b981',
        bgColor: '#10b98120',
      };
    case 'project-nested':
      return {
        label: 'Nested',
        icon: <FolderTree size={12} />,
        color: '#3b82f6',
        bgColor: '#3b82f620',
      };
    case 'global-universal':
      return {
        label: 'Global',
        icon: <Folder size={12} />,
        color: '#8b5cf6',
        bgColor: '#8b5cf620',
      };
  }
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, isSelected }) => {
  const { theme } = useTheme();
  const sourceBadge = getSourceBadge(agent.source);
  const [pathCopied, setPathCopied] = React.useState(false);

  // Extract a preview from content (first paragraph or section)
  const preview = agent.content.split('\n').find(line => line.trim() && !line.startsWith('#'))?.substring(0, 150) || 'No description available';

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering card onClick
    try {
      await navigator.clipboard.writeText(agent.path);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  return (
    <div
      onClick={() => onClick(agent)}
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
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            color: theme.colors.text,
            fontWeight: 600,
            flex: 1,
          }}
        >
          {agent.name}
        </h3>

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

      {/* Path - clickable to copy */}
      <div
        onClick={handleCopyPath}
        style={{
          fontSize: theme.fontSizes[0],
          color: pathCopied ? theme.colors.success : theme.colors.textMuted,
          fontFamily: theme.fonts.monospace,
          background: pathCopied ? `${theme.colors.success}15` : theme.colors.background,
          padding: '4px 8px',
          borderRadius: theme.radii[1],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: `1px solid ${pathCopied ? theme.colors.success : 'transparent'}`,
        }}
        title={pathCopied ? 'Copied!' : `Click to copy: ${agent.path}`}
        onMouseEnter={(e) => {
          if (!pathCopied) {
            e.currentTarget.style.background = theme.colors.backgroundTertiary || theme.colors.border;
          }
        }}
        onMouseLeave={(e) => {
          if (!pathCopied) {
            e.currentTarget.style.background = theme.colors.background;
          }
        }}
      >
        {pathCopied ? 'Copied!' : agent.path}
      </div>

      {/* Preview */}
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {preview}
      </div>

      {/* Sections Preview */}
      {agent.sections && Object.keys(agent.sections).length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '4px',
          }}
        >
          {Object.keys(agent.sections).map((section) => (
            <span
              key={section}
              style={{
                fontSize: theme.fontSizes[0],
                padding: '2px 8px',
                background: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[1],
                color: theme.colors.textSecondary,
                textTransform: 'capitalize',
              }}
            >
              {section}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

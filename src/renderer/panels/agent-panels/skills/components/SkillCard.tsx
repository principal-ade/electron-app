import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Code, BookOpen, Package, Globe, Folder, Github, AlertTriangle } from 'lucide-react';
import {
  useDraggable,
  DATA_TYPES,
  DRAG_ACTIONS,
} from '@principal-ade/panel-framework-core';
import type { Skill, SkillSource } from '../hooks/useSkillsData';

interface SkillCardProps {
  skill: Skill;
  onClick?: (skill: Skill) => void;
  isSelected?: boolean;
  /**
   * The current filter context ('project' or 'global')
   * Used to determine which path to copy when skill has multiple installations
   */
  filterContext?: 'project' | 'global';
  /**
   * Whether this skill is already installed globally
   * Used in browse mode to show installation status
   */
  isInstalled?: boolean;
}

/**
 * Helper to get source badge configuration
 */
const getSourceConfig = (source: SkillSource) => {
  switch (source) {
    case 'global-universal':
      return {
        label: 'Global',
        icon: Globe,
        color: '#7c3aed', // purple
        bgColor: '#7c3aed15',
        borderColor: '#7c3aed30',
      };
    case 'global-claude':
      return {
        label: 'Global Claude',
        icon: Globe,
        color: '#0891b2', // cyan
        bgColor: '#0891b215',
        borderColor: '#0891b230',
      };
    case 'project-universal':
      return {
        label: 'Project',
        icon: Folder,
        color: '#16a34a', // green
        bgColor: '#16a34a15',
        borderColor: '#16a34a30',
      };
    case 'project-claude':
      return {
        label: 'Project Claude',
        icon: Folder,
        color: '#0284c7', // blue
        bgColor: '#0284c715',
        borderColor: '#0284c730',
      };
    case 'project-other':
      return {
        label: 'Project',
        icon: Folder,
        color: '#64748b', // slate
        bgColor: '#64748b15',
        borderColor: '#64748b30',
      };
  }
};

/**
 * Helper to abbreviate source name for compact display
 */
const abbreviateSourceName = (source: SkillSource): string => {
  switch (source) {
    case 'project-universal':
      return 'Project';
    case 'global-universal':
      return 'Global';
    case 'project-claude':
      return 'Project (Claude)';
    case 'global-claude':
      return 'Global (Claude)';
    case 'project-other':
      return 'Project';
  }
};

/**
 * SkillCard - Displays a single skill with its metadata
 */
export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  onClick,
  isSelected = false,
  filterContext,
  isInstalled = false,
}) => {
  const { theme } = useTheme();
  const sourceConfig = getSourceConfig(skill.source);
  const [pathCopied, setPathCopied] = React.useState(false);

  // Draggable hook for drag-and-drop support
  const { isDragging, ...dragProps } = useDraggable({
    dataType: DATA_TYPES.FILE_PATH,
    primaryData: skill.path,  // Use skill path
    metadata: {
      name: skill.name,
      description: skill.description,
      source: skill.source,
    },
    suggestedActions: [DRAG_ACTIONS.INSERT_PATH, DRAG_ACTIONS.OPEN],
    sourcePanel: 'skills-panel',
    dragPreview: skill.name,
  });

  // Determine which path to copy based on filter context and installed locations
  const getPathToCopy = (): string => {
    // If no filter context or no multiple installations, use default path
    if (!filterContext || !skill.installedLocations || skill.installedLocations.length <= 1) {
      return skill.path;
    }

    // Find the installation matching the filter context
    if (filterContext === 'project') {
      const projectInstallation = skill.installedLocations.find(
        (loc) =>
          loc.source === 'project-universal' ||
          loc.source === 'project-claude' ||
          loc.source === 'project-other'
      );
      return projectInstallation?.path || skill.path;
    } else if (filterContext === 'global') {
      const globalInstallation = skill.installedLocations.find(
        (loc) => loc.source === 'global-universal' || loc.source === 'global-claude'
      );
      return globalInstallation?.path || skill.path;
    }

    return skill.path;
  };

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering card onClick
    try {
      const pathToCopy = getPathToCopy();
      await navigator.clipboard.writeText(pathToCopy);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  return (
    <div
      onClick={() => onClick?.(skill)}
      {...dragProps}
      style={{
        padding: '16px',
        background: isSelected ? `${theme.colors.primary}10` : theme.colors.surface,
        border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
        borderRadius: theme.radii[2],
        cursor: isDragging ? 'grabbing' : (onClick ? 'pointer' : 'default'),
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...(isSelected && {
          boxShadow: `0 0 0 1px ${theme.colors.primary}`,
        }),
      }}
      onMouseEnter={(e) => {
        if (onClick && !isSelected) {
          e.currentTarget.style.borderColor = theme.colors.primary + '80';
          e.currentTarget.style.background = theme.colors.backgroundSecondary;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick && !isSelected) {
          e.currentTarget.style.borderColor = theme.colors.border;
          e.currentTarget.style.background = theme.colors.surface;
        }
      }}
    >
      {/* Header with name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textTransform: 'capitalize',
            }}
          >
            {skill.name}
          </h3>
          {/* Source badge - only show when no filter context (Browse mode, etc.) */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            {!filterContext && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: theme.radii[1],
                  backgroundColor: sourceConfig.bgColor,
                  border: `1px solid ${sourceConfig.borderColor}`,
                  fontSize: theme.fontSizes[0],
                  color: sourceConfig.color,
                  fontWeight: 500,
                  width: 'fit-content',
                }}
                title={`Source: ${skill.source}`}
              >
                <sourceConfig.icon size={10} />
                <span>{sourceConfig.label}</span>
              </div>
            )}

            {/* Installed badge - show when skill is already installed globally */}
            {isInstalled && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: theme.radii[1],
                  backgroundColor: '#16a34a15', // green
                  border: `1px solid #16a34a30`,
                  fontSize: theme.fontSizes[0],
                  color: '#16a34a',
                  fontWeight: 500,
                  width: 'fit-content',
                }}
                title="This skill is already installed globally"
              >
                <Package size={10} />
                <span>Installed</span>
              </div>
            )}

            {/* GitHub source badge (if installed from GitHub) */}
            {skill.metadata?.owner && skill.metadata?.repo && (
              <a
                href={skill.metadata.installedFrom || `https://github.com/${skill.metadata.owner}/${skill.metadata.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} // Prevent card click when clicking link
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: theme.radii[1],
                  backgroundColor: `${theme.colors.textSecondary}15`,
                  border: `1px solid ${theme.colors.textSecondary}30`,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  fontWeight: 500,
                  fontFamily: theme.fonts.monospace,
                  width: 'fit-content',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={`Click to open: ${skill.metadata.installedFrom || `https://github.com/${skill.metadata.owner}/${skill.metadata.repo}`}\nInstalled: ${skill.metadata.installedAt ? new Date(skill.metadata.installedAt).toLocaleString() : 'Unknown'}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.textSecondary}25`;
                  e.currentTarget.style.borderColor = `${theme.colors.textSecondary}50`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.textSecondary}15`;
                  e.currentTarget.style.borderColor = `${theme.colors.textSecondary}30`;
                }}
              >
                <Github size={10} />
                <span>From {skill.metadata.owner}/{skill.metadata.repo}</span>
              </a>
            )}

            {/* Frontmatter validation badge */}
            {!skill.frontmatterValidation.isValid && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: theme.radii[1],
                  backgroundColor: '#f59e0b15', // warning amber
                  border: '1px solid #f59e0b30',
                  fontSize: theme.fontSizes[0],
                  color: '#f59e0b',
                  fontWeight: 500,
                  width: 'fit-content',
                }}
                title={skill.frontmatterValidation.errorMessage || 'Invalid frontmatter'}
              >
                <AlertTriangle size={10} />
                <span>
                  {skill.frontmatterValidation.hasStructure
                    ? skill.frontmatterValidation.missingFields.length > 0
                      ? `Missing: ${skill.frontmatterValidation.missingFields.join(', ')}`
                      : 'Invalid Frontmatter'
                    : 'No Frontmatter'}
                </span>
              </div>
            )}

            {/* Also installed in badge (multiple locations) */}
            {skill.installedLocations && skill.installedLocations.length > 1 && (() => {
              // Get locations based on filter context
              // If viewing 'project', show 'global' locations and vice versa
              let otherLocations: typeof skill.installedLocations = [];

              if (filterContext === 'project') {
                // Show global installations
                otherLocations = skill.installedLocations.filter(
                  loc => loc.source === 'global-universal' || loc.source === 'global-claude'
                );
              } else if (filterContext === 'global') {
                // Show project installations
                otherLocations = skill.installedLocations.filter(
                  loc => loc.source === 'project-universal' ||
                         loc.source === 'project-claude' ||
                         loc.source === 'project-other'
                );
              } else {
                // No filter context - show all other locations (not the primary)
                otherLocations = skill.installedLocations.filter(loc => loc.path !== skill.path);
              }

              if (otherLocations.length === 0) return null;

              const locationNames = otherLocations.map(loc => abbreviateSourceName(loc.source));
              const uniqueLocations = Array.from(new Set(locationNames));
              const locationText = uniqueLocations.join(', ');

              return (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: theme.radii[1],
                    backgroundColor: `${theme.colors.accent}15`,
                    border: `1px solid ${theme.colors.accent}30`,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.accent,
                    fontWeight: 500,
                    width: 'fit-content',
                  }}
                  title={`Also installed in:\n${otherLocations
                    .map(loc => `${abbreviateSourceName(loc.source)}: ${loc.path}`)
                    .join('\n')}`}
                >
                  <Package size={10} />
                  <span>Also in: {locationText}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Structure indicators */}
        {(skill.hasScripts || skill.hasReferences || skill.hasAssets) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
            {skill.hasScripts && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: theme.radii[1],
                  backgroundColor: `${theme.colors.primary}15`,
                  border: `1px solid ${theme.colors.primary}30`,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.primary,
                  fontWeight: 500,
                }}
                title={`Scripts: ${skill.scriptFiles?.join(', ')}`}
              >
                <Code size={12} />
                <span>{skill.scriptFiles?.length || 0}</span>
              </div>
            )}
            {skill.hasReferences && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: theme.radii[1],
                  backgroundColor: `${theme.colors.secondary}15`,
                  border: `1px solid ${theme.colors.secondary}30`,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.secondary,
                  fontWeight: 500,
                }}
                title={`References: ${skill.referenceFiles?.join(', ')}`}
              >
                <BookOpen size={12} />
                <span>{skill.referenceFiles?.length || 0}</span>
              </div>
            )}
            {skill.hasAssets && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: theme.radii[1],
                  backgroundColor: `${theme.colors.accent}15`,
                  border: `1px solid ${theme.colors.accent}30`,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.accent,
                  fontWeight: 500,
                }}
                title={`Assets: ${skill.assetFiles?.join(', ')}`}
              >
                <Package size={12} />
                <span>{skill.assetFiles?.length || 0}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {skill.description && (
        <p
          style={{
            margin: 0,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {skill.description}
        </p>
      )}

      {/* Capabilities */}
      {skill.capabilities && skill.capabilities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {skill.capabilities.map((capability, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: theme.colors.primary,
                  marginTop: '7px',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {capability}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Path badge */}
      <div
        onClick={handleCopyPath}
        style={{
          fontSize: theme.fontSizes[0],
          color: pathCopied ? theme.colors.success : theme.colors.textMuted,
          fontFamily: theme.fonts.monospace,
          background: pathCopied ? `${theme.colors.success}15` : theme.colors.backgroundSecondary,
          padding: '4px 8px',
          borderRadius: theme.radii[1],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: `1px solid ${pathCopied ? theme.colors.success : 'transparent'}`,
        }}
        title={pathCopied ? 'Copied!' : `Click to copy: ${getPathToCopy()}`}
        onMouseEnter={(e) => {
          if (!pathCopied) {
            e.currentTarget.style.background = theme.colors.backgroundTertiary || theme.colors.border;
          }
        }}
        onMouseLeave={(e) => {
          if (!pathCopied) {
            e.currentTarget.style.background = theme.colors.backgroundSecondary;
          }
        }}
      >
        {pathCopied ? 'Copied!' : getPathToCopy()}
      </div>
    </div>
  );
};

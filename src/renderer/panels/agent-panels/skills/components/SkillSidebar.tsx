/**
 * SkillSidebar component with tabbed interface for TOC and Metadata
 */
import { Theme } from '@principal-ade/industry-theme';
import { type PartialSkillMetadata } from '@principal-ade/markdown-utils';
import { Globe, Folder, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import type { MarkdownHeader } from '../utils/extractHeaders';
import type { Skill, SkillSource } from '../hooks/useSkillsData';
import { TableOfContents } from './TableOfContents';

type SidebarTab = 'toc' | 'metadata';

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
 * Convert date string to relative time (e.g., "2 days ago", "3 months ago")
 */
const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  } catch {
    return dateString; // Return original string if parsing fails
  }
};

export interface SkillSidebarProps {
  /** Array of headers for table of contents */
  headers: MarkdownHeader[];
  /** Skill metadata */
  metadata: PartialSkillMetadata;
  /** Theme object for styling */
  theme: Theme;
  /** Optional class name for styling */
  className?: string;
  /** Optional callback when a header is clicked */
  onHeaderClick?: (header: MarkdownHeader) => void;
  /** Optional full skill object for displaying installation locations */
  skill?: Skill;
}

/**
 * SkillSidebar component
 *
 * Renders a tabbed sidebar with Table of Contents and Metadata views
 */
export const SkillSidebar: React.FC<SkillSidebarProps> = ({
  headers,
  metadata,
  theme,
  className = '',
  onHeaderClick,
  skill,
}) => {
  const [activeTab, setActiveTab] = React.useState<SidebarTab>('toc');
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  const hasMetadata =
    metadata.compatibility ||
    (metadata['allowed-tools'] && metadata['allowed-tools'].length > 0) ||
    (metadata.metadata && Object.keys(metadata.metadata).length > 0) ||
    (skill?.installedLocations && skill.installedLocations.length > 1);

  // If no headers, default to metadata tab
  React.useEffect(() => {
    if (headers.length === 0 && hasMetadata) {
      setActiveTab('metadata');
    }
  }, [headers.length, hasMetadata]);

  // Don't render if we have neither headers nor metadata
  if (headers.length === 0 && !hasMetadata) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        width: isCollapsed ? '0px' : '250px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: isCollapsed ? 'none' : `1px solid ${theme.colors.border}`,
        position: 'relative',
        transition: 'width 0.3s ease',
        overflow: 'visible',
      }}
    >
      {/* Collapse/Expand Handle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: 'absolute',
          right: '-20px',
          top: '16px',
          width: '20px',
          height: '60px',
          padding: 0,
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderLeft: 'none',
          borderTopRightRadius: '8px',
          borderBottomRightRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.primary;
          e.currentTarget.style.color = theme.colors.background;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          e.currentTarget.style.color = theme.colors.textSecondary;
        }}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Tab Headers */}
      {!isCollapsed && (
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
          }}
        >
        {headers.length > 0 && (
          <button
            onClick={() => setActiveTab('toc')}
            style={{
              flex: 1,
              padding: theme.space[2],
              background: activeTab === 'toc' ? theme.colors.background : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'toc'
                ? `2px solid ${theme.colors.primary}`
                : '2px solid transparent',
              color: activeTab === 'toc' ? theme.colors.primary : theme.colors.textSecondary,
              fontFamily: theme.fonts.heading,
              fontSize: theme.fontSizes[1],
              fontWeight: activeTab === 'toc' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'toc') {
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'toc') {
                e.currentTarget.style.color = theme.colors.textSecondary;
              }
            }}
          >
            Contents
          </button>
        )}
        {hasMetadata && (
          <button
            onClick={() => setActiveTab('metadata')}
            style={{
              flex: 1,
              padding: theme.space[2],
              background: activeTab === 'metadata' ? theme.colors.background : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'metadata'
                ? `2px solid ${theme.colors.primary}`
                : '2px solid transparent',
              color: activeTab === 'metadata' ? theme.colors.primary : theme.colors.textSecondary,
              fontFamily: theme.fonts.heading,
              fontSize: theme.fontSizes[1],
              fontWeight: activeTab === 'metadata' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'metadata') {
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'metadata') {
                e.currentTarget.style.color = theme.colors.textSecondary;
              }
            }}
          >
            Metadata
          </button>
        )}
        </div>
      )}

      {/* Tab Content */}
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'toc' && headers.length > 0 && (
          <TableOfContents
            headers={headers}
            theme={theme}
            onHeaderClick={onHeaderClick}
          />
        )}

        {activeTab === 'metadata' && hasMetadata && (
          <div style={{ padding: theme.space[3] }}>
            {metadata.compatibility && (
              <div style={{ marginBottom: theme.space[3] }}>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontWeight: 600,
                    fontSize: theme.fontSizes[0],
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: theme.colors.textSecondary,
                    marginBottom: theme.space[1],
                  }}
                >
                  Compatibility
                </div>
                <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.text, fontFamily: theme.fonts.body }}>
                  {metadata.compatibility}
                </div>
              </div>
            )}

            {metadata['allowed-tools'] && metadata['allowed-tools'].length > 0 && (
              <div style={{ marginBottom: theme.space[3] }}>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontWeight: 600,
                    fontSize: theme.fontSizes[0],
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: theme.colors.textSecondary,
                    marginBottom: theme.space[1],
                  }}
                >
                  Allowed Tools
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space[1] }}>
                  {metadata['allowed-tools'].map((tool, index) => (
                    <span
                      key={index}
                      style={{
                        display: 'inline-block',
                        paddingTop: theme.space[2],
                        paddingBottom: theme.space[2],
                        paddingLeft: theme.space[3],
                        paddingRight: theme.space[3],
                        background: theme.colors.primary,
                        color: theme.colors.background,
                        borderRadius: '4px',
                        fontSize: theme.fontSizes[0],
                        fontWeight: 500,
                        fontFamily: theme.fonts.monospace,
                      }}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {metadata.metadata && Object.keys(metadata.metadata).length > 0 && (
              <div style={{ marginBottom: theme.space[3] }}>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontWeight: 600,
                    fontSize: theme.fontSizes[0],
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: theme.colors.textSecondary,
                    marginBottom: theme.space[1],
                  }}
                >
                  Metadata
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space[1] }}>
                  {Object.entries(metadata.metadata)
                    .filter(([key]) => key !== 'last-updated')
                    .map(([key, value]) => (
                      <div key={key}>
                        <div
                          style={{
                            fontSize: theme.fontSizes[0],
                            fontWeight: 600,
                            color: theme.colors.textSecondary,
                            fontFamily: theme.fonts.body,
                          }}
                        >
                          {key}:
                        </div>
                        <div
                          style={{
                            fontSize: theme.fontSizes[1],
                            color: theme.colors.text,
                            fontFamily: theme.fonts.monospace,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Installed Locations section */}
            {skill?.installedLocations && skill.installedLocations.length > 1 && (
              <div>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontWeight: 600,
                    fontSize: theme.fontSizes[0],
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: theme.colors.textSecondary,
                    marginBottom: theme.space[2],
                  }}
                >
                  Installed Locations ({skill.installedLocations.length})
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.space[2],
                }}>
                  {skill.installedLocations.map((location, idx) => {
                    const isPrimary = location.path === skill.path;
                    const sourceConfig = getSourceConfig(location.source);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: theme.space[2],
                          backgroundColor: isPrimary
                            ? `${theme.colors.primary}08`
                            : theme.colors.backgroundSecondary,
                          borderRadius: '6px',
                          border: `1px solid ${isPrimary
                            ? theme.colors.primary + '40'
                            : theme.colors.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: theme.space[1],
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space[2], flexWrap: 'wrap' }}>
                          {/* Source badge */}
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
                            }}
                          >
                            <sourceConfig.icon size={10} />
                            <span>{sourceConfig.label}</span>
                          </div>

                          {/* Primary indicator */}
                          {isPrimary && (
                            <span style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.primary,
                              fontWeight: 600,
                              fontFamily: theme.fonts.body,
                            }}>
                              (Active)
                            </span>
                          )}
                        </div>

                        {/* Path */}
                        <div style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.monospace,
                          wordBreak: 'break-all',
                        }}>
                          {location.path}
                        </div>

                        {/* Metadata info if available */}
                        {location.metadata?.installedAt && (
                          <div style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textMuted,
                            fontFamily: theme.fonts.body,
                          }}>
                            Installed: {formatRelativeTime(location.metadata.installedAt)}
                          </div>
                        )}

                        {/* SHA if different from primary */}
                        {location.metadata?.sha && skill.metadata?.sha &&
                         location.metadata.sha !== skill.metadata.sha && (
                          <div style={{
                            fontSize: theme.fontSizes[0],
                            color: '#f59e0b', // warning color
                            fontFamily: theme.fonts.monospace,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            <AlertTriangle size={10} />
                            <span>Different version (SHA: {location.metadata.sha.substring(0, 7)})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default SkillSidebar;

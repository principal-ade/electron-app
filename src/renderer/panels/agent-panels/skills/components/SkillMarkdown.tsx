/**
 * SkillMarkdown component for rendering Agent Skills (SKILL.md files)
 * Parses frontmatter and renders skill metadata with markdown body
 */

import { Theme } from '@principal-ade/industry-theme';
import {
  parseSkillMarkdownGraceful,
  type PartialParsedSkill,
  type PartialSkillMetadata,
  type ValidationWarning,
} from '@principal-ade/markdown-utils';
import { Code, BookOpen, Package, Globe, Search, X, ChevronUp, ChevronDown, FileEdit, Download, Check } from 'lucide-react';
import React from 'react';

import { IndustryMarkdownSlide } from 'themed-markdown';

import type { Skill } from '../hooks/useSkillsData';
import { extractHeaders, type MarkdownHeader } from '../utils/extractHeaders';
import { SkillSidebar } from './SkillSidebar';
import type { PanelActions, PanelEventEmitter } from '../../types';

export interface SkillStructure {
  hasScripts?: boolean;
  hasReferences?: boolean;
  hasAssets?: boolean;
  scriptFiles?: string[];
  referenceFiles?: string[];
  assetFiles?: string[];
}

export interface SkillMarkdownProps {
  /** Raw SKILL.md content with frontmatter */
  content: string;
  /** Theme object for styling */
  theme: Theme;
  /** Optional class name for styling */
  className?: string;
  /** Optional callback when skill is parsed */
  onParsed?: (skill: PartialParsedSkill) => void;
  /** Optional callback when parsing has warnings */
  onWarnings?: (warnings: ValidationWarning[]) => void;
  /** Show raw content on parse error instead of error message */
  showRawOnError?: boolean;
  /** Container width to pass to IndustryMarkdownSlide (skips ResizeObserver if provided) */
  containerWidth?: number;
  /** Optional skill structure information (scripts, references, assets) */
  structure?: SkillStructure;
  /** Optional full skill object for displaying installation locations */
  skill?: Skill;
  /** Optional panel actions for file operations */
  actions?: PanelActions;
  /** Optional event emitter for panel communication */
  events?: PanelEventEmitter;
  /** Install button configuration */
  installConfig?: {
    /** Whether the skill is currently installed */
    isInstalled: boolean;
    /** Whether an update is available (installed SHA differs from current SHA) */
    hasUpdate?: boolean;
    /** Directory IDs where the skill is installed */
    installedDirectoryIds?: string[];
    /** GitHub source information for the skill */
    githubSource?: {
      owner: string;
      repo: string;
      branch: string;
      skillPath: string;
      currentSha?: string;
    };
    /** Callback when install button is clicked */
    onInstall: () => void;
    /** Optional callback when uninstall is requested */
    onUninstall?: () => void;
  };
  /** Hide the Edit and MDX Editor buttons (default: false) */
  hideEditButtons?: boolean;
}

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

/**
 * Search bar component for finding text in markdown
 */
const SearchBar: React.FC<{
  theme: Theme;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentMatch: number;
  totalMatches: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}> = ({ theme, searchQuery, onSearchChange, currentMatch, totalMatches, onPrevious, onNext, onClose }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus();
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.space[2],
      padding: theme.space[2],
      backgroundColor: theme.colors.backgroundSecondary,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <Search size={16} color={theme.colors.textSecondary} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in skill..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          flex: 1,
          padding: '0.375rem 0.75rem',
          fontSize: theme.fontSizes[2],
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          outline: 'none',
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = theme.colors.primary}
        onBlur={(e) => e.currentTarget.style.borderColor = theme.colors.border}
      />
      {totalMatches > 0 && (
        <span style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
          whiteSpace: 'nowrap',
        }}>
          {currentMatch + 1} / {totalMatches}
        </span>
      )}
      <button
        onClick={onPrevious}
        disabled={totalMatches === 0}
        style={{
          padding: '0.375rem',
          backgroundColor: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '4px',
          cursor: totalMatches === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          opacity: totalMatches === 0 ? 0.5 : 1,
        }}
        title="Previous match"
      >
        <ChevronUp size={16} color={theme.colors.text} />
      </button>
      <button
        onClick={onNext}
        disabled={totalMatches === 0}
        style={{
          padding: '0.375rem',
          backgroundColor: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '4px',
          cursor: totalMatches === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          opacity: totalMatches === 0 ? 0.5 : 1,
        }}
        title="Next match"
      >
        <ChevronDown size={16} color={theme.colors.text} />
      </button>
      <button
        onClick={onClose}
        style={{
          padding: '0.375rem',
          backgroundColor: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Close search"
      >
        <X size={16} color={theme.colors.text} />
      </button>
    </div>
  );
};

/**
 * Render skill metadata section with support for partial metadata
 */
const SkillMetadataSection: React.FC<{
  metadata: PartialSkillMetadata;
  theme: Theme;
  structure?: SkillStructure;
  skill?: Skill;
  actions?: PanelActions;
  events?: PanelEventEmitter;
  hideEditButtons?: boolean;
}> = ({
  metadata,
  theme,
  structure,
  skill,
  actions,
  events,
  hideEditButtons,
}) => {
  const [expandedSections, setExpandedSections] = React.useState<{
    scripts: boolean;
    references: boolean;
    assets: boolean;
  }>({
    scripts: false,
    references: false,
    assets: false,
  });

  const toggleSection = (section: 'scripts' | 'references' | 'assets') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div style={{
      borderBottom: `2px solid ${theme.colors.border}`,
      paddingBottom: theme.space[3],
      marginBottom: theme.space[2],
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.space[2] }}>
          <h1
            style={{
              fontSize: theme.fontSizes[6],
              fontWeight: 700,
              margin: 0,
              color: metadata.name ? theme.colors.text : theme.colors.textSecondary,
              fontFamily: theme.fonts.heading,
            }}
          >
            {metadata.name || '(Unnamed Skill)'}
          </h1>
          {(metadata.metadata?.['last-updated'] || metadata.license) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.space[1], marginLeft: theme.space[3], marginTop: theme.space[1] }}>
              {metadata.metadata?.['last-updated'] && (
                <span
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.monospace,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatRelativeTime(metadata.metadata['last-updated'])}
                </span>
              )}
              {metadata.license && (
                <span
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.monospace,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {metadata.license}
                </span>
              )}
            </div>
          )}
        </div>
        {metadata.description ? (
          <p
            style={{
              fontSize: theme.fontSizes[3],
              color: theme.colors.textSecondary,
              margin: 0,
              lineHeight: 1.5,
              fontFamily: theme.fonts.body,
            }}
          >
            {metadata.description}
          </p>
        ) : (
          <p
            style={{
              fontSize: theme.fontSizes[3],
              color: theme.colors.textSecondary,
              margin: 0,
              lineHeight: 1.5,
              fontFamily: theme.fonts.body,
              fontStyle: 'italic',
            }}
          >
            (No description provided)
          </p>
        )}
        {(structure && (structure.hasScripts || structure.hasReferences || structure.hasAssets)) || (actions && skill?.path) ? (
          <div style={{
            marginTop: theme.space[3],
          }}>
            <div style={{
              display: 'flex',
              gap: theme.space[2],
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{
                display: 'flex',
                gap: theme.space[2],
                flexWrap: 'wrap',
              }}>
                {structure?.hasScripts && (
                  <button
                    onClick={() => toggleSection('scripts')}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <Code size={14} />
                    <span>Scripts ({structure.scriptFiles?.length || 0})</span>
                    <span style={{ fontSize: '10px' }}>{expandedSections.scripts ? '▼' : '▶'}</span>
                  </button>
                )}
                {structure?.hasReferences && (
                  <button
                    onClick={() => toggleSection('references')}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      backgroundColor: theme.colors.secondary,
                      color: theme.colors.background,
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <BookOpen size={14} />
                    <span>References ({structure.referenceFiles?.length || 0})</span>
                    <span style={{ fontSize: '10px' }}>{expandedSections.references ? '▼' : '▶'}</span>
                  </button>
                )}
                {structure?.hasAssets && (
                  <button
                    onClick={() => toggleSection('assets')}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      backgroundColor: theme.colors.accent,
                      color: theme.colors.background,
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <Package size={14} />
                    <span>Assets ({structure.assetFiles?.length || 0})</span>
                    <span style={{ fontSize: '10px' }}>{expandedSections.assets ? '▼' : '▶'}</span>
                  </button>
                )}
              </div>

              {/* Edit Button */}
              {!hideEditButtons && events && skill?.path && (
                <button
                  onClick={() => {
                    if (skill) {
                      events.emit({
                        type: 'skill:edit',
                        source: 'skill-detail',
                        timestamp: Date.now(),
                        payload: {
                          skill: skill,
                        },
                      });
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.space[1],
                    padding: `${theme.space[1]} ${theme.space[2]}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts.body,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.background;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.color = theme.colors.text;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                  title="Edit skill"
                >
                  <FileEdit size={14} />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {/* Expanded file lists */}
            {expandedSections.scripts && structure?.scriptFiles && structure.scriptFiles.length > 0 && (
              <div style={{
                marginTop: theme.space[2],
                padding: theme.space[2],
                backgroundColor: `${theme.colors.primary}15`,
                borderRadius: '8px',
                borderLeft: `3px solid ${theme.colors.primary}`,
              }}>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: theme.space[1],
                  fontFamily: theme.fonts.heading,
                }}>
                  Script Files
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: theme.space[3],
                  listStyle: 'none',
                }}>
                  {structure?.scriptFiles.map((file, idx) => (
                    <li key={idx} style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.text,
                      fontFamily: theme.fonts.monospace,
                      padding: '2px 0',
                    }}>
                      • {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {expandedSections.references && structure?.referenceFiles && structure.referenceFiles.length > 0 && (
              <div style={{
                marginTop: theme.space[2],
                padding: theme.space[2],
                backgroundColor: `${theme.colors.secondary}15`,
                borderRadius: '8px',
                borderLeft: `3px solid ${theme.colors.secondary}`,
              }}>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: theme.space[1],
                  fontFamily: theme.fonts.heading,
                }}>
                  Reference Files
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: theme.space[3],
                  listStyle: 'none',
                }}>
                  {structure?.referenceFiles.map((file, idx) => (
                    <li key={idx} style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.text,
                      fontFamily: theme.fonts.monospace,
                      padding: '2px 0',
                    }}>
                      • {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {expandedSections.assets && structure?.assetFiles && structure.assetFiles.length > 0 && (
              <div style={{
                marginTop: theme.space[2],
                padding: theme.space[2],
                backgroundColor: `${theme.colors.accent}15`,
                borderRadius: '8px',
                borderLeft: `3px solid ${theme.colors.accent}`,
              }}>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: theme.space[1],
                  fontFamily: theme.fonts.heading,
                }}>
                  Asset Files
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: theme.space[3],
                  listStyle: 'none',
                }}>
                  {structure?.assetFiles.map((file, idx) => (
                    <li key={idx} style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.text,
                      fontFamily: theme.fonts.monospace,
                      padding: '2px 0',
                    }}>
                      • {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

    </div>
  );
};

/**
 * SkillMarkdown component
 *
 * Renders Agent Skills markdown with frontmatter parsing
 *
 * @example
 * ```tsx
 * <SkillMarkdown
 *   content={skillContent}
 *   onParsed={(skill) => console.log('Parsed:', skill.metadata.name)}
 * />
 * ```
 */
export const SkillMarkdown: React.FC<SkillMarkdownProps> = ({
  content,
  theme,
  className = '',
  onParsed,
  onWarnings,
  containerWidth,
  structure,
  skill,
  actions,
  events,
  installConfig,
  hideEditButtons = false,
}) => {
  const [parsed, setParsed] = React.useState<PartialParsedSkill | null>(null);
  const [headers, setHeaders] = React.useState<MarkdownHeader[]>([]);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentMatch, setCurrentMatch] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const skill = parseSkillMarkdownGraceful(content);
    setParsed(skill);
    onParsed?.(skill);
    if (skill.warnings.length > 0) {
      onWarnings?.(skill.warnings);
    }

    // Extract headers for table of contents
    const extractedHeaders = extractHeaders(skill.body);
    setHeaders(extractedHeaders);
  }, [content, onParsed, onWarnings]);

  const scrollToMatch = React.useCallback((matches: HTMLElement[], index: number, theme: Theme) => {
    // Remove active class from all matches
    matches.forEach(m => {
      m.style.backgroundColor = '#ffeb3b'; // Bright yellow
      m.style.outline = 'none';
      m.style.boxShadow = 'none';
    });

    // Highlight current match with orange
    if (matches[index]) {
      matches[index].style.backgroundColor = '#ff9800'; // Bright orange
      matches[index].style.outline = `2px solid ${theme.colors.primary}`; // Blue outline for extra visibility
      matches[index].style.boxShadow = '0 0 8px rgba(255, 152, 0, 0.6)'; // Orange glow
      matches[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleNext = React.useCallback(() => {
    if (totalMatches === 0) return;
    const newIndex = (currentMatch + 1) % totalMatches;
    setCurrentMatch(newIndex);

    const matches = contentRef.current?.querySelectorAll('.search-highlight');
    if (matches) {
      scrollToMatch(Array.from(matches) as HTMLElement[], newIndex, theme);
    }
  }, [totalMatches, currentMatch, theme, scrollToMatch]);

  const handlePrevious = React.useCallback(() => {
    if (totalMatches === 0) return;
    const newIndex = currentMatch === 0 ? totalMatches - 1 : currentMatch - 1;
    setCurrentMatch(newIndex);

    const matches = contentRef.current?.querySelectorAll('.search-highlight');
    if (matches) {
      scrollToMatch(Array.from(matches) as HTMLElement[], newIndex, theme);
    }
  }, [totalMatches, currentMatch, theme, scrollToMatch]);

  // Handle Cmd+F / Ctrl+F keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // ESC to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
      // Enter to go to next match when search is open
      if (e.key === 'Enter' && showSearch && totalMatches > 0) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, totalMatches, handleNext]);

  // Search and highlight logic
  React.useEffect(() => {
    if (!searchQuery || !contentRef.current) {
      // Remove all highlights
      const highlights = contentRef.current?.querySelectorAll('.search-highlight');
      highlights?.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          parent.normalize();
        }
      });
      setTotalMatches(0);
      setCurrentMatch(0);
      return;
    }

    const container = contentRef.current;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // Remove previous highlights
    const oldHighlights = container.querySelectorAll('.search-highlight');
    oldHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });

    // Find and highlight matches
    const matches: HTMLElement[] = [];
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    textNodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const matches_in_text = [...text.matchAll(regex)];

      if (matches_in_text.length > 0) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        matches_in_text.forEach(match => {
          const matchIndex = match.index!;

          // Add text before match
          if (matchIndex > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
          }

          // Add highlighted match
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          mark.style.backgroundColor = '#ffeb3b'; // Bright yellow
          mark.style.color = '#000000'; // Black text for contrast
          mark.style.fontWeight = '500';
          mark.textContent = match[0];
          fragment.appendChild(mark);
          matches.push(mark);

          lastIndex = matchIndex + match[0].length;
        });

        // Add remaining text
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });

    setTotalMatches(matches.length);
    if (matches.length > 0) {
      setCurrentMatch(0);
      scrollToMatch(matches, 0, theme);
    }
  }, [searchQuery, parsed, theme, scrollToMatch]);

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setCurrentMatch(0);
    setTotalMatches(0);
  };

  // Safety check for theme
  if (!theme || !theme.space) {
    return (
      <div className={className} style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#856404' }}>
          Error: Theme not available. Wrap component in ThemeProvider.
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: theme.space[4],
          color: theme.colors.textSecondary,
          fontStyle: 'italic',
          background: theme.colors.background,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
      }}
    >
      {showSearch && (
        <SearchBar
          theme={theme}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentMatch={currentMatch}
          totalMatches={totalMatches}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onClose={handleCloseSearch}
        />
      )}

      {/* Install Toolbar */}
      {installConfig && (
        <div
          style={{
            padding: '12px 16px',
            background: theme.colors.backgroundSecondary,
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            {installConfig.githubSource && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
                <Globe size={14} />
                <span style={{ fontFamily: theme.fonts.monospace }}>
                  {installConfig.githubSource.owner}/{installConfig.githubSource.repo}
                </span>
                <span style={{ color: theme.colors.border }}>•</span>
                <span>{installConfig.githubSource.branch}</span>
                {installConfig.githubSource.currentSha && (
                  <>
                    <span style={{ color: theme.colors.border }}>•</span>
                    <span
                      style={{
                        fontFamily: theme.fonts.monospace,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                      }}
                      title={installConfig.githubSource.currentSha}
                    >
                      {installConfig.githubSource.currentSha.substring(0, 7)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {installConfig.isInstalled ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {installConfig.hasUpdate ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: theme.radii[1],
                      background: '#f59e0b15',
                      border: '1px solid #f59e0b30',
                      color: '#f59e0b',
                      fontSize: theme.fontSizes[1],
                      fontWeight: 500,
                    }}
                  >
                    <Download size={14} />
                    <span>Update Available</span>
                  </div>
                  <button
                    onClick={installConfig.onInstall}
                    style={{
                      padding: '6px 12px',
                      borderRadius: theme.radii[1],
                      background: theme.colors.primary,
                      border: 'none',
                      color: theme.colors.background,
                      fontSize: theme.fontSizes[1],
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.85';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    Update
                  </button>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: theme.radii[1],
                    background: '#16a34a15',
                    border: '1px solid #16a34a30',
                    color: '#16a34a',
                    fontSize: theme.fontSizes[1],
                    fontWeight: 500,
                  }}
                >
                  <Check size={14} />
                  <span>Installed</span>
                </div>
              )}
              {installConfig.onUninstall && (
                <button
                  onClick={installConfig.onUninstall}
                  style={{
                    padding: '6px 12px',
                    borderRadius: theme.radii[1],
                    background: 'transparent',
                    border: `1px solid ${theme.colors.border}`,
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[1],
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.error;
                    e.currentTarget.style.color = theme.colors.error;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                >
                  Uninstall
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={installConfig.onInstall}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: theme.radii[1],
                background: theme.colors.primary,
                border: 'none',
                color: theme.colors.background,
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Download size={14} />
              <span>Install Skill</span>
            </button>
          )}
        </div>
      )}

      <div style={{ padding: theme.space[3], paddingBottom: 0 }}>
        <SkillMetadataSection metadata={parsed.metadata} theme={theme} structure={structure} skill={skill} actions={actions} events={events} hideEditButtons={hideEditButtons} />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <SkillSidebar
          headers={headers}
          metadata={parsed.metadata}
          theme={theme}
          skill={skill}
        />
        <div ref={contentRef} style={{ flex: 1, overflow: 'auto', padding: theme.space[3], paddingTop: 0 }}>
          <IndustryMarkdownSlide
            content={parsed.body}
            theme={theme}
            slideIdPrefix="skill-body"
            slideIndex={0}
            isVisible={true}
            containerWidth={containerWidth}
          />
        </div>
      </div>
    </div>
  );
};

export default SkillMarkdown;

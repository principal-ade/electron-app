/**
 * TableOfContents component for displaying markdown headers
 * Provides navigation to sections within the document
 */
import { Theme } from '@principal-ade/industry-theme';
import React from 'react';
import type { MarkdownHeader } from '../utils/extractHeaders';

export interface TableOfContentsProps {
  /** Array of headers extracted from markdown */
  headers: MarkdownHeader[];
  /** Theme object for styling */
  theme: Theme;
  /** Optional class name for styling */
  className?: string;
  /** Optional callback when a header is clicked */
  onHeaderClick?: (header: MarkdownHeader) => void;
}

/**
 * TableOfContents component
 *
 * Renders a hierarchical navigation menu from markdown headers
 *
 * @example
 * ```tsx
 * const headers = extractHeaders(markdownContent);
 * <TableOfContents
 *   headers={headers}
 *   theme={theme}
 *   onHeaderClick={(header) => scrollToElement(header.id)}
 * />
 * ```
 */
export const TableOfContents: React.FC<TableOfContentsProps> = ({
  headers,
  theme,
  className = '',
  onHeaderClick,
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const handleClick = (header: MarkdownHeader) => {
    setActiveId(header.id);
    onHeaderClick?.(header);

    // Scroll to the element
    const element = document.getElementById(header.id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (headers.length === 0) {
    return null;
  }

  return (
    <nav
      className={className}
      style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        padding: theme.space[3],
      }}
    >
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {headers.map((header, index) => {
          const isActive = activeId === header.id;
          const indentLevel = Math.max(0, header.level - 1);

          return (
            <li
              key={`${header.id}-${index}`}
              style={{
                marginBottom: theme.space[1],
                marginLeft: `${indentLevel * 20}px`,
              }}
            >
              <button
                onClick={() => handleClick(header)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: `${theme.space[1]} ${theme.space[2]}`,
                  fontSize: header.level === 1 ? theme.fontSizes[2] : header.level === 2 ? theme.fontSizes[1] : theme.fontSizes[0],
                  fontFamily: theme.fonts.body,
                  color: isActive ? theme.colors.primary : theme.colors.text,
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                  fontWeight: isActive ? 600 : header.level === 1 ? 600 : header.level === 2 ? 500 : 400,
                  backgroundColor: isActive
                    ? `${theme.colors.primary}15`
                    : 'transparent',
                  borderLeft: isActive
                    ? `2px solid ${theme.colors.primary}`
                    : '2px solid transparent',
                  opacity: header.level > 3 ? 0.8 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = `${theme.colors.border}50`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {header.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default TableOfContents;

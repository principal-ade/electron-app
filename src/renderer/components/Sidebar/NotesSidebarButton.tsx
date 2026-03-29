import React from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { StickyNote } from 'lucide-react';
import { FileSystemService } from '../../main-process-api/FileSystemService';

const NOTES_DIR = '.principal';
const NOTES_FILE = 'notes.md';
const DEFAULT_CONTENT = `# Notes

`;

/**
 * Props for NotesSidebarButton
 */
export interface NotesSidebarButtonProps {
  /** Theme for styling */
  theme: Theme;
  /** Repository path */
  repositoryPath?: string;
  /** Current panel layout */
  currentLayout?: { left: string; middle: string; right: string };
  /** Callback to change panel layout */
  onLayoutChange?: (layout: { left: string; middle: string; right: string }) => void;
}

/**
 * NotesSidebarButton Component
 *
 * A sidebar button that opens the notes panel for editing .principal/notes.md
 * Creates the file if it doesn't exist.
 * Styled to match other sidebar icons.
 */
export const NotesSidebarButton: React.FC<NotesSidebarButtonProps> = ({
  theme,
  repositoryPath,
  currentLayout,
  onLayoutChange,
}) => {
  const isActive = currentLayout?.right === 'notes';
  const buttonColor = isActive ? theme.colors.primary : theme.colors.textSecondary;

  const handleClick = async () => {
    if (!repositoryPath || !currentLayout || !onLayoutChange) return;

    const notesPath = `${repositoryPath}/${NOTES_DIR}/${NOTES_FILE}`;

    // Check if file exists - readFile returns null if not found (doesn't throw)
    const existingFile = await FileSystemService.readFile(notesPath);

    if (!existingFile) {
      // File doesn't exist, create it
      try {
        await FileSystemService.writeFile(notesPath, DEFAULT_CONTENT);
        // Small delay to ensure file system sync
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        return; // Don't switch panels if file creation failed
      }
    }

    // Switch to notes panel
    onLayoutChange({ ...currentLayout, right: 'notes' });
  };

  return (
    <button
      onClick={handleClick}
      title="Notes"
      aria-label="Notes"
      style={{
        width: 'calc(100% - 20px)',
        height: '64px',
        margin: '4px 10px',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: buttonColor,
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          background: isActive ? `${theme.colors.primary}20` : 'transparent',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = theme.colors.border;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <StickyNote size={20} strokeWidth={1.5} />
      </div>
      <span
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          fontWeight: isActive ? theme.fontWeights.semibold : theme.fontWeights.body,
          lineHeight: theme.lineHeights.tight,
          textAlign: 'center',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        Notes
      </span>
    </button>
  );
};

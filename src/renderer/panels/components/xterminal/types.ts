import type { Terminal } from '@xterm/xterm';

/**
 * Overlay state for displaying messages over the terminal
 * (e.g., ownership messages, loading states, errors)
 */
export interface TerminalOverlayState {
  /** Type of overlay to display */
  type: 'owned' | 'loading' | 'error' | 'info';
  /** Main message to display */
  message: string;
  /** Optional subtitle/details */
  subtitle?: string;
  /** Optional actions the user can take */
  actions?: Array<{
    label: string;
    onClick: () => void;
    primary?: boolean;
    icon?: React.ReactNode;
  }>;
}

/**
 * Badge to display in the terminal header
 */
export interface TerminalHeaderBadge {
  label: string;
  color?: string;
}

/**
 * Props for the XTerminalPanel component
 * This is a pure UI component that renders an xterm.js terminal with minimal logic
 */
export interface XTerminalPanelProps {
  // === Data & Control ===
  /** Callback when user types data into the terminal */
  onData?: (data: string) => void;

  /** Callback when terminal is resized */
  onResize?: (cols: number, rows: number) => void;

  /** Callback when a link is clicked in the terminal */
  onLinkClick?: (url: string, isLocalhost: boolean) => void;

  // === Display ===
  /** Optional class name for container styling */
  className?: string;

  /** When true, hides the built-in header */
  hideHeader?: boolean;

  /** Title to display in the header */
  headerTitle?: string;

  /** Subtitle to display in the header (e.g., directory name) */
  headerSubtitle?: string;

  /** Optional badge to display in the header */
  headerBadge?: TerminalHeaderBadge;

  // === Behavior ===
  /** Whether to focus the terminal when it's created */
  autoFocus?: boolean;

  /** Whether the terminal is currently visible - triggers resize when becomes visible */
  isVisible?: boolean;

  /** Scrollbar style: 'overlay' (default), 'thin', 'hidden', or 'auto-hide' */
  scrollbarStyle?: 'overlay' | 'thin' | 'hidden' | 'auto-hide';

  // === Actions ===
  /** Callback when user clicks the close/hide button */
  onClose?: () => void;

  /** Callback when user clicks the destroy button */
  onDestroy?: () => void;

  /** Callback when user clicks the pop-out button */
  onPopOut?: () => void;

  // === State Overlay ===
  /**
   * Optional overlay state to display over the terminal
   * Used for showing ownership messages, loading states, etc.
   */
  overlayState?: TerminalOverlayState;
}

/**
 * Ref interface for XTerminalPanel
 * Exposes methods for controlling the terminal from parent components
 */
export interface XTerminalPanelRef {
  /** Write data to the terminal */
  write: (data: string) => void;

  /** Scroll to the bottom of the terminal */
  scrollToBottom: () => void;

  /** Focus the terminal */
  focus: () => void;

  /** Clear the terminal screen */
  clear: () => void;

  /** Get the underlying xterm Terminal instance */
  getTerminal: () => Terminal | null;

  /** Resize the terminal to fit its container */
  fit: () => void;

  /** Search forward for the given text */
  findNext: (searchTerm: string, searchOptions?: {
    regex?: boolean;
    wholeWord?: boolean;
    caseSensitive?: boolean;
  }) => boolean;

  /** Search backward for the given text */
  findPrevious: (searchTerm: string, searchOptions?: {
    regex?: boolean;
    wholeWord?: boolean;
    caseSensitive?: boolean;
  }) => boolean;

  /** Clear search highlights */
  clearSearch: () => void;
}

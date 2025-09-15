import '@xterm/xterm/css/xterm.css';
/**
 * TerminalPanelProps
 * Strongly typed props for the embedded terminal component.
 */
interface TerminalPanelProps {
    /** Absolute working directory for the terminal session */
    directory: string;
    /** Optional handler when user requests to hide the terminal (does not kill the session) */
    onClose?: () => void;
    /** Optional handler when user requests to destroy the terminal session */
    onDestroy?: () => void;
    /** Optional class name for container styling */
    className?: string;
    /** Optional associated AI session ID */
    agentSessionId?: string;
    /** Optional existing terminal session ID to connect to (re-attach) */
    terminalId?: string;
    /** Whether to focus the terminal when it's created */
    autoFocus?: boolean;
    /** When true, suppresses the built-in header so the parent can provide its own */
    hideHeader?: boolean;
    /** Whether the terminal is currently visible - triggers resize when becomes visible */
    isVisible?: boolean;
    /** Callback when a new terminal session is created */
    onSessionCreated?: (sessionId: string) => void;
    /** Optional command to run when the terminal is created */
    initialCommand?: string;
}
declare function TerminalPanel({ directory, onClose, onDestroy, className, agentSessionId, terminalId, autoFocus, hideHeader, isVisible, onSessionCreated, initialCommand, }: TerminalPanelProps): import("react/jsx-runtime").JSX.Element;
declare namespace TerminalPanel {
    var defaultProps: {
        onClose: undefined;
        onDestroy: undefined;
        className: string;
    };
}
export default TerminalPanel;
//# sourceMappingURL=TerminalPanel.d.ts.map
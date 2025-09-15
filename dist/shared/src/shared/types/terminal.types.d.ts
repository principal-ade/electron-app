/**
 * Terminal types and helpers shared across main and renderer.
 */
/**
 * Supported terminal identifiers.
 */
export type TerminalId = "terminal" | "iterm2" | "warp" | "kitty" | "alacritty" | "wezterm" | "ghostty";
/**
 * Human-friendly labels for supported terminals.
 */
export declare const TERMINAL_LABELS: Record<TerminalId, string>;
/**
 * macOS application names for supported terminals, used with `open -a`.
 */
export declare const MAC_TERMINAL_APP_NAMES: Record<TerminalId, string>;
/**
 * Default terminal selection used when user preference is not set.
 */
export declare const DEFAULT_TERMINAL: TerminalId;
//# sourceMappingURL=terminal.types.d.ts.map
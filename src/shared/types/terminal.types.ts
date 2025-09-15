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
export const TERMINAL_LABELS: Record<TerminalId, string> = {
  terminal: "Terminal",
  iterm2: "iTerm2",
  warp: "Warp",
  kitty: "Kitty",
  alacritty: "Alacritty",
  wezterm: "WezTerm",
  ghostty: "Ghostty",
};

/**
 * macOS application names for supported terminals, used with `open -a`.
 */
export const MAC_TERMINAL_APP_NAMES: Record<TerminalId, string> = {
  terminal: "Terminal",
  iterm2: "iTerm",
  warp: "Warp",
  kitty: "kitty",
  alacritty: "Alacritty",
  wezterm: "WezTerm",
  ghostty: "Ghostty",
};

/**
 * Default terminal selection used when user preference is not set.
 */
export const DEFAULT_TERMINAL: TerminalId = "terminal";
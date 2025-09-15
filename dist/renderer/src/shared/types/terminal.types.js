/**
 * Terminal types and helpers shared across main and renderer.
 */
/**
 * Human-friendly labels for supported terminals.
 */
export const TERMINAL_LABELS = {
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
export const MAC_TERMINAL_APP_NAMES = {
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
export const DEFAULT_TERMINAL = "terminal";

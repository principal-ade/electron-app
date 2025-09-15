/**
 * Editor types and helpers shared across main and renderer.
 */
/**
 * Human-friendly labels for supported editors.
 */
export const EDITOR_LABELS = {
    vscode: "VS Code",
    cursor: "Cursor",
    webstorm: "WebStorm",
    sublime: "Sublime Text",
    intellij: "IntelliJ IDEA",
};
/**
 * macOS application names for supported editors, used with `open -a`.
 */
export const MAC_EDITOR_APP_NAMES = {
    vscode: "Visual Studio Code",
    cursor: "Cursor",
    webstorm: "WebStorm",
    sublime: "Sublime Text",
    intellij: "IntelliJ IDEA",
};
/**
 * Default editor selection used when user preference is not set.
 */
export const DEFAULT_EDITOR = "vscode";

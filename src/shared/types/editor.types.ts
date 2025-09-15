/**
 * Editor types and helpers shared across main and renderer.
 */

/**
 * Supported editor identifiers.
 */
export type EditorId = "vscode" | "cursor" | "webstorm" | "sublime" | "intellij";

/**
 * Human-friendly labels for supported editors.
 */
export const EDITOR_LABELS: Record<EditorId, string> = {
  vscode: "VS Code",
  cursor: "Cursor",
  webstorm: "WebStorm",
  sublime: "Sublime Text",
  intellij: "IntelliJ IDEA",
};

/**
 * macOS application names for supported editors, used with `open -a`.
 */
export const MAC_EDITOR_APP_NAMES: Record<EditorId, string> = {
  vscode: "Visual Studio Code",
  cursor: "Cursor",
  webstorm: "WebStorm",
  sublime: "Sublime Text",
  intellij: "IntelliJ IDEA",
};

/**
 * Default editor selection used when user preference is not set.
 */
export const DEFAULT_EDITOR: EditorId = "vscode";



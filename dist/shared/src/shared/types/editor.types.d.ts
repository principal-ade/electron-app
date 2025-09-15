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
export declare const EDITOR_LABELS: Record<EditorId, string>;
/**
 * macOS application names for supported editors, used with `open -a`.
 */
export declare const MAC_EDITOR_APP_NAMES: Record<EditorId, string>;
/**
 * Default editor selection used when user preference is not set.
 */
export declare const DEFAULT_EDITOR: EditorId;
//# sourceMappingURL=editor.types.d.ts.map
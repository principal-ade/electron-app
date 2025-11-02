// Base components
export { BaseTitlebar } from './BaseTitlebar';
export type { BaseTitlebarProps } from './BaseTitlebar';

export { TitlebarButton } from './TitlebarButton';
export type { TitlebarButtonProps } from './TitlebarButton';

export { GitSyncStatusIndicator } from './GitSyncStatusIndicator';
export type { GitSyncStatusIndicatorProps } from './GitSyncStatusIndicator';

// Window-specific titlebars
export { RepositoryTitlebar } from './RepositoryTitlebar';
export type { RepositoryTitlebarProps } from './RepositoryTitlebar';

export { StoreViewerTitlebar } from './StoreViewerTitlebar';
export type { StoreViewerTitlebarProps } from './StoreViewerTitlebar';

export { MarkdownViewerTitlebar } from './MarkdownViewerTitlebar';
export type { MarkdownViewerTitlebarProps } from './MarkdownViewerTitlebar';

export { CallimachusTitlebar } from './CallimachusTitlebar';
export type { CallimachusTitlebarProps } from './CallimachusTitlebar';

export { TerminalTitlebar } from './TerminalTitlebar';
export type { TerminalTitlebarProps } from './TerminalTitlebar';

// For backward compatibility with old imports
export { RepositoryTitlebar as RepoManagerTitlebar } from './RepositoryTitlebar';

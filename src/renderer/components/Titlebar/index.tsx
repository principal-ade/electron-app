// Base components
export { BaseTitlebar } from './BaseTitlebar';
export type { BaseTitlebarProps } from './BaseTitlebar';

export { TitlebarButton } from './TitlebarButton';
export type { TitlebarButtonProps } from './TitlebarButton';

export { TitlebarSettings } from './TitlebarSettings';
export type { TitlebarSettingsProps } from './TitlebarSettings';

export { TitlebarAddProject } from './TitlebarAddProject';
export type { TitlebarAddProjectProps } from './TitlebarAddProject';

// Window-specific titlebars
export { MainWindowTitlebar } from './MainWindowTitlebar';
export type { MainWindowTitlebarProps } from './MainWindowTitlebar';

export { RepositoryTitlebar } from './RepositoryTitlebar';
export type { RepositoryTitlebarProps } from './RepositoryTitlebar';

export { EditorTitlebar } from './EditorTitlebar';
export type { EditorTitlebarProps } from './EditorTitlebar';

export { StoreViewerTitlebar } from './StoreViewerTitlebar';
export type { StoreViewerTitlebarProps } from './StoreViewerTitlebar';

export { SessionDetailsTitlebar } from './SessionDetailsTitlebar';
export type { SessionDetailsTitlebarProps } from './SessionDetailsTitlebar';

export { MarkdownViewerTitlebar } from './MarkdownViewerTitlebar';
export type { MarkdownViewerTitlebarProps } from './MarkdownViewerTitlebar';

export { CallimachusTitlebar } from './CallimachusTitlebar';
export type { CallimachusTitlebarProps } from './CallimachusTitlebar';

export { TerminalTitlebar } from './TerminalTitlebar';
export type { TerminalTitlebarProps } from './TerminalTitlebar';

export { SearchWindowTitlebar } from './SearchWindowTitlebar';
export type { SearchWindowTitlebarProps } from './SearchWindowTitlebar';

// For backward compatibility with old imports
export { MainWindowTitlebar as CustomTitlebar } from './MainWindowTitlebar';
export { RepositoryTitlebar as RepoManagerTitlebar } from './RepositoryTitlebar';
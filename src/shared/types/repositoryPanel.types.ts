export type RepositoryPanelId =
  // Repository Explorer panels
  | 'gitChanges'
  | 'files'
  | 'gitStatus'
  | 'tasksAndNotes'
  | 'cityVisualization'
  | 'actions'
  | 'packageInfo'
  // Repository Manager panels
  | 'fileTree'
  | 'search'
  | 'dependencies'
  | 'tools'
  | 'docs'
  | 'terminal'
  // Viewer panels (decoupled from RightPaneContainer)
  | 'codeViewer'
  | 'markdownViewer'
  | 'excalidrawDiagram'
  // Legacy panel IDs (deprecated)
  | 'markdownDocument'
  | 'markdownSlides';

export type RepositoryPanelVisibility = Record<RepositoryPanelId, boolean>;

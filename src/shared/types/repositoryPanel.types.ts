export type RepositoryPanelId =
  | 'gitChanges'
  | 'files'
  | 'gitStatus'
  | 'tasksAndNotes'
  | 'cityVisualization'
  | 'actions'
  | 'packageInfo';

export type RepositoryPanelVisibility = Record<RepositoryPanelId, boolean>;

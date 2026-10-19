export const HOME_REPOSITORY_REFRESH_INTEREST =
  'repository-monitoring:home-refresh-interest';

export interface HomeRepositoryRefreshInterest {
  consumerId: string;
  repoPaths: string[];
  visible: boolean;
}

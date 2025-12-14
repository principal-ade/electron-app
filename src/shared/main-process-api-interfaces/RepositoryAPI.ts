import type { Repository } from '../types/repository.types';

export enum RepositoryAPIEvent {
  GET_ALL = 'repository:get-all',
  GET = 'repository:get',
  ADD = 'repository:add',
  UPDATE = 'repository:update',
  REMOVE = 'repository:remove',
  ADD_LOCAL_CLONE = 'repository:add-local-clone',
  REMOVE_LOCAL_CLONE = 'repository:remove-local-clone',
  GET_BY_LOCAL_PATH = 'repository:get-by-local-path',
  GET_LOCAL = 'repository:get-local',
  CLEANUP_STALE = 'repository:cleanup-stale',
}

export interface RepositoryAPI {
  // Repository management
  getRepositories: () => Promise<Repository[]>;
  getRepository: (remoteUrl: string) => Promise<Repository | undefined>;
  addRepository: (params: {
    remoteUrl: string;
    owner: string;
    name: string;
    localPath?: string;
    description?: string;
    avatarUrl?: string;
  }) => Promise<Repository>;
  updateRepository: (
    remoteUrl: string,
    updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>,
  ) => Promise<Repository | undefined>;
  removeRepository: (remoteUrl: string) => Promise<boolean>;

  // Local clone management
  addLocalClone: (
    remoteUrl: string,
    localPath: string,
  ) => Promise<Repository | undefined>;
  removeLocalClone: (remoteUrl: string, localPath: string) => Promise<boolean>;
  getRepositoryByLocalPath: (
    localPath: string,
  ) => Promise<Repository | undefined>;
  getLocalRepositories: () => Promise<Repository[]>;
}

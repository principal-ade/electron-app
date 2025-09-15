import type { Repository } from '../types/repository.types';

export enum RepositoryAPIEvent {
  GET_ALL = 'repository:get-all',
  GET = 'repository:get',
  ADD = 'repository:add',
  UPDATE = 'repository:update',
  UPDATE_ACCESS = 'repository:update-access',
  REMOVE = 'repository:remove',
  GET_RECENT = 'repository:get-recent',
  ADD_LOCAL_CLONE = 'repository:add-local-clone',
  REMOVE_LOCAL_CLONE = 'repository:remove-local-clone',
  UPDATE_LOCAL_CLONE_ACCESS = 'repository:update-local-clone-access',
  GET_BY_LOCAL_PATH = 'repository:get-by-local-path',
  GET_LOCAL = 'repository:get-local',
  REFRESH_METADATA = 'repository:refresh-metadata',
  SET_REPOSITORY_AVATAR = 'repository:set-repository-avatar',
  SET_CLONE_AVATAR = 'repository:set-clone-avatar',
  REMOVE_REPOSITORY_AVATAR = 'repository:remove-repository-avatar',
  REMOVE_CLONE_AVATAR = 'repository:remove-clone-avatar',
  GET_AVATAR_URL = 'repository:get-avatar-url',
  SEARCH_GITHUB_REPOSITORIES = 'repository:search-github',
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
    metadata?: Repository['metadata'];
  }) => Promise<Repository>;
  updateRepository: (remoteUrl: string, updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>) => Promise<Repository | undefined>;
  updateRepositoryAccess: (remoteUrl: string) => Promise<void>;
  removeRepository: (remoteUrl: string) => Promise<boolean>;
  getRecentRepositories: (limit?: number) => Promise<Repository[]>;
  
  // Local clone management
  addLocalClone: (remoteUrl: string, localPath: string) => Promise<Repository | undefined>;
  removeLocalClone: (remoteUrl: string, localPath: string) => Promise<boolean>;
  updateLocalCloneAccess: (remoteUrl: string, localPath: string) => Promise<void>;
  getRepositoryByLocalPath: (localPath: string) => Promise<Repository | undefined>;
  getLocalRepositories: () => Promise<Repository[]>;
  refreshRepositoryMetadata: (remoteUrl: string) => Promise<Repository | undefined>;
  
  // Avatar management
  setRepositoryAvatar: (remoteUrl: string, imageBase64: string) => Promise<{ success: boolean; avatarPath?: string; error?: string }>;
  setCloneAvatar: (remoteUrl: string, clonePath: string, imageBase64: string) => Promise<{ success: boolean; avatarPath?: string; error?: string }>;
  removeRepositoryAvatar: (remoteUrl: string) => Promise<{ success: boolean; error?: string }>;
  removeCloneAvatar: (remoteUrl: string, clonePath: string) => Promise<{ success: boolean; error?: string }>;
  getAvatarUrl: (avatarPath: string) => Promise<string | null>;
  
  // GitHub API
  searchGitHubRepositories: (query: string, options?: { 
    sort?: 'stars' | 'forks' | 'updated'; 
    order?: 'asc' | 'desc';
    perPage?: number;
  }) => Promise<{ 
    items: Array<{
      id: number;
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      language: string | null;
    }>;
    total_count: number;
  }>;
}
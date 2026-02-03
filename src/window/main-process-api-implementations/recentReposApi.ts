import { ipcRenderer } from 'electron';
import {
  RecentReposAPIEvent,
  type RecentReposAPI,
} from '../../shared/main-process-api-interfaces/RecentReposAPI';

export const recentReposAPI: RecentReposAPI = {
  getRecentRepos: async () => {
    return ipcRenderer.invoke(RecentReposAPIEvent.GET_RECENT_REPOS);
  },
  addRecentRepo: async (repo) => {
    return ipcRenderer.invoke(RecentReposAPIEvent.ADD_RECENT_REPO, repo);
  },
  removeRecentRepo: async (owner, repo) => {
    return ipcRenderer.invoke(RecentReposAPIEvent.REMOVE_RECENT_REPO, { owner, repo });
  },
  clearRecentRepos: async () => {
    return ipcRenderer.invoke(RecentReposAPIEvent.CLEAR_RECENT_REPOS);
  },
};

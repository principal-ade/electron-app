import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  SkillLockAPI,
  SkillLockFile,
  AddSkillToLockOptions,
  UpdateSkillInLockOptions,
  SkillUpdateCheckResult,
  InstalledSkillInfo,
  SkillUpdateResult,
  SkillInstalledPayload,
  SkillUninstalledPayload,
  SkillUpdatedPayload,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';
import { SkillLockAPIEvent } from '../../shared/main-process-api-interfaces/SkillLockAPI';

export const skillLockAPI: SkillLockAPI = {
  getSkillLock: async (): Promise<SkillLockFile | null> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.GET_SKILL_LOCK);
  },

  addSkillToLock: async (
    options: AddSkillToLockOptions
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.ADD_SKILL_TO_LOCK, options);
  },

  removeSkillFromLock: async (
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.REMOVE_SKILL_FROM_LOCK, name);
  },

  updateSkillInLock: async (
    options: UpdateSkillInLockOptions
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.UPDATE_SKILL_IN_LOCK, options);
  },

  checkSkillUpdates: async (): Promise<SkillUpdateCheckResult[]> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.CHECK_SKILL_UPDATES);
  },

  getInstalledSkills: async (): Promise<InstalledSkillInfo[]> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.GET_INSTALLED_SKILLS);
  },

  updateSkill: async (name: string): Promise<SkillUpdateResult> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.UPDATE_SKILL, name);
  },

  updateAllSkills: async (): Promise<SkillUpdateResult[]> => {
    return ipcRenderer.invoke(SkillLockAPIEvent.UPDATE_ALL_SKILLS);
  },

  // Event listeners for broadcasts from main process
  onSkillInstalled: (
    callback: (payload: SkillInstalledPayload) => void
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: SkillInstalledPayload) => {
      callback(payload);
    };
    ipcRenderer.on(SkillLockAPIEvent.SKILL_INSTALLED, handler);
    return () => {
      ipcRenderer.removeListener(SkillLockAPIEvent.SKILL_INSTALLED, handler);
    };
  },

  onSkillUninstalled: (
    callback: (payload: SkillUninstalledPayload) => void
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: SkillUninstalledPayload) => {
      callback(payload);
    };
    ipcRenderer.on(SkillLockAPIEvent.SKILL_UNINSTALLED, handler);
    return () => {
      ipcRenderer.removeListener(SkillLockAPIEvent.SKILL_UNINSTALLED, handler);
    };
  },

  onSkillUpdated: (
    callback: (payload: SkillUpdatedPayload) => void
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: SkillUpdatedPayload) => {
      callback(payload);
    };
    ipcRenderer.on(SkillLockAPIEvent.SKILL_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(SkillLockAPIEvent.SKILL_UPDATED, handler);
    };
  },
};

/**
 * SkillsSurfaceContext
 *
 * The Skills workspace surface's shared state — everything the former
 * `SkillBrowserView` overlay kept in one component, lifted into a context so the
 * split halves can read it: the left-panel launcher (`SkillsLeftPanel`, the
 * list + header) and the singleton detail tab (`SkillDetailTabContent`). It also
 * renders the three modals (agent setup / install / editor) and opens the detail
 * tab when a skill is selected.
 *
 * Mounted once, stably, inside `WorkspaceShell` (so the always-mounted hidden
 * detail tab keeps its context across surface switches). Heavy effects — the
 * filesystem loaders and the focus/visibility auto-refresh — are gated on
 * `enabled` (Skills is the active surface, or a skill tab is open) so they stay
 * dormant while you're on another surface.
 *
 * The orchestration logic is moved verbatim from `SkillBrowserView`; only the
 * `enabled` guards, the context wiring, and the `skill:selected → openSkill`
 * call are new.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type Skill,
} from '@industry-theme/agent-panels';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { useSkillBrowserPanelProvider } from '../principal-window/views/SkillBrowserView/SkillBrowserPanelProvider';
import { useSkillsSync } from '../hooks/useSkillsSync';
import {
  type ViewMode,
  type DetectedDirectory,
} from '../principal-window/views/SkillBrowserView/SkillBrowserViewHeader';
import {
  type SkillDestination,
  DIRECTORY_ID_TO_DESTINATION,
} from '../principal-window/views/SkillBrowserView/InstallSkillToolbar';
import { type RecentRepo } from '../principal-window/views/SkillBrowserView/RecentSkillsPanel';
import { AgentSetupModal } from '../principal-window/views/SkillBrowserView/AgentSetupModal';
import { SkillInstallationModal } from '../principal-window/views/SkillBrowserView/SkillInstallationModal';
import { SkillEditorModal } from '../principal-window/views/SkillBrowserView/SkillEditorModal';
import { GithubService } from '../main-process-api/GithubService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { SkillLockService } from '../main-process-api/SkillLockService';
import { RecentReposService } from '../main-process-api/RecentReposService';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';

interface GithubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
  /** SHA of the root tree. */
  treeSha?: string;
  /** Raw tree data for extracting skill-specific SHAs. */
  treeData?: Array<{ path: string; type: string; sha: string }>;
}

interface SkillMetadata {
  sha: string;
  installedAt: string;
  installedFrom: string;
}

interface SkillSource {
  owner: string;
  repo: string;
  branch: string;
}

/** Everything the Skills left panel + detail tab + modals consume. */
export interface SkillsSurfaceValue {
  context: ReturnType<typeof useSkillBrowserPanelProvider>['context'];
  actions: ReturnType<typeof useSkillBrowserPanelProvider>['actions'];
  events: ReturnType<typeof useSkillBrowserPanelProvider>['events'];

  // Onboarding / loading
  checkingConfig: boolean;
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  onOnboardingComplete: () => void;

  // View mode + repo
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  githubRepoInfo: GithubRepoInfo | null;
  clearRepo: () => void;

  // List data
  browseFileTree: FileTree | null;
  recentRepos: RecentRepo[];
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  handleFetchSkills: (url?: string) => Promise<void>;
  handleSelectRecentRepo: (repo: RecentRepo) => Promise<void>;
  isLoading: boolean;
  error: string | null;

  // Directories / setup
  detectedDirectories: DetectedDirectory[];
  openSetup: () => void;

  // Selection + detail
  selectedSkill: Skill | null;
  selectedSkillMetadata: SkillMetadata | null;
  setSelectedSkillMetadata: (m: SkillMetadata | null) => void;
  isSkillInstalled: (skill: Skill) => boolean;
  getSkillInstalledDirectories: (skill: Skill) => string[];
  getSkillTreeSha: (skillFolderPath: string) => string | undefined;
  getInstalledSkillMetadata: (skill: Skill) => Promise<SkillMetadata | null>;
  handleInstallSkillToDirectories: (directoryIds: string[]) => Promise<void>;
  handleUninstallSkillFromDirectories: (directoryIds: string[]) => Promise<void>;
  openInstallModal: () => void;
}

const SkillsSurfaceContext = createContext<SkillsSurfaceValue | null>(null);

export const useSkillsSurface = (): SkillsSurfaceValue => {
  const ctx = useContext(SkillsSurfaceContext);
  if (!ctx) {
    throw new Error(
      'useSkillsSurface must be used within a SkillsSurfaceProvider',
    );
  }
  return ctx;
};

export const SkillsSurfaceProvider: React.FC<{
  /** Skills is the active surface, or a skill tab is open — run heavy effects. */
  enabled: boolean;
  children: ReactNode;
}> = ({ enabled, children }) => {
  const { context, actions, events } = useSkillBrowserPanelProvider();
  const { getConfig } = useSkillsSync();
  const { openSkill } = useWorkspaceTabs();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('installed');
  const [browseFileTree, setBrowseFileTree] = useState<FileTree | null>(null);
  const [installedFileTree, setInstalledFileTree] = useState<FileTree | null>(
    null,
  );
  const [installedSkillsData, setInstalledSkillsData] = useState<
    Array<{ path: string; name: string; source: string }>
  >([]);
  const [detectedDirectories, setDetectedDirectories] = useState<
    DetectedDirectory[]
  >([]);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [githubRepoInfo, setGithubRepoInfo] = useState<GithubRepoInfo | null>(
    null,
  );
  const [selectedSkillMetadata, setSelectedSkillMetadata] =
    useState<SkillMetadata | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [canEditSelectedSkill, setCanEditSelectedSkill] = useState(false);
  const [selectedSkillSource, setSelectedSkillSource] =
    useState<SkillSource | null>(null);

  // Check if sync is configured (once Skills is in use).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const checkConfig = async () => {
      await getConfig();
      if (!cancelled) setCheckingConfig(false);
    };
    checkConfig();
    return () => {
      cancelled = true;
    };
  }, [enabled, getConfig]);

  // Clear selected skill when switching view modes
  useEffect(() => {
    setSelectedSkill(null);
    setSelectedSkillMetadata(null);
  }, [viewMode]);

  // Clear selected skill when loading a new GitHub repo
  useEffect(() => {
    if (viewMode === 'browse' && githubRepoInfo) {
      setSelectedSkill(null);
      setSelectedSkillMetadata(null);
    }
  }, [githubRepoInfo, viewMode]);

  const parseGithubUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed.includes('/') || !trimmed.includes('.')) {
      const parts = trimmed.split('/');
      if (parts.length === 2) {
        return { owner: parts[0], repo: parts[1], branch: 'main', path: '' };
      }
    }
    const githubUrlPattern =
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(.*))?/;
    const match = trimmed.match(githubUrlPattern);
    if (match) {
      const [, owner, repo, branch = 'main', path = ''] = match;
      return {
        owner,
        repo,
        branch,
        path: path.startsWith('/') ? path.slice(1) : path,
      };
    }
    return null;
  }, []);

  const convertLocalSkillsToFileTree = useCallback(
    (skills: Array<{ path: string; name: string; source: string }>) => {
      const filePaths: string[] = [];
      for (const skill of skills) {
        filePaths.push(`${skill.source}/${skill.name}/SKILL.md`);
      }
      const builder = new PathsFileTreeBuilder();
      const builtTree = builder.build({
        files: filePaths,
        rootPath: '/installed-skills',
      });
      const uniqueSha = `local-${Date.now()}-${skills.length}`;
      const fileTreeData: FileTree = {
        ...builtTree,
        sha: uniqueSha,
        metadata: {
          ...builtTree.metadata,
          id: 'local:installed-skills',
          sourceType: 'local',
          sourceSha: uniqueSha,
          sourceInfo: {
            type: 'local-skills',
            skillCount: skills.length,
          },
        },
      };
      return fileTreeData;
    },
    [],
  );

  const loadInstalledSkills = useCallback(async () => {
    try {
      const result = await FileSystemService.getAllLocalSkills();
      if (!result || !result.skills || result.skills.length === 0) {
        setInstalledFileTree(null);
        setInstalledSkillsData([]);
        if (viewMode === 'installed') {
          actions.setFileTree(null);
        }
        return;
      }
      setInstalledSkillsData(result.skills);
      const fileTree = convertLocalSkillsToFileTree(result.skills);
      setInstalledFileTree(fileTree);
      if (viewMode === 'installed') {
        actions.setFileTree(fileTree);
      }
    } catch (err) {
      console.error('[SkillsSurface] Failed to load installed skills:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load installed skills',
      );
    }
  }, [convertLocalSkillsToFileTree, actions, viewMode]);

  const loadDetectedDirectories = useCallback(async () => {
    try {
      const detected = await FileSystemService.detectPresetDirectories();
      const mappedDirectories: DetectedDirectory[] = (detected || []).map(
        (dir) => ({
          ...dir,
          icon: dir.icon || 'folder',
        }),
      );
      setDetectedDirectories(mappedDirectories);
    } catch (err) {
      console.error('[SkillsSurface] Failed to detect directories:', err);
    }
  }, []);

  const loadRecentRepos = useCallback(async () => {
    try {
      const repos = await RecentReposService.getRecentRepos();
      setRecentRepos(repos || []);
    } catch (err) {
      console.error('[SkillsSurface] Failed to load recent repos:', err);
    }
  }, []);

  const handleCreateAgentDirectories = useCallback(
    async (agentIds: string[]) => {
      try {
        const result = await FileSystemService.createAgentDirectories(agentIds);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create directories');
        }
        await loadDetectedDirectories();
        await loadInstalledSkills();
      } catch (err) {
        console.error('[SkillsSurface] Failed to create directories:', err);
        throw err;
      }
    },
    [loadDetectedDirectories, loadInstalledSkills],
  );

  const handleRemoveAgentDirectory = useCallback(
    async (agentId: string) => {
      try {
        const result = await FileSystemService.deleteAgentDirectory(agentId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove directory');
        }
        await loadDetectedDirectories();
        await loadInstalledSkills();
      } catch (err) {
        console.error('[SkillsSurface] Failed to remove directory:', err);
        throw err;
      }
    },
    [loadDetectedDirectories, loadInstalledSkills],
  );

  // Listen for skill selection → track it + open/focus the detail tab.
  useEffect(() => {
    const unsubscribe = events.on('skill:selected', (event) => {
      const payload = event.payload as { skill: Skill } | undefined;
      if (payload?.skill) {
        setSelectedSkill(payload.skill);
        openSkill(payload.skill.name);
      }
    });
    return unsubscribe;
  }, [events, openSkill]);

  // Refresh installed skills after an install
  useEffect(() => {
    const unsubscribe = events.on('skill:installed', () => {
      loadInstalledSkills();
    });
    return unsubscribe;
  }, [events, loadInstalledSkills]);

  // Listen for skill edit events
  useEffect(() => {
    const unsubscribe = events.on('skill:edit', () => {
      if (!selectedSkill) return;
      if (canEditSelectedSkill && selectedSkillSource) {
        setShowEditorModal(true);
      } else {
        events.emit({
          type: 'file:openInMdxEditor',
          source: 'SkillsSurface',
          timestamp: Date.now(),
          payload: { filePath: selectedSkill.path },
        });
      }
    });
    return unsubscribe;
  }, [events, selectedSkill, canEditSelectedSkill, selectedSkillSource]);

  // Switch file tree when view mode changes
  useEffect(() => {
    if (!enabled) return;
    if (viewMode === 'browse') {
      if (browseFileTree) {
        actions.setFileTree(browseFileTree);
      } else {
        actions.setFileTree(null);
      }
    } else {
      if (installedFileTree) {
        actions.setFileTree(installedFileTree);
      } else {
        actions.setFileTree(null);
        loadInstalledSkills();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, enabled]);

  // Load detected directories, recent repos, and installed skills (when in use).
  useEffect(() => {
    if (!enabled) return;
    loadDetectedDirectories();
    loadRecentRepos();
    loadInstalledSkills();
  }, [enabled, loadDetectedDirectories, loadRecentRepos, loadInstalledSkills]);

  // Listen for refresh requests from the skills list panel
  useEffect(() => {
    const unsubscribe = events.on('skills:refresh', () => {
      loadInstalledSkills();
    });
    return unsubscribe;
  }, [events, loadInstalledSkills]);

  // Auto-refresh installed skills when the window becomes visible/focused.
  useEffect(() => {
    if (!enabled || viewMode !== 'installed') return;
    const handleVisibilityChange = () => {
      if (!document.hidden) loadInstalledSkills();
    };
    const handleFocus = () => {
      loadInstalledSkills();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, viewMode, loadInstalledSkills]);

  const convertGithubTreeToFileTree = useCallback(
    (
      treeItems: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>,
      parsed: { owner: string; repo: string; branch: string; path?: string },
    ): FileTree => {
      const filePaths = treeItems
        .filter((item) => item.type === 'blob')
        .map((item) => item.path);
      const builder = new PathsFileTreeBuilder();
      const builtTree = builder.build({
        files: filePaths,
        rootPath: `/${parsed.owner}/${parsed.repo}`,
      });
      const fileTreeData: FileTree = {
        ...builtTree,
        metadata: {
          ...builtTree.metadata,
          id: `github:${parsed.owner}/${parsed.repo}:${builtTree.sha}`,
          sourceType: 'github',
          sourceSha: builtTree.sha,
          sourceInfo: {
            owner: parsed.owner,
            repo: parsed.repo,
            branch: parsed.branch,
            path: parsed.path,
          },
        },
      };
      return fileTreeData;
    },
    [],
  );

  const handleFetchSkills = useCallback(
    async (url?: string) => {
      const urlToUse = url !== undefined ? url : githubUrl;
      if (!urlToUse.trim()) {
        setError('Please enter a GitHub URL');
        return;
      }
      const parsed = parseGithubUrl(urlToUse);
      if (!parsed) {
        setError('Invalid GitHub URL format');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        setGithubRepoInfo({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: parsed.branch,
        });
        actions.setGitHubRepository({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: parsed.branch,
        });
        const result = await GithubService.getTree(
          parsed.owner,
          parsed.repo,
          parsed.branch,
        );
        if (!result?.success || !result.data) {
          setError('Failed to fetch repository tree');
          return;
        }
        setGithubRepoInfo({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: parsed.branch,
          treeSha: result.data.sha,
          treeData: result.data.tree,
        });
        const fileTree = convertGithubTreeToFileTree(result.data.tree, parsed);
        setBrowseFileTree(fileTree);
        if (viewMode === 'browse') {
          actions.setFileTree(fileTree);
        }
        try {
          await RecentReposService.addRecentRepo({
            url: urlToUse,
            owner: parsed.owner,
            repo: parsed.repo,
            branch: parsed.branch,
          });
          await loadRecentRepos();
        } catch (err) {
          console.error('[SkillsSurface] Failed to save recent repo:', err);
        }
      } catch (err) {
        console.error('[SkillsSurface] Failed to fetch skills:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to fetch repository',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      githubUrl,
      parseGithubUrl,
      convertGithubTreeToFileTree,
      actions,
      viewMode,
      loadRecentRepos,
    ],
  );

  const handleSelectRecentRepo = useCallback(
    async (repo: RecentRepo) => {
      setGithubUrl(repo.url);
      await handleFetchSkills(repo.url);
    },
    [handleFetchSkills],
  );

  const getSkillFolderName = useCallback((skill: Skill): string => {
    const folderPath = skill.skillFolderPath || skill.path;
    const parts = folderPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || skill.name;
  }, []);

  const getSkillTreeSha = useCallback(
    (skillFolderPath: string): string | undefined => {
      if (!githubRepoInfo?.treeData) return undefined;
      const normalizedPath = skillFolderPath.replace(/^\/+|\/+$/g, '');
      const treeEntry = githubRepoInfo.treeData.find(
        (entry) => entry.path === normalizedPath && entry.type === 'tree',
      );
      return treeEntry?.sha;
    },
    [githubRepoInfo],
  );

  const isSkillInstalled = useCallback(
    (skill: Skill): boolean => {
      const folderName = getSkillFolderName(skill);
      return installedSkillsData.some(
        (installedSkill) => installedSkill.name === folderName,
      );
    },
    [installedSkillsData, getSkillFolderName],
  );

  const getSkillInstalledDirectories = useCallback(
    (skill: Skill): string[] => {
      const folderName = getSkillFolderName(skill);
      const skillInstances = installedSkillsData.filter(
        (installedSkill) => installedSkill.name === folderName,
      );
      const directoryIds: string[] = [];
      for (const installedSkill of skillInstances) {
        for (const dir of detectedDirectories) {
          if (installedSkill.path.startsWith(dir.path)) {
            directoryIds.push(dir.id);
            break;
          }
        }
      }
      return directoryIds;
    },
    [installedSkillsData, detectedDirectories, getSkillFolderName],
  );

  const getInstalledSkillMetadata = useCallback(
    async (skill: Skill): Promise<SkillMetadata | null> => {
      try {
        const folderName = getSkillFolderName(skill);
        const skillEntry = await SkillLockService.getSkillEntry(folderName);
        if (!skillEntry) {
          return null;
        }
        return {
          sha: skillEntry.skillFolderHash,
          installedAt: skillEntry.installedAt,
          installedFrom: skillEntry.sourceUrl,
        };
      } catch (err) {
        console.error('[SkillsSurface] Failed to read skill from lock:', err);
        return null;
      }
    },
    [getSkillFolderName],
  );

  // Load metadata when selected skill changes
  useEffect(() => {
    if (!selectedSkill) {
      setSelectedSkillMetadata(null);
      return;
    }
    const loadMetadata = async () => {
      if (isSkillInstalled(selectedSkill)) {
        const metadata = await getInstalledSkillMetadata(selectedSkill);
        setSelectedSkillMetadata(metadata);
      } else {
        setSelectedSkillMetadata(null);
      }
    };
    loadMetadata();
  }, [selectedSkill, isSkillInstalled, getInstalledSkillMetadata]);

  // Check edit permission + load skill source when selected skill changes
  useEffect(() => {
    if (!selectedSkill || !isSkillInstalled(selectedSkill)) {
      setCanEditSelectedSkill(false);
      setSelectedSkillSource(null);
      return;
    }
    const loadSkillEditInfo = async () => {
      const folderName = getSkillFolderName(selectedSkill);
      try {
        const permissionResult =
          await SkillLockService.checkEditPermission(folderName);
        setCanEditSelectedSkill(permissionResult.canEdit);
        const skillEntry = await SkillLockService.getSkillEntry(folderName);
        if (skillEntry) {
          const [owner, repo] = skillEntry.source.split('/');
          setSelectedSkillSource({
            owner: owner || '',
            repo: repo || '',
            branch: skillEntry.branch || 'main',
          });
        } else {
          setSelectedSkillSource(null);
        }
      } catch (err) {
        console.error('[SkillsSurface] Failed to load skill edit info:', err);
        setCanEditSelectedSkill(false);
        setSelectedSkillSource(null);
      }
    };
    loadSkillEditInfo();
  }, [selectedSkill, isSkillInstalled, getSkillFolderName]);

  const handleInstallSkillToDirectories = useCallback(
    async (directoryIds: string[]) => {
      if (!selectedSkill || !githubRepoInfo || !browseFileTree) {
        throw new Error(
          'No skill selected, GitHub repo info missing, or file tree not loaded',
        );
      }
      const repoUrl = `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`;
      const skillFolderPath = selectedSkill.skillFolderPath;
      const fileList = browseFileTree.allFiles
        .filter((file) => file.relativePath.startsWith(skillFolderPath + '/'))
        .map((file) => file.relativePath);
      const skillFolderName = getSkillFolderName(selectedSkill);
      for (const directoryId of directoryIds) {
        const destination: SkillDestination =
          DIRECTORY_ID_TO_DESTINATION[directoryId];
        if (!destination) {
          throw new Error(
            `Invalid directory ID: ${directoryId}. No destination mapping found.`,
          );
        }
        const skillTreeSha = getSkillTreeSha(selectedSkill.skillFolderPath);
        const result = await GithubService.installSkill({
          githubUrl: repoUrl,
          skillPath: selectedSkill.skillFolderPath,
          destination,
          skillName: skillFolderName,
          fileList,
          skillTreeSha,
        });
        if (!result.success) {
          throw new Error(result.error || `Installation to ${directoryId} failed`);
        }
        actions.notifyPanels?.({
          type: 'skill:installed',
          source: 'SkillsSurface',
          timestamp: Date.now(),
          payload: {
            skillName: skillFolderName,
            destination,
            installedPath: result.installedPath,
          },
        });
      }
      await loadInstalledSkills();
    },
    [
      selectedSkill,
      githubRepoInfo,
      browseFileTree,
      actions,
      loadInstalledSkills,
      getSkillFolderName,
      getSkillTreeSha,
    ],
  );

  const handleUninstallSkillFromDirectories = useCallback(
    async (directoryIds: string[]) => {
      if (!selectedSkill) {
        throw new Error('No skill selected');
      }
      const skillFolderName = getSkillFolderName(selectedSkill);
      const deletedPaths: Array<{ skillPath: string; directoryId: string }> = [];
      for (const directoryId of directoryIds) {
        const directory = detectedDirectories.find(
          (dir) => dir.id === directoryId,
        );
        if (!directory) {
          console.warn(`[SkillsSurface] Directory not found: ${directoryId}`);
          continue;
        }
        const skillPath = `${directory.path}/${skillFolderName}`;
        const result = await FileSystemService.deleteSkill(skillPath);
        if (!result.success) {
          throw new Error(
            result.error || `Uninstallation from ${directoryId} failed`,
          );
        }
        deletedPaths.push({ skillPath, directoryId });
      }
      await loadInstalledSkills();
      for (const { skillPath, directoryId } of deletedPaths) {
        actions.notifyPanels?.({
          type: 'skill:uninstalled',
          source: 'SkillsSurface',
          timestamp: Date.now(),
          payload: { skillName: skillFolderName, skillPath, directoryId },
        });
      }
    },
    [
      selectedSkill,
      detectedDirectories,
      loadInstalledSkills,
      actions,
      getSkillFolderName,
    ],
  );

  const clearRepo = useCallback(() => {
    setBrowseFileTree(null);
    setGithubRepoInfo(null);
    actions.setFileTree(null);
  }, [actions]);

  const onOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    getConfig();
  }, [getConfig]);

  const value = useMemo<SkillsSurfaceValue>(
    () => ({
      context,
      actions,
      events,
      checkingConfig,
      showOnboarding,
      setShowOnboarding,
      onOnboardingComplete,
      viewMode,
      setViewMode,
      githubRepoInfo,
      clearRepo,
      browseFileTree,
      recentRepos,
      githubUrl,
      setGithubUrl,
      handleFetchSkills,
      handleSelectRecentRepo,
      isLoading,
      error,
      detectedDirectories,
      openSetup: () => setShowSetupModal(true),
      selectedSkill,
      selectedSkillMetadata,
      setSelectedSkillMetadata,
      isSkillInstalled,
      getSkillInstalledDirectories,
      getSkillTreeSha,
      getInstalledSkillMetadata,
      handleInstallSkillToDirectories,
      handleUninstallSkillFromDirectories,
      openInstallModal: () => setShowInstallModal(true),
    }),
    [
      context,
      actions,
      events,
      checkingConfig,
      showOnboarding,
      onOnboardingComplete,
      viewMode,
      githubRepoInfo,
      clearRepo,
      browseFileTree,
      recentRepos,
      githubUrl,
      handleFetchSkills,
      handleSelectRecentRepo,
      isLoading,
      error,
      detectedDirectories,
      selectedSkill,
      selectedSkillMetadata,
      isSkillInstalled,
      getSkillInstalledDirectories,
      getSkillTreeSha,
      getInstalledSkillMetadata,
      handleInstallSkillToDirectories,
      handleUninstallSkillFromDirectories,
    ],
  );

  return (
    <SkillsSurfaceContext.Provider value={value}>
      {children}

      {/* Agent Setup Modal */}
      <AgentSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSetup={handleCreateAgentDirectories}
        existingDirectoryIds={detectedDirectories.map((dir) => dir.id)}
        detectedDirectories={detectedDirectories}
        onRemove={handleRemoveAgentDirectory}
      />

      {/* Skill Installation Modal */}
      {selectedSkill && (
        <SkillInstallationModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          skillName={selectedSkill.name}
          detectedDirectories={detectedDirectories}
          installedDirectories={getSkillInstalledDirectories(selectedSkill)}
          onInstall={handleInstallSkillToDirectories}
          onUninstall={handleUninstallSkillFromDirectories}
        />
      )}

      {/* Skill Editor Modal */}
      {selectedSkill && selectedSkillSource && (
        <SkillEditorModal
          isOpen={showEditorModal}
          onClose={() => setShowEditorModal(false)}
          skillName={getSkillFolderName(selectedSkill)}
          skillSource={selectedSkillSource}
        />
      )}
    </SkillsSurfaceContext.Provider>
  );
};

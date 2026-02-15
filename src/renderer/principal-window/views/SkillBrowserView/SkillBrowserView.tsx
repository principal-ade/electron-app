import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { panels as agentPanels, type Skill, SkillsBrowsePanel, GlobalSkillsPanel, type SkillDetailPanelProps } from '@industry-theme/agent-panels';
import type { PanelComponentProps } from '@principal-ade/panel-framework-core';
import {
  SkillBrowserPanelProvider,
  useSkillBrowserPanelProvider,
} from './SkillBrowserPanelProvider';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { SkillBrowserViewHeader, type ViewMode, type DetectedDirectory } from './SkillBrowserViewHeader';
import { type SkillDestination, DIRECTORY_ID_TO_DESTINATION } from './InstallSkillToolbar';
import { GithubService } from '../../../main-process-api/GithubService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { useSkillsSync } from '../../../hooks/useSkillsSync';
import { SkillsRepoOnboarding } from './SkillsRepoOnboarding';
import { RecentSkillsPanel, type RecentRepo } from './RecentSkillsPanel';
import { RecentReposService } from '../../../main-process-api/RecentReposService';
import { AgentSetupModal } from './AgentSetupModal';
import { SkillInstallationModal } from './SkillInstallationModal';

// Extract panel components from agent-panels package
const SkillDetailPanelComponent = agentPanels.find(
  (p) => p.metadata?.id === 'industry-theme.skill-detail',
)?.component as React.FC<SkillDetailPanelProps> | undefined;

/**
 * Inner content component that uses the panel context
 */
const SkillBrowserViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useSkillBrowserPanelProvider();
  const { isConfigured, config, getConfig } = useSkillsSync();

  // State for onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // State for view mode
  const [viewMode, setViewMode] = useState<ViewMode>('installed');

  // Separate state for each mode's file tree
  const [browseFileTree, setBrowseFileTree] = useState<FileTree | null>(null);
  const [installedFileTree, setInstalledFileTree] = useState<FileTree | null>(null);

  // State for installed skills data (needed for LocalSkillsFileSystemAdapter)
  const [installedSkillsData, setInstalledSkillsData] = useState<Array<{ path: string; name: string; source: string }>>([]);

  // State for detected skill directories
  const [detectedDirectories, setDetectedDirectories] = useState<DetectedDirectory[]>([]);

  // State for recent repos
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);

  // State for GitHub URL and loading
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [githubRepoInfo, setGithubRepoInfo] = useState<{
    owner: string;
    repo: string;
    branch: string;
    treeSha?: string; // SHA of the root tree
    treeData?: Array<{ path: string; type: string; sha: string }>; // Raw tree data for extracting skill-specific SHAs
  } | null>(null);

  // State for selected skill metadata
  const [selectedSkillMetadata, setSelectedSkillMetadata] = useState<{
    sha: string;
    installedAt: string;
    installedFrom: string;
  } | null>(null);

  // State for agent setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);

  // State for skill installation modal
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Check if sync is configured on mount
  useEffect(() => {
    const checkConfig = async () => {
      await getConfig();
      setCheckingConfig(false);
      // Don't auto-show onboarding - users should click "Enable Sync" button
    };
    checkConfig();
  }, []);

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

  /**
   * Parse GitHub URL to extract owner, repo, and optional path
   * Supports formats:
   * - https://github.com/owner/repo
   * - https://github.com/owner/repo/tree/branch/path/to/skills
   * - owner/repo
   */
  const parseGithubUrl = useCallback((url: string) => {
    const trimmed = url.trim();

    // Handle simple owner/repo format
    if (!trimmed.includes('/') || !trimmed.includes('.')) {
      const parts = trimmed.split('/');
      if (parts.length === 2) {
        return { owner: parts[0], repo: parts[1], branch: 'main', path: '' };
      }
    }

    // Handle full GitHub URLs
    const githubUrlPattern =
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+)(.*))?/;
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

  /**
   * Convert local installed skills to FileTree format
   */
  const convertLocalSkillsToFileTree = useCallback(
    (skills: Array<{ path: string; name: string; source: string }>) => {
      // Build file paths from skill directories
      // For each skill, we'll add the skill directory and a SKILL.md file
      const filePaths: string[] = [];

      for (const skill of skills) {
        // Add a virtual path for each skill: source/skill-name/SKILL.md
        filePaths.push(`${skill.source}/${skill.name}/SKILL.md`);
      }

      console.log('[SkillBrowserView] Building FileTree from local skills:', {
        totalSkills: skills.length,
        filePaths: filePaths.length,
      });

      // Use PathsFileTreeBuilder to construct the FileTree
      const builder = new PathsFileTreeBuilder();
      const builtTree = builder.build({
        files: filePaths,
        rootPath: '/installed-skills',
      });

      // Override metadata with local-specific info
      // Use timestamp as SHA to ensure uniqueness on each load
      const uniqueSha = `local-${Date.now()}-${skills.length}`;
      const fileTreeData: FileTree = {
        ...builtTree,
        sha: uniqueSha, // Update root SHA to trigger reload
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

      console.log('[SkillBrowserView] FileTree built for installed skills:', {
        totalFiles: fileTreeData.stats.totalFiles,
        totalDirectories: fileTreeData.stats.totalDirectories,
      });

      return fileTreeData;
    },
    [],
  );

  // Load installed skills from local directories
  const loadInstalledSkills = useCallback(async () => {
    try {
      console.log('[SkillBrowserView] Loading installed skills...');

      const result = await FileSystemService.getAllLocalSkills();

      if (!result || !result.skills || result.skills.length === 0) {
        console.log('[SkillBrowserView] No installed skills found');
        setInstalledFileTree(null);
        setInstalledSkillsData([]);
        if (viewMode === 'installed') {
          actions.setFileTree(null);
        }
        return;
      }

      console.log(`[SkillBrowserView] Found ${result.skills.length} installed skills`);

      // Store the raw skills data (needed for LocalSkillsFileSystemAdapter)
      setInstalledSkillsData(result.skills);

      // Convert to FileTree format
      const fileTree = convertLocalSkillsToFileTree(result.skills);

      // Store in installed file tree state
      setInstalledFileTree(fileTree);

      // Only update context if we're in installed mode
      if (viewMode === 'installed') {
        actions.setFileTree(fileTree);
      }
    } catch (err) {
      console.error('[SkillBrowserView] Failed to load installed skills:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load installed skills',
      );
    }
  }, [convertLocalSkillsToFileTree, actions, viewMode]);

  const loadDetectedDirectories = useCallback(async () => {
    try {
      const detected = await FileSystemService.detectPresetDirectories();
      // Map to DetectedDirectory, providing default icon if missing
      const mappedDirectories: DetectedDirectory[] = (detected || []).map(dir => ({
        ...dir,
        icon: dir.icon || 'folder',
      }));
      setDetectedDirectories(mappedDirectories);
    } catch (err) {
      console.error('[SkillBrowserView] Failed to detect directories:', err);
    }
  }, []);

  const loadRecentRepos = useCallback(async () => {
    try {
      const repos = await RecentReposService.getRecentRepos();
      setRecentRepos(repos || []);
    } catch (err) {
      console.error('[SkillBrowserView] Failed to load recent repos:', err);
    }
  }, []);

  /**
   * Handle creating agent directories from the setup modal
   */
  const handleCreateAgentDirectories = useCallback(async (agentIds: string[]) => {
    try {
      console.log('[SkillBrowserView] Creating agent directories:', agentIds);
      const result = await FileSystemService.createAgentDirectories(agentIds);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create directories');
      }

      console.log('[SkillBrowserView] Directories created:', result.createdDirectories);

      // Refresh detected directories and installed skills
      await loadDetectedDirectories();
      await loadInstalledSkills();
    } catch (err) {
      console.error('[SkillBrowserView] Failed to create directories:', err);
      throw err; // Re-throw to let modal handle error display
    }
  }, [loadDetectedDirectories, loadInstalledSkills]);

  /**
   * Handle removing agent directory from the setup modal
   */
  const handleRemoveAgentDirectory = useCallback(async (agentId: string) => {
    try {
      console.log('[SkillBrowserView] Removing agent directory:', agentId);
      const result = await FileSystemService.deleteAgentDirectory(agentId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove directory');
      }

      console.log('[SkillBrowserView] Directory removed successfully');

      // Refresh detected directories and installed skills
      await loadDetectedDirectories();
      await loadInstalledSkills();
    } catch (err) {
      console.error('[SkillBrowserView] Failed to remove directory:', err);
      throw err; // Re-throw to let modal handle error display
    }
  }, [loadDetectedDirectories, loadInstalledSkills]);

  /**
   * Convert GitHub tree to FileTree format using PathsFileTreeBuilder
   */
  // Listen for skill selection events
  useEffect(() => {
    const unsubscribe = events.on('skill:selected', (event) => {
      const payload = event.payload as { skill: Skill } | undefined;
      if (payload?.skill) {
        console.log('[SkillBrowserView] Skill selected:', {
          skillId: payload.skill.id,
          skillName: payload.skill.name,
          skillPath: payload.skill.path,
          skillFolderPath: payload.skill.skillFolderPath,
          hasScripts: payload.skill.hasScripts,
          hasReferences: payload.skill.hasReferences,
          hasAssets: payload.skill.hasAssets,
        });

        // Store the full skill object with all file structure information
        setSelectedSkill(payload.skill);
      }
    });

    return unsubscribe;
  }, [events]);

  // Listen for skill installation events to refresh installed skills
  useEffect(() => {
    const unsubscribe = events.on('skill:installed', (_event) => {
      console.log('[SkillBrowserView] Skill installed, refreshing installed skills');
      // Reload installed skills after a skill is installed
      loadInstalledSkills();
    });

    return unsubscribe;
  }, [events, loadInstalledSkills]);

  // Switch file tree when view mode changes
  useEffect(() => {
    if (viewMode === 'browse') {
      // Switch to browse tree (if available)
      if (browseFileTree) {
        console.log('[SkillBrowserView] Switching to browse mode tree');
        actions.setFileTree(browseFileTree);
      } else {
        // Clear the tree if no browse data loaded yet
        console.log('[SkillBrowserView] Browse mode - no tree loaded yet, clearing');
        actions.setFileTree(null);
      }
    } else {
      // Switch to installed tree (if available)
      if (installedFileTree) {
        console.log('[SkillBrowserView] Switching to installed mode tree');
        actions.setFileTree(installedFileTree);
      } else {
        console.log('[SkillBrowserView] Installed mode - clearing browse tree and loading local skills');
        // Clear the browse tree from view
        actions.setFileTree(null);
        // Load local skills if not already loaded
        loadInstalledSkills();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Load detected directories, recent repos, and installed skills on mount
  useEffect(() => {
    loadDetectedDirectories();
    loadRecentRepos();
    loadInstalledSkills();
  }, [loadInstalledSkills]);

  // Listen for refresh requests from SkillsListPanel
  useEffect(() => {
    const unsubscribe = events.on('skills:refresh', () => {
      console.log('[SkillBrowserView] Received skills refresh request, reloading installed skills from filesystem');
      loadInstalledSkills();
    });

    return unsubscribe;
  }, [events, loadInstalledSkills]);

  // Auto-refresh installed skills when view becomes visible (helps catch new skills)
  useEffect(() => {
    if (viewMode !== 'installed') return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[SkillBrowserView] Document became visible, refreshing installed skills');
        loadInstalledSkills();
      }
    };

    const handleFocus = () => {
      console.log('[SkillBrowserView] Window focused, refreshing installed skills');
      loadInstalledSkills();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [viewMode, loadInstalledSkills]);

  const convertGithubTreeToFileTree = useCallback(
    (
      treeItems: Array<{
        path: string;
        type: 'blob' | 'tree';
        size?: number;
      }>,
      parsed: {
        owner: string;
        repo: string;
        branch: string;
        path?: string;
      },
    ): FileTree => {
      // Extract file paths from GitHub tree (blobs only, not directories)
      const filePaths = treeItems
        .filter((item) => item.type === 'blob')
        .map((item) => item.path);

      console.log('[SkillBrowserView] Building FileTree from paths:', {
        totalPaths: filePaths.length,
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
      });

      // Use PathsFileTreeBuilder to construct the FileTree
      // This handles all the complexity: allFiles array, metadata, stats, etc.
      const builder = new PathsFileTreeBuilder();
      const builtTree = builder.build({
        files: filePaths,
        rootPath: `/${parsed.owner}/${parsed.repo}`,
      });

      // Override metadata with GitHub-specific info
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

      console.log('[SkillBrowserView] FileTree built:', {
        totalFiles: fileTreeData.stats.totalFiles,
        totalDirectories: fileTreeData.stats.totalDirectories,
        allFilesLength: fileTreeData.allFiles.length,
        hasMetadata: !!fileTreeData.metadata,
      });

      return fileTreeData;
    },
    [],
  );

  /**
   * Fetch skills from GitHub repository
   */
  const handleFetchSkills = useCallback(async (url?: string) => {
    // Use provided URL or fall back to state
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
      // Store GitHub repo info for installation
      setGithubRepoInfo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
      });

      // Set GitHub repository info in the context
      // This will create the GitHub adapter
      actions.setGitHubRepository({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
      });

      // Fetch the repository tree
      const result = await GithubService.getTree(
        parsed.owner,
        parsed.repo,
        parsed.branch,
      );

      if (!result?.success || !result.data) {
        setError('Failed to fetch repository tree');
        return;
      }

      // Update GitHub repo info with tree SHA and raw tree data
      setGithubRepoInfo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        treeSha: result.data.sha,
        treeData: result.data.tree,
      });

      // Convert to FileTree format
      const fileTree = convertGithubTreeToFileTree(
        result.data.tree,
        parsed,
      );

      // Store in browse file tree state (not directly in context)
      console.log('[SkillBrowserView] File tree fetched for browse mode:', fileTree);
      setBrowseFileTree(fileTree);

      // Only update context if we're in browse mode
      if (viewMode === 'browse') {
        actions.setFileTree(fileTree);
      }

      // Save to recent repos
      try {
        await RecentReposService.addRecentRepo({
          url: urlToUse,
          owner: parsed.owner,
          repo: parsed.repo,
          branch: parsed.branch,
        });
        // Reload recent repos to update the list
        await loadRecentRepos();
      } catch (err) {
        console.error('[SkillBrowserView] Failed to save recent repo:', err);
      }
    } catch (err) {
      console.error('[SkillBrowserView] Failed to fetch skills:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch repository',
      );
    } finally {
      setIsLoading(false);
    }
  }, [githubUrl, parseGithubUrl, convertGithubTreeToFileTree, actions, viewMode, loadRecentRepos]);

  /**
   * Handle selecting a recent repository
   */
  const handleSelectRecentRepo = useCallback(async (repo: RecentRepo) => {
    console.log('[SkillBrowserView] Selected recent repo:', repo);
    // Set the GitHub URL
    setGithubUrl(repo.url);
    // Fetch the skills for this repo
    await handleFetchSkills(repo.url);
  }, [handleFetchSkills]);

  /**
   * Extract folder name from skill folder path
   * Examples:
   * - "skills/code-review" → "code-review"
   * - "/Users/me/.agents/skills/code-review" → "code-review"
   */
  const getSkillFolderName = useCallback((skill: Skill): string => {
    // skill.name has hyphens/underscores replaced with spaces for display
    // We need the actual folder name from skillFolderPath
    const folderPath = skill.skillFolderPath || skill.path;
    const parts = folderPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || skill.name;
  }, []);

  /**
   * Get the tree SHA for a specific skill folder from the GitHub tree data
   */
  const getSkillTreeSha = useCallback((skillFolderPath: string): string | undefined => {
    if (!githubRepoInfo?.treeData) return undefined;

    // Normalize the path to match GitHub tree format (remove leading/trailing slashes)
    const normalizedPath = skillFolderPath.replace(/^\/+|\/+$/g, '');

    // Find the tree entry that matches this skill's folder path
    const treeEntry = githubRepoInfo.treeData.find(
      (entry) => entry.path === normalizedPath && entry.type === 'tree'
    );

    return treeEntry?.sha;
  }, [githubRepoInfo]);

  /**
   * Check if a skill is already installed
   */
  const isSkillInstalled = useCallback(
    (skill: Skill): boolean => {
      // Use folder name for comparison with installed skills
      const folderName = getSkillFolderName(skill);
      return installedSkillsData.some((installedSkill) =>
        installedSkill.name === folderName
      );
    },
    [installedSkillsData, getSkillFolderName],
  );

  /**
   * Get which directories a skill is installed in
   */
  const getSkillInstalledDirectories = useCallback(
    (skill: Skill): string[] => {
      // Use folder name for comparison with installed skills
      const folderName = getSkillFolderName(skill);
      const skillInstances = installedSkillsData.filter((installedSkill) =>
        installedSkill.name === folderName
      );

      // Map each instance to its directory ID
      const directoryIds: string[] = [];

      for (const installedSkill of skillInstances) {
        // Find which detected directory this skill path belongs to
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

  /**
   * Get metadata for an installed skill from the lock file
   */
  const getInstalledSkillMetadata = useCallback(
    async (skill: Skill): Promise<{ sha: string; installedAt: string; installedFrom: string } | null> => {
      try {
        // Read from centralized lock file instead of per-skill .metadata.json
        // Use folder name (not display name with spaces)
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
      } catch (error) {
        console.error(`[SkillBrowserView] Failed to read skill from lock file:`, error);
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

  /**
   * Install skill to selected destination
   */
  const _handleInstallSkill = useCallback(
    async (destination: SkillDestination) => {
      if (!selectedSkill || !githubRepoInfo || !browseFileTree) {
        throw new Error('No skill selected, GitHub repo info missing, or file tree not loaded');
      }

      const githubUrl = `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`;

      // Build complete file list for the skill from the file tree
      const skillFolderPath = selectedSkill.skillFolderPath;
      const fileList = browseFileTree.allFiles
        .filter(file => file.relativePath.startsWith(skillFolderPath + '/'))
        .map(file => file.relativePath);

      // Use folder name (with hyphens) not display name (with spaces) for installation
      const skillFolderName = getSkillFolderName(selectedSkill);

      console.log('[SkillBrowserView] Installing skill:', {
        skillName: skillFolderName,
        skillPath: selectedSkill.skillFolderPath,
        destination,
        githubUrl,
        fileCount: fileList.length,
      });

      const skillTreeSha = getSkillTreeSha(selectedSkill.skillFolderPath);

      const result = await GithubService.installSkill({
        githubUrl,
        skillPath: selectedSkill.skillFolderPath,
        destination,
        skillName: skillFolderName,
        fileList, // Pass the complete file list
        skillTreeSha, // Pass the skill-specific tree SHA
      });

      if (!result.success) {
        throw new Error(result.error || 'Installation failed');
      }

      console.log('[SkillBrowserView] Skill installed successfully:', result);

      // Emit event to refresh global skills cache
      actions.notifyPanels?.({
        type: 'skill:installed',
        source: 'SkillBrowserView',
        timestamp: Date.now(),
        payload: {
          skillName: skillFolderName,
          destination,
          installedPath: result.installedPath,
        },
      });
    },
    [selectedSkill, githubRepoInfo, browseFileTree, actions, getSkillFolderName],
  );

  /**
   * Install skill to multiple directories
   */
  const handleInstallSkillToDirectories = useCallback(
    async (directoryIds: string[]) => {
      if (!selectedSkill || !githubRepoInfo || !browseFileTree) {
        throw new Error('No skill selected, GitHub repo info missing, or file tree not loaded');
      }

      const githubUrl = `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`;

      // Build complete file list for the skill from the file tree
      // The skill folder contains all files under skillFolderPath
      const skillFolderPath = selectedSkill.skillFolderPath;
      const fileList = browseFileTree.allFiles
        .filter(file => file.relativePath.startsWith(skillFolderPath + '/'))
        .map(file => file.relativePath);

      // Use folder name (with hyphens) not display name (with spaces) for installation
      const skillFolderName = getSkillFolderName(selectedSkill);

      console.log('[SkillBrowserView] Building file list for skill installation:', {
        skillName: skillFolderName,
        skillFolderPath,
        totalFiles: fileList.length,
        files: fileList,
      });

      // Install to each directory
      for (const directoryId of directoryIds) {
        // Map directory ID to destination
        const destination = DIRECTORY_ID_TO_DESTINATION[directoryId];
        if (!destination) {
          throw new Error(`Invalid directory ID: ${directoryId}. No destination mapping found.`);
        }

        console.log('[SkillBrowserView] Installing skill to directory:', {
          skillName: skillFolderName,
          skillPath: selectedSkill.skillFolderPath,
          directoryId,
          destination,
          githubUrl,
          fileCount: fileList.length,
        });

        const skillTreeSha = getSkillTreeSha(selectedSkill.skillFolderPath);

        const result = await GithubService.installSkill({
          githubUrl,
          skillPath: selectedSkill.skillFolderPath,
          destination,
          skillName: skillFolderName,
          fileList, // Pass the complete file list
          skillTreeSha, // Pass the skill-specific tree SHA
        });

        if (!result.success) {
          throw new Error(result.error || `Installation to ${directoryId} failed`);
        }

        console.log('[SkillBrowserView] Skill installed successfully to:', {
          directoryId,
          destination,
          installedPath: result.installedPath,
        });

        // Emit event to refresh global skills cache
        actions.notifyPanels?.({
          type: 'skill:installed',
          source: 'SkillBrowserView',
          timestamp: Date.now(),
          payload: {
            skillName: skillFolderName,
            destination,
            installedPath: result.installedPath,
          },
        });
      }

      // Refresh installed skills
      await loadInstalledSkills();
    },
    [selectedSkill, githubRepoInfo, browseFileTree, actions, loadInstalledSkills, getSkillFolderName],
  );

  /**
   * Uninstall skill from specific directories
   */
  const handleUninstallSkillFromDirectories = useCallback(
    async (directoryIds: string[]) => {
      if (!selectedSkill) {
        throw new Error('No skill selected');
      }

      // Use folder name (with hyphens) for the actual path construction
      const skillFolderName = getSkillFolderName(selectedSkill);

      console.log('[handleUninstallSkillFromDirectories] Uninstalling skill:', {
        displayName: selectedSkill.name,
        folderName: skillFolderName,
        fromDirectories: directoryIds,
      });

      // Track deleted paths for event emission
      const deletedPaths: Array<{ skillPath: string; directoryId: string }> = [];

      // For each directory, construct the expected skill path and delete it
      for (const directoryId of directoryIds) {
        // Find the directory's base path
        const directory = detectedDirectories.find((dir) => dir.id === directoryId);
        if (!directory) {
          console.warn(`[handleUninstallSkillFromDirectories] Directory not found: ${directoryId}`);
          continue;
        }

        // Construct the full path to the skill in this directory
        const skillPath = `${directory.path}/${skillFolderName}`;

        console.log('[handleUninstallSkillFromDirectories] Deleting skill at:', {
          directoryId,
          directoryPath: directory.path,
          skillPath,
        });

        const result = await FileSystemService.deleteSkill(skillPath);

        if (!result.success) {
          throw new Error(result.error || `Uninstallation from ${directoryId} failed`);
        }

        console.log('[handleUninstallSkillFromDirectories] Skill uninstalled successfully from:', directoryId);
        deletedPaths.push({ skillPath, directoryId });
      }

      // Refresh installed skills BEFORE emitting events
      await loadInstalledSkills();

      // Now emit events so panels refresh with the updated data
      for (const { skillPath, directoryId } of deletedPaths) {
        actions.notifyPanels?.({
          type: 'skill:uninstalled',
          source: 'SkillBrowserView',
          timestamp: Date.now(),
          payload: {
            skillName: skillFolderName,
            skillPath,
            directoryId,
          },
        });
      }
    },
    [selectedSkill, detectedDirectories, loadInstalledSkills, actions, getSkillFolderName],
  );

  // Use panel persistence for two-panel layout
  const panelState = usePanelPersistence({
    viewKey: 'skillBrowserView',
    defaultSizes: { left: 30, right: 70 },
    collapsed: { left: false, right: false },
    panelType: 'two-panel',
  });

  // Define panels using agent-panels components
  const panels = useMemo(() => {
    // Show recent panel when in browse mode and no file tree loaded
    if (viewMode === 'browse' && !browseFileTree) {
      return [
        {
          id: 'recent-repos',
          label: 'Recent',
          content: (
            <RecentSkillsPanel
              recentRepos={recentRepos}
              onSelectRepo={handleSelectRecentRepo}
              githubUrl={githubUrl}
              onGithubUrlChange={setGithubUrl}
              onFetchSkills={handleFetchSkills}
              isLoading={isLoading}
            />
          ),
        },
      ];
    }

    if (!SkillDetailPanelComponent) {
      return [];
    }

    const skillsPanelLabel = viewMode === 'browse' ? 'Browse Skills' : 'Installed Skills';

    return [
      {
        id: 'skills-list',
        label: skillsPanelLabel,
        content:
          viewMode === 'browse' ? (
            <SkillsBrowsePanel
              context={context}
              actions={actions}
              events={events}
            />
          ) : (
            <GlobalSkillsPanel
              context={context}
              actions={actions}
              events={events}
            />
          ),
      },
      {
        id: 'skill-detail',
        label: 'Skill Detail',
        content: SkillDetailPanelComponent ? (
          <SkillDetailPanelComponent
            context={context}
            actions={actions}
            events={events}
            installConfig={selectedSkill ? {
              isInstalled: isSkillInstalled(selectedSkill),
              hasUpdate: (() => {
                // Check if update is available by comparing skill-specific SHAs
                if (!isSkillInstalled(selectedSkill)) return false;
                const currentSkillSha = getSkillTreeSha(selectedSkill.skillFolderPath);
                if (!selectedSkillMetadata?.sha || !currentSkillSha) return false;
                return selectedSkillMetadata.sha !== currentSkillSha;
              })(),
              installedDirectoryIds: getSkillInstalledDirectories(selectedSkill),
              githubSource: githubRepoInfo ? {
                owner: githubRepoInfo.owner,
                repo: githubRepoInfo.repo,
                branch: githubRepoInfo.branch,
                skillPath: selectedSkill.path,
                currentSha: getSkillTreeSha(selectedSkill.skillFolderPath),
              } : undefined,
              onInstall: () => {
                // Check if this is an update (skill is already installed)
                if (isSkillInstalled(selectedSkill)) {
                  const installedDirs = getSkillInstalledDirectories(selectedSkill);
                  if (installedDirs.length > 0) {
                    // Directly update to already-installed directories
                    handleInstallSkillToDirectories(installedDirs).then(async () => {
                      // Refresh metadata after update
                      const metadata = await getInstalledSkillMetadata(selectedSkill);
                      setSelectedSkillMetadata(metadata);
                    }).catch((err) => {
                      console.error('[SkillBrowserView] Update failed:', err);
                      alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    });
                    return;
                  }
                }
                // For new installations, show the modal
                setShowInstallModal(true);
              },
              onUninstall: isSkillInstalled(selectedSkill) ? () => {
                const installedDirs = getSkillInstalledDirectories(selectedSkill);
                if (installedDirs.length > 0) {
                  const dirNames = installedDirs.map(id => {
                    const dir = detectedDirectories.find(d => d.id === id);
                    return dir?.displayName || id;
                  }).join(', ');
                  if (window.confirm(`Uninstall "${selectedSkill.name}" from: ${dirNames}?`)) {
                    handleUninstallSkillFromDirectories(installedDirs);
                  }
                }
              } : undefined,
            } : undefined}
            hideEditButtons={viewMode === 'browse'}
          />
        ) : null,
      },
    ];
  }, [context, actions, events, selectedSkill, githubRepoInfo, isSkillInstalled, getSkillInstalledDirectories, getSkillTreeSha, viewMode, browseFileTree, recentRepos, handleSelectRecentRepo, detectedDirectories, githubUrl, handleFetchSkills, isLoading, selectedSkillMetadata, handleInstallSkillToDirectories, getInstalledSkillMetadata, setSelectedSkillMetadata]);

  // Define layout configuration (simple left/right split or single panel for recent)
  const layout = useMemo(() => {
    // Single panel for recent repos
    if (viewMode === 'browse' && !browseFileTree) {
      return {
        left: 'recent-repos',
        right: null,
      };
    }

    // Two-panel layout for skills
    return {
      left: 'skills-list',
      right: 'skill-detail',
    };
  }, [viewMode, browseFileTree]);

  // Show onboarding if not configured
  if (checkingConfig) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        Loading...
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <SkillsRepoOnboarding
        onComplete={() => {
          setShowOnboarding(false);
          // Refresh config
          getConfig();
        }}
        onCancel={() => {
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with view mode toggle */}
      <SkillBrowserViewHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentRepo={githubRepoInfo}
        onClearRepo={() => {
          setBrowseFileTree(null);
          setGithubRepoInfo(null);
          actions.setFileTree(null);
        }}
        hasDetectedDirectories={detectedDirectories.length > 0}
        onOpenSetup={() => setShowSetupModal(true)}
        detectedDirectories={detectedDirectories}
      />

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: theme.colors.error + '20',
            borderBottom: `1px solid ${theme.colors.error}`,
            color: theme.colors.error,
            fontSize: theme.fontSizes[1],
          }}
        >
          {error}
        </div>
      )}

      {/* Panel Layout */}
      {panels.length > 0 ? (
        // Show single panel directly when showing recent repos
        viewMode === 'browse' && !browseFileTree ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {panels[0].content}
          </div>
        ) : (
          <ConfigurablePanelLayout
            panels={panels}
            layout={layout}
            collapsiblePanels={{ left: false, right: false }}
            defaultSizes={
              panelState.type === 'two-panel'
                ? panelState.sizes
                : { left: 30, right: 70 }
            }
            minSizes={{ left: 30, right: 30 }}
            collapsed={
              panelState.type === 'two-panel'
                ? panelState.collapsed
                : { left: false, right: false }
            }
            style={{ flex: 1, width: '100%', minHeight: 0 }}
            theme={theme}
            showCollapseButtons={false}
            onPanelResize={
              panelState.type === 'two-panel'
                ? panelState.handlePanelResize
                : undefined
            }
            onLeftCollapseComplete={
              panelState.type === 'two-panel'
                ? panelState.handleLeftCollapseComplete
                : undefined
            }
            onLeftExpandComplete={
              panelState.type === 'two-panel'
                ? panelState.handleLeftExpandComplete
                : undefined
            }
            onRightCollapseComplete={
              panelState.type === 'three-panel'
                ? panelState.handleRightCollapseComplete
                : undefined
            }
            onRightExpandComplete={
              panelState.type === 'three-panel'
                ? panelState.handleRightExpandComplete
                : undefined
            }
          />
        )
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
          }}
        >
          Failed to load skill panels
        </div>
      )}

      {/* Agent Setup Modal */}
      <AgentSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSetup={handleCreateAgentDirectories}
        existingDirectoryIds={detectedDirectories.map(dir => dir.id)}
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
    </div>
  );
};

/**
 * SkillBrowserView - Browse and install skills from GitHub repositories
 *
 * Uses @industry-theme/agent-panels for skills display with the
 * ConfigurablePanelLayout for the two-panel layout.
 */
export const SkillBrowserView: React.FC = () => {
  // Create event bus for panel communication
  const events = useMemo(() => new PanelEventBus(), []);

  return (
    <SkillBrowserPanelProvider events={events}>
      <SkillBrowserViewContent />
    </SkillBrowserPanelProvider>
  );
};

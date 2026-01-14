import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { panels as agentPanels } from '@industry-theme/agent-panels';
import {
  SkillBrowserPanelProvider,
  useSkillBrowserPanelProvider,
} from './SkillBrowserPanelProvider';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { SkillBrowserViewHeader, type ViewMode } from './SkillBrowserViewHeader';
import { InstallSkillToolbar, type SkillDestination } from './InstallSkillToolbar';
import { GithubService } from '../../../main-process-api/GithubService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { FileTree } from '../../../contexts/RepositoryPanelContext';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { useSkillsSync } from '../../../hooks/useSkillsSync';
import { SkillsRepoOnboarding } from './SkillsRepoOnboarding';
import { RecentSkillsPanel, type RecentRepo } from './RecentSkillsPanel';
import { RecentReposService } from '../../../main-process-api/RecentReposService';
import { AgentSetupModal } from './AgentSetupModal';

// Extract panel components from agent-panels package
const SkillsListPanelComponent = agentPanels.find(
  (p) => p.metadata?.id === 'industry-theme.skills-list',
)?.component;
const SkillDetailPanelComponent = agentPanels.find(
  (p) => p.metadata?.id === 'industry-theme.skill-detail',
)?.component;

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
  const [detectedDirectories, setDetectedDirectories] = useState<Array<{
    id: string;
    path: string;
    displayName: string;
    skillCount: number;
    skills: string[];
  }>>([]);

  // State for recent repos
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);

  // State for GitHub URL and loading
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<{
    id: string;
    name: string;
    path: string;
  } | null>(null);
  const [githubRepoInfo, setGithubRepoInfo] = useState<{
    owner: string;
    repo: string;
    branch: string;
    treeSha?: string; // SHA of the current tree
  } | null>(null);

  // State for selected skill metadata
  const [selectedSkillMetadata, setSelectedSkillMetadata] = useState<{
    sha: string;
    installedAt: string;
    installedFrom: string;
  } | null>(null);

  // State for agent setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Check if sync is configured on mount
  useEffect(() => {
    const checkConfig = async () => {
      await getConfig();
      setCheckingConfig(false);
      // Don't auto-show onboarding - users should click "Enable Sync" button
    };
    checkConfig();
  }, []);

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
      const fileTreeData: FileTree = {
        ...builtTree,
        metadata: {
          ...builtTree.metadata,
          id: 'local:installed-skills',
          sourceType: 'local',
          sourceSha: Date.now().toString(), // Use timestamp as version
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
      setDetectedDirectories(detected || []);
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
      const payload = event.payload as { skillId?: string; skill?: any } | undefined;
      if (payload?.skill) {
        // skill.path is the SKILL.md file path (e.g., "skills/brand-guidelines/SKILL.md")
        // We need the folder path for installation (e.g., "skills/brand-guidelines")
        const skillPath = payload.skill.path || '';
        const folderPath = skillPath.endsWith('/SKILL.md')
          ? skillPath.substring(0, skillPath.length - '/SKILL.md'.length)
          : skillPath.substring(0, skillPath.lastIndexOf('/'));

        console.log('[SkillBrowserView] Skill selected:', {
          skillId: payload.skill.id,
          skillName: payload.skill.name,
          fullPath: skillPath,
          folderPath,
        });

        setSelectedSkill({
          id: payload.skill.id || payload.skillId || '',
          name: payload.skill.name || '',
          path: folderPath || skillPath,
        });
      } else if (payload?.skillId) {
        setSelectedSkill({
          id: payload.skillId,
          name: '',
          path: '',
        });
      }
    });

    return unsubscribe;
  }, [events]);

  // Listen for skill installation events to refresh installed skills
  useEffect(() => {
    const unsubscribe = events.on('skill:installed', (event) => {
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

      // Update GitHub repo info with tree SHA
      setGithubRepoInfo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        treeSha: result.data.sha,
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
   * Check if a skill is already installed
   */
  const isSkillInstalled = useCallback(
    (skillName: string): boolean => {
      // Check if the skill name exists in any of the installed skills
      return installedSkillsData.some((installedSkill) => installedSkill.name === skillName);
    },
    [installedSkillsData],
  );

  /**
   * Get metadata for an installed skill
   */
  const getInstalledSkillMetadata = useCallback(
    async (skillName: string): Promise<{ sha: string; installedAt: string; installedFrom: string } | null> => {
      // Find the installed skill
      const installedSkill = installedSkillsData.find((skill) => skill.name === skillName);
      if (!installedSkill) {
        return null;
      }

      try {
        // Read .metadata.json from the skill directory
        const metadataPath = `${installedSkill.path}/.metadata.json`;
        const metadataContent = await FileSystemService.readFile(metadataPath);
        const metadata = JSON.parse(metadataContent);

        return {
          sha: metadata.sha,
          installedAt: metadata.installedAt,
          installedFrom: metadata.installedFrom,
        };
      } catch (error) {
        console.error(`[SkillBrowserView] Failed to read metadata for ${skillName}:`, error);
        return null;
      }
    },
    [installedSkillsData],
  );

  // Load metadata when selected skill changes
  useEffect(() => {
    if (!selectedSkill) {
      setSelectedSkillMetadata(null);
      return;
    }

    const loadMetadata = async () => {
      if (isSkillInstalled(selectedSkill.name)) {
        const metadata = await getInstalledSkillMetadata(selectedSkill.name);
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
  const handleInstallSkill = useCallback(
    async (destination: SkillDestination) => {
      if (!selectedSkill || !githubRepoInfo) {
        throw new Error('No skill selected or GitHub repo info missing');
      }

      const githubUrl = `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`;

      console.log('[SkillBrowserView] Installing skill:', {
        skillName: selectedSkill.name,
        skillPath: selectedSkill.path,
        destination,
        githubUrl,
      });

      const result = await GithubService.installSkill({
        githubUrl,
        skillPath: selectedSkill.path,
        destination,
        skillName: selectedSkill.name,
      });

      if (!result.success) {
        throw new Error(result.error || 'Installation failed');
      }

      console.log('[SkillBrowserView] Skill installed successfully:', result);

      // Emit event to refresh global skills cache
      actions.notifyPanels({
        type: 'skill:installed',
        payload: {
          skillName: selectedSkill.name,
          destination,
          installedPath: result.installedPath,
        },
      });
    },
    [selectedSkill, githubRepoInfo, actions],
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

    if (!SkillsListPanelComponent || !SkillDetailPanelComponent) {
      return [];
    }

    return [
      {
        id: 'skills-list',
        label: 'Skills',
        content: (
          <SkillsListPanelComponent
            context={context}
            actions={actions}
            events={events}
            browseMode={true}
          />
        ),
      },
      {
        id: 'skill-detail',
        label: 'Skill Detail',
        content: (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Install Toolbar */}
            {selectedSkill && githubRepoInfo && (
              <InstallSkillToolbar
                skillName={selectedSkill.name}
                skillSource={{
                  owner: githubRepoInfo.owner,
                  repo: githubRepoInfo.repo,
                  branch: githubRepoInfo.branch,
                  skillPath: selectedSkill.path,
                  currentSha: githubRepoInfo.treeSha,
                }}
                isInstalled={isSkillInstalled(selectedSkill.name)}
                installedMetadata={selectedSkillMetadata || undefined}
                onInstall={handleInstallSkill}
                detectedDirectories={detectedDirectories}
              />
            )}

            {/* Skill Detail Panel */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SkillDetailPanelComponent
                context={context}
                actions={actions}
                events={events}
              />
            </div>
          </div>
        ),
      },
    ];
  }, [context, actions, events, selectedSkill, githubRepoInfo, handleInstallSkill, isSkillInstalled, viewMode, browseFileTree, recentRepos, handleSelectRecentRepo, detectedDirectories, githubUrl, handleFetchSkills, isLoading]);

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
      {/* Header with GitHub URL input */}
      <SkillBrowserViewHeader
        githubUrl={githubUrl}
        onGithubUrlChange={setGithubUrl}
        onFetchSkills={handleFetchSkills}
        isLoading={isLoading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showGithubInput={viewMode !== 'browse'}
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
              panelState.type === 'two-panel'
                ? panelState.handleRightCollapseComplete
                : undefined
            }
            onRightExpandComplete={
              panelState.type === 'two-panel'
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

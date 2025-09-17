import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import { parseGitHubUrl } from "@principal-ai/repository-abstraction";
import type { CityData, HighlightLayer } from "@principal-ai/code-city-react";
import { createFileColorHighlightLayers } from "@principal-ai/code-city-react";
import { PackageLayerModule, PackageLayer } from "@principal-ai/codebase-composition";
import { SourceFileSystemAdapter } from '../../adapters/SourceFileSystemAdapter';

import type { Repository } from '../../../shared/types/repository.types';
import { RepositoryViewType } from '../../../shared/types/userPreferences.types';
import { RepositoryManagerHeader } from './RepositoryManagerHeader';
import { LocalDevelopmentView } from './LocalDevelopmentView';
import { RepositoryExplorationView } from './RepositoryExplorationView';
import { RepositoryMaintenanceView } from './RepositoryMaintenanceView';
import { PlanningView } from './PlanningView';
import { FileChangeProvider } from '../../contexts/FileChangeContext';
import { GitChangesProvider } from '../../contexts/GitChangesContext';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { EventActivityType } from '../../../shared/sessionEnums';
import { GitService } from '../../main-process-api/GitService';
import { UIAgentSessionData, EnhancedUIAgentSessionData } from '../../types/session.types';
// import { DirectorySessions } from '../../../shared/main-process-api-interfaces/AgentSessionAPI'; // TODO: Remove if not needed
import { FileTree } from "@principal-ai/repository-abstraction";
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { FileTreeInvalidator } from '../../services/FileTreeInvalidator';
import { CityDataCacheService } from '../../services/CityDataCacheService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
import { SourceSelectionService } from '../../services/SourceSelectionService';
import { AgentConfigurationService } from '../../main-process-api/AgentConfigurationService';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { A24zService } from '../../main-process-api/A24zService';
import { RepositoryUIState } from '../../../shared/types/userPreferences.types';

// Window init data type for RepositoryManager
interface RepositoryManagerWindowData {
  windowInitData?: {
    mode?: ViewMode;
  };
}

import { loadManifestContents } from '../../utils/loadManifestContents';
import type { A24zNote } from '../../../shared/main-process-api-interfaces/A24zAPI';
import { GitHubWebAdapters } from '../../adapters/GitHubWebAdapters';
import { ElectronPlatformAdapters } from '../../adapters';

interface RepositoryManagerProps {
  repository: Repository;
  onBack?: () => void;
}

type ViewMode = RepositoryViewType;


export const RepositoryManager: React.FC<RepositoryManagerProps> = React.memo(({ repository }) => {
  const { theme } = useTheme();
  
  // Repository identifier for state persistence
  const repoKey = `${repository.owner}/${repository.name}`;
  
  
  // UI State management
  const [uiState, setUIState] = useState<RepositoryUIState>({});
  const [uiStateLoaded, setUIStateLoaded] = useState(false);
  const uiStateRef = useRef<RepositoryUIState>({});
  
  // Get initial mode from window data if available
  const initialMode = (window as Window & RepositoryManagerWindowData).windowInitData?.mode as ViewMode | undefined;
  
  // View mode state - initialize as null to indicate not yet loaded
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  
  // Search state - TODO: Move to floating search component in bottom-left corner
  const [searchQuery] = useState<string>(''); // setSearchQuery will be used when search is implemented
  
  // File tree services - shared across all views
  const fileTreeSourceService = useMemo(() => new FileTreeSourceService(), []);
  const cacheService = useMemo(() => new FileTreeCacheService(), []);
  const cityDataCache = useMemo(() => new CityDataCacheService(), []);
  const fileTreeInvalidator = useMemo(() => new FileTreeInvalidator(cacheService, cityDataCache), [cacheService, cityDataCache]);
  
  // File tree state - unified around selected source
  const [selectedSource, setSelectedSource] = useState<FileTreeSource | null>(null);
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  const [treeStats, setTreeStats] = useState<FileTreeStats | null>(null);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [packageLayers, setPackageLayers] = useState<PackageLayer[] | null>(null);
  const [filterLayers, setFilterLayers] = useState<any[] | null>(null);
  const [_loading, setLoading] = useState(true);
  const [_treeLoadError, setTreeLoadError] = useState<string | null>(null);
  // Note: _loading and _treeLoadError will be used in UI rendering once implemented
  
  // Cache for loaded trees to avoid re-fetching
  const treeCache = useMemo(() => new Map<string, { tree: FileTree; stats: FileTreeStats; filterLayers?: any[] }>(), []);
  
  // Create file color highlight layers from fileTree
  const fileColorHighlightLayers = useMemo(() => {
    if (!fileTree || !fileTree.allFiles) return [];
    const layers = createFileColorHighlightLayers(fileTree.allFiles);
    console.log('[RepositoryManager] Created file color highlight layers:', {
      layerCount: layers.length,
      totalFiles: fileTree.allFiles?.length || 0
    });
    return layers;
  }, [fileTree]);
  
  // Agent Sessions state - using proper UI types
  const [agentSessions, setAgentSessions] = useState<EnhancedUIAgentSessionData[]>([]);
  const [selectedAgentSessions, setSelectedAgentSessions] = useState<EnhancedUIAgentSessionData[]>([]);
  const [selectedAgentSessionIds, setSelectedAgentSessionIds] = useState<Set<string>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  
  // MCP Agent configuration state
  const [agentsWithMCP, setAgentsWithMCP] = useState<SupportedAgent[]>([]);
  const [loadingAgentMCPStatus, setLoadingAgentMCPStatus] = useState(true);
  
  // a24z memory state - loaded once and shared across all views
  const [a24zNotes, setA24zNotes] = useState<A24zNote[]>([]);
  const [, setLoadingA24zNotes] = useState(false); // loadingA24zNotes will be used for loading UI
  
  // Note: File tree sources and toggle logic removed - badges now launch windows

  // Parse repository info
  const repoInfo = useMemo(() => parseGitHubUrl(repository.remoteUrl), [repository.remoteUrl]);
  const ghOwner = repoInfo?.owner || repository.owner;
  const ghRepo = repoInfo?.repo || repository.name;
  
  // Check which agents have MCP configured (once on mount)
  useEffect(() => {
    const checkAgentMCPStatus = async () => {
      setLoadingAgentMCPStatus(true);
      const agentsWithMCPEnabled: SupportedAgent[] = [];
      
      try {
        // Check each supported agent for MCP configuration
        for (const agent of Object.values(SupportedAgent)) {
          const mcpStatus = await AgentConfigurationService.getAgentMCPStatus(agent);
          if (mcpStatus.success && mcpStatus.status?.hasMCP) {
            agentsWithMCPEnabled.push(agent);
          }
        }
        setAgentsWithMCP(agentsWithMCPEnabled);
        console.info('[RepositoryManager] Agents with MCP enabled:', agentsWithMCPEnabled);
      } catch (error) {
        console.error('[RepositoryManager] Failed to check agent MCP status:', error);
      } finally {
        setLoadingAgentMCPStatus(false);
      }
    };
    
    checkAgentMCPStatus();
  }, []); // Only run once on mount
  
  // Load a24z notes when source changes (only for local sources)
  useEffect(() => {
    const loadA24zNotes = async () => {
      // Only load for local sources
      if (selectedSource?.type !== 'local' || !selectedSource.location) {
        setA24zNotes([]);
        return;
      }
      
      setLoadingA24zNotes(true);
      try {
        console.info('[RepositoryManager] Loading a24z notes for:', selectedSource.location);
        const notes = await A24zService.getAllNotes(selectedSource.location);
        console.info('[RepositoryManager] Loaded a24z notes:', notes?.length || 0);
        setA24zNotes(notes || []);
      } catch (error) {
        console.error('[RepositoryManager] Failed to load a24z notes:', error);
        setA24zNotes([]);
      } finally {
        setLoadingA24zNotes(false);
      }
    };
    
    loadA24zNotes();
  }, [selectedSource]);
  
  // Load saved UI state for this repository
  useEffect(() => {
    console.info('[RepositoryManager] Load effect starting. Initial mode from window:', initialMode);
    
    const loadUIState = async () => {
      try {
        console.info('[RepositoryManager] Loading UI state for repo:', repoKey);
        const preferences = await UserPreferencesService.getPreferences();
        // Debug: All saved states - preferences.repositoryUIStates
        const savedState = preferences.repositoryUIStates?.[repoKey];
        
        console.info('[RepositoryManager] Found saved state for', repoKey, ':', savedState);
        console.info('[RepositoryManager] Initial mode from window:', initialMode);
        
        if (savedState) {
          setUIState(savedState);
        }
        
        // Determine the view mode to use
        let modeToUse: ViewMode = 'exploration'; // default
        
        // Priority 1: Window data (if provided)
        if (initialMode) {
          modeToUse = initialMode;
          console.info('[RepositoryManager] Using view mode from window data:', modeToUse);
        }
        // Priority 2: Saved state
        else if (savedState?.activeView) {
          modeToUse = savedState.activeView;
          console.info('[RepositoryManager] Restoring view mode from saved state:', modeToUse);
        }
        // Priority 3: Default
        else {
          console.info('[RepositoryManager] Using default view mode:', modeToUse);
        }
        
        setViewMode(modeToUse);
        
        setUIStateLoaded(true);
      } catch (error) {
        console.error('[RepositoryManager] Failed to load UI state:', error);
        setUIStateLoaded(true);
      }
    };
    
    loadUIState();
  }, [repoKey, initialMode]); // viewMode is logged for debugging only, not a dependency
  
  // Save UI state when it changes
  const saveUIState = useCallback(async (newState: RepositoryUIState) => {
    try {
      console.info('[RepositoryManager] Saving UI state for repo:', repoKey, newState);
      const preferences = await UserPreferencesService.getPreferences();
      const repositoryUIStates = preferences.repositoryUIStates || {};
      
      repositoryUIStates[repoKey] = {
        ...newState,
        lastAccessed: Date.now()
      };
      
      await UserPreferencesService.updatePreferences({ repositoryUIStates });
      console.info('[RepositoryManager] UI state saved successfully');
    } catch (error) {
      console.error('[RepositoryManager] Failed to save UI state:', error);
    }
  }, [repoKey]);
  
  // Keep ref in sync with state
  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);
  
  // Clear file tree cache on first load to prevent stale cached results
  useEffect(() => {
    console.log('🗑️ [RepositoryManager] Clearing file tree cache on first load to prevent stale data');
    cacheService.clearAll();
  }, []); // Empty deps = run only once on mount
  
  // Track if this is the initial load to prevent saving on restore
  const isInitialLoad = useRef(true);
  
  // Handle view mode changes and UI state updates together
  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    
    const newState = {
      ...uiStateRef.current,
      activeView: newMode,
      lastAccessed: Date.now()
    };
    
    // React 18 automatically batches these updates - no need for startTransition
    // Update both states synchronously for immediate response
    setViewMode(newMode);
    setUIState(newState);
    uiStateRef.current = newState;
    
    // Defer the save operation
    setTimeout(() => {
      const currentRepoKey = `${repository.owner}/${repository.name}`;
      UserPreferencesService.getPreferences()
        .then(preferences => {
          const repositoryUIStates = preferences.repositoryUIStates || {};
          repositoryUIStates[currentRepoKey] = newState;
          return UserPreferencesService.updatePreferences({ repositoryUIStates });
        })
        .then(() => {})
        .catch(error => {
          console.error('[RepositoryManager] Failed to save UI state:', error);
        });
    }, 0);
  }, [repository.owner, repository.name]);
  
  // Update UI state when view mode changes (only for tracking, not for mode changes from user)
  useEffect(() => {
    if (!uiStateLoaded || !viewMode) return;
    
    
    // Skip on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    // Note: We now handle state updates in handleViewModeChange to avoid double updates
  }, [viewMode, uiStateLoaded]); // Don't depend on uiState to avoid loops
  
  // Initialize selected source from repository
  useEffect(() => {
    const defaultSource = SourceSelectionService.getSelectedSource(repository);
    if (defaultSource) {
      setSelectedSource(defaultSource);
      // Initialize the file tree source service with this source
      fileTreeSourceService.initializeFromRepository(repository);
      fileTreeSourceService.setActiveSource(defaultSource.id);
    }
  }, [repository, fileTreeSourceService]);
  
  // Load file tree for selected source
  const loadTree = useCallback(async (forceReload = false) => {
    if (!selectedSource) {
      setLoading(false);
      return;
    }
    
    // Check memory cache first (unless forcing reload)
    if (!forceReload) {
      const cached = treeCache.get(selectedSource.id);
      if (cached) {
        setFileTree(cached.tree);
        setTreeStats(cached.stats);
        setFilterLayers(cached.filterLayers || null);
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      setTreeLoadError(null);
      
      console.log('[RepositoryManager] Loading tree for source:', selectedSource);
      
      // Load tree using cache service
      const result = await cacheService.loadFileTree(selectedSource);
      
      console.log('[RepositoryManager] Tree loaded result:', {
        sourceId: selectedSource.id,
        hasTree: !!result.tree,
        hasTreeStats: !!result.treeStats,
        treeFiles: result.tree?.allFiles?.length || 0,
        treeDirs: result.tree?.allDirectories?.length || 0,
        treeStats: result.treeStats,
        filterLayers: result.filterLayers?.length || 0,
        filters: result.filterLayers
      });
      
      // Update memory cache
      treeCache.set(selectedSource.id, {
        tree: result.tree,
        stats: result.treeStats,
        filterLayers: result.filterLayers
      });
      
      console.log('[RepositoryManager] Setting state:', {
        tree: !!result.tree,
        treeStats: result.treeStats,
        filterLayers: result.filterLayers?.length || 0
      });
      
      setFileTree(result.tree);
      setTreeStats(result.treeStats);
      setFilterLayers(result.filterLayers || null);
      
      // Build city data using cache service
      if (result.tree) {
        const city = await cityDataCache.buildCityData(
          selectedSource,
          result.tree,
          new Map(), // No additional trees for basic loading
          { width: 1200, height: 900 }
        );
        setCityData(city);
        
        // Discover packages for violation monitoring
        try {
          console.info('[RepositoryManager] Discovering packages...');
          
          // Check if packages are already cached
          const cached = cacheService.getAnalysis(selectedSource.id);
          if (cached?.packageLayers) {
            console.info('[RepositoryManager] Using cached packages:', cached.packageLayers.length);
            setPackageLayers(cached.packageLayers);
          } else {
            // Create source-aware filesystem adapter
            const sourceAdapter = new SourceFileSystemAdapter(selectedSource);
            
            // Create package module
            const packageModule = new PackageLayerModule();
            
            // Convert FileTree to FileSystemTree
            const fileSystemTree = result.tree as FileTree;
            
            // Create file reader function from the source adapter
            const fileReader = sourceAdapter.createFileReader();
            
            // Discover packages
            const packageResult = await packageModule.discoverPackages(fileSystemTree, fileReader);
            console.info('[RepositoryManager] Discovered packages:', packageResult?.length || 0);
            // Log detailed structure of first package for debugging
            if (packageResult && packageResult.length > 0) {
              console.info('[RepositoryManager] First package structure:', {
                hasPackageData: !!packageResult[0].packageData,
                packageDataPath: packageResult[0].packageData?.path,
                packageDataName: packageResult[0].packageData?.name,
                configFiles: packageResult[0].configFiles,
                type: packageResult[0].type,
                keys: Object.keys(packageResult[0])
              });
            }
            
            setPackageLayers(packageResult);
            
            // Cache the result
            if (packageResult) {
              cacheService.setAnalysis(selectedSource.id, {
                packageLayers: packageResult,
              });
            }
          }
        } catch (error) {
          console.error('[RepositoryManager] Error discovering packages:', error);
          // Don't fail the whole load if package discovery fails
          setPackageLayers(null);
        }
      }
    } catch (err) {
      console.error('[RepositoryManager] Error loading tree:', err);
      console.error('[RepositoryManager] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        source: selectedSource,
        err
      });
      setTreeLoadError(err instanceof Error ? err.message : 'Failed to load file tree');
      setFileTree(null);
      setTreeStats(null);
      setFilterLayers(null);
      setCityData(null);
      setPackageLayers(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSource, cacheService, treeCache, cityDataCache]);
  
  // Load tree when source changes
  useEffect(() => {
    console.log('[RepositoryManager] useEffect triggered for loadTree, selectedSource:', selectedSource);
    if (selectedSource) {
      loadTree();
    } else {
      console.log('[RepositoryManager] No selectedSource, skipping loadTree');
    }
  }, [selectedSource, loadTree]);
  
  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidated = (event: CustomEvent) => {
      const { repoPath } = event.detail;
      
      // Check if this invalidation affects our current source
      if (selectedSource?.type === 'local' && selectedSource.location === repoPath) {
        console.info('[RepositoryManager] Cache invalidated for current source, reloading...');
        // Clear memory cache for this source
        treeCache.delete(selectedSource.id);
        // Reload the tree
        loadTree(true);
      }
    };
    
    window.addEventListener('filetree:cache-invalidated', handleCacheInvalidated as EventListener);
    
    return () => {
      window.removeEventListener('filetree:cache-invalidated', handleCacheInvalidated as EventListener);
    };
  }, [selectedSource, loadTree, treeCache]);
  
  // Determine available modes
  // const hasLocalClones = repository.localClones && repository.localClones.length > 0; // TODO: Use for mode availability checks
  // const hasRemoteAccess = Boolean(ghOwner && ghRepo); // TODO: Use for mode availability checks

  // Note: File tree source initialization and toggle handling removed
  

  
  // Clean up file tree invalidator on unmount
  useEffect(() => {
    return () => {
      fileTreeInvalidator.destroy();
    };
  }, [fileTreeInvalidator]);
  
  // Listen for repository updates (e.g., new clones added)
  useEffect(() => {
    const handleCloneAdded = (data: { repository: Repository; clonePath: string }) => {
      // Check if this update is for our repository
      if (data.repository.remoteUrl === repository.remoteUrl) {
        console.info('[RepositoryManager] Clone added to current repository:', data.clonePath);
        // Force a re-render by updating the repository prop
        // Note: This might need to be handled by the parent component passing updated repository prop
        window.location.reload(); // Simple solution for now
      }
    };
    
    const handleCloneRemoved = (data: { repository: Repository; clonePath: string }) => {
      // Check if this update is for our repository
      if (data.repository.remoteUrl === repository.remoteUrl) {
        console.info('[RepositoryManager] Clone removed from current repository:', data.clonePath);
        // If the removed clone was the selected one, we need to handle it
        if (selectedSource?.type === 'local' && selectedSource.location === data.clonePath) {
          // Select another clone or fall back to remote
          if (data.repository.localClones.length > 0) {
            const newSource = SourceSelectionService.getSelectedSource(data.repository);
            if (newSource) {
              setSelectedSource(newSource);
            }
          } else {
            // Fall back to remote source and switch to explore mode
            const remoteSource = SourceSelectionService.getAvailableSources(data.repository)
              .find(s => s.type === 'remote');
            if (remoteSource) {
              setSelectedSource(remoteSource);
              SourceSelectionService.setSelectedSource(data.repository.remoteUrl, remoteSource.id);
              setViewMode('exploration');
            }
          }
        }
      }
    };
    
    // Subscribe to repository events using GitService
    const unsubscribeCloneAdded = GitService.onRepositoryCloneAdded(handleCloneAdded);
    const unsubscribeCloneRemoved = GitService.onRepositoryCloneRemoved(handleCloneRemoved);
    
    // Cleanup listeners on unmount
    return () => {
      unsubscribeCloneAdded();
      unsubscribeCloneRemoved();
    };
  }, [repository.remoteUrl, selectedSource]);

  // Compute session status based on activity and state
  const computeSessionStatus = useCallback((
    session: UIAgentSessionData
  ): Pick<EnhancedUIAgentSessionData, 'status' | 'statusColor' | 'statusText'> => {
    // If session is not active (has stop event), it's stopped
    if (!session.isActive) {
      return { 
        status: 'stopped', 
        statusColor: theme.colors.textTertiary, 
        statusText: 'Stopped' 
      };
    }
    
    // Check if the last event was a notification (waiting for user)
    // Note: We'd need to check lastEvent type here if we have that data
    if (session.lastEvent && 
        (session.lastEvent.type === EventActivityType.NOTIFICATION ||
         session.lastEvent.fileName === 'Notification')) {
      return { 
        status: 'waiting', 
        statusColor: '#f59e0b', 
        statusText: 'Waiting for user' 
      };
    }
    
    // Check time since last activity
    const now = Date.now();
    const lastActivityMs = session.lastActivity || now;
    const timeSinceActivity = now - lastActivityMs;
    const minutesSinceActivity = timeSinceActivity / (60 * 1000);
    
    if (minutesSinceActivity < 2) {
      return { 
        status: 'active', 
        statusColor: '#10b981', 
        statusText: 'Active' 
      };
    } else if (minutesSinceActivity < 30) {
      return { 
        status: 'idle', 
        statusColor: '#f59e0b', 
        statusText: 'Idle' 
      };
    } else {
      // More than 30 minutes, probably stopped even if no stop event
      return { 
        status: 'inactive', 
        statusColor: theme.colors.textTertiary, 
        statusText: 'Inactive' 
      };
    }
  }, [theme]);

  // Load active agent sessions
  const loadAgentSessions = useCallback(async () => {
    try {
      const activeSessions: EnhancedUIAgentSessionData[] = [];
      const pathsToCheck = repository.localClones?.map(c => c.path) || [];
      
      // Get active sessions from the service
      const directorySessions = await AgentSessionService.getActiveSessions();
      
      if (directorySessions && directorySessions.length > 0) {
        for (const dirSession of directorySessions) {
          // Check if this session's directory is within any of the repository's clones
          const isRelevant = pathsToCheck.length === 0 || 
            pathsToCheck.some(clonePath => 
              clonePath && dirSession.directory && 
              dirSession.directory.startsWith(clonePath)
            );
          
          if (isRelevant && dirSession.summaries) {
            // Convert session summaries to our UI format
            for (const summary of dirSession.summaries) {
              console.info('[RepositoryManager] Loading session summary:', {
                sessionId: summary.sessionId.substring(0, 8),
                fileAccessCount: summary.fileAccessCount,
                fileWriteCount: summary.fileWriteCount,
                eventCount: summary.eventCount,
                active: summary.active
              });
              
              const baseSession: UIAgentSessionData = {
                sessionId: summary.sessionId,
                directory: dirSession.directory,
                workingDirectory: dirSession.directory,
                lastActivity: summary.lastActivity || Date.now(),
                firstAccess: summary.startTime || Date.now(),
                isActive: summary.active, // Use the actual active status from the summary
                customName: summary.customName,
                lastEvent: {
                  type: EventActivityType.READ,
                  fileName: '',
                  timestamp: summary.lastActivity || Date.now()
                },
                fileAccessCount: summary.fileAccessCount || 0,
                fileWriteCount: summary.fileWriteCount || 0,
                toolCallCount: summary.toolUseCount || 0,
                eventCount: summary.eventCount || 0,
                metadata: undefined
              };
              
              // Compute status and enhance the session
              const statusInfo = computeSessionStatus(baseSession);
              const enhancedSession: EnhancedUIAgentSessionData = {
                ...baseSession,
                ...statusInfo
              };
              
              activeSessions.push(enhancedSession);
            }
          }
        }
      }
      
      // Sort by last activity (newest first)
      activeSessions.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
      setAgentSessions(activeSessions);
      
      // Initialize selection with live sessions on first load (only in collaboration mode)
      if (!hasInitializedSelection && activeSessions.length > 0 && viewMode === 'collaboration') {
        const liveSessionIds = activeSessions
          .filter(session => 
            session.status === 'active' || 
            session.status === 'idle' || 
            session.status === 'waiting'
          )
          .map(session => session.sessionId);
        
        if (liveSessionIds.length > 0) {
          console.info('[RepositoryManager] Initializing with', liveSessionIds.length, 'live sessions');
          setSelectedAgentSessionIds(new Set(liveSessionIds));
          setSelectedAgentSessions(activeSessions.filter(s => liveSessionIds.includes(s.sessionId)));
        }
        setHasInitializedSelection(true);
      }
    } catch (error) {
      console.error('Failed to load agent sessions:', error);
      setAgentSessions([]);
    }
  }, [repository.localClones, computeSessionStatus, hasInitializedSelection, viewMode]);

  // Note: Agent session filtering removed - each window shows one clone

  // Load sessions on mount and when repository changes
  // Don't reload just because viewMode changed - that's expensive!
  useEffect(() => {
    loadAgentSessions();
  }, [repository.localClones, loadAgentSessions]); // Only reload if clones actually change

  // Handler for updating session data from real-time events
  const handleSessionUpdate = useCallback((sessionId: string, updates: Partial<EnhancedUIAgentSessionData>) => {
    console.info('[RepositoryManager] Updating session from event:', sessionId, updates);
    
    setAgentSessions(prev => prev.map(session => {
      if (session.sessionId === sessionId) {
        // Merge updates into existing session
        return { ...session, ...updates };
      }
      return session;
    }));
    
    // Also update selected sessions if needed
    setSelectedAgentSessions(prev => prev.map(session => {
      if (session.sessionId === sessionId) {
        const updatedSession = agentSessions.find(s => s.sessionId === sessionId);
        if (updatedSession) {
          return { ...updatedSession, ...updates };
        }
      }
      return session;
    }));
  }, [agentSessions]);
  
  // Handler for refreshing a specific session (e.g., after stop event)
  const handleSessionRefresh = useCallback(async (sessionId: string) => {
    console.info('[RepositoryManager] Refreshing session after stop event:', sessionId);
    
    try {
      // Get fresh session data
      const directorySessions = await AgentSessionService.getActiveSessions();
      const pathsToCheck = repository.localClones?.map(c => c.path) || [];
      
      if (directorySessions && directorySessions.length > 0) {
        for (const dirSession of directorySessions) {
          // Find the matching session
          const matchingSession = dirSession.summaries?.find(s => s.sessionId === sessionId);
          if (matchingSession && pathsToCheck.includes(dirSession.directory)) {
            // Compute fresh status
            // Create a proper UIAgentSessionData from SessionSummary
            const baseSession: UIAgentSessionData = {
              sessionId: matchingSession.sessionId,
              directory: dirSession.directory,
              workingDirectory: dirSession.directory,
              lastActivity: matchingSession.lastActivity || Date.now(),
              firstAccess: matchingSession.startTime || Date.now(),
              isActive: matchingSession.active,
              customName: matchingSession.customName,
              lastEvent: {
                type: EventActivityType.READ,
                fileName: '',
                timestamp: matchingSession.lastActivity || Date.now()
              },
              fileAccessCount: matchingSession.fileAccessCount || 0,
              fileWriteCount: matchingSession.fileWriteCount || 0,
              toolCallCount: matchingSession.toolUseCount || 0,
              eventCount: matchingSession.eventCount || 0,
              metadata: undefined
            };
            
            const statusInfo = computeSessionStatus(baseSession);
            const enhancedSession: EnhancedUIAgentSessionData = {
              ...baseSession,
              ...statusInfo
            };
            
            // Update in the sessions list
            setAgentSessions(prev => prev.map(session => 
              session.sessionId === sessionId ? enhancedSession : session
            ));
            
            // Update in selected sessions if selected
            setSelectedAgentSessions(prev => prev.map(session => 
              session.sessionId === sessionId ? enhancedSession : session
            ));
            
            return;
          }
        }
      }
      
      // If session not found (stopped and removed), remove it from lists
      console.info('[RepositoryManager] Session no longer active, removing:', sessionId);
      setAgentSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      setSelectedAgentSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      setSelectedAgentSessionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    } catch (error) {
      console.error('[RepositoryManager] Failed to refresh session:', sessionId, error);
    }
  }, [repository.localClones, computeSessionStatus]);

  // Handler for selecting/toggling session from header
  const handleAgentSessionSelect = useCallback((session: EnhancedUIAgentSessionData) => {
    console.info('[RepositoryManager] Agent session toggled:', session.sessionId);
    
    setSelectedAgentSessionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(session.sessionId)) {
        // Deselect
        newSet.delete(session.sessionId);
        setSelectedAgentSessions(current => 
          current.filter(s => s.sessionId !== session.sessionId)
        );
      } else {
        // Select
        newSet.add(session.sessionId);
        setSelectedAgentSessions(current => [...current, session]);
      }
      return newSet;
    });
  }, []);
  
  // Don't render until view mode is determined
  if (!viewMode) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background
      }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 20px 0 20px',
      overflow: 'hidden',
      boxSizing: 'border-box',
      backgroundColor: theme.colors.background
    }}>
      {/* Header - Content-based height */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <RepositoryManagerHeader
          repository={repository}
          ghOwner={ghOwner}
          ghRepo={ghRepo}
          mode={viewMode}
          onModeChange={handleViewModeChange}
          onSourceSelect={setSelectedSource}
          selectedSource={selectedSource}
          fileTreeStats={treeStats}
          packageLayers={packageLayers}
          filterLayers={filterLayers}
        />
      </div>
      
      {/* Main Content - Remaining space */}
      <div style={{
        flex: 1,
        minHeight: 0, // Important for flexbox overflow
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: '20px'
      }}>
        {/* Loading State */}
        {_loading && !fileTree ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            gap: '24px'
          }}>
            {/* Animated Tree Icon */}
            <div style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <style>{`
                @keyframes tree-pulse {
                  0%, 100% {
                    transform: scale(1);
                    opacity: 0.3;
                  }
                  50% {
                    transform: scale(1.1);
                    opacity: 0.5;
                  }
                }
                
                @keyframes tree-ring {
                  0% {
                    transform: scale(0.8);
                    opacity: 0.6;
                  }
                  100% {
                    transform: scale(1.3);
                    opacity: 0;
                  }
                }
                
                @keyframes dots-fade {
                  0%, 100% {
                    opacity: 0.3;
                  }
                  50% {
                    opacity: 1;
                  }
                }
              `}</style>
              
              {/* Background rings */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `2px solid ${theme.colors.primary}`,
                animation: 'tree-ring 2s ease-out infinite'
              }} />
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `2px solid ${theme.colors.primary}`,
                animation: 'tree-ring 2s ease-out infinite 0.5s'
              }} />
              
              {/* Tree structure */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                animation: 'tree-pulse 2s ease-in-out infinite'
              }}>
                {/* Root node */}
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary
                }} />
                
                {/* Branches */}
                <svg width="60" height="40" viewBox="0 0 60 40" style={{ opacity: 0.6 }}>
                  <line x1="30" y1="0" x2="30" y2="15" stroke={theme.colors.primary} strokeWidth="2" />
                  <line x1="30" y1="15" x2="10" y2="30" stroke={theme.colors.primary} strokeWidth="2" />
                  <line x1="30" y1="15" x2="50" y2="30" stroke={theme.colors.primary} strokeWidth="2" />
                  <circle cx="10" cy="30" r="4" fill={theme.colors.primary} />
                  <circle cx="50" cy="30" r="4" fill={theme.colors.primary} />
                  <line x1="10" y1="30" x2="5" y2="38" stroke={theme.colors.primary} strokeWidth="1.5" />
                  <line x1="10" y1="30" x2="15" y2="38" stroke={theme.colors.primary} strokeWidth="1.5" />
                  <line x1="50" y1="30" x2="45" y2="38" stroke={theme.colors.primary} strokeWidth="1.5" />
                  <line x1="50" y1="30" x2="55" y2="38" stroke={theme.colors.primary} strokeWidth="1.5" />
                  <circle cx="5" cy="38" r="3" fill={theme.colors.primary} opacity="0.7" />
                  <circle cx="15" cy="38" r="3" fill={theme.colors.primary} opacity="0.7" />
                  <circle cx="45" cy="38" r="3" fill={theme.colors.primary} opacity="0.7" />
                  <circle cx="55" cy="38" r="3" fill={theme.colors.primary} opacity="0.7" />
                </svg>
              </div>
            </div>
            
            {/* Loading text */}
            <div style={{
              textAlign: 'center',
              gap: '8px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0
              }}>
                Building Source Tree
              </h3>
              <p style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: 0
              }}>
                Analyzing {repository.name} repository structure
              </p>
              
              {/* Animated dots */}
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                marginTop: '12px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary,
                  animation: 'dots-fade 1.5s ease-in-out infinite'
                }} />
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary,
                  animation: 'dots-fade 1.5s ease-in-out infinite 0.3s'
                }} />
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary,
                  animation: 'dots-fade 1.5s ease-in-out infinite 0.6s'
                }} />
              </div>
            </div>
            
            {/* Additional info */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              maxWidth: '400px',
              width: '100%'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: theme.colors.textSecondary
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.success || '#10b981',
                  flexShrink: 0
                }} />
                <span>Parsing file structure and dependencies</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: theme.colors.textSecondary
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.success || '#10b981',
                  flexShrink: 0
                }} />
                <span>Computing code metrics and statistics</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: theme.colors.textSecondary
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.warning || '#f59e0b',
                  flexShrink: 0,
                  animation: 'dots-fade 1s ease-in-out infinite'
                }} />
                <span>Generating visualization data...</span>
              </div>
            </div>
          </div>
        ) : /* View Content */
        viewMode === 'collaboration' && selectedSource?.type === 'local' ? (
          <GitChangesProvider>
            <FileChangeProvider>
              <LocalDevelopmentView
              repository={repository}
              localClone={{
                path: selectedSource.location,
                currentBranch: selectedSource.metadata?.currentBranch
              }}
              onRefresh={() => {}}
              selectedAgentSessionIds={selectedAgentSessionIds}
              selectedAgentSessions={selectedAgentSessions}
              allAgentSessions={agentSessions}
              onAgentSessionSelect={handleAgentSessionSelect}
              onSessionUpdate={handleSessionUpdate}
              onSessionRefresh={handleSessionRefresh}
              searchQuery={searchQuery}
              fileTree={fileTree}
              cityData={cityData}
              fileColorHighlightLayers={fileColorHighlightLayers}
              activeFileTreeSource={selectedSource}
              fileTreeSourceService={fileTreeSourceService}
              cacheService={cacheService}
              treeStats={treeStats}
              a24zNotes={a24zNotes}
            />
            </FileChangeProvider>
          </GitChangesProvider>
        ) : viewMode === 'planning' && selectedSource?.type === 'local' ? (
          <PlanningView
            repository={repository}
            localClone={{
              path: selectedSource.location,
              currentBranch: selectedSource.metadata?.currentBranch
            }}
            onRefresh={() => {}}
            fileTree={fileTree}
            activeFileTreeSource={selectedSource}
            fileTreeSourceService={fileTreeSourceService}
            cacheService={cacheService}
            agentsWithMCP={agentsWithMCP}
            loadingAgentMCPStatus={loadingAgentMCPStatus}
            uiState={uiState.planningState as any}
            onUIStateChange={(planningState: any) => {
              const newState: RepositoryUIState = {
                ...uiState,
                planningState
              };
              setUIState(newState);
              saveUIState(newState);
            }}
          />
        ) : viewMode === 'deployment' ? (
          <React.Fragment key="maintain-view">
            <RepositoryMaintenanceView
              repository={repository}
            remoteData={{
              owner: ghOwner || '',
              repo: ghRepo || '',
              defaultBranch: repository.metadata?.defaultBranch || 'main'
            }}
            searchQuery={searchQuery}
            fileTree={fileTree}
            cityData={cityData}
            activeFileTreeSource={selectedSource}
            fileTreeSourceService={fileTreeSourceService}
            cacheService={cacheService}
            cityDataCache={cityDataCache}
            treeStats={treeStats}
            a24zNotes={a24zNotes}
            fileColorHighlightLayers={fileColorHighlightLayers}
            packageLayers={packageLayers}
            onPackageLayersChange={setPackageLayers}
            />
          </React.Fragment>
        ) : viewMode === 'exploration' ? (
          <GitChangesProvider>
            <RepositoryExplorationView
            repository={repository}
            remoteData={{
              owner: ghOwner || '',
              repo: ghRepo || '',
              defaultBranch: repository.metadata?.defaultBranch || 'main'
            }}
            searchQuery={searchQuery}
            fileTree={fileTree}
            cityData={cityData}
            activeFileTreeSource={selectedSource}
            fileTreeSourceService={fileTreeSourceService}
            cacheService={cacheService}
            cityDataCache={cityDataCache}
            treeStats={treeStats}
            a24zNotes={a24zNotes}
            fileColorHighlightLayers={fileColorHighlightLayers}
          />
          </GitChangesProvider>
        ) : viewMode === 'planning' || viewMode === 'collaboration' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textSecondary,
            fontSize: '14px'
          }}>
{viewMode === 'planning' ? 'Planning' : 'Collaboration'} mode requires a local clone. Please select a local clone from the source dropdown.
          </div>
        ) : null}
      </div>
      
    </div>
  );
});
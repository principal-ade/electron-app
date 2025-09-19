import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Activity, GitBranch, Brain, Search, FileText } from 'lucide-react';
import { FileTree } from '@principal-ai/repository-abstraction';
import { useTheme } from 'themed-markdown';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import { CityMapManager } from './shared/CityMapManager';
import { ToolbarItem } from './shared/RepositoryToolbar';
import { EventActivityType } from '../../../shared/sessionEnums';
import { useSessionEventProcessor } from '../../hooks/useSessionEventProcessor';
import type { Repository } from '../../../shared/types/repository.types';
import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import type { A24zNote } from '../../../shared/main-process-api-interfaces/A24zAPI';

import { ElectronPlatformAdapters } from '../../adapters';
import { RepositoryNotesService } from '../../main-process-api/RepositoryNotesService';
import { TerminalService } from '../../main-process-api/TerminalService';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
import { WindowService } from '../../main-process-api/WindowService';

import { useFileChanges } from '../../contexts/FileChangeContext';
import { useGitChanges } from '../../contexts/GitChangesContext';

import {
  RepositoryViewSkeleton,
  TabConfig,
} from './shared/RepositoryViewSkeleton';
import { AgentSessionsTab } from './shared/AgentSessionsTab';
import { LocalFileSystemProvider } from '../../services/ContentProviders';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
import { NormalizedAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { HelpModal } from './shared/HelpModal';
import { SessionCardData } from './shared/AgentSessionCard';

interface LocalDevelopmentViewProps {
  repository: Repository;
  localClone: { path: string; currentBranch?: string };

  // Agent Sessions from parent - using proper UI types
  selectedAgentSessionIds?: Set<string>;
  selectedAgentSessions?: EnhancedUIAgentSessionData[];
  allAgentSessions?: EnhancedUIAgentSessionData[];
  onAgentSessionSelect?: (session: EnhancedUIAgentSessionData) => void;
  onSessionUpdate?: (
    sessionId: string,
    updates: Partial<EnhancedUIAgentSessionData>,
  ) => void;
  onSessionRefresh?: (sessionId: string) => void;

  // Search from header
  searchQuery?: string;

  // Shared tree data from parent
  fileTree?: FileTree | null;
  cityData?: CityData | null;
  activeFileTreeSource?: FileTreeSource | null;
  fileTreeSourceService?: FileTreeSourceService;
  cacheService?: FileTreeCacheService;
  treeStats?: FileTreeStats | null;

  // a24z notes from parent (already loaded)
  a24zNotes?: A24zNote[];

  // File color highlight layers from parent
  fileColorHighlightLayers?: HighlightLayer[];

  // Callbacks
  onRefresh?: () => void;
}

/**
 * Local Development View - Uses source-based architecture
 * Manages its own data loading through services
 */
export const LocalDevelopmentView: React.FC<LocalDevelopmentViewProps> = ({
  repository,
  localClone,
  selectedAgentSessionIds = new Set(),
  selectedAgentSessions = [],
  allAgentSessions = [],
  onAgentSessionSelect,
  onSessionUpdate,
  onSessionRefresh,
  searchQuery,
  fileTree: sharedFileTree,
  cityData: _sharedCityData,
  activeFileTreeSource: sharedActiveSource,
  fileTreeSourceService: _sharedFileTreeService,
  cacheService: sharedCacheService,
  treeStats: sharedTreeStats,
  a24zNotes: a24zNotesProp = [],
  fileColorHighlightLayers = [],
  onRefresh,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('agent-sessions-new');

  // Handle tab changes
  const handleTabChange = (newTab: string) => {
    console.info(
      '[LocalDev] Tab changed to:',
      newTab,
      'Current session:',
      selectedSessionId,
    );
    setActiveTab(newTab);
    // Keep the filter state persistent across tabs
    // User can manually turn it off if needed
  };

  // Services - use shared if provided, otherwise create local
  const fileTreeSourceService = useMemo(
    () => _sharedFileTreeService || new FileTreeSourceService(),
    [_sharedFileTreeService],
  );
  const cacheService = useMemo(
    () => sharedCacheService || new FileTreeCacheService(),
    [sharedCacheService],
  );

  // Data loading state
  const [loading, setLoading] = useState(!sharedFileTree);
  const [error, setError] = useState<string | null>(null);

  // Sources state
  const [fileTreeSources, setFileTreeSources] = useState<FileTreeSource[]>([]);
  const [activeFileTreeSource, setActiveFileTreeSource] =
    useState<FileTreeSource | null>(sharedActiveSource || null);

  // Repository data - use shared if provided
  const [fileTree, setFileTree] = useState<FileTree | null>(
    sharedFileTree || null,
  );
  const [treeStats, setTreeStats] = useState<FileTreeStats | null>(
    sharedTreeStats || null,
  );

  // Update local state when shared data changes
  useEffect(() => {
    if (sharedFileTree !== undefined) {
      setFileTree(sharedFileTree);
      setLoading(false);
    }
  }, [sharedFileTree]);

  useEffect(() => {
    if (sharedActiveSource !== undefined) {
      setActiveFileTreeSource(sharedActiveSource);
    }
  }, [sharedActiveSource]);

  useEffect(() => {
    if (sharedTreeStats !== undefined) {
      setTreeStats(sharedTreeStats);
    }
  }, [sharedTreeStats]);

  // Git state is now managed by GitChangesContext via the toolbar

  // File changes from provider
  const {
    sources: fileChangeSources,
    sessionFileActivities,
    registerSource,
    unregisterSource,
    setActiveSource: setActiveFileChangeSource,
    getHighlightLayers,
  } = useFileChanges();
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
  const [_showGitChanges, _setShowGitChanges] = useState(true);

  // Sessions state - managed at parent level for persistence
  const [selectedSessionId, _setSelectedSessionId] = useState<
    string | undefined
  >();
  const [sessionHighlightLayers, setSessionHighlightLayers] = useState<
    HighlightLayer[]
  >([]);
  const [sessionShownOnMap, setSessionShownOnMap] = useState<string | null>(
    null,
  ); // Track which session is shown on map

  // Detail view state
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<
    string | null
  >(null);
  const [selectedSessionCardData, setSelectedSessionCardData] =
    useState<SessionCardData | null>(null);

  // Terminal window tracking - maps sessionId to terminal windowId
  const [terminalWindows, setTerminalWindows] = useState<Map<string, number>>(
    new Map(),
  );

  // Selected file state for search
  const [selectedFile, _setSelectedFile] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchHighlightLayer, setSearchHighlightLayer] =
    useState<HighlightLayer | null>(null);
  const [selectedFileLayer, setSelectedFileLayer] =
    useState<HighlightLayer | null>(null);

  // Help modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Toolbar state
  const [toolbarExpanded, setToolbarExpanded] = useState(false);

  // Track session IDs to avoid unnecessary re-subscriptions
  const allSessionIdsRef = useRef<Set<string>>(new Set());
  // Also use refs for callbacks to maintain stable references
  const onSessionUpdateRef = useRef(onSessionUpdate);
  const onSessionRefreshRef = useRef(onSessionRefresh);
  const processEventRef = useRef<
    ((event: NormalizedAgentSessionEvent) => void) | null
  >(null);

  // Use centralized event processor for consistent event handling (must be at top level)
  const { processEvent } = useSessionEventProcessor({
    onSessionUpdate: (sessionId, updates) => {
      // Check if this is a session we're tracking
      const trackedSession = allAgentSessions.find(
        (s) => s.sessionId === sessionId,
      );
      if (!trackedSession) {
        return;
      }

      // Add status updates based on event type
      const enhancedUpdates = { ...updates };

      // Update status based on activity
      if (updates.lastEvent) {
        if (updates.lastEvent.type === EventActivityType.NOTIFICATION) {
          enhancedUpdates.status = 'waiting';
          enhancedUpdates.statusColor = '#f59e0b';
          enhancedUpdates.statusText = 'Waiting for user';
        } else if (trackedSession.status !== 'active') {
          enhancedUpdates.status = 'active';
          enhancedUpdates.statusColor = '#10b981';
          enhancedUpdates.statusText = 'Active';
        }
      }

      if (onSessionUpdate) {
        onSessionUpdate(sessionId, enhancedUpdates);
      }
    },
    onSideEffect: (sessionId, effects) => {
      console.info('[LocalDev] Side effects for session', sessionId, effects);
      // Handle side effects like git status checks if needed
    },
  });

  // Update the refs when props change
  useEffect(() => {
    const newSessionIds = new Set(allAgentSessions.map((s) => s.sessionId));
    allSessionIdsRef.current = newSessionIds;
  }, [allAgentSessions]);

  useEffect(() => {
    onSessionUpdateRef.current = onSessionUpdate;
  }, [onSessionUpdate]);

  useEffect(() => {
    onSessionRefreshRef.current = onSessionRefresh;
  }, [onSessionRefresh]);

  useEffect(() => {
    processEventRef.current = processEvent;
  }, [processEvent]);

  // Subscribe to real-time session events - stable effect with no dependencies
  useEffect(() => {
    const handleSessionEvent = (event: NormalizedAgentSessionEvent) => {
      // Use refs to get current values without triggering re-subscriptions
      if (
        !onSessionUpdateRef.current ||
        !onSessionRefreshRef.current ||
        !processEventRef.current
      ) {
        return;
      }

      // Handle both raw and processed event formats
      const normalizedEvent: NormalizedAgentSessionEvent = event;

      if (!normalizedEvent.sessionId) {
        return;
      }

      // Check if this event is for a session we're tracking using the ref
      if (!allSessionIdsRef.current.has(normalizedEvent.sessionId)) {
        return;
      }

      console.info('[LocalDev] Received session event:', {
        sessionId: normalizedEvent.sessionId,
        eventType: normalizedEvent.eventType,
        toolName: normalizedEvent.toolName,
        timestamp: normalizedEvent.timestamp,
      });

      // Special handling for stop events
      if (normalizedEvent.eventType === 'stop') {
        // Update session status directly without full refresh
        console.info(
          '[LocalDev] Session stopped, updating status:',
          normalizedEvent.sessionId,
        );
        onSessionUpdateRef.current(normalizedEvent.sessionId, {
          status: 'stopped',
          statusColor: '#6b7280',
          statusText: 'Stopped',
          lastActivity: normalizedEvent.timestamp,
        });
        return;
      }

      // Special handling for notification events (not tool events)
      if (normalizedEvent.eventType === 'notification') {
        onSessionUpdateRef.current(normalizedEvent.sessionId, {
          status: 'waiting',
          statusColor: '#f59e0b',
          statusText: 'Waiting for user',
          lastActivity: normalizedEvent.timestamp,
          lastEvent: {
            type: EventActivityType.NOTIFICATION,
            fileName: 'Notification',
            timestamp: normalizedEvent.timestamp,
          },
        });
        return;
      }

      // Process through centralized processor using ref
      // Note: We can't easily get session data here without dependencies
      // So we'll just pass undefined and let the processor initialize if needed
      processEventRef.current(normalizedEvent);
    };

    // Subscribe to both event channels
    console.info('[LocalDev] Subscribing to real-time session events');
    const unsubscribeCLI =
      AgentSessionService.onCliProviderEvent(handleSessionEvent);
    const unsubscribeProcessed =
      AgentSessionService.onProcessedEvent(handleSessionEvent);

    // Also subscribe to HTTP bridge for redundancy
    window.mainProcess?.agentSessionEvents
      ?.subscribe?.()
      .then((result) => {
        if (result?.success) {
          console.info(
            '[LocalDev] Subscribed to agent session events HTTP bridge on port:',
            result.port,
          );
        }
      })
      .catch((error) => {
        console.error('[LocalDev] Failed to subscribe to HTTP bridge:', error);
      });

    return () => {
      console.info('[LocalDev] Unsubscribing from session events');
      if (unsubscribeCLI) unsubscribeCLI();
      if (unsubscribeProcessed) unsubscribeProcessed();
    };
  }, []); // Empty dependency array - stable subscription

  // Notes state
  const [tribalKnowledgeNotes, setTribalKnowledgeNotes] = useState<
    RepositoryNote[]
  >([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [noteHighlightLayers, setNoteHighlightLayers] = useState<
    HighlightLayer[]
  >([]);

  // a24z memory state - notes come from props, only manage the layer locally
  const a24zNotes = a24zNotesProp; // Use the prop instead of local state
  const [a24zHighlightLayer, setA24zHighlightLayer] =
    useState<HighlightLayer | null>(null);
  const [showA24zLayer, setShowA24zLayer] = useState(true);

  // Theme state (README loading removed as it was never used)
  const [_customDocsTheme, _setCustomDocsTheme] = useState<any | null>(null);
  const [_themeValidationWarnings, _setThemeValidationWarnings] = useState<
    string[]
  >([]);

  // Right pane mode: 'city' | 'session-detail'
  const [rightPaneMode, setRightPaneMode] = useState<'city' | 'session-detail'>(
    'city',
  );

  // Layer visibility state
  const [layerVisibility, setLayerVisibility] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Create adapters
  const _adapters = useMemo(() => new ElectronPlatformAdapters(), []);

  // Create content provider for local filesystem
  const contentProvider = useMemo(() => new LocalFileSystemProvider(), []);

  // Simple file tree search without indexing for better performance
  const performSimpleSearch = useCallback(
    (query: string): string[] => {
      if (!fileTree || !query.trim()) return [];

      const lowerQuery = query.toLowerCase();
      const results: string[] = [];

      // Search through all files
      for (const file of fileTree.allFiles || []) {
        // Check if filename or path contains the query
        if (
          file.name.toLowerCase().includes(lowerQuery) ||
          file.relativePath.toLowerCase().includes(lowerQuery)
        ) {
          // Use relative path directly
          let relativePath = file.relativePath;
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
          }
          results.push(relativePath);

          // Limit results for performance
          if (results.length >= 100) break;
        }
      }

      return results;
    },
    [fileTree],
  );

  // Handle search from header with instant results
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    // Perform simple search without delay for instant feedback
    const results = performSimpleSearch(searchQuery);
    setSearchResults(results);

    console.info(
      '[LocalDev] Search results for "' + searchQuery + '":',
      results.length,
      'files found',
    );
  }, [searchQuery, performSimpleSearch]);

  // Initialize sources only if not using shared service
  useEffect(() => {
    if (_sharedFileTreeService || sharedActiveSource) {
      // Skip initialization if using shared data
      return;
    }

    const initialSources =
      fileTreeSourceService.initializeFromRepository(repository);
    setFileTreeSources(initialSources);

    // Find the source for this specific local clone
    const localSource = initialSources.find(
      (s) => s.type === 'local' && s.location === localClone.path,
    );

    if (localSource) {
      fileTreeSourceService.setActiveSource(localSource.id);
      setActiveFileTreeSource(localSource);
    }
  }, [
    repository,
    localClone,
    fileTreeSourceService,
    _sharedFileTreeService,
    sharedActiveSource,
  ]);

  // Register with file change provider - only once per path
  useEffect(() => {
    if (!activeFileTreeSource || !localClone.path) return;

    const sourceId = `local-${localClone.path}`;

    // Set current source ID
    setCurrentSourceId(sourceId);

    // Register the source
    registerSource({
      id: sourceId,
      path: localClone.path,
      type: 'git',
      name: repository.name,
    });

    setActiveFileChangeSource(sourceId);

    // Cleanup on unmount or path change
    return () => {
      unregisterSource(sourceId);
    };
  }, [
    localClone.path,
    repository.name,
    registerSource,
    unregisterSource,
    setActiveFileChangeSource,
    activeFileTreeSource,
  ]); // Include all dependencies

  // LocalDevelopmentView should never load its own tree - always use the one from RepositoryManager
  useEffect(() => {
    if (!sharedFileTree) {
      setLoading(false);
      setError('File tree not provided by RepositoryManager');
      console.error('[LocalDev] No file tree provided by RepositoryManager');
    } else {
      setLoading(false);
      setError(null);
    }
  }, [sharedFileTree]);

  // Fetch repository notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!repository.remoteUrl) {
        console.info(
          '[LocalDev] No remote URL for repository, skipping notes fetch',
        );
        return;
      }
      try {
        console.info(
          '[LocalDev] Fetching notes for repository:',
          repository.remoteUrl,
        );
        const notes = await RepositoryNotesService.getNotesForRepository(
          repository.remoteUrl,
        );
        console.info('[LocalDev] Fetched notes:', notes.length, 'notes');
        setTribalKnowledgeNotes(notes);
      } catch (error) {
        console.error('Failed to fetch repository notes:', error);
      }
    };
    fetchNotes();
  }, [repository.remoteUrl]);

  // a24z notes are now loaded in RepositoryManager and passed as props

  // Load custom theme from local file system (README loading removed as it was never used)
  useEffect(() => {
    const loadCustomTheme = async () => {
      if (!localClone?.path || !contentProvider) {
        return;
      }

      try {
        // Try to load custom theme from .specktor/docs_theme.json
        const themePath = `${localClone.path}/.specktor/docs_theme.json`;
        console.info(
          '[LocalDev] Theme: checking for custom theme at',
          themePath,
        );

        const themeContent = await contentProvider.readFileContent(themePath);
        if (themeContent) {
          console.info('[LocalDev] Theme: found custom theme file', {
            bytes: themeContent.length,
          });

          // TODO: parseThemeJson is not defined - theme parsing not implemented
          const validationResult = {
            valid: false,
            mergedTheme: null,
            warnings: [],
            errors: ['Theme parsing not implemented'],
          };
          if (validationResult.valid && validationResult.mergedTheme) {
            _setCustomDocsTheme(validationResult.mergedTheme);
            if (validationResult.warnings) {
              _setThemeValidationWarnings(validationResult.warnings);
            }
          } else {
            _setThemeValidationWarnings([
              'Theme validation failed: ' +
                (validationResult.errors?.join(', ') || 'Unknown error'),
            ]);
          }
        }
      } catch (themeError) {
        console.info('[LocalDev] Theme: error loading theme', themeError);
        // Not an error - theme is optional
      }
    };

    loadCustomTheme();
  }, [localClone?.path, contentProvider]);

  // Create a24z highlight layer from anchors
  useEffect(() => {
    if (!showA24zLayer || a24zNotes.length === 0) {
      setA24zHighlightLayer(null);
      return;
    }

    console.info(
      '[LocalDev] Processing a24z notes for highlight layer:',
      a24zNotes.length,
      'notes',
    );

    // Collect all unique file paths from anchors
    const filePaths = new Set<string>();
    for (const note of a24zNotes) {
      console.info('[LocalDev] Processing note:', {
        id: note.id,
        anchors: note.anchors,
        type: note.type,
        tags: note.tags,
      });

      if (note.anchors && Array.isArray(note.anchors)) {
        for (const anchor of note.anchors) {
          console.info('[LocalDev] Processing anchor:', anchor);
          // Anchors are relative paths, normalize them
          let normalizedPath = anchor;
          // Remove leading slash if present
          if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
          }
          // Remove ./ if present
          if (normalizedPath.startsWith('./')) {
            normalizedPath = normalizedPath.substring(2);
          }
          console.info('[LocalDev] Normalized path:', normalizedPath);
          filePaths.add(normalizedPath);
        }
      }
    }

    if (filePaths.size === 0) {
      setA24zHighlightLayer(null);
      return;
    }

    const layer: HighlightLayer = {
      id: 'a24z-memory',
      name: `a24z Memory (${filePaths.size} files)`,
      enabled: true,
      color: '#9333ea', // Purple for a24z
      priority: 20, // Lower than search but higher than most
      items: Array.from(filePaths).map((path) => ({
        path,
        type: 'file' as const,
      })),
    };

    console.info(
      '[LocalDev] Created a24z highlight layer with',
      filePaths.size,
      'files',
    );
    console.info('[LocalDev] a24z file paths:', Array.from(filePaths));
    setA24zHighlightLayer(layer);
  }, [a24zNotes, showA24zLayer]);

  // Create note highlight layers
  useEffect(() => {
    if (selectedNoteIds.size === 0) {
      setNoteHighlightLayers([]);
      return;
    }

    const layers: HighlightLayer[] = [];
    const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
    let colorIndex = 0;

    for (const noteId of selectedNoteIds) {
      const note = tribalKnowledgeNotes.find((n) => n.id === noteId);
      if (!note) continue;

      const color = colors[colorIndex % colors.length];
      colorIndex++;

      const items: Array<{ path: string; type: 'file' | 'directory' }> = [];
      if (note.relativePath) {
        items.push({ path: note.relativePath, type: 'directory' as const });
      }
      if (note.anchors) {
        for (const anchor of note.anchors) {
          items.push({ path: anchor, type: 'file' as const });
        }
      }

      if (items.length > 0) {
        layers.push({
          id: `note-${noteId}`,
          name: `Note: ${note.note.substring(0, 30)}...`,
          enabled: true,
          color,
          priority: 20 + colorIndex,
          items,
        });
      }
    }

    setNoteHighlightLayers(layers);
  }, [selectedNoteIds, tribalKnowledgeNotes]);

  // Create search highlight layer
  useEffect(() => {
    console.info(
      '[LocalDev] Creating search highlight layer, searchResults:',
      searchResults,
    );
    console.info('[LocalDev] searchResults length:', searchResults.length);

    if (searchResults.length === 0) {
      console.info(
        '[LocalDev] No search results, clearing search highlight layer',
      );
      setSearchHighlightLayer(null);
      return;
    }

    const layer: HighlightLayer = {
      id: 'search-results',
      name: `Search Results (${searchResults.length})`,
      enabled: true,
      color: '#3b82f6', // Blue for search results
      priority: 25, // Higher than most layers
      items: searchResults.map((path) => ({
        path,
        type: 'file' as const,
      })),
    };

    console.info('[LocalDev] Created search highlight layer:', layer);
    console.info('[LocalDev] Search layer items:', layer.items);

    setSearchHighlightLayer(layer);
  }, [searchResults]);

  // Create selected file fill layer
  useEffect(() => {
    console.info(
      '[LocalDev] Creating selected file layer, selectedFile:',
      selectedFile,
    );

    if (!selectedFile) {
      console.info('[LocalDev] No selected file, clearing selected file layer');
      setSelectedFileLayer(null);
      return;
    }

    // Extract relative path from the selected file
    let relativePath = selectedFile;
    console.info('[LocalDev] Processing selected file path:', selectedFile);
    console.info('[LocalDev] Local clone path:', localClone.path);

    if (selectedFile.includes('/')) {
      // If it contains the local clone path, remove it
      if (localClone.path && selectedFile.startsWith(localClone.path)) {
        relativePath = selectedFile.substring(localClone.path.length);
        // Remove leading slash
        if (relativePath.startsWith('/')) {
          relativePath = relativePath.substring(1);
        }
        console.info(
          '[LocalDev] Extracted relative path from local clone:',
          relativePath,
        );
      } else {
        // Try to find repository name in path
        const parts = selectedFile.split('/');
        const repoNameIndex = parts.findIndex(
          (part) => part === repository.name,
        );
        if (repoNameIndex !== -1 && repoNameIndex < parts.length - 1) {
          relativePath = parts.slice(repoNameIndex + 1).join('/');
          console.info(
            '[LocalDev] Extracted relative path from repo name:',
            relativePath,
          );
        }
      }
    }

    const layer: HighlightLayer = {
      id: 'selected-file',
      name: 'Selected File',
      enabled: true,
      color: '#10b981', // Green for selected file
      priority: 30, // Higher priority than search results
      items: [
        {
          renderStrategy: 'fill',
          path: relativePath,
          type: 'file' as const,
        },
      ],
    };

    console.info('[LocalDev] Created selected file layer:', layer);
    console.info('[LocalDev] Selected file layer item:', layer.items[0]);

    setSelectedFileLayer(layer);
  }, [selectedFile, localClone.path, repository.name]);

  // Handler for layer visibility toggle
  const _handleLayerToggle = useCallback(
    (layerId: string, enabled?: boolean) => {
      setLayerVisibility((prev) => {
        const newMap = new Map(prev);
        if (enabled !== undefined) {
          newMap.set(layerId, enabled);
        } else {
          // Toggle if no explicit value provided
          newMap.set(layerId, !prev.get(layerId));
        }
        return newMap;
      });
    },
    [],
  );

  // Handler for session layer generation
  const handleSessionLayersGenerated = useCallback(
    (
      sessionId: string,
      readLayer: HighlightLayer | null,
      writeLayer: HighlightLayer | null,
    ) => {
      console.info(
        '[LocalDev] onLayersGenerated called for session:',
        sessionId,
      );
      console.info(
        '[LocalDev] - Read layer:',
        readLayer ? `${readLayer.items.length} items` : 'none',
        readLayer,
      );
      console.info(
        '[LocalDev] - Write layer:',
        writeLayer ? `${writeLayer.items.length} items` : 'none',
        writeLayer,
      );

      // Update session highlight layers
      setSessionHighlightLayers((prev) => {
        // Remove existing layers for this session
        const filtered = prev.filter(
          (l) => !l.id.startsWith(`session-${sessionId}-`),
        );
        console.info(
          '[LocalDev] Filtered out',
          prev.length - filtered.length,
          'existing layers for session',
        );

        // Add new layers if provided
        const newLayers = [...filtered];
        if (readLayer) newLayers.push(readLayer);
        if (writeLayer) newLayers.push(writeLayer);

        console.info(
          '[LocalDev] New session highlight layers count:',
          newLayers.length,
        );
        return newLayers;
      });
    },
    [],
  );

  // Combine all highlight layers
  const combinedLayers = useMemo(() => {
    console.info('[LocalDev] Building combined layers...');
    console.info(
      '[LocalDev] - File color layers:',
      fileColorHighlightLayers.length,
    );
    console.info('[LocalDev] - Note layers:', noteHighlightLayers.length);
    console.info(
      '[LocalDev] - Session highlight layers:',
      sessionHighlightLayers.length,
    );
    console.info(
      '[LocalDev] - Search layer:',
      searchHighlightLayer ? 'yes' : 'no',
    );
    console.info(
      '[LocalDev] - Selected file layer:',
      selectedFileLayer ? 'yes' : 'no',
    );
    console.info('[LocalDev] - a24z layer:', a24zHighlightLayer ? 'yes' : 'no');

    if (a24zHighlightLayer) {
      console.info('[LocalDev] - a24z layer details:', {
        id: a24zHighlightLayer.id,
        name: a24zHighlightLayer.name,
        enabled: a24zHighlightLayer.enabled,
        color: a24zHighlightLayer.color,
        priority: a24zHighlightLayer.priority,
        itemCount: a24zHighlightLayer.items.length,
        sampleItems: a24zHighlightLayer.items.slice(0, 3),
      });
    }

    const layers = [
      ...fileColorHighlightLayers,
      ...noteHighlightLayers,
      ...sessionHighlightLayers,
      ...(a24zHighlightLayer ? [a24zHighlightLayer] : []),
      ...(searchHighlightLayer ? [searchHighlightLayer] : []),
      ...(selectedFileLayer ? [selectedFileLayer] : []),
    ];

    console.info('[LocalDev] Combined layers total:', layers.length);
    console.info(
      '[LocalDev] Combined layers summary:',
      layers.map((l) => ({
        id: l.id,
        name: l.name,
        enabled: l.enabled,
        itemCount: l.items.length,
      })),
    );

    if (currentSourceId) {
      // Get file change layers with session tracking and unattributed changes
      // If a session is shown on the map, only show changes for that session
      let fileChangeLayers = getHighlightLayers(currentSourceId, {
        showGitChanges: !sessionShownOnMap, // Hide git changes when showing a specific session
        showSessionChanges: true, // Show what sessions are doing
        showUnattributed: !sessionShownOnMap, // Hide unattributed when showing a specific session
        showCollisions: !sessionShownOnMap, // Hide collisions when showing a specific session
        activeSessionOnly: !!sessionShownOnMap, // Only show the active session when one is selected
      });

      console.info(
        '[LocalDev] - File change layers from context:',
        fileChangeLayers.length,
      );
      layers.push(...fileChangeLayers);
    }

    // Apply visibility overrides from user toggles
    const finalLayers = layers.map((layer) => ({
      ...layer,
      enabled: layerVisibility.has(layer.id)
        ? (layerVisibility.get(layer.id) ?? layer.enabled)
        : layer.enabled,
    }));

    return finalLayers;
  }, [
    fileColorHighlightLayers,
    noteHighlightLayers,
    sessionHighlightLayers,
    a24zHighlightLayer,
    searchHighlightLayer,
    selectedFileLayer,
    currentSourceId,
    getHighlightLayers,
    layerVisibility,
    sessionShownOnMap,
  ]);

  // Handle refresh
  const handleRefresh = async () => {
    if (activeFileTreeSource) {
      // Clear cache for this source
      cacheService.removeTree(activeFileTreeSource.id);
      // Trigger reload by updating active source
      setActiveFileTreeSource({ ...activeFileTreeSource });
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  // Handle session selection for detail view
  const handleSessionDetailSelect = async (
    sessionId: string,
    cardData: SessionCardData,
  ) => {
    console.info('[LocalDev] Session selected for detail view:', sessionId);
    setSelectedSessionForDetail(sessionId);
    setSelectedSessionCardData(cardData);
    setRightPaneMode('session-detail');
  };

  // Keep selectedSessionCardData in sync with updates
  // We'll need to pass a callback from AgentSessionsTab to update this
  const updateSessionCardData = useCallback(
    (sessionId: string, cardData: SessionCardData) => {
      if (selectedSessionForDetail === sessionId) {
        setSelectedSessionCardData(cardData);
      }
    },
    [selectedSessionForDetail],
  );

  // Agent color palette
  const getAgentColor = (sessionId: string): string => {
    const colors = [
      '#F02C03',
      '#FF950C',
      '#FEDC03',
      '#7CDA01',
      '#0D8DFF',
      '#B02FF7',
    ];

    const hash = sessionId.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  // Helper to format time ago
  const getTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  // Create tabs configuration
  const tabs: TabConfig[] = [
    {
      id: 'agent-sessions-new',
      label: 'Tasks',
      icon: <Activity size={14} />,
      visible: true,
      content: (
        <AgentSessionsTab
          repositoryPath={localClone.path}
          localClonePaths={repository.localClones?.map((c) => c.path) || []}
          selectedAgentSessionIds={selectedAgentSessionIds}
          allAgentSessions={allAgentSessions}
          fileTreeSourceService={fileTreeSourceService}
          sourceId={activeFileTreeSource?.id}
          repository={repository}
          fileTreeSources={fileTreeSources}
          onSessionSelect={(sessionId) => {
            console.info(
              '[LocalDev] Session selected from new tab:',
              sessionId,
            );
            // Find the session and call parent handler
            const session = allAgentSessions.find(
              (s) => s.sessionId === sessionId,
            );
            if (session && onAgentSessionSelect) {
              onAgentSessionSelect(session);
            }
          }}
          onSessionUnselect={(sessionId) => {
            console.info(
              '[LocalDev] Session unselected from new tab:',
              sessionId,
            );
            // Find the session and call parent handler to deselect
            const session = allAgentSessions.find(
              (s) => s.sessionId === sessionId,
            );
            if (session && onAgentSessionSelect) {
              onAgentSessionSelect(session); // Parent handles toggle logic
            }
          }}
          onLayersGenerated={handleSessionLayersGenerated}
          onSessionMapVisibilityChange={(sessionId) => {
            setSessionShownOnMap(sessionId);
            // Update session activities to mark the active one
            if (currentSourceId) {
              const activities = sessionFileActivities.get(currentSourceId);
              if (activities) {
                activities.forEach((activity) => {
                  activity.isActive = sessionId
                    ? activity.sessionId === sessionId
                    : false;
                });
              }
            }
          }}
          onOpenTerminal={async (sessionId, _sessionName) => {
            // Find the session data
            const session = allAgentSessions?.find(
              (s) => s.sessionId === sessionId,
            );
            if (!session) {
              console.error('[LocalDev] Session not found:', sessionId);
              return;
            }

            // Build minimal card data for detail view
            // Convert operations array to Map for SessionCardData
            const activity = sessionFileActivities
              .get(currentSourceId || '')
              ?.find((activity) => activity.sessionId === sessionId);

            const fileOpsMap = activity?.operations
              ? new Map(
                  activity.operations.map(
                    (op, idx) => [`op-${idx}`, op] as const,
                  ),
                )
              : undefined;

            const cardData: SessionCardData = {
              session,
              isExpanded: false,
              // Add other data if available from sessionFileActivities
              fileOperations: fileOpsMap,
            };

            // Check if we already have a terminal window for this session
            const existingWindowId = terminalWindows.get(sessionId);
            if (existingWindowId) {
              // Focus existing terminal window instead of creating new one
              try {
                await TerminalService.focusWindow(existingWindowId);
                console.info(
                  `[LocalDev] Focused existing terminal window ${existingWindowId} for session ${sessionId}`,
                );

                // Switch to session detail view with card data
                setSelectedSessionForDetail(sessionId);
                setSelectedSessionCardData(cardData);
                setRightPaneMode('session-detail');
                return;
              } catch (error) {
                console.error(
                  '[LocalDev] Failed to focus terminal window:',
                  error,
                );
                // Window might be closed, remove from tracking and continue to create new one
                setTerminalWindows((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(sessionId);
                  return newMap;
                });
              }
            }

            // Create new terminal window
            try {
              const command = `claude -r ${sessionId}`;
              console.info(
                `[LocalDev] Creating terminal with command: ${command}`,
              );
              const terminalId = await TerminalService.createWithCommand(
                localClone.path,
                command,
              );
              console.info(
                `[LocalDev] Terminal created with ID: ${terminalId}`,
              );

              // Pop out the terminal to left side of screen
              console.info(
                `[LocalDev] Attempting to pop out terminal ${terminalId}`,
              );
              const { windowId } = await TerminalService.popOut(terminalId);
              console.info(
                `[LocalDev] Terminal popped out to window ${windowId}`,
              );

              // Track the terminal window for this session
              setTerminalWindows((prev) =>
                new Map(prev).set(sessionId, windowId),
              );

              // Wait for window ready event (with timeout)
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                  console.info(
                    '[LocalDev] Window ready timeout reached, proceeding anyway',
                  );
                  resolve();
                }, 2000); // Fallback after 2 seconds
                const unsubscribe = TerminalService.onWindowReady((data) => {
                  if (
                    data.terminalId === terminalId ||
                    data.agentSessionId === sessionId
                  ) {
                    console.info(
                      '[LocalDev] Window ready event received:',
                      data,
                    );
                    clearTimeout(timeout);
                    unsubscribe?.();
                    resolve();
                  }
                });
              });

              // Switch to session detail view with card data
              setSelectedSessionForDetail(sessionId);
              setSelectedSessionCardData(cardData);
              setRightPaneMode('session-detail');

              console.info(
                `[LocalDev] Successfully opened terminal window ${windowId} for session ${sessionId}`,
              );
            } catch (error) {
              console.error(
                '[LocalDev] Failed to open terminal - full error:',
                error,
              );
              if (error instanceof Error) {
                console.error('[LocalDev] Error message:', error.message);
                console.error('[LocalDev] Error stack:', error.stack);
              }
            }
          }}
          onShowContext={(sessionId) => {
            console.info('[LocalDev] Show context for session:', sessionId);
            // Will be implemented in AgentSessionDetailView in the future
            console.info(
              '[LocalDev] Context view will be integrated into session detail view',
            );
          }}
          onSessionDetailSelect={handleSessionDetailSelect}
          onSessionCardUpdate={updateSessionCardData}
        />
      ),
    },
  ];

  // Get git state from context
  const {
    getGitState,
    toggleGitChanges,
    initializeLocalSource,
    setGitChangesVisible,
  } = useGitChanges();
  const gitState =
    activeFileTreeSource?.type === 'local'
      ? getGitState(activeFileTreeSource.id)
      : undefined;

  // Auto-initialize git state for local sources (loads HEAD tree)
  useEffect(() => {
    if (activeFileTreeSource?.type === 'local') {
      console.log(
        '[LocalDev] Auto-initializing git state for local source:',
        activeFileTreeSource.id,
      );
      initializeLocalSource(activeFileTreeSource);
    }
  }, [activeFileTreeSource, initializeLocalSource]);

  // Create toolbar items for repository tools
  const toolbarItems = useMemo<ToolbarItem[]>(() => {
    const items: ToolbarItem[] = [];

    // Git changes tool (for local sources)
    if (activeFileTreeSource?.type === 'local' && gitState) {
      const changeCount =
        (gitState.gitStatus?.modified?.length || 0) +
        (gitState.gitStatus?.created?.length || 0) +
        (gitState.gitStatus?.deleted?.length || 0);

      items.push({
        id: 'git-changes',
        label: gitState.hasNoCommits ? 'No commits yet' : `Git Changes`,
        shortLabel: 'Git',
        icon: <GitBranch />,
        count: gitState.hasNoCommits ? undefined : changeCount,
        color: '#f59e0b',
        active: gitState.enabled && !gitState.hasNoCommits,
        onClick: () => {
          if (!gitState.hasNoCommits && activeFileTreeSource) {
            // Just toggle visibility, don't reload HEAD tree
            setGitChangesVisible(activeFileTreeSource.id, !gitState.enabled);
          }
        },
        tooltip: gitState.hasNoCommits
          ? 'Repository has no commits yet'
          : `${gitState.enabled ? 'Hide' : 'Show'} git changes (${changeCount} changes)`,
      });
    }

    // a24z memory tool
    if (a24zNotes.length > 0) {
      items.push({
        id: 'a24z-memory',
        label: 'a24z Memory',
        shortLabel: 'a24z',
        icon: <Brain />,
        count: a24zNotes.length,
        color: '#9333ea',
        active: showA24zLayer,
        onClick: () => setShowA24zLayer(!showA24zLayer),
        tooltip: `${showA24zLayer ? 'Hide' : 'Show'} a24z memory coverage (${a24zNotes.length} notes)`,
      });
    }

    // Search results
    if (searchResults.length > 0) {
      items.push({
        id: 'search-results',
        label: 'Search Results',
        shortLabel: 'Search',
        icon: <Search />,
        count: searchResults.length,
        color: '#3b82f6',
        active: true, // Always active when there are results
        onClick: () => {
          // Could toggle search highlight visibility
          setSearchResults([]);
        },
        tooltip: `Clear search results (${searchResults.length} files)`,
      });
    }

    // Tribal knowledge notes
    if (selectedNoteIds.size > 0) {
      items.push({
        id: 'tribal-notes',
        label: 'Tribal Notes',
        shortLabel: 'Notes',
        icon: <FileText />,
        count: selectedNoteIds.size,
        color: '#8b5cf6',
        active: true,
        onClick: () => {
          // Clear all selected notes
          setSelectedNoteIds(new Set());
        },
        tooltip: `Clear selected notes (${selectedNoteIds.size} selected)`,
      });
    }

    return items;
  }, [
    a24zNotes.length,
    showA24zLayer,
    searchResults.length,
    selectedNoteIds.size,
    gitState,
    activeFileTreeSource,
    setGitChangesVisible,
  ]);

  // Handle file click to open in multi-file editor window
  const handleFileClick = useCallback(
    async (filePath: string) => {
      console.info('[LocalDevelopmentView] File clicked:', filePath);

      try {
        // Prepare file info for the multi-file editor
        const files = [
          {
            path: filePath,
            relativePath: filePath,
            lastModified: Date.now(),
          },
        ];

        // Get current branch from the local clone
        const currentBranch = localClone?.currentBranch || 'main';

        // Parse owner and repo from remote URL if available
        let owner = 'local';
        let repo = repository.name;
        if (repository.remoteUrl) {
          const match = repository.remoteUrl.match(
            /github\.com[:/]([^/]+)\/([^/.]+)/,
          );
          if (match) {
            owner = match[1];
            repo = match[2];
          }
        }

        console.info('[LocalDevelopmentView] Opening multi-file editor with:', {
          sessionId: `develop-${owner}-${repo}`,
          sessionName: `Develop ${owner}/${repo}`,
          repositoryPath: `${owner}/${repo}`,
          files,
          localPath: localClone.path,
          branch: currentBranch,
        });

        // Open the multi-file editor window with local repository context
        await WindowService.openMultiFileEditor({
          sessionId: `develop-${owner}-${repo}`,
          sessionName: `Develop ${owner}/${repo}`,
          files,
          repositoryPath: `${owner}/${repo}`,
          // Note: localInfo removed as it's not part of MultiFileEditorOptions type
        });
      } catch (error) {
        console.error(
          '[LocalDevelopmentView] Error opening multi-file editor:',
          error,
        );
      }
    },
    [localClone, repository],
  );

  // Error handling
  if (error && !loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: theme.colors.text, marginBottom: '8px' }}>
            Failed to Load Repository
          </h3>
          <p>{error}</p>
          <button
            onClick={handleRefresh}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              borderRadius: '4px',
              backgroundColor: theme.colors.primary,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CityMapManager
        fileTree={fileTree}
        activeSource={activeFileTreeSource}
        gitEnabled={gitState?.enabled}
        headTree={gitState?.headTree}
        hasNoCommits={gitState?.hasNoCommits}
        viewMode="develop"
        showWorkingTree={gitState?.enabled}
        showHeadTree={gitState?.headTree !== undefined}
        onToggleWorkingTree={(_show) => {
          // This is handled by the toolbar now
        }}
        onToggleHeadTree={(_show) => {
          // This is handled by the toolbar now
        }}
      >
        {({ cityData, sourceBadges, isBuilding }) => (
          <RepositoryViewSkeleton
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            cityData={cityData}
            highlightLayers={combinedLayers}
            loading={loading || isBuilding}
            treeStats={treeStats}
            sourceBadges={sourceBadges}
            toolbarItems={toolbarItems}
            toolbarExpanded={toolbarExpanded}
            onToolbarExpandedChange={setToolbarExpanded}
            onHelpClick={() => setShowHelpModal(true)}
            cityHeaderExtra={undefined}
            loadingMessage="Loading local repository"
            emptyMessage="Select a local clone"
            onFileClick={handleFileClick}
            rightPaneMode={rightPaneMode}
            onRightPaneModeChange={(mode) => {
              setRightPaneMode(mode as 'city' | 'session-detail');
            }}
            sessions={allAgentSessions}
            sessionFileActivities={sessionFileActivities}
            selectedSessionId={selectedSessionId}
            repository={repository}
            selectedSessionCardData={selectedSessionCardData}
            sessionColor={
              selectedSessionForDetail
                ? getAgentColor(selectedSessionForDetail)
                : '#3b82f6'
            }
            repositoryPath={localClone.path}
            sources={fileChangeSources}
            onOpenInEditor={async (filePath) => {
              try {
                const { UserPreferencesService } = await import(
                  '../../main-process-api/UserPreferencesService'
                );
                const { DEFAULT_EDITOR } = await import(
                  '../../../shared/types/editor.types'
                );
                const preferences =
                  await UserPreferencesService.getPreferences();
                const preferredEditor =
                  preferences.defaultEditor || DEFAULT_EDITOR;

                const result = await window.mainProcess?.shell?.openInEditor({
                  editor: preferredEditor,
                  dir: filePath,
                });
                if (!result?.success) {
                  console.error(
                    'Failed to open file in editor:',
                    result?.error,
                  );
                }
              } catch (error) {
                console.error('Error opening file in editor:', error);
              }
            }}
            onOpenAllInEditor={async (filePaths) => {
              try {
                const { UserPreferencesService } = await import(
                  '../../main-process-api/UserPreferencesService'
                );
                const { DEFAULT_EDITOR } = await import(
                  '../../../shared/types/editor.types'
                );
                const preferences =
                  await UserPreferencesService.getPreferences();
                const preferredEditor =
                  preferences.defaultEditor || DEFAULT_EDITOR;

                for (const filePath of filePaths) {
                  const result = await window.mainProcess?.shell?.openInEditor({
                    editor: preferredEditor,
                    dir: filePath,
                  });
                  if (!result?.success) {
                    console.error(
                      'Failed to open file in editor:',
                      filePath,
                      result?.error,
                    );
                  }
                }
              } catch (error) {
                console.error('Error opening files in editor:', error);
              }
            }}
            onOpenTerminal={async () => {
              if (selectedSessionForDetail) {
                // Check if we already have a terminal window for this session
                const existingWindowId = terminalWindows.get(
                  selectedSessionForDetail,
                );

                if (existingWindowId) {
                  // Focus existing terminal window
                  try {
                    await TerminalService.focusWindow(existingWindowId);
                    return; // Important: return here to avoid creating a new window
                  } catch (error) {
                    console.error(
                      '[LocalDev] Failed to focus terminal window:',
                      error,
                    );
                    // Window might be closed, remove from tracking and continue to create new one
                    setTerminalWindows((prev) => {
                      const newMap = new Map(prev);
                      newMap.delete(selectedSessionForDetail);
                      return newMap;
                    });
                    // Continue to create new window below
                  }
                }

                // Create new terminal window (no existing window or focus failed)
                try {
                  const command = `claude -r ${selectedSessionForDetail}`;
                  const terminalId = await TerminalService.createWithCommand(
                    localClone.path,
                    command,
                  );
                  const { windowId } = await TerminalService.popOut(terminalId);
                  setTerminalWindows((prev) =>
                    new Map(prev).set(selectedSessionForDetail, windowId),
                  );
                } catch (error) {
                  console.error('[LocalDev] Failed to create terminal:', error);
                }
              }
            }}
            onShowContext={() => {
              // Will be implemented within AgentSessionDetailView
              console.info(
                'Context view will be integrated into session detail view',
              );
            }}
            onViewEvents={() => {
              // Open event viewer modal for selected session
              if (selectedSessionForDetail && selectedSessionCardData) {
                // This would need to be implemented - for now just log
                console.info(
                  'View events for session:',
                  selectedSessionForDetail,
                );
              }
            }}
            onArchive={async () => {
              if (selectedSessionForDetail && selectedSessionCardData) {
                try {
                  await AgentSessionArchiveService.archiveSession(
                    selectedSessionForDetail,
                  );
                  // Clear the detail view after archiving
                  setSelectedSessionForDetail(null);
                  setSelectedSessionCardData(null);
                  setRightPaneMode('city');
                  // Trigger refresh to update the session list
                  if (onSessionRefresh) {
                    onSessionRefresh(selectedSessionForDetail);
                  }
                } catch (error) {
                  console.error('Failed to archive session:', error);
                }
              }
            }}
            onOpenPackageCommands={async (project) => {
              // Find the corresponding package layer and open command panel
              if (!fileTreeSourceService || !activeFileTreeSource?.id) return;

              try {
                const packages =
                  await fileTreeSourceService.detectPackagesForSource(
                    activeFileTreeSource.id,
                  );
                const matchingPackage = packages?.find(
                  (pkg) =>
                    pkg.packageData.path === project.path ||
                    pkg.packageData.name === project.name,
                );

                if (matchingPackage) {
                  // For now, just log - you can connect to PackageCommandPanel later
                  console.info(
                    '[LocalDev] Opening commands for package:',
                    project.name,
                  );
                  // TODO: setSelectedPackageForCommands(matchingPackage);
                  // TODO: setCommandPanelOpen(true);
                }
              } catch (error) {
                console.error(
                  '[LocalDev] Failed to open package commands:',
                  error,
                );
              }
            }}
            getTimeAgo={getTimeAgo}
          />
        )}
      </CityMapManager>

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        mode="develop"
      />
    </>
  );
};

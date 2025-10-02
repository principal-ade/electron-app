import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  parseMarkdownIntoPresentation,
  serializePresentationToMarkdown,
  updatePresentationSlide,
  type MarkdownPresentation,
} from 'themed-markdown';
import { debounce } from 'lodash';
import {
  Plus,
  Terminal,
  Search,
  FileText,
  Eye,
  Code,
  Save,
  Trash2,
  ChevronDown,
  PenTool,
  LayoutGrid,
  AlignJustify,
  PanelLeftClose,
  PanelLeft,
  Database,
  FolderOpen,
  Clock,
} from 'lucide-react';
import { ThemedMonaco } from '../../components/shared/ThemedMonaco';
import type { Repository } from '../../../shared/types/repository.types';
import { PlanningLeftTabType } from '../../../shared/types/userPreferences.types';
import TerminalPanel from '../../components/Terminal/TerminalPanel';
import { MarkdownSearchPanel } from './shared/MarkdownSearchPanel';
import { TerminalCleanupButton } from './shared/TerminalCleanupButton';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { TerminalService } from '../../main-process-api/TerminalService';
import { cleanupOrphanedTerminals } from '../../utils/terminalCleanup';
import { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { MonitoredFileTreeService } from '../../services/MonitoredFileTreeService';
import { FileTreeSource } from '../../types/file-tree-source';
import { ExcalidrawWrapper } from '../../components/shared/ExcalidrawWrapper';
import {
  ExcalidrawStorageService,
  DiagramListItem,
} from '../../main-process-api/ExcalidrawStorageService';
import { AlexandriaDrawingService } from '../../main-process-api/AlexandriaDrawingService';
import {
  DocumentType,
  StorageLocation,
} from '../../types/planning-storage.types';
import { ExcalidrawDiagramData } from '../../../shared/main-process-api-interfaces/ExcalidrawAPI';
import { MarkdownDocumentViewer } from './shared/MarkdownDocumentViewer';
import { PlanningEmptyState } from './shared/PlanningEmptyState';
import { PlanningAgentGuide } from './shared/PlanningAgentGuide';
import { PlanningStartOverlay } from './shared/PlanningStartOverlay';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { SupportedAgent, AGENT_INFO } from '@principal-ai/agent-monitoring';
import { PrincipalService } from '../../main-process-api/PrincipalService';
import type { AgentDocumentRequest } from '../../../shared/main-process-api-interfaces/PrincipalAPI';

interface PlanningViewProps {
  repository: Repository;
  localClone: { path: string; currentBranch?: string };
  agentsWithMCP?: SupportedAgent[];
  loadingAgentMCPStatus?: boolean;
  fileTree?: FileTree | null;
  activeFileTreeSource?: FileTreeSource | null;
  fileTreeSourceService?: FileTreeSourceService;
  cacheService?: MonitoredFileTreeService;
  uiState?: {
    viewMode?: 'slides' | 'document';
    showSegmented?: boolean;
    showEditor?: boolean;
    activeLeftTab?: Exclude<PlanningLeftTabType, 'storage'>;
  };
  onUIStateChange?: (state: {
    viewMode?: 'slides' | 'document';
    showSegmented?: boolean;
    showEditor?: boolean;
    activeLeftTab?: 'terminal' | 'search' | 'editor';
  }) => void;
}

interface SlideDocument {
  content: string | ExcalidrawDiagramData;
  presentation?: MarkdownPresentation; // For markdown documents
  currentSlide: number;
  type: DocumentType;
  storageLocation: StorageLocation;
  metadata: {
    title?: string;
    lastModified?: Date;
    filePath?: string;
    diagramId?: string;
  };
}

/**
 * Get the directory where planning documents should be stored.
 * Checks user preferences first, then falls back to default location.
 */
async function getPlanningDocumentsDirectory(
  repositoryPath: string,
): Promise<string> {
  try {
    // Check if user has a custom preference for planning documents directory
    const preferences = await UserPreferencesService.getPreferences();
    const customPath = preferences.planningDocumentsDirectory;

    if (customPath && typeof customPath === 'string') {
      // If it's a relative path, make it relative to repository root
      if (!customPath.startsWith('/')) {
        return `${repositoryPath}/${customPath}`;
      }
      // If it's absolute, use as-is
      return customPath;
    }
  } catch (err) {
    console.warn(
      '[PlanningView] Failed to get user preference for planning directory:',
      err,
    );
  }

  // Default to .principleMD/planning directory within the repository
  return `${repositoryPath}/.principleMD/planning`;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  repository,
  localClone,
  fileTree: sharedFileTree,
  activeFileTreeSource: sharedActiveSource,
  fileTreeSourceService: sharedFileTreeService,
  cacheService: sharedCacheService,
  agentsWithMCP: propsAgentsWithMCP = [],
  loadingAgentMCPStatus: propsLoadingAgentMCPStatus = false,
  uiState,
  onUIStateChange,
}) => {
  const { theme } = useTheme();
  const [slideDocument, setSlideDocument] = useState<SlideDocument>({
    content: '',
    presentation: undefined,
    currentSlide: 0,
    type: 'markdown',
    storageLocation: 'repository',
    metadata: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [_lastSaved, _setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // Store current Excalidraw data separately to avoid render loops
  const [currentExcalidrawData, setCurrentExcalidrawData] =
    useState<ExcalidrawDiagramData | null>(null);
  // Use refs to prevent render loops
  const isUpdatingExcalidraw = useRef(false);
  const lastExcalidrawElements = useRef<string | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<PlanningLeftTabType>(
    uiState?.activeLeftTab || 'search',
  );
  const [hasDocument, setHasDocument] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewDocumentConfirm, setShowNewDocumentConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [terminalSessionId, setTerminalSessionId] = useState<string | null>(
    null,
  );
  const [showNewDocumentMenu, setShowNewDocumentMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'slides' | 'document'>(
    uiState?.viewMode || 'slides',
  );
  const [showEditor, _setShowEditor] = useState(uiState?.showEditor || false);
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);
  const [showSegmented, setShowSegmented] = useState(
    uiState?.showSegmented ?? true,
  );
  const viewModeDropdownRef = useRef<HTMLDivElement>(null);
  const _terminalRef = useRef<HTMLDivElement | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent | null>(
    null,
  );
  const [showTerminal, setShowTerminal] = useState(false);
  const [showStartOverlay, setShowStartOverlay] = useState(true);
  const [startOverlayStep, setStartOverlayStep] = useState<
    'document' | 'format'
  >('document');
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [storageDiagrams, setStorageDiagrams] = useState<DiagramListItem[]>([]);
  const [alexandriaDiagrams, setAlexandriaDiagrams] = useState<DiagramListItem[]>([]);
  const [storageSearchQuery, setStorageSearchQuery] = useState('');
  const [loadingStorageDiagrams, setLoadingStorageDiagrams] = useState(false);
  const [agentDocumentRequest, setAgentDocumentRequest] =
    useState<AgentDocumentRequest | null>(null);

  // Use MCP status from props
  const agentsWithMCP = propsAgentsWithMCP;
  const _loadingAgentStatus = propsLoadingAgentMCPStatus;

  // Notify parent of UI state changes
  useEffect(() => {
    // Only notify if we have a handler and the state has actually been initialized
    if (onUIStateChange && hasDocument) {
      onUIStateChange({
        viewMode,
        showSegmented,
        showEditor,
        activeLeftTab:
          activeLeftTab === 'storage'
            ? undefined
            : (activeLeftTab as 'terminal' | 'search' | 'editor' | undefined),
      });
    }
  }, [viewMode, showSegmented, showEditor, activeLeftTab, hasDocument]); // Remove onUIStateChange from deps to avoid loops

  // Listen for agent document requests from MCP bridge
  useEffect(() => {
    const handleAgentDocumentRequest = (data: AgentDocumentRequest) => {
      console.info('[PlanningView] Received agent document request:', data);
      setAgentDocumentRequest(data);
    };

    // Subscribe to planning service event
    const unsubscribe = PrincipalService.onAgentDocumentRequest(
      handleAgentDocumentRequest,
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // File tree services and state - use shared if provided, otherwise create local
  const fileTreeSourceService = useMemo(
    () => sharedFileTreeService || new FileTreeSourceService(),
    [sharedFileTreeService],
  );
  const cacheService = useMemo(
    () => sharedCacheService || new MonitoredFileTreeService(),
    [sharedCacheService],
  );
  const [fileTree, setFileTree] = useState<FileTree | null>(
    sharedFileTree || null,
  );
  const [activeFileTreeSource, setActiveFileTreeSource] =
    useState<FileTreeSource | null>(sharedActiveSource || null);

  // Define callbacks outside of conditional rendering to avoid hooks error
  const handleTerminalCleanupComplete = useCallback(() => {
    console.info('[PlanningView] Terminal cleanup completed');
  }, []);

  const handleTerminalSessionCreated = useCallback((sessionId: string) => {
    console.info('[PlanningView] Terminal session created:', sessionId);
    setTerminalSessionId(sessionId);
  }, []);

  // Update local state when shared data changes
  useEffect(() => {
    if (sharedFileTree !== undefined) {
      setFileTree(sharedFileTree);
    }
  }, [sharedFileTree]);

  useEffect(() => {
    if (sharedActiveSource !== undefined) {
      setActiveFileTreeSource(sharedActiveSource);
    }
  }, [sharedActiveSource]);

  // Load document from file system or app data
  const loadDocument = useCallback(
    async (
      filePath: string,
      docType: DocumentType,
      storageLocation: StorageLocation,
      diagramId?: string,
    ) => {
      setLoading(true);
      setError(null);

      try {
        if (storageLocation === 'app-data' && diagramId) {
          // Load from app data storage
          const diagram = await ExcalidrawStorageService.loadDiagram(diagramId);
          if (!diagram) {
            throw new Error('Diagram not found in app data');
          }

          setSlideDocument({
            content: diagram.data,
            presentation: undefined,
            currentSlide: 0,
            type: 'excalidraw',
            storageLocation: 'app-data',
            metadata: {
              title: diagram.name,
              lastModified: diagram.updatedAt,
              diagramId: diagram.id,
            },
          });
          // Clear tracking refs when loading from app-data
          setCurrentExcalidrawData(null);
          lastExcalidrawElements.current = null;
        } else if (storageLocation === 'alexandria' && filePath) {
          // Load from Alexandria storage (.alexandria/drawings/)
          const diagramData = await AlexandriaDrawingService.loadDiagram(
            filePath,
            localClone.path,
          );

          if (!diagramData) {
            throw new Error('Diagram not found in Alexandria storage');
          }

          setSlideDocument({
            content: diagramData,
            presentation: undefined,
            currentSlide: 0,
            type: 'excalidraw',
            storageLocation: 'alexandria',
            metadata: {
              title: filePath.replace('.excalidraw', ''),
              lastModified: new Date(),
              filePath,
            },
          });
          // Clear tracking refs when loading from alexandria
          setCurrentExcalidrawData(null);
          lastExcalidrawElements.current = null;
        } else if (storageLocation === 'repository' && filePath) {
          // Load from file system
          const result = await FileSystemService.readFile(filePath);

          // For markdown files, allow empty content
          if (docType === 'markdown') {
            const content = result?.content || '';

            // Expand left panel for markdown documents
            setLeftPanelCollapsed(false);

            // Handle markdown
            const presentation = parseMarkdownIntoPresentation(content);
            setSlideDocument({
              content,
              presentation,
              currentSlide: 0,
              type: 'markdown',
              storageLocation: 'repository',
              metadata: {
                title:
                  filePath.split('/').pop()?.replace('.md', '') ||
                  'Planning Document',
                lastModified: new Date(),
                filePath,
              },
            });
          } else if (docType === 'excalidraw') {
            if (!result || !result.content) {
              throw new Error('Excalidraw file is empty or could not be read');
            }

            const content = result.content;

            // Parse Excalidraw JSON
            let excalidrawData: ExcalidrawDiagramData;
            try {
              excalidrawData = JSON.parse(content);
            } catch (err) {
              throw new Error('Invalid Excalidraw file format');
            }

            setSlideDocument({
              content: excalidrawData,
              presentation: undefined,
              currentSlide: 0,
              type: 'excalidraw',
              storageLocation: 'repository',
              metadata: {
                title:
                  filePath
                    .split('/')
                    .pop()
                    ?.replace(/\.(excalidraw|excalidraw\.json)$/, '') ||
                  'Excalidraw Diagram',
                lastModified: new Date(),
                filePath,
              },
            });
            // Clear tracking refs when loading Excalidraw document
            setCurrentExcalidrawData(null);
            lastExcalidrawElements.current = null;
          }
        }

        setHasDocument(true);
        setIsDirty(false);
        _setLastSaved(new Date());
        // Reset tracking refs when loading new document
        isUpdatingExcalidraw.current = true;
        lastExcalidrawElements.current = null;
        setTimeout(() => {
          isUpdatingExcalidraw.current = false;
        }, 1000); // Give Excalidraw time to initialize

        console.info('[PlanningView] Loaded document:', {
          filePath,
          type: docType,
          storageLocation,
          diagramId,
          hasMetadata: !!slideDocument.metadata,
        });
      } catch (err) {
        console.error('[PlanningView] Failed to load document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    },
    [parseMarkdownIntoPresentation],
  );

  // Save document to file system or app data
  const saveDocument = useCallback(async () => {
    console.info(
      '[PlanningView] saveDocument called, isDirty:',
      isDirty,
      'type:',
      slideDocument.type,
    );
    if (!isDirty) {
      setSaveMessage('No changes to save');
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }

    setIsSaving(true);
    setSaveMessage('Saving...');

    try {
      if (slideDocument.type === 'excalidraw') {
        if (slideDocument.storageLocation === 'app-data') {
          // Save to app data storage - use current data if available
          const dataToSave =
            currentExcalidrawData ||
            (slideDocument.content as ExcalidrawDiagramData);
          const diagramId = await ExcalidrawStorageService.saveDiagram(
            slideDocument.metadata.title || 'Untitled Diagram',
            dataToSave,
            localClone.path,
            slideDocument.metadata.diagramId,
          );

          // Update diagram ID if new
          if (!slideDocument.metadata.diagramId) {
            setSlideDocument((prev) => ({
              ...prev,
              metadata: {
                ...prev.metadata,
                diagramId,
              },
            }));
          }
        } else if (slideDocument.storageLocation === 'alexandria' && slideDocument.metadata.filePath) {
          // Save to Alexandria storage - use current data if available
          const dataToSave =
            currentExcalidrawData ||
            (slideDocument.content as ExcalidrawDiagramData);
          await AlexandriaDrawingService.saveDiagram(
            slideDocument.metadata.filePath,
            dataToSave,
            localClone.path,
          );
        } else if (slideDocument.metadata.filePath) {
          // Save to repository - use current data if available
          const dataToSave =
            currentExcalidrawData ||
            (slideDocument.content as ExcalidrawDiagramData);
          const jsonContent = JSON.stringify(dataToSave, null, 2);
          await FileSystemService.writeFile(
            slideDocument.metadata.filePath,
            jsonContent,
          );
        }
      } else if (slideDocument.metadata.filePath) {
        // Save markdown to repository
        await FileSystemService.writeFile(
          slideDocument.metadata.filePath,
          slideDocument.content as string,
        );
      }

      setIsDirty(false);
      _setLastSaved(new Date());
      setSaveMessage('Saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
      console.info(
        '[PlanningView] Saved document:',
        slideDocument.metadata.filePath || slideDocument.metadata.diagramId,
      );
    } catch (err) {
      console.error('[PlanningView] Failed to save document:', err);
      setError('Failed to save document');
      setSaveMessage('Failed to save!');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [slideDocument, isDirty, localClone.path, currentExcalidrawData]);

  // Handle slide navigation
  const navigateToSlide = useCallback(
    (slideNumber: number) => {
      const slideCount = slideDocument.presentation?.slides.length || 0;
      if (slideNumber >= 0 && slideNumber < slideCount) {
        setSlideDocument((prev) => ({
          ...prev,
          currentSlide: slideNumber,
        }));
      }
    },
    [slideDocument.presentation?.slides.length],
  );

  // Keyboard shortcuts and click outside handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save shortcut: Cmd+S or Ctrl+S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && slideDocument.metadata.filePath) {
          saveDocument();
        }
      }

      // Arrow key navigation for slides (only in slides view mode for markdown documents)
      if (
        slideDocument.type === 'markdown' &&
        viewMode === 'slides' &&
        hasDocument &&
        activeLeftTab !== 'editor'
      ) {
        // Don't navigate if user is typing in an input or textarea
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.getAttribute('contenteditable') === 'true');

        if (!isInputFocused) {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateToSlide(Math.max(0, slideDocument.currentSlide - 1));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const maxSlide =
              (slideDocument.presentation?.slides.length || 1) - 1;
            navigateToSlide(Math.min(maxSlide, slideDocument.currentSlide + 1));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Find the slide content container and scroll it
            e.preventDefault();
            const slideContainer = document.querySelector(
              '[data-slide-container="true"]',
            );
            if (slideContainer) {
              const scrollAmount = 100; // Pixels to scroll
              if (e.key === 'ArrowDown') {
                slideContainer.scrollBy({
                  top: scrollAmount,
                  behavior: 'smooth',
                });
              } else {
                slideContainer.scrollBy({
                  top: -scrollAmount,
                  behavior: 'smooth',
                });
              }
            }
          }
        }
      }

      // Close dialogs on Escape
      if (e.key === 'Escape') {
        if (showNewDocumentMenu) {
          setShowNewDocumentMenu(false);
        }
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        }
        if (showViewModeDropdown) {
          setShowViewModeDropdown(false);
        }
      }
    };

    // Handle click outside for dropdowns
    const handleClickOutside = (e: MouseEvent) => {
      if (
        viewModeDropdownRef.current &&
        !viewModeDropdownRef.current.contains(e.target as Node)
      ) {
        setShowViewModeDropdown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    if (showViewModeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isDirty,
    slideDocument.metadata.filePath,
    slideDocument.type,
    slideDocument.currentSlide,
    slideDocument.presentation?.slides.length,
    viewMode,
    hasDocument,
    activeLeftTab,
    saveDocument,
    showDeleteConfirm,
    showNewDocumentMenu,
    showViewModeDropdown,
    navigateToSlide,
  ]);

  // Start terminal session with selected agent
  const startTerminalWithAgent = useCallback((agent?: SupportedAgent) => {
    if (agent) {
      setSelectedAgent(agent);
      setShowTerminal(true);
      setActiveLeftTab('terminal');
      console.info('[PlanningView] Starting terminal with agent:', agent);
    }
  }, []);

  // Handle start overlay choices
  const handleStartChoice = useCallback(
    async (options: {
      documentType: 'new' | 'existing';
      format?: 'markdown' | 'excalidraw';
      storageLocation?: 'repository' | 'app-data' | 'alexandria';
    }) => {
      setShowStartOverlay(false);
      setStartOverlayStep('document'); // Reset for next time

      if (options.documentType === 'new' && options.format) {
        await createNewDocument(options.format, options.storageLocation || 'app-data', true);
      } else if (options.documentType === 'existing') {
        // For existing documents, default to storage tab (App Docs)
        setActiveLeftTab('storage');
      }
      // For existing documents, user will select from file browser
    },
    [],
  );

  // Load storage diagrams
  const loadStorageDiagrams = useCallback(async () => {
    setLoadingStorageDiagrams(true);
    try {
      // Load app-data diagrams
      const appDiagrams = await ExcalidrawStorageService.listDiagrams(
        localClone.path,
      );
      setStorageDiagrams(appDiagrams);

      // Load Alexandria diagrams
      const alexDiagrams = await AlexandriaDrawingService.listDiagrams(
        localClone.path,
      );
      setAlexandriaDiagrams(alexDiagrams);
    } catch (error) {
      console.error('Failed to load storage diagrams:', error);
    } finally {
      setLoadingStorageDiagrams(false);
    }
  }, [localClone.path]);

  // Load storage diagrams when switching to storage tab
  useEffect(() => {
    if (activeLeftTab === 'storage') {
      loadStorageDiagrams();
    }
  }, [activeLeftTab, loadStorageDiagrams]);

  // Create new document (markdown or excalidraw)
  const createNewDocument = useCallback(
    async (
      type: DocumentType = 'markdown',
      storageLocation: StorageLocation = 'app-data',
      fromOverlay: boolean = false,
    ) => {
      if (type === 'excalidraw') {
        // Collapse left panel for maximum canvas space when creating new Excalidraw documents
        if (fromOverlay) {
          setLeftPanelCollapsed(true);
        }

        if (storageLocation === 'repository') {
          // Create .excalidraw file in repository
          const fileName = `diagram-${Date.now()}.excalidraw`;
          const filePath = `${localClone.path}/${fileName}`;

          const defaultContent =
            ExcalidrawStorageService.createDefaultDiagramData();

          try {
            await FileSystemService.writeFile(
              filePath,
              JSON.stringify(defaultContent, null, 2),
            );
            await loadDocument(filePath, 'excalidraw', 'repository');
          } catch (err) {
            console.error(
              '[PlanningView] Failed to create Excalidraw document:',
              err,
            );
            setError('Failed to create Excalidraw document');
          }
        } else if (storageLocation === 'alexandria') {
          // Create in Alexandria storage (.alexandria/drawings/)
          const fileName = `diagram-${Date.now()}.excalidraw`;
          const defaultContent =
            ExcalidrawStorageService.createDefaultDiagramData();

          try {
            await AlexandriaDrawingService.saveDiagram(
              fileName,
              defaultContent,
              localClone.path,
            );
            await loadDocument(fileName, 'excalidraw', 'alexandria');
          } catch (err) {
            console.error(
              '[PlanningView] Failed to create Excalidraw in Alexandria:',
              err,
            );
            setError('Failed to create Excalidraw document in Alexandria');
          }
        } else {
          // Create in app data storage (will be handled by ExcalidrawWrapper on first save)
          setSlideDocument({
            content: ExcalidrawStorageService.createDefaultDiagramData(),
            presentation: undefined,
            currentSlide: 0,
            type: 'excalidraw',
            storageLocation: 'app-data',
            metadata: {
              title: 'New Diagram',
            },
          });
          setHasDocument(true);
          setIsDirty(false);
          // Clear tracking refs when creating new Excalidraw document
          setCurrentExcalidrawData(null);
          lastExcalidrawElements.current = null;
        }
      } else {
        // Expand left panel for markdown documents
        setLeftPanelCollapsed(false);

        // Create markdown document in planning directory
        const fileName = `planning-${Date.now()}.md`;
        const planningDir = await getPlanningDocumentsDirectory(
          localClone.path,
        );
        const filePath = `${planningDir}/${fileName}`;

        // Note: Directory creation is handled automatically by the main process when writing the file

        const defaultContent = '';

        try {
          await FileSystemService.writeFile(filePath, defaultContent);
          await loadDocument(filePath, 'markdown', 'repository');
          // Automatically switch to editor tab for new markdown documents
          setActiveLeftTab('editor');
        } catch (err) {
          console.error('[PlanningView] Failed to create document:', err);
          setError('Failed to create document');
        }
      }

      setShowNewDocumentMenu(false);
    },
    [localClone.path, repository.name, loadDocument],
  );

  // Delete document
  // Rename document
  const renameDocument = useCallback(
    async (newTitle: string) => {
      if (!newTitle.trim()) {
        console.warn('[PlanningView] Cannot rename to empty title');
        return;
      }

      try {
        const oldTitle = slideDocument.metadata.title;

        if (slideDocument.storageLocation === 'app-data') {
          // For app data storage, update the diagram metadata
          if (slideDocument.metadata.diagramId) {
            // Update the diagram name in app storage
            await ExcalidrawStorageService.saveDiagram(
              newTitle,
              slideDocument.content as ExcalidrawDiagramData,
              localClone.path,
              slideDocument.metadata.diagramId,
            );

            // Update local state
            setSlideDocument((prev) => ({
              ...prev,
              metadata: {
                ...prev.metadata,
                title: newTitle,
              },
            }));

            console.info(
              '[PlanningView] Renamed diagram in app data:',
              oldTitle,
              '->',
              newTitle,
            );
          }
        } else if (slideDocument.metadata.filePath) {
          // For repository storage, rename the actual file
          const currentPath = slideDocument.metadata.filePath;
          const pathParts = currentPath.split('/');
          const currentFileName = pathParts[pathParts.length - 1];
          const extension =
            slideDocument.type === 'excalidraw' ? '.excalidraw' : '.md';

          // Ensure the new title has the correct extension
          let newFileName = newTitle;
          if (!newFileName.endsWith(extension)) {
            newFileName += extension;
          }

          // Build the new path
          pathParts[pathParts.length - 1] = newFileName;
          const newPath = pathParts.join('/');

          // Use shell command to rename the file
          const { ShellService } = await import(
            '../../main-process-api/ShellService'
          );
          const result = await ShellService.runCommand(
            `mv "${currentPath}" "${newPath}"`,
            { cwd: localClone.path },
          );

          if (!result.success) {
            throw new Error(result.error || 'Failed to rename file');
          }

          // Update local state with new path and title
          setSlideDocument((prev) => ({
            ...prev,
            metadata: {
              ...prev.metadata,
              filePath: newPath,
              title: newTitle,
            },
          }));

          console.info(
            '[PlanningView] Renamed file:',
            currentPath,
            '->',
            newPath,
          );
        } else {
          // For unsaved documents, just update the title in memory
          setSlideDocument((prev) => ({
            ...prev,
            metadata: {
              ...prev.metadata,
              title: newTitle,
            },
          }));
          console.info(
            '[PlanningView] Updated title for unsaved document:',
            newTitle,
          );
        }

        setIsEditingTitle(false);
        setEditingTitle('');
      } catch (error) {
        console.error('[PlanningView] Failed to rename document:', error);
        // Show error to user (could add an error modal here)
        setError(
          `Failed to rename document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setTimeout(() => setError(null), 3000);
      }
    },
    [slideDocument, localClone.path],
  );

  const deleteDocument = useCallback(async () => {
    try {
      // Handle deletion based on storage location and document state
      if (slideDocument.storageLocation === 'app-data') {
        if (slideDocument.metadata.diagramId) {
          // Delete saved diagram from app data storage
          await ExcalidrawStorageService.deleteDiagram(
            slideDocument.metadata.diagramId,
          );
          console.info(
            '[PlanningView] Deleted diagram from app data:',
            slideDocument.metadata.diagramId,
          );
        } else {
          // Unsaved Excalidraw document - just clear it
          console.info('[PlanningView] Clearing unsaved Excalidraw document');
        }
      } else if (slideDocument.metadata.filePath) {
        // Use shell to move file to trash (safer than permanent deletion)
        const result = await window.mainProcess?.shell?.moveToTrash(
          slideDocument.metadata.filePath,
        );

        if (result?.success === false) {
          throw new Error(result.error || 'Failed to move file to trash');
        }

        console.info(
          '[PlanningView] Moved document to trash:',
          slideDocument.metadata.filePath,
        );
      } else if (
        slideDocument.type === 'markdown' &&
        !slideDocument.metadata.filePath
      ) {
        // Unsaved markdown document - just clear it
        console.info('[PlanningView] Clearing unsaved markdown document');
      } else {
        console.error(
          '[PlanningView] Cannot delete: unexpected document state',
          slideDocument,
        );
        setError('Cannot delete document: unexpected state');
        setShowDeleteConfirm(false);
        return;
      }

      // Clear the current document
      setSlideDocument({
        content: '',
        presentation: undefined,
        currentSlide: 0,
        type: 'markdown',
        storageLocation: 'repository',
        metadata: {},
      });
      setHasDocument(false);
      setIsDirty(false);
      setShowDeleteConfirm(false);
      setShowTerminal(false); // Also close terminal if open
      setSelectedAgent(null);

      // Invalidate cache and trigger refresh from RepositoryManager (only for repository files)
      if (
        slideDocument.storageLocation === 'repository' &&
        slideDocument.metadata.filePath &&
        activeFileTreeSource &&
        cacheService
      ) {
        cacheService.removeTree(activeFileTreeSource.id);
        // Dispatch event to trigger RepositoryManager to reload
        window.dispatchEvent(
          new CustomEvent('filetree:cache-invalidated', {
            detail: { repoPath: activeFileTreeSource.location },
          }),
        );
      }
    } catch (err) {
      console.error('[PlanningView] Failed to delete document:', err);
      setError('Failed to delete document');
      setShowDeleteConfirm(false);
    }
  }, [slideDocument, activeFileTreeSource, cacheService]);

  // Handle slide updates from MCP tools
  const handleSlideUpdate = useCallback(
    (slideNumber: number, content: string) => {
      setSlideDocument((prev) => {
        if (!prev.presentation) return prev;

        const updatedPresentation = updatePresentationSlide(
          prev.presentation,
          slideNumber,
          content,
        );
        const newContent = serializePresentationToMarkdown(updatedPresentation);

        return {
          ...prev,
          content: newContent,
          presentation: updatedPresentation,
        };
      });
      setIsDirty(true);
    },
    [],
  );

  // Handle slide creation
  const handleCreateSlide = useCallback(
    (
      position: 'before' | 'after' | 'end',
      content: string = '# New Slide\n\nContent here...',
    ) => {
      setSlideDocument((prev) => {
        if (!prev.presentation) {
          // If no presentation yet, create one with the new slide
          const newContent = content;
          const newPresentation = parseMarkdownIntoPresentation(newContent);
          return {
            ...prev,
            content: newContent,
            presentation: newPresentation,
            currentSlide: 0,
          };
        }

        // Get existing slides content
        const slides = prev.presentation.slides.map((s) => s.location.content);

        if (position === 'end') {
          slides.push(content);
        } else {
          const insertIndex =
            position === 'before' ? prev.currentSlide : prev.currentSlide + 1;
          slides.splice(insertIndex, 0, content);
        }

        const newContent = slides.join('\n\n---\n\n');
        const newPresentation = parseMarkdownIntoPresentation(newContent);
        const newCurrentSlide =
          position === 'before'
            ? prev.currentSlide + 1
            : position === 'after'
              ? prev.currentSlide + 1
              : slides.length - 1;

        return {
          ...prev,
          content: newContent,
          presentation: newPresentation,
          currentSlide: newCurrentSlide,
        };
      });
      setIsDirty(true);
    },
    [],
  );

  // Handle slide deletion
  const handleDeleteSlide = useCallback((slideNumber: number) => {
    setSlideDocument((prev) => {
      if (!prev.presentation || prev.presentation.slides.length <= 1)
        return prev; // Don't delete the last slide

      const slides = prev.presentation.slides
        .map((s) => s.location.content)
        .filter((_, index) => index !== slideNumber);

      const newContent = slides.join('\n\n---\n\n');
      const newPresentation = parseMarkdownIntoPresentation(newContent);
      const newCurrentSlide = Math.min(prev.currentSlide, slides.length - 1);

      return {
        ...prev,
        content: newContent,
        presentation: newPresentation,
        currentSlide: newCurrentSlide,
      };
    });
    setIsDirty(true);
  }, []);

  // Listen for updates from the Principal MCP Bridge (when agents make changes)
  useEffect(() => {
    const currentDocumentPath = slideDocument.metadata.filePath;
    console.info(
      '[PlanningView] Setting up IPC listeners for document:',
      currentDocumentPath,
    );

    // Listen for slide updates from MCP bridge
    const handleSlideUpdatedFromBridge = (data: any) => {
      console.info('[PlanningView] Received slide-updated event:', data);

      // Defensive check for data structure
      if (!data || !data.filePath) {
        console.error(
          '[PlanningView] Invalid data received in slide-updated event:',
          data,
        );
        return;
      }

      // Only update if this event is for the EXACT current document
      // Remove the overly permissive !currentDocumentPath condition
      const isCurrentDocument =
        currentDocumentPath && data.filePath === currentDocumentPath;

      if (isCurrentDocument) {
        console.info(
          '[PlanningView] Updating slides from Principal MCP bridge for file:',
          data.filePath,
        );

        // Make sure we have the required data
        if (data.slides && Array.isArray(data.slides)) {
          const content = data.slides.join('\n\n---\n\n');
          const presentation = parseMarkdownIntoPresentation(content);

          // Only update if we have a document loaded and it matches
          setSlideDocument((prev) => ({
            ...prev, // Preserve existing metadata and state
            content,
            presentation,
            currentSlide: data.currentSlide || prev.currentSlide,
            metadata: {
              ...prev.metadata, // Preserve existing metadata like title
              lastModified: new Date(),
              filePath: data.filePath,
            },
          }));
        }
      } else {
        console.info(
          '[PlanningView] Event for different document, ignoring:',
          data.filePath,
          'current:',
          currentDocumentPath,
        );
      }
    };

    // Listen for navigation events
    const handleSlideNavigatedFromBridge = (data: any) => {
      console.info('[PlanningView] Received slide-navigated event:', data);

      // Defensive check for data structure
      if (!data || !data.filePath) {
        console.error(
          '[PlanningView] Invalid data received in slide-navigated event:',
          data,
        );
        return;
      }

      // Only update if this event is for the EXACT current document
      const isCurrentDocument =
        currentDocumentPath && data.filePath === currentDocumentPath;

      if (isCurrentDocument) {
        console.info('[PlanningView] Navigating to slide:', data.currentSlide);

        // If we have content in the navigation event, update the whole document
        if (data.content && data.totalSlides) {
          // Ensure we have enough slides
          let currentSlides =
            slideDocument.presentation?.slides.map((s) => s.location.content) ||
            [];

          // If the total slides is different, we need to adjust
          if (data.totalSlides > currentSlides.length) {
            // Pad with empty slides
            while (currentSlides.length < data.totalSlides) {
              currentSlides.push('# New Slide\n\nContent pending...');
            }
          } else if (data.totalSlides < currentSlides.length) {
            // Trim excess slides
            currentSlides = currentSlides.slice(0, data.totalSlides);
          }

          // Update the specific slide if we have content
          if (data.currentSlide < currentSlides.length) {
            currentSlides[data.currentSlide] = data.content;
          }

          const content = currentSlides.join('\n\n---\n\n');
          const presentation = parseMarkdownIntoPresentation(content);
          setSlideDocument({
            content,
            presentation,
            currentSlide: data.currentSlide || 0,
            type: 'markdown',
            storageLocation: 'repository',
            metadata: {
              title:
                data.filePath.split('/').pop()?.replace('.md', '') ||
                `${repository.name} Planning`,
              lastModified: new Date(),
              filePath: data.filePath,
            },
          });
        } else {
          // Just update the current slide index
          setSlideDocument((prev) => ({
            ...prev,
            currentSlide: data.currentSlide || 0,
          }));
        }
      }
    };

    // Listen for document load events
    const handleDocumentLoadedFromBridge = (data: any) => {
      console.info('[PlanningView] Received document-loaded event:', data);

      if (!data || !data.filePath) {
        console.error(
          '[PlanningView] Invalid data received in document-loaded event:',
          data,
        );
        return;
      }

      // Only load if we don't have a document OR if the user explicitly requested this document
      // This prevents accidentally overwriting unsaved work
      const shouldLoadDocument =
        !hasDocument ||
        !currentDocumentPath ||
        data.filePath === currentDocumentPath;

      if (shouldLoadDocument && data.slides && Array.isArray(data.slides)) {
        const content = data.slides.join('\n\n---\n\n');
        const presentation = parseMarkdownIntoPresentation(content);
        setSlideDocument({
          content,
          presentation,
          currentSlide: data.currentSlide || 0,
          type: 'markdown',
          storageLocation: 'repository',
          metadata: {
            title:
              data.filePath.split('/').pop()?.replace('.md', '') ||
              `${repository.name} Planning`,
            lastModified: new Date(),
            filePath: data.filePath,
          },
        });
        setHasDocument(true);
        console.info(
          '[PlanningView] Document loaded:',
          data.filePath,
          'with',
          data.slides.length,
          'slides',
        );
      } else {
        console.info(
          '[PlanningView] Ignoring document-loaded event - document already active:',
          currentDocumentPath,
        );
      }
    };

    // Register planning event listeners using PrincipalService
    const unsubscribeSlideUpdated = PrincipalService.onSlideUpdated(
      handleSlideUpdatedFromBridge,
    );
    const unsubscribeSlideNavigated = PrincipalService.onSlideNavigated(
      handleSlideNavigatedFromBridge,
    );
    const unsubscribeDocumentLoaded = PrincipalService.onDocumentLoaded(
      handleDocumentLoadedFromBridge,
    );

    // Cleanup
    return () => {
      unsubscribeSlideUpdated();
      unsubscribeSlideNavigated();
      unsubscribeDocumentLoaded();
    };
  }, [slideDocument.metadata.filePath, repository.name]);

  // Initialize file tree sources
  useEffect(() => {
    const sources = fileTreeSourceService.initializeFromRepository(repository);

    // Find and set the local source for the current clone
    const localSource = sources.find(
      (s) => s.type === 'local' && s.location === localClone.path,
    );

    if (localSource) {
      fileTreeSourceService.setActiveSource(localSource.id);
      setActiveFileTreeSource(localSource);
    }
  }, [repository, localClone, fileTreeSourceService]);

  // Debounced handler for Excalidraw changes
  const handleExcalidrawChange = useMemo(
    () =>
      debounce((elements: any, appState: any) => {
        if (isUpdatingExcalidraw.current) return;

        // Check if elements actually changed
        const elementsStr = JSON.stringify(elements);
        if (lastExcalidrawElements.current === elementsStr) return;

        // If this is the first time we're seeing elements, just store them without marking dirty
        if (lastExcalidrawElements.current === null) {
          lastExcalidrawElements.current = elementsStr;
          // Store the initial data but don't mark as dirty
          const newData: ExcalidrawDiagramData = {
            type: 'excalidraw' as const,
            version: 2,
            source: 'PrincipleMD',
            elements,
            appState: {
              ...appState,
              // Remove viewport properties that can change frequently
              scrollX: undefined,
              scrollY: undefined,
              width: undefined,
              height: undefined,
              offsetLeft: undefined,
              offsetTop: undefined,
              collaborators: undefined,
            },
            files:
              (slideDocument.content as ExcalidrawDiagramData)?.files || {},
            libraryItems:
              (slideDocument.content as ExcalidrawDiagramData)?.libraryItems ||
              [],
          };
          setCurrentExcalidrawData(newData);
          return; // Don't mark as dirty on initial load
        }

        lastExcalidrawElements.current = elementsStr;

        const newData: ExcalidrawDiagramData = {
          type: 'excalidraw' as const,
          version: 2,
          source: 'PrincipleMD',
          elements,
          appState: {
            ...appState,
            // Remove viewport properties that can change frequently
            scrollX: undefined,
            scrollY: undefined,
            width: undefined,
            height: undefined,
            offsetLeft: undefined,
            offsetTop: undefined,
            collaborators: undefined,
          },
          files: (slideDocument.content as ExcalidrawDiagramData)?.files || {},
          libraryItems:
            (slideDocument.content as ExcalidrawDiagramData)?.libraryItems ||
            [],
        };

        setCurrentExcalidrawData(newData);
        setIsDirty(true);
      }, 500), // Debounce for 500ms
    [slideDocument.content],
  );

  // PlanningView should never load its own tree - always use the one from RepositoryManager
  useEffect(() => {
    if (!sharedFileTree) {
      console.error(
        '[PlanningView] No file tree provided by RepositoryManager',
      );
    } else {
      console.info(
        '[PlanningView] Using shared file tree with',
        sharedFileTree.allFiles.length,
        'files',
      );
    }
  }, [sharedFileTree]);

  // Clean up orphaned terminals on mount and cleanup on unmount
  useEffect(() => {
    // Clean up any orphaned terminals when component mounts
    cleanupOrphanedTerminals(
      terminalSessionId ? [terminalSessionId] : [],
    ).catch((err) => {
      console.error(
        '[PlanningView] Failed to cleanup orphaned terminals:',
        err,
      );
    });

    return () => {
      // Cancel any pending debounced operations
      handleExcalidrawChange.cancel();

      if (terminalSessionId) {
        console.info(
          '[PlanningView] Cleaning up terminal session:',
          terminalSessionId,
        );
        TerminalService.destroy(terminalSessionId).catch((err) => {
          console.error(
            '[PlanningView] Failed to cleanup terminal session:',
            err,
          );
        });
      }
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        gap: '16px',
        padding: '16px',
        backgroundColor: theme.colors.background,
      }}
    >
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeInScale {
            from { 
              opacity: 0; 
              transform: scale(0.95) translateY(10px);
            }
            to { 
              opacity: 1; 
              transform: scale(1) translateY(0);
            }
          }
        `}
      </style>
      {/* Start Planning Cover - shows when requested */}
      {showStartOverlay ? (
        <div
          style={{
            flex: 1,
            position: 'relative',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            minHeight: '500px',
          }}
        >
          <PlanningStartOverlay
            theme={theme}
            onStart={handleStartChoice}
            initialStep={startOverlayStep}
          />
        </div>
      ) : (
        <>
          {/* Left Panel: Tabbed Terminal/Search */}
          {!leftPanelCollapsed && (
            <div
              style={{
                flex: 1,
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Tab Headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    hasDocument && slideDocument.type === 'markdown'
                      ? showTerminal
                        ? '1fr 1fr 1fr 1fr'
                        : '1fr 1fr 1fr'
                      : showTerminal
                        ? '1fr 1fr 1fr'
                        : '1fr 1fr',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundLight,
                  padding: '0 8px',
                  flexShrink: 0,
                }}
              >
                {/* Storage Tab */}
                <button
                  onClick={() => setActiveLeftTab('storage')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    color:
                      activeLeftTab === 'storage'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    border: 'none',
                    borderBottom:
                      activeLeftTab === 'storage'
                        ? `3px solid ${theme.colors.primary}`
                        : '3px solid transparent',
                    marginBottom: activeLeftTab === 'storage' ? '-2px' : '-2px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: activeLeftTab === 'storage' ? 600 : 400,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: activeLeftTab === 'storage' ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    if (activeLeftTab !== 'storage') {
                      e.currentTarget.style.opacity = '0.9';
                      e.currentTarget.style.color = theme.colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeLeftTab !== 'storage') {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }
                  }}
                >
                  <span>App Docs</span>
                </button>

                {/* Repo Documents Tab (formerly Search) */}
                <button
                  onClick={() => setActiveLeftTab('search')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    color:
                      activeLeftTab === 'search'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    border: 'none',
                    borderBottom:
                      activeLeftTab === 'search'
                        ? `3px solid ${theme.colors.primary}`
                        : '3px solid transparent',
                    marginBottom: activeLeftTab === 'search' ? '-2px' : '-2px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: activeLeftTab === 'search' ? 600 : 400,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: activeLeftTab === 'search' ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    if (activeLeftTab !== 'search') {
                      e.currentTarget.style.opacity = '0.9';
                      e.currentTarget.style.color = theme.colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeLeftTab !== 'search') {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }
                  }}
                >
                  <span>Repo Documents</span>
                </button>

                {/* Editor Tab - only show for markdown documents */}
                {hasDocument && slideDocument.type === 'markdown' && (
                  <button
                    onClick={() => setActiveLeftTab('editor')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      color:
                        activeLeftTab === 'editor'
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                      border: 'none',
                      borderBottom:
                        activeLeftTab === 'editor'
                          ? `3px solid ${theme.colors.primary}`
                          : '3px solid transparent',
                      marginBottom:
                        activeLeftTab === 'editor' ? '-2px' : '-2px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: activeLeftTab === 'editor' ? 600 : 400,
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: activeLeftTab === 'editor' ? 1 : 0.7,
                    }}
                    onMouseEnter={(e) => {
                      if (activeLeftTab !== 'editor') {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.color = theme.colors.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeLeftTab !== 'editor') {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.color =
                          theme.colors.textSecondary;
                      }
                    }}
                  >
                    <span>Editor</span>
                  </button>
                )}

                {showTerminal && (
                  <button
                    onClick={() => setActiveLeftTab('terminal')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      color:
                        activeLeftTab === 'terminal'
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                      border: 'none',
                      borderBottom:
                        activeLeftTab === 'terminal'
                          ? `3px solid ${theme.colors.primary}`
                          : '3px solid transparent',
                      marginBottom:
                        activeLeftTab === 'terminal' ? '-2px' : '-2px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: activeLeftTab === 'terminal' ? 600 : 400,
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: activeLeftTab === 'terminal' ? 1 : 0.7,
                    }}
                    onMouseEnter={(e) => {
                      if (activeLeftTab !== 'terminal') {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.color = theme.colors.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeLeftTab !== 'terminal') {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.color =
                          theme.colors.textSecondary;
                      }
                    }}
                  >
                    <span>
                      {selectedAgent
                        ? AGENT_INFO[selectedAgent].displayName
                        : 'Terminal'}
                    </span>
                  </button>
                )}
              </div>

              {/* Terminal Cleanup Button - moved outside tabs */}
              {activeLeftTab === 'terminal' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 10,
                  }}
                >
                  <TerminalCleanupButton
                    currentSessionId={terminalSessionId}
                    onCleanupComplete={handleTerminalCleanupComplete}
                  />
                </div>
              )}

              {/* Tab Content */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Search Tab */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    visibility:
                      activeLeftTab === 'search' ? 'visible' : 'hidden',
                    pointerEvents: activeLeftTab === 'search' ? 'auto' : 'none',
                  }}
                >
                  <MarkdownSearchPanel
                    baseDirectory={localClone.path}
                    onDocumentSelect={(
                      filePath,
                      type,
                      storageLocation,
                      diagramId,
                    ) =>
                      loadDocument(filePath, type, storageLocation, diagramId)
                    }
                    onDocumentDeleted={async (deletedPath) => {
                      // Clear the current document if it was deleted
                      if (deletedPath === slideDocument.metadata.filePath) {
                        setSlideDocument({
                          content: '',
                          presentation: undefined,
                          currentSlide: 0,
                          type: 'markdown',
                          storageLocation: 'repository',
                          metadata: {},
                        });
                        setHasDocument(false);
                        setIsDirty(false);
                      }

                      // Update the file tree in memory only (no reload from disk)
                      // This keeps the cache in sync without triggering a search
                      if (fileTree && deletedPath) {
                        // Remove the file from the tree's allFiles array
                        const updatedFiles = fileTree.allFiles.filter(
                          (file) => {
                            const fullPath = file.path.startsWith('/')
                              ? file.path
                              : `${localClone.path}/${file.path}`.replace(
                                  /\/+/g,
                                  '/',
                                );
                            return fullPath !== deletedPath;
                          },
                        );

                        // Create a new FileTree instance with updated files
                        // This updates the tree without triggering a re-search
                        if (updatedFiles.length !== fileTree.allFiles.length) {
                          setFileTree({
                            ...fileTree,
                            allFiles: updatedFiles,
                          });
                        }
                      }
                    }}
                    selectedDocument={slideDocument.metadata.filePath}
                  />
                </div>

                {/* Editor Tab - only show for markdown documents */}
                {hasDocument && slideDocument.type === 'markdown' && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      visibility:
                        activeLeftTab === 'editor' ? 'visible' : 'hidden',
                      pointerEvents:
                        activeLeftTab === 'editor' ? 'auto' : 'none',
                      padding: '16px',
                      backgroundColor: theme.colors.background,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        gap: '12px',
                      }}
                    >
                      {/* Editor Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '8px',
                          borderBottom: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Code size={16} />
                          <span>
                            {viewMode === 'slides'
                              ? `Slide ${slideDocument.currentSlide + 1} Editor`
                              : 'Document Editor'}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {isDirty ? 'Unsaved changes' : 'Saved'} •
                          {slideDocument.presentation?.slides.length || 0}{' '}
                          slides
                        </div>
                      </div>

                      {/* Monaco Editor */}
                      <div style={{ flex: 1 }}>
                        <ThemedMonaco
                          value={
                            viewMode === 'slides'
                              ? slideDocument.presentation?.slides[
                                  slideDocument.currentSlide
                                ]?.location.content || ''
                              : (slideDocument.content as string) || ''
                          }
                          onChange={(newValue) => {
                            if (viewMode === 'slides') {
                              // Update just the current slide
                              const slides =
                                slideDocument.presentation?.slides || [];
                              const newSlides = slides.map(
                                (slide) => slide.location.content,
                              );
                              newSlides[slideDocument.currentSlide] =
                                newValue || '';
                              const newContent = newSlides.join('\n\n---\n\n');
                              const newPresentation =
                                parseMarkdownIntoPresentation(newContent);
                              setSlideDocument((prev) => ({
                                ...prev,
                                content: newContent,
                                presentation: newPresentation,
                              }));
                            } else {
                              // Update the entire document
                              const newPresentation =
                                parseMarkdownIntoPresentation(newValue || '');
                              setSlideDocument((prev) => ({
                                ...prev,
                                content: newValue || '',
                                presentation: newPresentation,
                              }));
                            }
                            setIsDirty(true);
                          }}
                          language="markdown"
                          height="100%"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Terminal Tab */}
                {showTerminal && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#1e1e1e',
                      visibility:
                        activeLeftTab === 'terminal' ? 'visible' : 'hidden',
                      pointerEvents:
                        activeLeftTab === 'terminal' ? 'auto' : 'none',
                    }}
                  >
                    <TerminalPanel
                      directory={localClone.path}
                      hideHeader={true}
                      isVisible={activeLeftTab === 'terminal'}
                      autoFocus={activeLeftTab === 'terminal'}
                      terminalId={terminalSessionId || undefined}
                      onSessionCreated={handleTerminalSessionCreated}
                      initialCommand={
                        !terminalSessionId && selectedAgent
                          ? AGENT_INFO[selectedAgent].installation.binaryName
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Storage Tab */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    visibility:
                      activeLeftTab === 'storage' ? 'visible' : 'hidden',
                    pointerEvents:
                      activeLeftTab === 'storage' ? 'auto' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.colors.background,
                  }}
                >
                  {/* Search Bar - only show if there are diagrams */}
                  {storageDiagrams.length > 0 && (
                    <div
                      style={{
                        padding: '12px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundLight,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                        }}
                      >
                        <Search
                          size={14}
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: theme.colors.textSecondary,
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Search diagrams..."
                          value={storageSearchQuery}
                          onChange={(e) =>
                            setStorageSearchQuery(e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: '6px 10px 6px 32px',
                            backgroundColor: theme.colors.background,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: theme.colors.text,
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Diagrams List */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      padding: '12px',
                    }}
                  >
                    {loadingStorageDiagrams ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Loading diagrams...
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                        }}
                      >
                        {/* Alexandria Diagrams Section */}
                        {alexandriaDiagrams.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: theme.colors.textSecondary,
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Alexandria Storage
                            </div>
                            {alexandriaDiagrams
                              .filter(
                                (diagram) =>
                                  storageSearchQuery === '' ||
                                  diagram.name
                                    .toLowerCase()
                                    .includes(storageSearchQuery.toLowerCase()),
                              )
                              .map((diagram) => (
                                <div
                                  key={diagram.id}
                                  style={{
                                    padding: '12px',
                                    backgroundColor:
                                      theme.colors.backgroundSecondary,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    marginBottom: '8px',
                                  }}
                                  onClick={() =>
                                    loadDocument(
                                      diagram.name,
                                      'excalidraw',
                                      'alexandria',
                                    )
                                  }
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      theme.colors.backgroundLight;
                                    e.currentTarget.style.borderColor =
                                      theme.colors.primary;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      theme.colors.backgroundSecondary;
                                    e.currentTarget.style.borderColor =
                                      theme.colors.border;
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: '6px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                      }}
                                    >
                                      <PenTool
                                        size={14}
                                        style={{ color: theme.colors.primary }}
                                      />
                                      <span
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          color: theme.colors.text,
                                        }}
                                      >
                                        {diagram.name.replace('.excalidraw', '')}
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        backgroundColor:
                                          theme.colors.success + '20',
                                        color: theme.colors.success,
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ALEXANDRIA
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '12px',
                                      fontSize: '11px',
                                      color: theme.colors.textSecondary,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Clock size={11} />
                                      {new Date(
                                        diagram.updatedAt,
                                      ).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* App Data Diagrams Section */}
                        {storageDiagrams.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: theme.colors.textSecondary,
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              App Data Storage
                            </div>
                            {storageDiagrams
                              .filter(
                            (diagram) =>
                              storageSearchQuery === '' ||
                              diagram.name
                                .toLowerCase()
                                .includes(storageSearchQuery.toLowerCase()),
                          )
                          .map((diagram) => (
                            <div
                              key={diagram.id}
                              style={{
                                padding: '12px',
                                backgroundColor:
                                  theme.colors.backgroundSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onClick={() =>
                                loadDocument(
                                  '',
                                  'excalidraw',
                                  'app-data',
                                  diagram.id,
                                )
                              }
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.backgroundLight;
                                e.currentTarget.style.borderColor =
                                  theme.colors.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.backgroundSecondary;
                                e.currentTarget.style.borderColor =
                                  theme.colors.border;
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '6px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                  }}
                                >
                                  <PenTool
                                    size={14}
                                    style={{ color: theme.colors.primary }}
                                  />
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      color: theme.colors.text,
                                    }}
                                  >
                                    {diagram.name}
                                  </span>
                                </div>
                                {diagram.isRepoAgnostic && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      backgroundColor:
                                        theme.colors.primary + '20',
                                      color: theme.colors.primary,
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    GLOBAL
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '11px',
                                  color: theme.colors.textSecondary,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Clock size={11} />
                                  {new Date(
                                    diagram.updatedAt,
                                  ).toLocaleDateString()}
                                </div>
                                {diagram.projectPath && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <FolderOpen size={11} />
                                    <span>Repository-specific</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          </div>
                        )}

                        {storageDiagrams.length === 0 && alexandriaDiagrams.length === 0 && (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '40px 20px',
                              color: theme.colors.textSecondary,
                              maxWidth: '400px',
                              margin: '0 auto',
                            }}
                          >
                            <Database
                              size={48}
                              style={{
                                opacity: 0.3,
                                marginBottom: '16px',
                              }}
                            />
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '12px',
                              }}
                            >
                              No app documents found
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                lineHeight: '1.5',
                                marginBottom: '16px',
                              }}
                            >
                              Documents saved here are stored in your user data
                              directory, outside of version control.
                            </div>
                            <div
                              style={{
                                padding: '12px',
                                backgroundColor: theme.colors.backgroundLight,
                                borderRadius: '6px',
                                border: `1px solid ${theme.colors.border}`,
                                fontSize: '11px',
                                lineHeight: '1.5',
                              }}
                            >
                              <strong style={{ color: theme.colors.text }}>
                                Tip:
                              </strong>{' '}
                              When editing a document, use the "Save As" button
                              to move it to your repository where it can be
                              version controlled and shared with your team.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Panel: Markdown Slide Viewer */}
          <div
            style={{
              flex: 1,
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Slide Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.colors.backgroundLight,
                gap: '16px',
              }}
            >
              {/* Left Section: Toggle Panel, Document Name and Navigation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flex: '0 0 auto',
                }}
              >
                {/* Toggle Left Panel Button */}
                <button
                  onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title={leftPanelCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.color = theme.colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                >
                  {leftPanelCollapsed ? (
                    <PanelLeft size={16} />
                  ) : (
                    <PanelLeftClose size={16} />
                  )}
                </button>

                {hasDocument ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingTitle(
                          slideDocument.metadata.title ||
                            (slideDocument.type === 'excalidraw'
                              ? 'Excalidraw Diagram'
                              : 'Planning Document'),
                        );
                        setIsEditingTitle(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: theme.colors.text,
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Click to rename"
                    >
                      {slideDocument.metadata.title || 'Planning Document'}
                    </button>
                  </>
                ) : null}
              </div>

              {/* Center Section: View Mode Dropdown and Editor Toggle */}
              {hasDocument && slideDocument.type === 'markdown' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: '0 0 auto',
                  }}
                >
                  {/* View Mode Dropdown */}
                  <div
                    ref={viewModeDropdownRef}
                    style={{ position: 'relative' }}
                  >
                    <button
                      onClick={() =>
                        setShowViewModeDropdown(!showViewModeDropdown)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: theme.colors.text,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor =
                          theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      {viewMode === 'slides' && <Eye size={14} />}
                      {viewMode === 'document' && <FileText size={14} />}
                      <span style={{ textTransform: 'capitalize' }}>
                        {viewMode}
                      </span>
                      <ChevronDown
                        size={12}
                        style={{
                          transform: showViewModeDropdown
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {showViewModeDropdown && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          minWidth: '140px',
                          backgroundColor: theme.colors.backgroundSecondary,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          overflow: 'hidden',
                          padding: '4px',
                        }}
                      >
                        <button
                          onClick={() => {
                            setViewMode('slides');
                            setShowViewModeDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor:
                              viewMode === 'slides'
                                ? `${theme.colors.primary}15`
                                : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color:
                              viewMode === 'slides'
                                ? theme.colors.primary
                                : theme.colors.text,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            textAlign: 'left',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (viewMode !== 'slides') {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.backgroundTertiary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (viewMode !== 'slides') {
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }
                          }}
                        >
                          <Eye size={14} />
                          <span>Slides</span>
                        </button>

                        <button
                          onClick={() => {
                            setViewMode('document');
                            setShowViewModeDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor:
                              viewMode === 'document'
                                ? `${theme.colors.primary}15`
                                : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color:
                              viewMode === 'document'
                                ? theme.colors.primary
                                : theme.colors.text,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            textAlign: 'left',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (viewMode !== 'document') {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.backgroundTertiary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (viewMode !== 'document') {
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }
                          }}
                        >
                          <FileText size={14} />
                          <span>Document</span>
                        </button>

                        {/* Segmented view toggle - shown when in document mode */}
                        {viewMode === 'document' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSegmented(!showSegmented);
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              marginTop: '4px',
                              backgroundColor: 'transparent',
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: '4px',
                              fontSize: '11px',
                              color: theme.colors.text,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'all 0.2s',
                            }}
                            title={
                              showSegmented
                                ? 'Show as single document'
                                : 'Show with sections'
                            }
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.backgroundTertiary;
                              e.currentTarget.style.borderColor =
                                theme.colors.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                            }}
                          >
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {showSegmented ? (
                                <LayoutGrid size={12} />
                              ) : (
                                <AlignJustify size={12} />
                              )}
                              {showSegmented ? 'Sections View' : 'Single View'}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                opacity: 0.7,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              {showSegmented ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Switch to Editor Tab */}
                  <button
                    onClick={() => setActiveLeftTab('editor')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      backgroundColor:
                        activeLeftTab === 'editor'
                          ? theme.colors.primary
                          : theme.colors.backgroundTertiary,
                      color:
                        activeLeftTab === 'editor' ? '#fff' : theme.colors.text,
                      border: `1px solid ${activeLeftTab === 'editor' ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    title="Switch to editor tab"
                  >
                    <Code size={14} />
                    <span>Edit</span>
                  </button>
                </div>
              )}

              {/* Right Section: Actions and Status */}
              {hasDocument && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: '0 0 auto',
                    marginLeft: 'auto',
                  }}
                >
                  {/* Save Status */}
                  {isDirty && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: theme.colors.warning,
                        fontWeight: 600,
                        padding: '3px 8px',
                        backgroundColor: `${theme.colors.warning}20`,
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.warning}40`,
                      }}
                    >
                      ● Unsaved
                    </span>
                  )}
                  {saveMessage && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: saveMessage.includes('success')
                          ? theme.colors.success
                          : saveMessage.includes('Failed')
                            ? theme.colors.error
                            : theme.colors.textSecondary,
                        fontWeight: 600,
                        padding: '3px 8px',
                        backgroundColor: saveMessage.includes('success')
                          ? `${theme.colors.success}20`
                          : saveMessage.includes('Failed')
                            ? `${theme.colors.error}20`
                            : theme.colors.backgroundTertiary,
                        borderRadius: '4px',
                        animation: 'fadeIn 0.3s ease-in',
                      }}
                    >
                      {saveMessage}
                    </span>
                  )}

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      paddingLeft: '8px',
                      borderLeft: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    {/* Add AI Assistant Button - shows when no agent is active */}
                    {!selectedAgent &&
                      !showTerminal &&
                      agentsWithMCP.length > 0 && (
                        <button
                          onClick={() => setShowAgentSelector(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            backgroundColor: theme.colors.primary,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                          }}
                          title="Add AI assistant to help with planning"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(1.1)';
                            e.currentTarget.style.transform =
                              'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'brightness(1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <Terminal size={14} />
                          <span>Add AI Assistant</span>
                        </button>
                      )}

                    {/* New Document Button */}
                    <button
                      onClick={() => {
                        // Check if there are unsaved changes
                        if (isDirty) {
                          setShowNewDocumentConfirm(true);
                        } else {
                          // Reset to show empty state
                          setHasDocument(false);
                          setSlideDocument({
                            content: '',
                            presentation: undefined,
                            currentSlide: 0,
                            type: 'markdown',
                            storageLocation: 'repository',
                            metadata: {},
                          });
                          setCurrentExcalidrawData(null);
                          lastExcalidrawElements.current = null;
                          setIsDirty(false);
                          _setLastSaved(null);
                          setError(null);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        width: '28px',
                        height: '28px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      title="Create new document"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.primary;
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.borderColor =
                          theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                        e.currentTarget.style.color = theme.colors.text;
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      <Plus size={14} />
                    </button>

                    {/* Save Button */}
                    <button
                      onClick={saveDocument}
                      disabled={!isDirty || isSaving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        width: '28px',
                        height: '28px',
                        backgroundColor: isDirty
                          ? theme.colors.primary
                          : theme.colors.backgroundTertiary,
                        color: isDirty ? '#fff' : theme.colors.textTertiary,
                        border: 'none',
                        borderRadius: '4px',
                        cursor:
                          isDirty && !isSaving ? 'pointer' : 'not-allowed',
                        opacity: isDirty && !isSaving ? 1 : 0.5,
                        transition: 'all 0.2s',
                      }}
                      title="Save document (Cmd+S)"
                    >
                      <Save size={14} />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        width: '28px',
                        height: '28px',
                        backgroundColor: 'transparent',
                        color: theme.colors.error,
                        border: `1px solid ${theme.colors.error}40`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      title="Delete document"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.error}20`;
                        e.currentTarget.style.borderColor = theme.colors.error;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = `${theme.colors.error}40`;
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slide Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Loading document...
                </div>
              ) : error ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: theme.colors.error,
                  }}
                >
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                    ⚠️
                  </div>
                  <div>{error}</div>
                </div>
              ) : !hasDocument ? (
                selectedAgent && showTerminal ? (
                  <PlanningAgentGuide
                    theme={theme}
                    selectedAgent={selectedAgent}
                    onCreateDocument={createNewDocument}
                  />
                ) : (
                  <PlanningEmptyState
                    theme={theme}
                    agentsWithMCP={agentsWithMCP}
                    onStartWithAgent={(agent) => {
                      setSelectedAgent(agent);
                      setShowTerminal(true);
                      createNewDocument('markdown');
                    }}
                    onCreateNew={() => {
                      setStartOverlayStep('format');
                      setShowStartOverlay(true);
                    }}
                  />
                )
              ) : slideDocument.type === 'excalidraw' ? (
                <ExcalidrawWrapper
                  key={
                    slideDocument.metadata.filePath ||
                    `excalidraw-${slideDocument.storageLocation}`
                  }
                  initialData={slideDocument.content as ExcalidrawDiagramData}
                  diagramId={slideDocument.metadata.diagramId}
                  diagramName={
                    slideDocument.metadata.title || 'Excalidraw Diagram'
                  }
                  projectPath={
                    slideDocument.storageLocation === 'repository'
                      ? localClone.path
                      : undefined
                  }
                  onChange={(elements, appState) => {
                    // Use debounced handler to prevent render loops
                    if (hasDocument && !isUpdatingExcalidraw.current) {
                      handleExcalidrawChange(elements, appState);
                    }
                  }}
                  onSave={async (diagramId) => {
                    // Handle save for Excalidraw
                    console.info(
                      '[PlanningView] ExcalidrawWrapper saved, diagramId:',
                      diagramId,
                    );
                    if (!slideDocument.metadata.diagramId && diagramId) {
                      setSlideDocument((prev) => ({
                        ...prev,
                        metadata: {
                          ...prev.metadata,
                          diagramId,
                        },
                      }));
                    }
                    setIsDirty(false);
                    _setLastSaved(new Date());
                  }}
                  // Hide wrapper UI elements since PlanningView has its own controls
                  showSaveButton={false}
                  showNewDiagramButton={false}
                  showNameEditor={false}
                  // Don't show save to repository button in wrapper - it's in the header
                  showSaveToRepository={false}
                />
              ) : slideDocument.type === 'markdown' ? (
                <MarkdownDocumentViewer
                  viewMode={viewMode}
                  showEditor={false}
                  showSegmented={showSegmented}
                  content={slideDocument.content as string}
                  slides={
                    slideDocument.presentation?.slides.map(
                      (s) => s.location.content,
                    ) || []
                  }
                  currentSlide={slideDocument.currentSlide}
                  theme={theme}
                  onContentChange={(newContent) => {
                    // Update the document content - this won't be used since editor is in left panel
                    const newPresentation =
                      parseMarkdownIntoPresentation(newContent);
                    setSlideDocument((prev) => ({
                      ...prev,
                      content: newContent,
                      presentation: newPresentation,
                    }));
                    setIsDirty(true);
                  }}
                  onSlideNavigate={navigateToSlide}
                  onCheckboxChange={(slideIndex, lineNumber, checked) => {
                    // Handle checkbox changes in the slide
                    console.info('Checkbox changed:', {
                      slideIndex,
                      lineNumber,
                      checked,
                    });
                    setIsDirty(true);
                  }}
                />
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '400px',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                color: theme.colors.text,
              }}
            >
              Delete Document?
            </h3>
            <p
              style={{
                margin: '0 0 20px 0',
                fontSize: '14px',
                color: theme.colors.textSecondary,
              }}
            >
              Are you sure you want to delete "
              {slideDocument.metadata.title || 'this document'}"?
              {slideDocument.metadata.filePath ||
              (slideDocument.metadata.diagramId &&
                slideDocument.storageLocation === 'app-data')
                ? 'This will move the file to trash.'
                : 'This will clear the unsaved document.'}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteDocument}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.error,
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Document Confirmation Dialog */}
      {showNewDocumentConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowNewDocumentConfirm(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '400px',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                color: theme.colors.text,
              }}
            >
              Unsaved Changes
            </h3>
            <p
              style={{
                margin: '0 0 20px 0',
                fontSize: '14px',
                color: theme.colors.textSecondary,
              }}
            >
              You have unsaved changes in "
              {slideDocument.metadata.title || 'this document'}". Would you like
              to save before creating a new document?
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                onClick={() => setShowNewDocumentConfirm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Don't save, just create new
                  setShowNewDocumentConfirm(false);
                  setHasDocument(false);
                  setSlideDocument({
                    content: '',
                    presentation: undefined,
                    currentSlide: 0,
                    type: 'markdown',
                    storageLocation: 'repository',
                    metadata: {},
                  });
                  setCurrentExcalidrawData(null);
                  lastExcalidrawElements.current = null;
                  setIsDirty(false);
                  _setLastSaved(null);
                  setError(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.warning,
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Don't Save
              </button>
              <button
                onClick={async () => {
                  // Save first, then create new
                  await saveDocument();
                  setShowNewDocumentConfirm(false);
                  setHasDocument(false);
                  setSlideDocument({
                    content: '',
                    presentation: undefined,
                    currentSlide: 0,
                    type: 'markdown',
                    storageLocation: 'repository',
                    metadata: {},
                  });
                  setCurrentExcalidrawData(null);
                  lastExcalidrawElements.current = null;
                  setIsDirty(false);
                  _setLastSaved(null);
                  setError(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.primary,
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title Edit Modal */}
      {isEditingTitle && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => {
            setIsEditingTitle(false);
            setEditingTitle('');
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                color: theme.colors.text,
              }}
            >
              Rename Document
            </h3>

            {/* Show storage location info */}
            <div
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                marginBottom: '16px',
                padding: '8px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              {slideDocument.storageLocation === 'app-data' ? (
                <>
                  <strong>Storage:</strong> App Data
                  <br />
                  <span style={{ fontSize: '11px' }}>
                    This will update the diagram name in your local storage.
                  </span>
                </>
              ) : slideDocument.storageLocation === 'alexandria' ? (
                <>
                  <strong>Storage:</strong> Alexandria (.alexandria/drawings)
                  <br />
                  <span style={{ fontSize: '11px' }}>
                    This will rename the drawing in your Alexandria storage.
                  </span>
                </>
              ) : slideDocument.metadata.filePath ? (
                <>
                  <strong>File:</strong>{' '}
                  {slideDocument.metadata.filePath.split('/').pop()}
                  <br />
                  <span style={{ fontSize: '11px' }}>
                    This will rename the actual file in your repository.
                  </span>
                </>
              ) : (
                <>
                  <strong>Status:</strong> Unsaved Document
                  <br />
                  <span style={{ fontSize: '11px' }}>
                    This will update the title for this session. Save the
                    document to persist changes.
                  </span>
                </>
              )}
            </div>

            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editingTitle.trim()) {
                  renameDocument(editingTitle.trim());
                } else if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setEditingTitle('');
                }
              }}
              placeholder="Enter new name"
              autoFocus
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                backgroundColor: theme.colors.backgroundLight,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                outline: 'none',
              }}
            />

            {/* Note about file extensions */}
            {slideDocument.metadata.filePath && (
              <p
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                  marginTop: '8px',
                  marginBottom: '16px',
                }}
              >
                Note: The appropriate file extension (
                {slideDocument.type === 'excalidraw' ? '.excalidraw' : '.md'})
                will be added automatically if not provided.
              </p>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '20px',
              }}
            >
              <button
                onClick={() => {
                  setIsEditingTitle(false);
                  setEditingTitle('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => renameDocument(editingTitle.trim())}
                disabled={
                  !editingTitle.trim() ||
                  editingTitle.trim() === slideDocument.metadata.title
                }
                style={{
                  padding: '8px 16px',
                  backgroundColor:
                    editingTitle.trim() &&
                    editingTitle.trim() !== slideDocument.metadata.title
                      ? theme.colors.primary
                      : theme.colors.backgroundTertiary,
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color:
                    editingTitle.trim() &&
                    editingTitle.trim() !== slideDocument.metadata.title
                      ? '#fff'
                      : theme.colors.textTertiary,
                  cursor:
                    editingTitle.trim() &&
                    editingTitle.trim() !== slideDocument.metadata.title
                      ? 'pointer'
                      : 'not-allowed',
                  fontWeight: 500,
                  opacity:
                    editingTitle.trim() &&
                    editingTitle.trim() !== slideDocument.metadata.title
                      ? 1
                      : 0.5,
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Document Request Modal */}
      {agentDocumentRequest && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                color: theme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Terminal size={20} color={theme.colors.primary} />
              {agentDocumentRequest.agentName} Planning Request
            </h3>

            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                marginBottom: '20px',
                lineHeight: 1.5,
              }}
            >
              {agentDocumentRequest.message ||
                `${agentDocumentRequest.agentName} wants to work with a planning document. Choose an option below:`}
            </p>

            {/* Quick action buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <button
                onClick={() => {
                  // Create new markdown document
                  createNewDocument('markdown');
                  // Send response to agent
                  PrincipalService.sendAgentDocumentResponse(
                    agentDocumentRequest.requestId,
                    {
                      success: true,
                      documentSelected: true,
                      documentTitle:
                        agentDocumentRequest.suggestedTitle ||
                        'New Planning Document',
                      documentType: 'markdown',
                      filePath: null, // Will be set when saved
                    },
                  );
                  setAgentDocumentRequest(null);
                }}
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundLight,
                  color: theme.colors.text,
                  border: `2px solid ${theme.colors.primary}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundLight;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <FileText size={24} />
                <span>New Markdown Document</span>
                {agentDocumentRequest.suggestedType === 'markdown' && (
                  <span
                    style={{ fontSize: '11px', color: theme.colors.primary }}
                  >
                    (Suggested)
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  // Create new excalidraw document
                  createNewDocument('excalidraw');
                  // Send response to agent
                  PrincipalService.sendAgentDocumentResponse(
                    agentDocumentRequest.requestId,
                    {
                      success: true,
                      documentSelected: true,
                      documentTitle:
                        agentDocumentRequest.suggestedTitle ||
                        'New Excalidraw Diagram',
                      documentType: 'excalidraw',
                      filePath: null, // Will be set when saved
                    },
                  );
                  setAgentDocumentRequest(null);
                }}
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundLight,
                  color: theme.colors.text,
                  border: `2px solid ${theme.colors.primary}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundLight;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <PenTool size={24} />
                <span>New Excalidraw Diagram</span>
                {agentDocumentRequest.suggestedType === 'excalidraw' && (
                  <span
                    style={{ fontSize: '11px', color: theme.colors.primary }}
                  >
                    (Suggested)
                  </span>
                )}
              </button>
            </div>

            {/* Search for existing documents */}
            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                Or choose an existing document:
              </div>
              <button
                onClick={() => {
                  // TODO: Implement document search/selection
                  console.info(
                    '[PlanningView] Document search not yet implemented',
                  );
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: theme.colors.backgroundLight,
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                🔍 Browse existing documents...
              </button>
            </div>

            {/* Cancel button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => {
                  // Send cancellation response
                  PrincipalService.sendAgentDocumentResponse(
                    agentDocumentRequest.requestId,
                    {
                      success: true,
                      documentSelected: false,
                      cancelled: true,
                    },
                  );
                  setAgentDocumentRequest(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Selector Dropdown */}
      {showAgentSelector && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowAgentSelector(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: '12px',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              border: `1px solid ${theme.colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '20px',
              }}
            >
              Select AI Assistant
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {agentsWithMCP.map((agent) => (
                <button
                  key={agent}
                  onClick={() => {
                    setSelectedAgent(agent);
                    setShowTerminal(true);
                    setActiveLeftTab('terminal');
                    setShowAgentSelector(false);
                    console.info('[PlanningView] Selected agent:', agent);
                  }}
                  style={{
                    padding: '14px 20px',
                    backgroundColor: AGENT_INFO[agent].ui.color,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(1.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>{AGENT_INFO[agent].displayName}</div>
                  <div
                    style={{
                      fontSize: '12px',
                      opacity: 0.9,
                      fontWeight: 400,
                    }}
                  >
                    {AGENT_INFO[agent].ui.description ||
                      'AI assistant for planning and development'}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAgentSelector(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

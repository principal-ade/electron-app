import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Excalidraw,
  MainMenu,
  exportToBlob,
} from '@excalidraw/excalidraw';
import { AppState as ExcalidrawAppState } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from 'themed-markdown';
import { debounce } from 'lodash';
import { ExcalidrawStorageService } from '../../main-process-api/ExcalidrawStorageService';
import {
  diagramEventBus,
  DIAGRAM_EVENTS,
} from '../../services/DiagramEventBus';
import { ExcalidrawDiagramData } from '../../../../shared/main-process-api-interfaces/ExcalidrawAPI';
import { LibraryItem } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

interface ExcalidrawWrapperProps {
  onChange?: (elements: readonly  OrderedExcalidrawElement[], appState: ExcalidrawAppState) => void;
  initialData?: ExcalidrawDiagramData;
  onClose?: () => void;
  libraryItems?: LibraryItem[];
  diagramId?: string;
  diagramName?: string;
  projectPath?: string;
  onSave?: (diagramId: string) => void;
  showSaveToRepository?: boolean;
  onSaveToRepository?: () => void;
  // New props to control UI elements
  showSaveButton?: boolean;
  showNewDiagramButton?: boolean;
  showNameEditor?: boolean;
}

export const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
  onChange,
  initialData,
  onClose,
  libraryItems,
  diagramId,
  diagramName = 'Untitled Diagram',
  projectPath,
  onSave,
  showSaveToRepository,
  onSaveToRepository,
  showSaveButton = true,  // Default to true for backward compatibility
  showNewDiagramButton = true,  // Default to true for backward compatibility
  showNameEditor = true,  // Default to true for backward compatibility
}) => {
  const { theme } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDiagramId, setCurrentDiagramId] = useState(diagramId);
  const currentDiagramIdRef = useRef(diagramId);
  const [currentLibraryItems, setCurrentLibraryItems] = useState< readonly LibraryItem[]>(
    libraryItems || initialData?.libraryItems || [],
  );
  const [currentDiagramName, setCurrentDiagramName] = useState(diagramName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(diagramName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Update refs when props change (when loading a different diagram)
  useEffect(() => {
    if (diagramId !== currentDiagramIdRef.current) {
      currentDiagramIdRef.current = diagramId;
      setCurrentDiagramId(diagramId);
      // Reset draft number when loading an existing diagram
      draftNumberRef.current = null;
      setDraftNumber(null);
      // Reset initial load flag when switching diagrams
      isInitialLoadRef.current = true;

      // If diagramId is null and we have the API, clear the scene for new diagram
      if (!diagramId && excalidrawAPI) {
        excalidrawAPI.resetScene({
          elements: [],
          appState: {
            showWelcomeScreen: false,
            collaborators: new Map(),
          },
        });
        // Mark as loaded for new diagrams
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      }
    }
    if (diagramName !== currentDiagramName) {
      setCurrentDiagramName(diagramName);
      setEditingName(diagramName);
    }
  }, [diagramId, diagramName, excalidrawAPI]);

  // Track if we're loading a diagram
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);
  // Track if this is the initial mount/load to prevent auto-save on load
  const isInitialLoadRef = useRef(true);

  // When initialData changes and we have the API, update the scene
  useEffect(() => {
    if (excalidrawAPI) {
      if (!initialData) {
        // No initial data - mark as loaded after a short delay
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
        return;
      }
      let data = initialData;
      if (typeof initialData === 'string') {
        try {
          data = JSON.parse(initialData);
        } catch (e) {
          console.error(
            '[ExcalidrawWrapper] Failed to parse initialData in useEffect:',
            e,
          );
          return;
        }
      }

      // Reset the scene with the new data
      // Add a small delay to ensure the API is ready
      setIsLoadingDiagram(true);
      setTimeout(() => {
        // Try different approach - use resetScene with proper options
        try {
          // Clear first, then set new data
          excalidrawAPI.resetScene({
            elements: [],
            appState: {
              showWelcomeScreen: false,
              collaborators: new Map(),
            },
          });

          // Then immediately set the actual data
          setTimeout(() => {
            // Ensure collaborators is a Map and remove any saved viewport dimensions
            const {
              width,
              height,
              offsetLeft,
              offsetTop,
              scrollX,
              scrollY,
              ...cleanAppState
            } = data.appState || {};
            const appState = {
              ...cleanAppState,
              showWelcomeScreen: false,
              collaborators: new Map(),
            };

            excalidrawAPI.updateScene({
              elements: data.elements || [],
              appState,
            });

            // Force a refresh to recalculate viewport
            setTimeout(() => {
              excalidrawAPI.refresh();
              // Also trigger a resize event to force viewport recalculation
              window.dispatchEvent(new Event('resize'));
            }, 100);

            setIsLoadingDiagram(false);
            // Mark initial load as complete after a short delay
            setTimeout(() => {
              isInitialLoadRef.current = false;
            }, 500);
          }, 50);
        } catch (error) {
          console.error('[ExcalidrawWrapper] Error loading scene:', error);
          setIsLoadingDiagram(false);
          isInitialLoadRef.current = false;
        }
      }, 100);
    }
  }, [excalidrawAPI, initialData, diagramId]); // Include diagramId to trigger on diagram change

  useEffect(() => {
    if (excalidrawAPI && theme) {
      excalidrawAPI.updateScene({
        appState: {
          theme: 'dark',
        },
      });
    }
  }, [theme, excalidrawAPI]);

  useEffect(() => {
    if (excalidrawAPI && libraryItems) {
      excalidrawAPI.updateLibrary({
        libraryItems,
        merge: true,
      });
    }
  }, [excalidrawAPI, libraryItems]);

  // Create refs to hold the latest values without causing re-renders
  const saveDataRef = useRef({
    excalidrawAPI,
    diagramName: currentDiagramName,
    projectPath,
    currentLibraryItems,
  });

  // Update the ref when values change
  useEffect(() => {
    saveDataRef.current = {
      excalidrawAPI,
      diagramName: currentDiagramName,
      projectPath,
      currentLibraryItems,
    };
  }, [excalidrawAPI, currentDiagramName, projectPath, currentLibraryItems]);

  // Track if this is the first save for draft naming
  const [draftNumber, setDraftNumber] = useState<number | null>(null);
  const draftNumberRef = useRef<number | null>(null);

  // Auto-save functionality using refs to avoid re-renders
  const handleSave = useCallback(async () => {
    const { excalidrawAPI, projectPath, currentLibraryItems } =
      saveDataRef.current;
    const { diagramName } = saveDataRef.current;

    if (!excalidrawAPI) {
      return;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();

      // Don't save empty diagrams
      // if (!elements || elements.length === 0) {
      //   console.log('Skipping save - no elements');
      //   return;
      // }

      setIsSaving(true);
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Remove non-serializable and viewport-specific properties from appState
      const {
        collaborators,
        width,
        height,
        offsetLeft,
        offsetTop,
        scrollX,
        scrollY,
        ...serializableAppState
      } = appState;

      const data: ExcalidrawDiagramData = {
        elements,
        appState: serializableAppState,
        files,
        libraryItems: currentLibraryItems,
        type: 'excalidraw',
        version: 2,
        source: window.appName,
      };

      // Generate draft name if needed
      let saveName = diagramName;
      if (!currentDiagramIdRef.current && saveName === 'Untitled Diagram') {
        if (!draftNumberRef.current) {
          // Get next draft number
          const diagrams =
            await ExcalidrawStorageService.listDiagrams(projectPath);
          const draftNumbers = diagrams
            .filter((d) => d.name.startsWith('Draft #'))
            .map((d) => {
              const match = d.name.match(/Draft #(\d+)/);
              return match ? parseInt(match[1]) : 0;
            });
          draftNumberRef.current =
            draftNumbers.length > 0 ? Math.max(...draftNumbers) + 1 : 1;
          setDraftNumber(draftNumberRef.current);
        }
        saveName = `Draft #${draftNumberRef.current}`;
        setCurrentDiagramName(saveName); // Update the name state
      }

      const savedId = await ExcalidrawStorageService.saveDiagram(
        saveName,
        data,
        projectPath,
        currentDiagramIdRef.current || currentDiagramId,
      );

      if (!currentDiagramIdRef.current) {
        currentDiagramIdRef.current = savedId;
        // Only update state if we're creating a new diagram
        setCurrentDiagramId(savedId);
        // Emit event for new diagram
        diagramEventBus.emit(DIAGRAM_EVENTS.DIAGRAM_CREATED, {
          id: savedId,
          name: saveName,
          projectPath,
        });
        if (onSave) {
          onSave(savedId);
        }
      } else {
        // Emit event for updated diagram
        diagramEventBus.emit(DIAGRAM_EVENTS.DIAGRAM_SAVED, {
          id: savedId,
          name: saveName,
          projectPath,
        });
      }
    } catch (error) {
      console.error('Failed to save diagram:', error);
    } finally {
      setIsSaving(false);
    }
  }, []); // Empty deps since we use refs

  // Debounced auto-save - created only once
  const debouncedSave = useMemo(() => debounce(handleSave, 2000), [handleSave]);

  // Handle manual save
  const handleManualSave = useCallback(async () => {
    console.log('[ExcalidrawWrapper] Manual save triggered');
    // Manual save should always work, regardless of initial load state
    isInitialLoadRef.current = false;
    await handleSave();
    // Show save confirmation (you can add a toast notification here)
  }, [handleSave]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  // Handle name editing
  const handleStartEditingName = () => {
    setIsEditingName(true);
    setEditingName(currentDiagramName);
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 0);
  };

  const handleSaveName = () => {
    const newName = editingName.trim() || 'Untitled Diagram';
    setCurrentDiagramName(newName);
    setIsEditingName(false);
    // Update the ref immediately so save uses the new name
    saveDataRef.current.diagramName = newName;
    // If we have a diagram ID, save the updated name
    if (currentDiagramId) {
      handleSave();
    }
  };

  const handleCancelEditName = () => {
    setEditingName(currentDiagramName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditName();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: theme.colors.background,
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.2);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={(() => {
          if (!initialData) return undefined;

          // If initialData is a string, parse it first
          let data = initialData;
          if (typeof initialData === 'string') {
            try {
              data = JSON.parse(initialData);
            } catch (e) {
              console.error(
                '[ExcalidrawWrapper] Failed to parse initialData:',
                e,
              );
              return undefined;
            }
          }

          // Remove viewport-specific properties from initial data
          const {
            width,
            height,
            offsetLeft,
            offsetTop,
            scrollX,
            scrollY,
            ...cleanAppState
          } = data.appState || {};

          return {
            elements: data.elements || [],
            appState: {
              ...cleanAppState,
              collaborators: new Map(),
            },
            libraryItems: data.libraryItems || libraryItems || [],
            files: data.files || {},
          };
        })()}
        onChange={(elements, appState, files) => {
          if (onChange && !isLoadingDiagram) {
            onChange(elements, appState);
          }
          // Auto-save disabled - manual save only
          // if (!isInitialLoadRef.current && !isLoadingDiagram) {
          //   debouncedSave();
          // }
        }}
        onLibraryChange={(items) => {
          setCurrentLibraryItems(items);
        }}
        theme={'dark'}
        UIOptions={{
          canvasActions: {
            saveAsImage: false,  // Hide "Save as image" button
            saveToActiveFile: false,  // Hide "Save" button
            loadScene: false,  // Hide "Load" button (prevents loading new diagrams)
            export: {
              saveFileToDisk: true,  // Keep ability to export to disk
              onExportToBackend: false,  // Remove backend export options
            },
          },
        }}
        renderTopRightUI={() => (
          <div
            style={{
              marginRight: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {showNameEditor && isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleSaveName}
                style={{
                  padding: '4px 8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: '4px',
                  outline: 'none',
                  minWidth: '150px',
                }}
              />
            ) : showNameEditor ? (
              <span
                onClick={handleStartEditingName}
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Click to edit name"
              >
                {currentDiagramId
                  ? currentDiagramName || 'Draft'
                  : 'New Diagram'}
              </span>
            ) : null}
            {showSaveButton && (
              <button
                onClick={handleManualSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 12px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: theme.colors.primary,
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
                position: 'relative',
              }}
              title="Save (Cmd/Ctrl+S)"
            >
              Save
            </button>
            )}
            {showSaveToRepository && onSaveToRepository && (
              <button
                onClick={onSaveToRepository}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: theme.colors.primary,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Save a copy to repository as .excalidraw file"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V2zm10-1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1z"/>
                  <path d="M5 3.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5z"/>
                </svg>
                Save to Repository
              </button>
            )}
            {showNewDiagramButton && onClose && (
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                title="New Diagram"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                </svg>
              </button>
            )}
            {/* MainMenu removed - all menu functionality disabled to give full control to our UI */}
          </div>
        )}
      >
        {/* Welcome screen disabled - we manage diagram creation through our own UI */}
        {/* Empty MainMenu to override all default menu items */}
        <MainMenu />
      </Excalidraw>
    </div>
  );
};

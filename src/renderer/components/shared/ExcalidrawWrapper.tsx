import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Excalidraw, MainMenu, exportToBlob } from '@excalidraw/excalidraw';
import { AppState as ExcalidrawAppState } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from '@a24z/industry-theme';
import { debounce } from 'lodash';
import { ExcalidrawStorageService } from '../../main-process-api/ExcalidrawStorageService';
import { AlexandriaDrawingService } from '../../main-process-api/AlexandriaDrawingService';
import {
  diagramEventBus,
  DIAGRAM_EVENTS,
} from '../../services/DiagramEventBus';
import { ExcalidrawDiagramData } from '../../../shared/main-process-api-interfaces/ExcalidrawAPI';
import { LibraryItem } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

interface ExcalidrawWrapperProps {
  onChange?: (
    elements: readonly OrderedExcalidrawElement[],
    appState: ExcalidrawAppState,
  ) => void;
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
  // Control which storage to use
  useAlexandriaStorage?: boolean;
  // Expose save function to parent
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
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
  showSaveButton = true, // Default to true for backward compatibility
  showNewDiagramButton = true, // Default to true for backward compatibility
  showNameEditor = true, // Default to true for backward compatibility
  useAlexandriaStorage = false, // Default to false for backward compatibility
  saveRef,
}) => {
  const { theme } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDiagramId, setCurrentDiagramId] = useState(diagramId);
  const currentDiagramIdRef = useRef(diagramId);
  const [currentLibraryItems, setCurrentLibraryItems] = useState<
    readonly LibraryItem[]
  >(libraryItems || initialData?.libraryItems || []);
  const [currentDiagramName, setCurrentDiagramName] = useState(diagramName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(diagramName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Track last saved content hash to avoid unnecessary saves
  const lastSavedContentRef = useRef<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      // Reset unsaved changes when switching diagrams
      setHasUnsavedChanges(false);

      // If diagramId is null and we have the API, clear the scene for new diagram
      if (!diagramId && excalidrawAPI) {
        excalidrawAPI.resetScene({
          elements: [],
          appState: {
            showWelcomeScreen: false,
            collaborators: new Map(),
            name: diagramName || 'Untitled Diagram',
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

            // If the appState has a name, update our UI state to reflect it
            if (cleanAppState.name && typeof cleanAppState.name === 'string') {
              setCurrentDiagramName(cleanAppState.name);
              setEditingName(cleanAppState.name);
            }

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
  const saveDataRef = useRef<{
    excalidrawAPI: any;
    diagramName: string;
    projectPath: string | undefined;
    currentLibraryItems: readonly LibraryItem[];
    useAlexandriaStorage: boolean;
  }>({
    excalidrawAPI,
    diagramName: currentDiagramName,
    projectPath,
    currentLibraryItems,
    useAlexandriaStorage,
  });

  // Update the ref when values change
  useEffect(() => {
    saveDataRef.current = {
      excalidrawAPI,
      diagramName: currentDiagramName,
      projectPath,
      currentLibraryItems,
      useAlexandriaStorage,
    };
  }, [
    excalidrawAPI,
    currentDiagramName,
    projectPath,
    currentLibraryItems,
    useAlexandriaStorage,
  ]);

  // Track if this is the first save for draft naming
  const [draftNumber, setDraftNumber] = useState<number | null>(null);
  const draftNumberRef = useRef<number | null>(null);

  // Auto-save functionality using refs to avoid re-renders
  const handleSave = useCallback(async () => {
    const {
      excalidrawAPI,
      projectPath,
      currentLibraryItems,
      useAlexandriaStorage,
    } = saveDataRef.current;
    const { diagramName } = saveDataRef.current;

    if (!excalidrawAPI) {
      return;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();

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

      // Generate draft name if needed
      let saveName = diagramName;
      let fileNameToUse = currentDiagramIdRef.current || currentDiagramId;

      if (!fileNameToUse && saveName === 'Untitled Diagram') {
        if (!draftNumberRef.current) {
          // Get next draft number - use the appropriate service based on storage type
          const diagrams = useAlexandriaStorage && projectPath
            ? await AlexandriaDrawingService.listDiagrams(projectPath)
            : await ExcalidrawStorageService.listDiagrams(projectPath);
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
        fileNameToUse = saveName; // Use the draft name as the filename
        setCurrentDiagramName(saveName); // Update the name state

        // Update Excalidraw's appState with the draft name immediately
        if (excalidrawAPI) {
          excalidrawAPI.updateScene({
            appState: {
              name: saveName,
            },
          });
        }
      }

      // Update the appState.name to match saveName before saving
      const data: ExcalidrawDiagramData = {
        elements,
        appState: {
          ...serializableAppState,
          name: saveName, // Use saveName instead of whatever is in appState
        },
        files,
        libraryItems: currentLibraryItems,
        type: 'excalidraw',
        version: 2,
        source: window.appName,
      };

      let savedId: string;

      if (useAlexandriaStorage && projectPath) {
        // Use Alexandria service for drawings
        // For new drawings, fileNameToUse is the draft name; for existing ones, it's the ID
        const fileName = fileNameToUse || saveName;
        const fileNameWithExt = fileName.endsWith('.excalidraw')
          ? fileName
          : `${fileName}.excalidraw`;
        await AlexandriaDrawingService.saveDiagram(
          fileNameWithExt,
          data,
          projectPath,
        );
        savedId = fileName.replace('.excalidraw', '');
      } else {
        // Save to app-data storage
        savedId = await ExcalidrawStorageService.saveDiagram(
          saveName,
          data,
          projectPath,
          currentDiagramIdRef.current || currentDiagramId,
        );
      }

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

      // Mark as saved
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('[ExcalidrawWrapper] Failed to save diagram:', error);
    } finally {
      setIsSaving(false);
    }
  }, []); // Empty deps since we use refs

  // Debounced auto-save - created only once
  const debouncedSave = useMemo(() => debounce(handleSave, 2000), [handleSave]);

  // Handle manual save
  const handleManualSave = useCallback(async () => {
    // Manual save should always work, regardless of initial load state
    isInitialLoadRef.current = false;
    await handleSave();
  }, [handleSave]);

  // Expose save function to parent through ref
  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleManualSave;
    }
  }, [saveRef, handleManualSave]);

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

  // Auto-save on unmount removed - it was causing issues where it would
  // save empty canvas after component cleanup. Instead we rely on:
  // 1. Auto-save on changes (debounced)
  // 2. Manual save button
  // 3. Parent component calling saveRef before unmounting if needed

  // Handle name editing
  const handleStartEditingName = () => {
    setIsEditingName(true);
    setEditingName(currentDiagramName);
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 0);
  };

  const handleSaveName = async () => {
    const newName = editingName.trim() || 'Untitled Diagram';
    const oldName = currentDiagramName;

    setCurrentDiagramName(newName);
    setIsEditingName(false);
    // Update the ref immediately so save uses the new name
    saveDataRef.current.diagramName = newName;

    // Update Excalidraw's appState with the new name
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          name: newName,
        },
      });
    }

    // If we have a diagram ID, save and optionally rename the file
    if (currentDiagramId && useAlexandriaStorage && projectPath) {
      // If the name changed and this is a named drawing (not just appState update)
      // we should rename the file
      const oldFileName = currentDiagramId.endsWith('.excalidraw')
        ? currentDiagramId
        : `${currentDiagramId}.excalidraw`;
      const newFileName = newName.endsWith('.excalidraw')
        ? newName
        : `${newName}.excalidraw`;

      // Only rename if the filename would actually change
      if (oldFileName !== newFileName && oldName !== newName) {
        try {
          // Rename the file in Alexandria storage
          const success = await AlexandriaDrawingService.renameDiagram(
            oldFileName,
            newFileName,
            projectPath,
          );

          if (success) {
            // Update the diagram ID to the new filename (without extension)
            const newId = newName.replace('.excalidraw', '');
            currentDiagramIdRef.current = newId;
            setCurrentDiagramId(newId);

            // Notify parent component of the ID change
            if (onSave) {
              onSave(newId);
            }

            // Emit rename event
            diagramEventBus.emit(DIAGRAM_EVENTS.DIAGRAM_SAVED, {
              id: newId,
              name: newName,
              projectPath,
            });
          } else {
            console.error('Failed to rename diagram file');
            // Revert the name change in UI
            setCurrentDiagramName(oldName);
            setEditingName(oldName);
          }
        } catch (error) {
          console.error('Error renaming diagram:', error);
          // Revert the name change in UI
          setCurrentDiagramName(oldName);
          setEditingName(oldName);
        }
      } else {
        // Just save the updated appState without renaming the file
        await handleSave();
      }
    } else if (currentDiagramId) {
      // For non-Alexandria storage, just save
      await handleSave();
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

          // Auto-save only if content actually changed (not just selection/viewport)
          if (!isInitialLoadRef.current && !isLoadingDiagram) {
            // Create a simple hash of elements to detect actual content changes
            const contentHash = JSON.stringify(
              elements.map((el) => ({
                id: el.id,
                type: el.type,
                x: el.x,
                y: el.y,
                width: el.width,
                height: el.height,
                // Include other properties that indicate actual content changes
                text: 'text' in el ? el.text : undefined,
                points: 'points' in el ? el.points : undefined,
              })),
            );

            if (contentHash !== lastSavedContentRef.current) {
              setHasUnsavedChanges(true);
              lastSavedContentRef.current = contentHash;
              debouncedSave();
            }
          }
        }}
        onLibraryChange={(items) => {
          setCurrentLibraryItems(items);
        }}
        theme={'dark'}
        UIOptions={{
          canvasActions: {
            saveAsImage: false, // Hide "Save as image" button
            saveToActiveFile: false, // Hide "Save" button
            loadScene: false, // Hide "Load" button (prevents loading new diagrams)
            export: {
              saveFileToDisk: true, // Keep ability to export to disk
              onExportToBackend: undefined, // Remove backend export options
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
            {showSaveButton && hasUnsavedChanges && (
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: isSaving
                    ? theme.colors.backgroundSecondary
                    : theme.colors.primary,
                  color: 'white',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  position: 'relative',
                  opacity: isSaving ? 0.6 : 1,
                }}
                title="Save (Cmd/Ctrl+S)"
              >
                {isSaving ? 'Saving...' : 'Save'}
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M2 2a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V2zm10-1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1z" />
                  <path d="M5 3.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5z" />
                </svg>
                Save to Repository
              </button>
            )}
            {/* New Diagram button removed - managed by parent panels */}
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

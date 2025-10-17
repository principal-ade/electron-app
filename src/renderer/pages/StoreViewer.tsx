import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  FileJson,
  AlertCircle,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Folder,
  File,
  Archive,
  HardDrive,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { useTheme } from '@a24z/industry-theme';

import { HeadlessFileEditorPanel } from '../panels/components/HeadlessFileEditorPanel';
import { StoreViewerTitlebar } from '../components/Titlebar';
import { StoreService } from '../main-process-api/StoreService';
import { AgentSessionEventsService } from '../main-process-api/AgentSessionEventsService';
import {
  HookFallbackFile,
  StorageNamespaceConfig,
  StorageStats,
} from '../../shared/main-process-api-interfaces/StoreAPI';

interface StoreViewerProps {}

export const StoreViewer: React.FC<StoreViewerProps> = () => {
  const { theme } = useTheme();
  const [storeStats, setStoreStats] = useState<StorageStats | null>(null);
  const [storePath, setStorePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathCopied, setPathCopied] = useState(false);
  const [namespaces, setNamespaces] = useState<StorageNamespaceConfig[]>([]);

  // Parse query parameters from URL - do this safely to avoid window undefined errors
  const getUrlParams = () => {
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.hash.split('?')[1] || '');
    }
    return new URLSearchParams();
  };

  const urlParams = getUrlParams();
  const agentFilter = urlParams.get('agent');
  const namespaceParam = urlParams.get('namespace');

  const [selectedNamespace, setSelectedNamespace] = useState<string>(
    namespaceParam || '',
  ); // Use namespace from URL or empty string
  const [hookFallbackFiles, setHookFallbackFiles] = useState<
    HookFallbackFile[]
  >([]);
  const [storageMetrics, setStorageMetrics] = useState<any>(null);
  const [showStorageOverview, setShowStorageOverview] = useState(false);

  useEffect(() => {
    loadNamespaces();
    scanHookFallbackFiles();
  }, []);

  useEffect(() => {
    if (selectedNamespace) {
      console.log('Selected namespace changed to:', selectedNamespace);
      loadStoreInfo();
    } else {
      // No namespace selected, clear the loading state
      setLoading(false);
      setStorePath(null);
      setStoreStats(null);
      setError(null);
    }
  }, [selectedNamespace]);

  const loadNamespaces = async () => {
    try {
      console.log('Loading namespaces...');

      let availableNamespaces: StorageNamespaceConfig[];
      try {
        console.log('About to call listNamespaces IPC...');
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('listNamespaces timeout after 5s')),
            5000,
          ),
        );

        availableNamespaces = (await Promise.race([
          StoreService.listNamespaces(),
          timeoutPromise,
        ])) as StorageNamespaceConfig[];
        console.log('listNamespaces IPC call completed');
        console.log('Raw response:', availableNamespaces);
      } catch (ipcError: any) {
        console.error('IPC call failed:', ipcError);
        console.error('Error stack:', ipcError.stack);
        // Fallback to empty array
        availableNamespaces = [];
      }

      console.log('Available namespaces from backend:', availableNamespaces);
      console.log(
        'Number of namespaces received:',
        availableNamespaces ? availableNamespaces.length : 0,
      );

      // Ensure we have an array
      if (!Array.isArray(availableNamespaces)) {
        console.error(
          'Namespaces is not an array:',
          typeof availableNamespaces,
        );
        availableNamespaces = [];
      }

      // Validate and mark legacy namespaces
      const namespacesWithLegacy = availableNamespaces
        .filter((ns) => ns && typeof ns === 'object' && ns.name) // Filter out invalid entries
        .map((ns) => ({ ...ns }));

      console.log('Namespaces with legacy flag:', namespacesWithLegacy);

      // Log agent session event namespaces
      const agentSessionEventNamespaces = namespacesWithLegacy.filter(
        (ns) => ns.category === 'agent-session-events',
      );
      console.log(
        'Agent Session Event namespaces found:',
        agentSessionEventNamespaces,
      );
      console.log(
        'All namespace categories:',
        namespacesWithLegacy.map((ns) => ({
          name: ns.name,
          category: ns.category,
        })),
      );

      setNamespaces(namespacesWithLegacy);

      // Set default namespace if not already selected
      if (!selectedNamespace && namespacesWithLegacy.length > 0) {
        setSelectedNamespace(namespacesWithLegacy[0].name);
      }
    } catch (err) {
      console.error('Failed to load namespaces:', err);
      setError('Failed to load storage namespaces');
    }
  };

  const scanHookFallbackFiles = async () => {
    try {
      const files = await StoreService.scanHookFallbackFiles();
      setHookFallbackFiles(files);
    } catch (err) {
      console.error('Failed to scan hook fallback files:', err);
    }
  };

  const loadStoreInfo = async () => {
    console.log('Loading store info for namespace:', selectedNamespace);
    setLoading(true);
    setError(null);
    try {
      // Check if this is a hook fallback file
      if (selectedNamespace.startsWith('hook-fallback:')) {
        const filePath = selectedNamespace.substring('hook-fallback:'.length);
        setStorePath(filePath);

        // Get file stats
        const file = hookFallbackFiles.find((f) => f.path === filePath);
        if (file) {
          setStoreStats({
            totalKeys: 1,
            sizeBytes: file.size || 0,
          });
        }
      } else if (selectedNamespace === 'config') {
        // Legacy config namespace - no longer used
        setError('Config namespace is no longer supported');
        return;
      } else {
        // Namespace-specific store
        try {
          const [path, statsResult] = await Promise.all([
            StoreService.getNamespaceFilePath(selectedNamespace as any),
            StoreService.getNamespaceStats(selectedNamespace as any),
          ]);

          console.log('Setting store path to:', path);
          setStorePath(path);

          // Handle stats result
          if (statsResult && typeof statsResult.totalKeys !== 'undefined') {
            setStoreStats({
              totalKeys: statsResult.totalKeys || 0,
              sizeBytes: statsResult.sizeBytes || 0,
            });
          } else {
            // Empty namespace
            setStoreStats({
              totalKeys: 0,
              sizeBytes: 0,
            });
          }
        } catch (namespaceErr) {
          // If the namespace doesn't have a file yet, handle gracefully
          console.warn(
            `Namespace ${selectedNamespace} might not have a file yet:`,
            namespaceErr,
          );
          setStorePath(null);
          setStoreStats({
            totalKeys: 0,
            sizeBytes: 0,
          });
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load store info',
      );
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyPath = async () => {
    if (!storePath) return;

    try {
      await navigator.clipboard.writeText(storePath);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const openInFinder = async () => {
    if (!storePath) return;
    /* TODO: This Should Use System Service 
    try {
      // Open the directory containing the file
      const directory = storePath.substring(0, storePath.lastIndexOf('/'));
      // Use open command on macOS to open the directory
      const command = process.platform === 'darwin' 
        ? `open "${directory}"`
        : process.platform === 'win32'
        ? `explorer "${directory}"`
        : `xdg-open "${directory}"`;
      
      await ShellService.runCommand(command);
    } catch (err) {
      console.error('Failed to open in file manager:', err);
    }
      */
  };

  const loadStorageMetrics = async () => {
    try {
      const metrics = await StoreService.getSessionStorageMetrics();
      setStorageMetrics(metrics);
    } catch (err) {
      console.error('Failed to load storage metrics:', err);
    }
  };

  const renderLeftPanel = () => {
    return (
      <div className="h-full flex flex-col bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <Database className="text-blue-400" size={20} />
            <h3 className="text-sm font-semibold text-white">
              Storage Browser
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadStorageMetrics();
                setShowStorageOverview(true);
              }}
              className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              title="Storage Overview"
            >
              Storage Overview
            </button>
            <button
              onClick={() => {
                loadNamespaces();
                scanHookFallbackFiles();
                loadStoreInfo();
              }}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              title="Refresh All"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Namespace List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Agent Session Event Storage */}
            {namespaces.filter((ns) => {
              // Filter by category
              if (ns.category !== 'agent-session-events') return false;
              // If there's an agent filter, only show namespaces for that agent
              if (agentFilter && !ns.name.includes(agentFilter)) return false;
              return true;
            }).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Agent Session Event Storage
                  {agentFilter && (
                    <span className="ml-2 text-blue-400">({agentFilter})</span>
                  )}
                </h4>
                <div className="space-y-1">
                  {namespaces
                    .filter((ns) => {
                      if (ns.category !== 'agent-session-events') return false;
                      if (agentFilter && !ns.name.includes(agentFilter))
                        return false;
                      return true;
                    })
                    .map((ns) => (
                      <button
                        key={ns.name}
                        onClick={() => setSelectedNamespace(ns.name)}
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                          selectedNamespace === ns.name
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <FileJson size={16} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {ns.description || ns.name}
                          </div>
                          <div className="text-xs opacity-70">
                            {ns.name}.json
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Core Storage */}
            {namespaces.filter((ns) => ns.category === 'core').length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Core Storage
                </h4>
                <div className="space-y-1">
                  {namespaces
                    .filter((ns) => ns.category === 'core')
                    .map((ns) => (
                      <button
                        key={ns.name}
                        onClick={() => setSelectedNamespace(ns.name)}
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                          selectedNamespace === ns.name
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <Database size={16} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {ns.description || ns.name}
                          </div>
                          <div className="text-xs opacity-70">
                            {ns.name}.json
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Cache Storage */}
            {namespaces.filter((ns) => ns.category === 'cache').length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Cache Storage
                </h4>
                <div className="space-y-1">
                  {namespaces
                    .filter((ns) => ns.category === 'cache')
                    .map((ns) => (
                      <button
                        key={ns.name}
                        onClick={() => setSelectedNamespace(ns.name)}
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                          selectedNamespace === ns.name
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <Archive size={16} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {ns.description || ns.name}
                          </div>
                          <div className="text-xs opacity-70">
                            {ns.name}.json
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Other Namespaces (uncategorized) */}
            {namespaces.filter((ns) => !ns.category).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Other Storage
                </h4>
                <div className="space-y-1">
                  {namespaces
                    .filter((ns) => !ns.category)
                    .map((ns) => (
                      <button
                        key={ns.name}
                        onClick={() => setSelectedNamespace(ns.name)}
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                          selectedNamespace === ns.name
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <Folder size={16} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {ns.description || ns.name}
                          </div>
                          <div className="text-xs opacity-70">
                            {ns.name}.json
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Hook Fallback Files */}
            {hookFallbackFiles.filter((f) => !f.isError && !f.isSettings)
              .length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Hook Fallback Files
                </h4>
                <div className="space-y-1">
                  {hookFallbackFiles
                    .filter((f) => !f.isError && !f.isSettings)
                    .map((file) => (
                      <div key={file.path} className="group">
                        <button
                          onClick={() =>
                            setSelectedNamespace(`hook-fallback:${file.path}`)
                          }
                          className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                            selectedNamespace === `hook-fallback:${file.path}`
                              ? 'bg-blue-600 text-white'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          <File size={16} />
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {file.cli} Hook Events
                            </div>
                            <div className="text-xs opacity-70">
                              {file.fileName}
                            </div>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `Process ${file.fileName}?\n\nThis will import all events from this fallback file into the system.`,
                                )
                              ) {
                                try {
                                  const result =
                                    await AgentSessionEventsService.processFallbackFile(
                                      file.path,
                                      file.cli,
                                    );
                                  if (result.success) {
                                    alert(
                                      `Successfully processed fallback file!\n\nStored: ${result.storedCount} events\nProcessed: ${result.processedCount} events`,
                                    );
                                    // Refresh the file list
                                    await scanHookFallbackFiles();
                                  } else {
                                    alert(
                                      `Failed to process fallback file: ${result.error}`,
                                    );
                                  }
                                } catch (error) {
                                  alert(
                                    `Error processing fallback file: ${error}`,
                                  );
                                }
                              }
                            }}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Process
                          </button>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Hook Error Logs */}
            {hookFallbackFiles.filter((f) => f.isError).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Hook Error Logs
                </h4>
                <div className="space-y-1">
                  {hookFallbackFiles
                    .filter((f) => f.isError)
                    .map((file) => (
                      <button
                        key={file.path}
                        onClick={() =>
                          setSelectedNamespace(`hook-fallback:${file.path}`)
                        }
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                          selectedNamespace === `hook-fallback:${file.path}`
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <AlertCircle size={16} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {file.cli} Hook Errors
                          </div>
                          <div className="text-xs opacity-70">
                            {file.fileName}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Agent Settings Files */}
            {hookFallbackFiles.filter((f) => f.isSettings).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Agent Settings Files
                </h4>
                <div className="space-y-1">
                  {hookFallbackFiles
                    .filter((f) => f.isSettings)
                    .map((file) => (
                      <button
                        key={file.path}
                        onClick={() =>
                          setSelectedNamespace(`hook-fallback:${file.path}`)
                        }
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                          selectedNamespace === `hook-fallback:${file.path}`
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <FileText size={16} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {file.cli.charAt(0).toUpperCase() +
                              file.cli.slice(1)}{' '}
                            Settings
                          </div>
                          <div className="text-xs opacity-70">
                            {file.fileName}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    console.log(
      'renderRightPanel - storePath:',
      storePath,
      'loading:',
      loading,
      'error:',
      error,
    );

    // Empty state when no namespace is selected
    if (!selectedNamespace) {
      return (
        <div className="flex items-center justify-center h-full bg-neutral-950">
          <div className="text-center max-w-md">
            <Database className="mx-auto mb-4 text-neutral-600" size={48} />
            <h2 className="text-xl font-semibold text-neutral-300 mb-2">
              Storage Browser
            </h2>
            <p className="text-neutral-500 mb-6">
              Explore and inspect your application's storage namespaces. Select
              a namespace from the left panel to view its contents.
            </p>
            <div className="text-left bg-neutral-900 rounded-lg p-4 text-sm text-neutral-400">
              <div className="font-semibold text-neutral-300 mb-2">
                Available Storage Types:
              </div>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <FileJson size={14} className="text-blue-400" />
                  <span>
                    Agent Session Events - AI assistant interaction logs
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Database size={14} className="text-green-400" />
                  <span>Core Storage - User preferences and settings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Archive size={14} className="text-orange-400" />
                  <span>Cache Storage - Temporary data and caches</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full bg-neutral-950">
          <RefreshCw className="animate-spin text-neutral-400" size={32} />
        </div>
      );
    }

    if (error || !storePath) {
      return (
        <div className="flex items-center justify-center h-full bg-neutral-950">
          <div className="text-center">
            <div className="text-neutral-500 mb-2">
              {error
                ? 'Error loading store file'
                : 'No store file available yet'}
            </div>
            {!error && !storePath && (
              <div className="text-neutral-600 text-sm">
                This namespace will create a file when data is first written to
                it
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-neutral-950">
        {/* Store File Header */}
        <div className="border-b border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <FileText size={14} />
                <span>Store File</span>
              </div>
              {storeStats && (
                <div className="flex items-center gap-3 text-xs text-neutral-400">
                  <div className="flex items-center gap-1">
                    <span>Total Keys:</span>
                    <span className="text-neutral-300 font-mono">
                      {storeStats.totalKeys}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>File Size:</span>
                    <span className="text-neutral-300 font-mono">
                      {formatBytes(storeStats.sizeBytes)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyPath}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                {pathCopied ? (
                  <>
                    <Check size={12} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Path</span>
                  </>
                )}
              </button>
              <button
                onClick={openInFinder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                <ExternalLink size={12} />
                <span>Show in Finder</span>
              </button>
            </div>
          </div>
          <div className="bg-blue-900/20 text-blue-400 p-2 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Read-Only View:</span>
              <span className="ml-1">
                This is a read-only view of the store data. To edit the store,
                copy the file path and open it in your preferred JSON editor.
              </span>
            </div>
          </div>
        </div>
        {/* File Viewer */}
        <div className="flex-1 overflow-hidden">
          <HeadlessFileEditorPanel
            key={storePath} // Force remount when path changes
            filePath={storePath}
            editable={false}
            vimModeOverride={false}
          />
        </div>
      </div>
    );
  };

  const renderStorageOverview = () => {
    if (!showStorageOverview) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-neutral-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
            <div className="flex items-center gap-3">
              <HardDrive className="text-blue-400" size={24} />
              <h2 className="text-lg font-semibold text-white">
                Session Storage Overview
              </h2>
            </div>
            <button
              onClick={() => setShowStorageOverview(false)}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!storageMetrics ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw
                  className="animate-spin text-neutral-400"
                  size={32}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Total Storage */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-3">
                    Total Storage Used
                  </h3>
                  <div className="text-3xl font-bold text-white">
                    {formatBytes(storageMetrics.totalStorageUsed)}
                  </div>
                </div>

                {/* Storage Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Archive Files */}
                  <div className="bg-neutral-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-neutral-300 mb-2">
                      Archive Files
                    </h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Count:</span>
                        <span className="text-neutral-200">
                          {storageMetrics.archiveFiles.count}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Size:</span>
                        <span className="text-neutral-200">
                          {formatBytes(storageMetrics.archiveFiles.totalSize)}
                        </span>
                      </div>
                      {storageMetrics.archiveFiles.oldestFile && (
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Oldest:</span>
                          <span className="text-neutral-200">
                            {new Date(
                              storageMetrics.archiveFiles.oldestFile,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Processed Events */}
                  <div className="bg-neutral-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-neutral-300 mb-2">
                      Processed Events
                    </h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Sessions:</span>
                        <span className="text-neutral-200">
                          {storageMetrics.processedEvents.sessionCount}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">Est. Size:</span>
                        <span className="text-neutral-200">
                          {formatBytes(
                            storageMetrics.processedEvents.totalSize,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw Events by Agent */}
                <div>
                  <h3 className="text-sm font-semibold text-neutral-300 mb-3">
                    Raw Events by Agent
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(storageMetrics.rawEvents).map(
                      ([agent, data]: [string, any]) => (
                        <div
                          key={agent}
                          className="bg-neutral-800 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-200">
                              {agent}
                            </span>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-neutral-400">
                                {data.eventCount} events
                              </span>
                              <span className="text-neutral-300">
                                {formatBytes(data.totalSize)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Cleanup Options */}
                <div className="border-t border-neutral-700 pt-6">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-3">
                    Cleanup Options
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        if (
                          window.confirm(
                            'Delete all sessions older than 7 days?',
                          )
                        ) {
                          try {
                            const result =
                              await StoreService.cleanupSessionStorage({
                                olderThanDays: 7,
                                includeArchives: false,
                                includeProcessed: true,
                              });
                            alert(
                              `Cleaned up ${result.deletedCount} items, freed ${formatBytes(result.freedSpace)}`,
                            );
                            loadStorageMetrics();
                          } catch (err) {
                            console.error('Cleanup failed:', err);
                          }
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      <Trash2 size={16} />
                      <span>Clean Sessions &gt; 7 Days</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Parse selectedNamespace to extract agent and namespace for titlebar
  const parsedNamespace = React.useMemo(() => {
    if (!selectedNamespace) return { agent: undefined, namespace: undefined };

    // Check if it's an agent-namespaced format (e.g., "agent:namespace")
    const parts = selectedNamespace.split(':');
    if (parts.length === 2) {
      return { agent: parts[0], namespace: parts[1] };
    }

    // Otherwise just use it as namespace
    return { agent: undefined, namespace: selectedNamespace };
  }, [selectedNamespace]);

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Titlebar */}
      <StoreViewerTitlebar
        agent={parsedNamespace.agent}
        namespace={parsedNamespace.namespace}
        onRefresh={loadStoreInfo}
      />

      {/* Main content - flex-1 to fill remaining space */}
      <div className="flex-1 relative">
        <AnimatedResizableLayout
          leftPanel={renderLeftPanel()}
          rightPanel={renderRightPanel()}
          minSize={30}
          defaultSize={50}
          theme={theme}
        />
        {renderStorageOverview()}
      </div>
    </div>
  );
};

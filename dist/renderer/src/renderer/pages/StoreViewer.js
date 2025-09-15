import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Database, RefreshCw, FileJson, AlertCircle, FileText, Copy, Check, ExternalLink, Folder, File, Archive, HardDrive, Trash2, X } from 'lucide-react';
import { AnimatedResizableLayout } from "@a24z/panels";
import "@a24z/panels/style.css";
import { useTheme } from 'themed-markdown';
import { FileViewer } from '../components/FileViewer';
import { StoreService } from '../main-process-api/StoreService';
import { AgentSessionEventsService } from '../main-process-api/AgentSessionEventsService';
export const StoreViewer = () => {
    const { theme } = useTheme();
    const [storeStats, setStoreStats] = useState(null);
    const [storePath, setStorePath] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pathCopied, setPathCopied] = useState(false);
    const [namespaces, setNamespaces] = useState([]);
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
    const [selectedNamespace, setSelectedNamespace] = useState(namespaceParam || ''); // Use namespace from URL or empty string
    const [hookFallbackFiles, setHookFallbackFiles] = useState([]);
    const [storageMetrics, setStorageMetrics] = useState(null);
    const [showStorageOverview, setShowStorageOverview] = useState(false);
    useEffect(() => {
        loadNamespaces();
        scanHookFallbackFiles();
    }, []);
    useEffect(() => {
        if (selectedNamespace) {
            console.log('Selected namespace changed to:', selectedNamespace);
            loadStoreInfo();
        }
        else {
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
            let availableNamespaces;
            try {
                console.log('About to call listNamespaces IPC...');
                // Add a timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('listNamespaces timeout after 5s')), 5000));
                availableNamespaces = await Promise.race([
                    StoreService.listNamespaces(),
                    timeoutPromise
                ]);
                console.log('listNamespaces IPC call completed');
                console.log('Raw response:', availableNamespaces);
            }
            catch (ipcError) {
                console.error('IPC call failed:', ipcError);
                console.error('Error stack:', ipcError.stack);
                // Fallback to empty array
                availableNamespaces = [];
            }
            console.log('Available namespaces from backend:', availableNamespaces);
            console.log('Number of namespaces received:', availableNamespaces ? availableNamespaces.length : 0);
            // Ensure we have an array
            if (!Array.isArray(availableNamespaces)) {
                console.error('Namespaces is not an array:', typeof availableNamespaces);
                availableNamespaces = [];
            }
            // Validate and mark legacy namespaces
            const namespacesWithLegacy = availableNamespaces
                .filter(ns => ns && typeof ns === 'object' && ns.name) // Filter out invalid entries
                .map(ns => ({ ...ns }));
            console.log('Namespaces with legacy flag:', namespacesWithLegacy);
            // Log agent session event namespaces
            const agentSessionEventNamespaces = namespacesWithLegacy.filter(ns => ns.category === 'agent-session-events');
            console.log('Agent Session Event namespaces found:', agentSessionEventNamespaces);
            console.log('All namespace categories:', namespacesWithLegacy.map(ns => ({ name: ns.name, category: ns.category })));
            setNamespaces(namespacesWithLegacy);
            // Set default namespace if not already selected
            if (!selectedNamespace && namespacesWithLegacy.length > 0) {
                setSelectedNamespace(namespacesWithLegacy[0].name);
            }
        }
        catch (err) {
            console.error('Failed to load namespaces:', err);
            setError('Failed to load storage namespaces');
        }
    };
    const scanHookFallbackFiles = async () => {
        try {
            const files = await StoreService.scanHookFallbackFiles();
            setHookFallbackFiles(files);
        }
        catch (err) {
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
                const file = hookFallbackFiles.find(f => f.path === filePath);
                if (file) {
                    setStoreStats({
                        totalKeys: 1,
                        sizeBytes: file.size || 0
                    });
                }
            }
            else if (selectedNamespace === 'config') {
                // Legacy config namespace - no longer used
                setError('Config namespace is no longer supported');
                return;
            }
            else {
                // Namespace-specific store
                try {
                    const [path, statsResult] = await Promise.all([
                        StoreService.getNamespaceFilePath(selectedNamespace),
                        StoreService.getNamespaceStats(selectedNamespace)
                    ]);
                    console.log('Setting store path to:', path);
                    setStorePath(path);
                    // Handle stats result
                    if (statsResult && typeof statsResult.totalKeys !== 'undefined') {
                        setStoreStats({
                            totalKeys: statsResult.totalKeys || 0,
                            sizeBytes: statsResult.sizeBytes || 0
                        });
                    }
                    else {
                        // Empty namespace
                        setStoreStats({
                            totalKeys: 0,
                            sizeBytes: 0
                        });
                    }
                }
                catch (namespaceErr) {
                    // If the namespace doesn't have a file yet, handle gracefully
                    console.warn(`Namespace ${selectedNamespace} might not have a file yet:`, namespaceErr);
                    setStorePath(null);
                    setStoreStats({
                        totalKeys: 0,
                        sizeBytes: 0
                    });
                }
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load store info');
        }
        finally {
            setLoading(false);
        }
    };
    const formatBytes = (bytes) => {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const copyPath = async () => {
        if (!storePath)
            return;
        try {
            await navigator.clipboard.writeText(storePath);
            setPathCopied(true);
            setTimeout(() => setPathCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy path:', err);
        }
    };
    const openInFinder = async () => {
        if (!storePath)
            return;
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
        }
        catch (err) {
            console.error('Failed to load storage metrics:', err);
        }
    };
    const renderLeftPanel = () => {
        return (_jsxs("div", { className: "h-full flex flex-col bg-neutral-900", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-neutral-700", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Database, { className: "text-blue-400", size: 20 }), _jsx("h3", { className: "text-sm font-semibold text-white", children: "Storage Browser" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => {
                                        loadStorageMetrics();
                                        setShowStorageOverview(true);
                                    }, className: "px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors", title: "Storage Overview", children: "Storage Overview" }), _jsx("button", { onClick: () => {
                                        loadNamespaces();
                                        scanHookFallbackFiles();
                                        loadStoreInfo();
                                    }, className: "p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors", title: "Refresh All", children: _jsx(RefreshCw, { size: 16 }) })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsxs("div", { className: "p-4", children: [namespaces.filter(ns => {
                                // Filter by category
                                if (ns.category !== 'agent-session-events')
                                    return false;
                                // If there's an agent filter, only show namespaces for that agent
                                if (agentFilter && !ns.name.includes(agentFilter))
                                    return false;
                                return true;
                            }).length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsxs("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: ["Agent Session Event Storage", agentFilter && _jsxs("span", { className: "ml-2 text-blue-400", children: ["(", agentFilter, ")"] })] }), _jsx("div", { className: "space-y-1", children: namespaces.filter(ns => {
                                            if (ns.category !== 'agent-session-events')
                                                return false;
                                            if (agentFilter && !ns.name.includes(agentFilter))
                                                return false;
                                            return true;
                                        }).map((ns) => (_jsxs("button", { onClick: () => setSelectedNamespace(ns.name), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === ns.name
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(FileJson, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium", children: ns.description || ns.name }), _jsxs("div", { className: "text-xs opacity-70", children: [ns.name, ".json"] })] })] }, ns.name))) })] })), namespaces.filter(ns => ns.category === 'core').length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: "Core Storage" }), _jsx("div", { className: "space-y-1", children: namespaces.filter(ns => ns.category === 'core').map((ns) => (_jsxs("button", { onClick: () => setSelectedNamespace(ns.name), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === ns.name
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(Database, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium", children: ns.description || ns.name }), _jsxs("div", { className: "text-xs opacity-70", children: [ns.name, ".json"] })] })] }, ns.name))) })] })), namespaces.filter(ns => ns.category === 'cache').length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: "Cache Storage" }), _jsx("div", { className: "space-y-1", children: namespaces.filter(ns => ns.category === 'cache').map((ns) => (_jsxs("button", { onClick: () => setSelectedNamespace(ns.name), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === ns.name
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(Archive, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium", children: ns.description || ns.name }), _jsxs("div", { className: "text-xs opacity-70", children: [ns.name, ".json"] })] })] }, ns.name))) })] })), namespaces.filter(ns => !ns.category).length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: "Other Storage" }), _jsx("div", { className: "space-y-1", children: namespaces.filter(ns => !ns.category).map((ns) => (_jsxs("button", { onClick: () => setSelectedNamespace(ns.name), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === ns.name
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(Folder, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium", children: ns.description || ns.name }), _jsxs("div", { className: "text-xs opacity-70", children: [ns.name, ".json"] })] })] }, ns.name))) })] })), hookFallbackFiles.filter(f => !f.isError && !f.isSettings).length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: "Hook Fallback Files" }), _jsx("div", { className: "space-y-1", children: hookFallbackFiles.filter(f => !f.isError && !f.isSettings).map((file) => (_jsx("div", { className: "group", children: _jsxs("button", { onClick: () => setSelectedNamespace(`hook-fallback:${file.path}`), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === `hook-fallback:${file.path}`
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(File, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "text-sm font-medium", children: [file.cli, " Hook Events"] }), _jsx("div", { className: "text-xs opacity-70", children: file.fileName })] }), _jsx("button", { onClick: async (e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`Process ${file.fileName}?\n\nThis will import all events from this fallback file into the system.`)) {
                                                                try {
                                                                    const result = await AgentSessionEventsService.processFallbackFile(file.path, file.cli);
                                                                    if (result.success) {
                                                                        alert(`Successfully processed fallback file!\n\nStored: ${result.storedCount} events\nProcessed: ${result.processedCount} events`);
                                                                        // Refresh the file list
                                                                        await scanHookFallbackFiles();
                                                                    }
                                                                    else {
                                                                        alert(`Failed to process fallback file: ${result.error}`);
                                                                    }
                                                                }
                                                                catch (error) {
                                                                    alert(`Error processing fallback file: ${error}`);
                                                                }
                                                            }
                                                        }, className: "px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity", children: "Process" })] }) }, file.path))) })] })), hookFallbackFiles.filter(f => f.isError).length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: "Hook Error Logs" }), _jsx("div", { className: "space-y-1", children: hookFallbackFiles.filter(f => f.isError).map((file) => (_jsxs("button", { onClick: () => setSelectedNamespace(`hook-fallback:${file.path}`), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === `hook-fallback:${file.path}`
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(AlertCircle, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "text-sm font-medium", children: [file.cli, " Hook Errors"] }), _jsx("div", { className: "text-xs opacity-70", children: file.fileName })] })] }, file.path))) })] })), hookFallbackFiles.filter(f => f.isSettings).length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2", children: "Agent Settings Files" }), _jsx("div", { className: "space-y-1", children: hookFallbackFiles.filter(f => f.isSettings).map((file) => (_jsxs("button", { onClick: () => setSelectedNamespace(`hook-fallback:${file.path}`), className: `w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${selectedNamespace === `hook-fallback:${file.path}`
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`, children: [_jsx(FileText, { size: 16 }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "text-sm font-medium", children: [file.cli.charAt(0).toUpperCase() + file.cli.slice(1), " Settings"] }), _jsx("div", { className: "text-xs opacity-70", children: file.fileName })] })] }, file.path))) })] }))] }) })] }));
    };
    const renderRightPanel = () => {
        console.log('renderRightPanel - storePath:', storePath, 'loading:', loading, 'error:', error);
        // Empty state when no namespace is selected
        if (!selectedNamespace) {
            return (_jsx("div", { className: "flex items-center justify-center h-full bg-neutral-950", children: _jsxs("div", { className: "text-center max-w-md", children: [_jsx(Database, { className: "mx-auto mb-4 text-neutral-600", size: 48 }), _jsx("h2", { className: "text-xl font-semibold text-neutral-300 mb-2", children: "Storage Browser" }), _jsx("p", { className: "text-neutral-500 mb-6", children: "Explore and inspect your application's storage namespaces. Select a namespace from the left panel to view its contents." }), _jsxs("div", { className: "text-left bg-neutral-900 rounded-lg p-4 text-sm text-neutral-400", children: [_jsx("div", { className: "font-semibold text-neutral-300 mb-2", children: "Available Storage Types:" }), _jsxs("ul", { className: "space-y-1", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FileJson, { size: 14, className: "text-blue-400" }), _jsx("span", { children: "Agent Session Events - AI assistant interaction logs" })] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Database, { size: 14, className: "text-green-400" }), _jsx("span", { children: "Core Storage - User preferences and settings" })] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Archive, { size: 14, className: "text-orange-400" }), _jsx("span", { children: "Cache Storage - Temporary data and caches" })] })] })] })] }) }));
        }
        if (loading) {
            return (_jsx("div", { className: "flex items-center justify-center h-full bg-neutral-950", children: _jsx(RefreshCw, { className: "animate-spin text-neutral-400", size: 32 }) }));
        }
        if (error || !storePath) {
            return (_jsx("div", { className: "flex items-center justify-center h-full bg-neutral-950", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-neutral-500 mb-2", children: error ? 'Error loading store file' : 'No store file available yet' }), !error && !storePath && (_jsx("div", { className: "text-neutral-600 text-sm", children: "This namespace will create a file when data is first written to it" }))] }) }));
        }
        return (_jsxs("div", { className: "h-full flex flex-col bg-neutral-950", children: [_jsxs("div", { className: "border-b border-neutral-800 bg-neutral-900 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-4 flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-400", children: [_jsx(FileText, { size: 14 }), _jsx("span", { children: "Store File" })] }), storeStats && (_jsxs("div", { className: "flex items-center gap-3 text-xs text-neutral-400", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { children: "Total Keys:" }), _jsx("span", { className: "text-neutral-300 font-mono", children: storeStats.totalKeys })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { children: "File Size:" }), _jsx("span", { className: "text-neutral-300 font-mono", children: formatBytes(storeStats.sizeBytes) })] })] }))] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: copyPath, className: "flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors", children: pathCopied ? (_jsxs(_Fragment, { children: [_jsx(Check, { size: 12 }), _jsx("span", { children: "Copied!" })] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { size: 12 }), _jsx("span", { children: "Copy Path" })] })) }), _jsxs("button", { onClick: openInFinder, className: "flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors", children: [_jsx(ExternalLink, { size: 12 }), _jsx("span", { children: "Show in Finder" })] })] })] }), _jsxs("div", { className: "bg-blue-900/20 text-blue-400 p-2 rounded-lg text-xs flex items-start gap-2", children: [_jsx(AlertCircle, { size: 12, className: "flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Read-Only View:" }), _jsx("span", { className: "ml-1", children: "This is a read-only view of the store data. To edit the store, copy the file path and open it in your preferred JSON editor." })] })] })] }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(FileViewer, { filePath: storePath, editable: false, enableVimMode: false }, storePath) })] }));
    };
    const renderStorageOverview = () => {
        if (!showStorageOverview)
            return null;
        return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", children: _jsxs("div", { className: "bg-neutral-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-neutral-700", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(HardDrive, { className: "text-blue-400", size: 24 }), _jsx("h2", { className: "text-lg font-semibold text-white", children: "Session Storage Overview" })] }), _jsx("button", { onClick: () => setShowStorageOverview(false), className: "p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors", children: _jsx(X, { size: 20 }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-6", children: !storageMetrics ? (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx(RefreshCw, { className: "animate-spin text-neutral-400", size: 32 }) })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-neutral-800 rounded-lg p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-300 mb-3", children: "Total Storage Used" }), _jsx("div", { className: "text-3xl font-bold text-white", children: formatBytes(storageMetrics.totalStorageUsed) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-neutral-800 rounded-lg p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-neutral-300 mb-2", children: "Archive Files" }), _jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-neutral-400", children: "Count:" }), _jsx("span", { className: "text-neutral-200", children: storageMetrics.archiveFiles.count })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-neutral-400", children: "Size:" }), _jsx("span", { className: "text-neutral-200", children: formatBytes(storageMetrics.archiveFiles.totalSize) })] }), storageMetrics.archiveFiles.oldestFile && (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-neutral-400", children: "Oldest:" }), _jsx("span", { className: "text-neutral-200", children: new Date(storageMetrics.archiveFiles.oldestFile).toLocaleDateString() })] }))] })] }), _jsxs("div", { className: "bg-neutral-800 rounded-lg p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-neutral-300 mb-2", children: "Processed Events" }), _jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-neutral-400", children: "Sessions:" }), _jsx("span", { className: "text-neutral-200", children: storageMetrics.processedEvents.sessionCount })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-neutral-400", children: "Est. Size:" }), _jsx("span", { className: "text-neutral-200", children: formatBytes(storageMetrics.processedEvents.totalSize) })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-300 mb-3", children: "Raw Events by Agent" }), _jsx("div", { className: "space-y-2", children: Object.entries(storageMetrics.rawEvents).map(([agent, data]) => (_jsx("div", { className: "bg-neutral-800 rounded-lg p-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-medium text-neutral-200", children: agent }), _jsxs("div", { className: "flex items-center gap-4 text-sm", children: [_jsxs("span", { className: "text-neutral-400", children: [data.eventCount, " events"] }), _jsx("span", { className: "text-neutral-300", children: formatBytes(data.totalSize) })] })] }) }, agent))) })] }), _jsxs("div", { className: "border-t border-neutral-700 pt-6", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-300 mb-3", children: "Cleanup Options" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("button", { onClick: async () => {
                                                        if (window.confirm('Delete all sessions older than 7 days?')) {
                                                            try {
                                                                const result = await StoreService.cleanupSessionStorage({
                                                                    olderThanDays: 7,
                                                                    includeArchives: true,
                                                                    includeProcessed: true
                                                                });
                                                                alert(`Cleaned up ${result.deletedCount} items, freed ${formatBytes(result.freedSpace)}`);
                                                                loadStorageMetrics();
                                                            }
                                                            catch (err) {
                                                                console.error('Cleanup failed:', err);
                                                            }
                                                        }
                                                    }, className: "flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors", children: [_jsx(Trash2, { size: 16 }), _jsx("span", { children: "Clean Sessions > 7 Days" })] }), _jsxs("button", { onClick: async () => {
                                                        if (window.confirm('Delete all archived sessions older than 30 days?')) {
                                                            try {
                                                                const result = await StoreService.cleanupSessionStorage({
                                                                    olderThanDays: 30,
                                                                    includeArchives: true,
                                                                    includeProcessed: false
                                                                });
                                                                alert(`Cleaned up ${result.deletedCount} archives, freed ${formatBytes(result.freedSpace)}`);
                                                                loadStorageMetrics();
                                                            }
                                                            catch (err) {
                                                                console.error('Cleanup failed:', err);
                                                            }
                                                        }
                                                    }, className: "flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors", children: [_jsx(Archive, { size: 16 }), _jsx("span", { children: "Clean Archives > 30 Days" })] })] })] })] })) })] }) }));
    };
    return (_jsxs("div", { className: "fixed inset-0 flex flex-col h-screen", style: { backgroundColor: theme.colors.background }, children: [_jsx(AnimatedResizableLayout, { leftPanel: renderLeftPanel(), rightPanel: renderRightPanel(), minSize: 30, defaultSize: 50 }), renderStorageOverview()] }));
};

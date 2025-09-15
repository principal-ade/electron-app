import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, GitBranch, Layers, Search, FileText, Brain, Book, PanelLeft, PanelLeftClose, Clock, Scale } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { ThemedMarkdownSlide } from '../../components/markdown/ThemedMarkdownSlide';
import { CityMapManager } from './shared/CityMapManager';
import { DocumentationPanel } from './shared/DocumentationPanel';
import { MarkdownDocumentViewer } from './shared/MarkdownDocumentViewer';
import { ExcalidrawWrapper } from '../../components/shared/ExcalidrawWrapper';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { WindowService } from '../../main-process-api/WindowService';
import { RepositoryNotesService } from '../../main-process-api/RepositoryNotesService';
import { GitHubWebAdapters } from '../../adapters/GitHubWebAdapters';
import { ElectronPlatformAdapters } from '../../adapters/ElectronPlatformAdapters';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { RepositoryViewSkeleton } from './shared/RepositoryViewSkeleton';
import { RepoSourceArchitecturePanelSimple } from './shared/RepoSourceArchitecturePanelSimple';
import { NullContentProvider, GitHubContentProvider } from '../../services/ContentProviders';
import { RemoteFileViewerModal } from './shared/RemoteFileViewerModal';
import { HelpModal } from './shared/HelpModal';
import { useGitChanges } from '../../contexts/GitChangesContext';
export const RepositoryExplorationView = ({ repository, remoteData, searchQuery, fileTree: sharedFileTree, cityData: sharedCityData, activeFileTreeSource: sharedActiveSource, fileTreeSourceService: sharedFileTreeService, cacheService: sharedCacheService, cityDataCache: _cityDataCache, treeStats: sharedTreeStats, a24zNotes: a24zNotesProp = [], fileColorHighlightLayers = [], onFileTreeLoaded, }) => {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState('readme');
    const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
    // Services - use shared if provided, otherwise create local
    const fileTreeSourceService = useMemo(() => sharedFileTreeService || new FileTreeSourceService(), [sharedFileTreeService]);
    const cacheService = useMemo(() => sharedCacheService || new FileTreeCacheService(), [sharedCacheService]);
    // Data loading state
    const [loading, setLoading] = useState(!sharedFileTree);
    const [error, setError] = useState(null);
    // Sources state
    const [fileTreeSources, setFileTreeSources] = useState([]);
    const [activeFileTreeSource, setActiveFileTreeSource] = useState(sharedActiveSource || null);
    // Repository data - use shared if provided
    const [treeStats, setTreeStats] = useState(sharedTreeStats || null);
    const [fileTree, setFileTree] = useState(sharedFileTree || null);
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
    // README state
    const [readmeContent, setReadmeContent] = useState(null);
    const [loadingReadme, setLoadingReadme] = useState(false);
    // CHANGELOG state
    const [changelogContent, setChangelogContent] = useState(null);
    const [loadingChangelog, setLoadingChangelog] = useState(false);
    // LICENSE state
    const [licenseContent, setLicenseContent] = useState(null);
    const [loadingLicense, setLoadingLicense] = useState(false);
    // Notes state
    const [tribalKnowledgeNotes, setTribalKnowledgeNotes] = useState([]);
    const [selectedNoteIds, setSelectedNoteIds] = useState(new Set());
    const [noteHighlightLayers, setNoteHighlightLayers] = useState([]);
    // a24z memory state - notes come from props, only manage the layer locally
    const a24zNotes = a24zNotesProp; // Use the prop instead of local state
    const [a24zHighlightLayer, setA24zHighlightLayer] = useState(null);
    const [showA24zLayer, setShowA24zLayer] = useState(true);
    // Search state
    const [selectedFile] = useState(null); // setSelectedFile will be used when file selection is implemented
    const [searchResults, setSearchResults] = useState([]);
    const [searchHighlightLayer, setSearchHighlightLayer] = useState(null);
    const [selectedFileLayer, setSelectedFileLayer] = useState(null);
    const [hoveredSearchResult] = useState(null); // setHoveredSearchResult will be used when hover is implemented
    const [hoveredSearchLayer, setHoveredSearchLayer] = useState(null);
    // File viewer modal state
    const [showFileViewer, setShowFileViewer] = useState(false);
    const [viewerFilePath, setViewerFilePath] = useState(null);
    const [viewerRelativePath, setViewerRelativePath] = useState(null);
    // Help modal state
    const [showHelpModal, setShowHelpModal] = useState(false);
    // Multi-file editor state
    const [openedFiles, setOpenedFiles] = useState(new Set());
    // Package data state
    const [packageLayers, setPackageLayers] = useState(null);
    // Toolbar state
    const [toolbarExpanded, setToolbarExpanded] = useState(false);
    // Package highlight state
    const [highlightedPackages, setHighlightedPackages] = useState(new Set());
    const [packageHighlightLayers, setPackageHighlightLayers] = useState([]);
    // Dependency analysis highlight state
    const [analyzingPackagePath, setAnalyzingPackagePath] = useState(null);
    const [dependencyAnalysisHighlightLayer, setDependencyAnalysisHighlightLayer] = useState([]);
    // Documentation state
    const [selectedDocPath, setSelectedDocPath] = useState(null);
    const [selectedDocType, setSelectedDocType] = useState('markdown');
    const [docContent, setDocContent] = useState(null);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [docViewMode, setDocViewMode] = useState('document');
    const [preferredDocViewMode, setPreferredDocViewMode] = useState('document');
    const [currentSlide, setCurrentSlide] = useState(0);
    // Git changes from context
    const { getGitHighlightLayers, checkGitStatus, getGitState, toggleGitChanges, initializeLocalSource, setGitChangesVisible } = useGitChanges();
    const [gitHighlightLayers, setGitHighlightLayers] = useState([]);
    // Auto-initialize git state for local sources (loads HEAD tree)
    useEffect(() => {
        if (activeFileTreeSource?.type === 'local') {
            console.log('[RepositoryExploration] Auto-initializing git state for local source:', activeFileTreeSource.id);
            initializeLocalSource(activeFileTreeSource);
        }
    }, [activeFileTreeSource, initializeLocalSource]);
    // Check git status and get layers when source changes
    useEffect(() => {
        if (activeFileTreeSource && activeFileTreeSource.type === 'local') {
            // Check git status for this source
            checkGitStatus(activeFileTreeSource).then(() => {
                // Get highlight layers
                const layers = getGitHighlightLayers(activeFileTreeSource.id, fileTree);
                setGitHighlightLayers(layers);
            });
        }
        else {
            setGitHighlightLayers([]);
        }
    }, [activeFileTreeSource, fileTree, checkGitStatus, getGitHighlightLayers]);
    // Handle file click to open in multi-tab viewer
    const handleFileClick = useCallback((filePath) => {
        // Add file to opened files set
        setOpenedFiles(prev => new Set(prev).add(filePath));
        // Open multi-file editor window
        const openMultiFileEditor = async () => {
            try {
                // Prepare file info for the multi-file editor
                const files = [{
                        path: filePath,
                        relativePath: filePath,
                        lastModified: Date.now()
                    }];
                // Include any previously opened files
                openedFiles.forEach(openedFile => {
                    if (openedFile !== filePath) {
                        files.push({
                            path: openedFile,
                            relativePath: openedFile,
                            lastModified: Date.now()
                        });
                    }
                });
                // Pass remote repository information for the multi-file editor
                const branch = activeFileTreeSource?.metadata?.currentBranch || remoteData.defaultBranch;
                await WindowService.openMultiFileEditor({
                    sessionId: `explore-${remoteData.owner}-${remoteData.repo}`,
                    sessionName: `Explore ${remoteData.owner}/${remoteData.repo}`,
                    files,
                    repositoryPath: remoteData.owner + '/' + remoteData.repo,
                    // Add remote repository info so the editor knows to use remote content provider
                    isRemote: true,
                    remoteInfo: {
                        owner: remoteData.owner,
                        repo: remoteData.repo,
                        branch
                    }
                });
            }
            catch (error) {
                console.error('[RepositoryExplorationView] Failed to open multi-file editor:', error);
            }
        };
        openMultiFileEditor();
    }, [remoteData, openedFiles, activeFileTreeSource]);
    // Right pane mode: for remote exploration we default to city and do not show terminal toggle
    const [rightPaneMode] = useState('city');
    // Create content provider for remote repositories
    const _contentProvider = useMemo(() => {
        // For search, we should NOT use GitHubContentProvider for content search
        // as it would make API calls for every file. Use NullContentProvider for search,
        // but we'll create a separate provider for viewing individual files
        return new NullContentProvider();
    }, []);
    // Handle dependency analysis highlighting
    const handlePackageAnalysisStart = useCallback((packagePath, packageName) => {
        if (!fileTree)
            return;
        setAnalyzingPackagePath(packagePath);
        // Clear selection highlights when analysis starts
        setPackageHighlightLayers([]);
        // Create highlight layer for the package being analyzed
        const highlightLayer = {
            id: 'dependency-analysis',
            name: `Analyzing ${packageName}`,
            color: '#0ea5e9', // Bright blue color for analysis
            opacity: 0.9,
            items: [
                { path: packagePath, type: 'directory' }, // Highlight the entire package directory
                { path: packagePath + '/package.json', type: 'file' } // Also highlight the package.json file
            ],
            enabled: true,
            priority: 10
        };
        setDependencyAnalysisHighlightLayer([highlightLayer]);
    }, [fileTree]);
    const handlePackageAnalysisEnd = useCallback(() => {
        const prevAnalyzingPath = analyzingPackagePath;
        setAnalyzingPackagePath(null);
        setDependencyAnalysisHighlightLayer([]);
        // If there was a package being analyzed, restore its selection highlight
        if (prevAnalyzingPath && fileTree && packageLayers) {
            const packageData = packageLayers.find(pkg => pkg.packageData.path === prevAnalyzingPath);
            if (packageData) {
                const highlightLayer = {
                    id: 'package-selection',
                    name: `Selected ${packageData.packageData.name}`,
                    color: '#22c55e', // Bright green color for selection
                    opacity: 0.9,
                    items: [
                        { path: prevAnalyzingPath, type: 'directory' }, // Highlight the entire package directory
                        { path: prevAnalyzingPath + '/package.json', type: 'file' } // Also highlight the package.json file
                    ],
                    enabled: true,
                    priority: 5
                };
                setPackageHighlightLayers([highlightLayer]);
            }
        }
    }, [analyzingPackagePath, fileTree, packageLayers]);
    // Handle package selection highlighting
    const handlePackageSelected = useCallback((packagePath, packageName) => {
        if (!fileTree)
            return;
        // Don't show selection highlight if we're currently analyzing this package
        if (analyzingPackagePath === packagePath)
            return;
        // Create highlight layer for the selected package
        const highlightLayer = {
            id: 'package-selection',
            name: `Selected ${packageName}`,
            color: '#22c55e', // Bright green color for selection
            opacity: 0.9,
            items: [
                { path: packagePath, type: 'directory' }, // Highlight the entire package directory
                { path: packagePath + '/package.json', type: 'file' } // Also highlight the package.json file
            ],
            enabled: true,
            priority: 5
        };
        setPackageHighlightLayers([highlightLayer]);
    }, [fileTree, analyzingPackagePath]);
    const handlePackageDeselected = useCallback(() => {
        // Only clear selection highlights if we're not currently analyzing
        if (!analyzingPackagePath) {
            setPackageHighlightLayers([]);
        }
    }, [analyzingPackagePath]);
    // Simple file tree search without indexing for better performance
    const performSimpleSearch = useCallback((query) => {
        if (!fileTree || !query.trim())
            return [];
        const lowerQuery = query.toLowerCase();
        const results = [];
        // Search through all files
        for (const file of fileTree.allFiles || []) {
            // Check if filename or path contains the query
            if (file.name.toLowerCase().includes(lowerQuery) ||
                file.relativePath.toLowerCase().includes(lowerQuery)) {
                results.push(file.relativePath);
                // Limit results for performance
                if (results.length >= 100)
                    break;
            }
        }
        return results;
    }, [fileTree]);
    // Handle search from header
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            setSearchHighlightLayer(null);
            return;
        }
        // Perform simple search for instant feedback
        const results = performSimpleSearch(searchQuery);
        setSearchResults(results);
        // Create highlight layer for search results
        if (results.length > 0) {
            const layer = {
                id: 'search-results',
                name: 'Search Results',
                color: '#FFD700',
                opacity: 0.6,
                items: results.map(f => ({ path: f, type: 'file' })),
                enabled: true,
                priority: 15
            };
            setSearchHighlightLayer(layer);
        }
        else {
            setSearchHighlightLayer(null);
        }
        console.info('[ExploreView] Search results for "' + searchQuery + '":', results.length, 'files found');
    }, [searchQuery, performSimpleSearch]);
    // Separate provider for viewing individual files (not for search)
    const fileViewerContentProvider = useMemo(() => {
        return new GitHubContentProvider(remoteData.owner, remoteData.repo, activeFileTreeSource?.metadata?.currentBranch || remoteData.defaultBranch);
    }, [remoteData.owner, remoteData.repo, remoteData.defaultBranch, activeFileTreeSource?.metadata?.currentBranch]);
    // Initialize sources only if not using shared service
    useEffect(() => {
        if (sharedFileTreeService || sharedActiveSource) {
            // Skip initialization if using shared data
            return;
        }
        const initialSources = fileTreeSourceService.initializeFromRepository(repository);
        // Filter to only remote sources for exploration view
        // Local clones should be explored through LocalDevelopmentView
        const remoteSources = initialSources.filter(source => source.type === 'remote');
        setFileTreeSources(remoteSources);
        // Set the first remote source as active (should be the default branch)
        const defaultRemoteSource = remoteSources.find(s => s.isDefault) || remoteSources[0];
        if (defaultRemoteSource) {
            fileTreeSourceService.setActiveSource(defaultRemoteSource.id);
            setActiveFileTreeSource(defaultRemoteSource);
        }
    }, [repository, fileTreeSourceService, sharedFileTreeService, sharedActiveSource]);
    // Create adapters for active source - use appropriate provider based on source type
    const adapters = useMemo(() => {
        if (!activeFileTreeSource)
            return null;
        // For local sources, use Electron adapters to read local files
        if (activeFileTreeSource.type === 'local') {
            return new ElectronPlatformAdapters();
        }
        // For remote sources, use GitHub adapters
        const branch = activeFileTreeSource.metadata?.currentBranch || remoteData.defaultBranch;
        return new GitHubWebAdapters(remoteData.owner, remoteData.repo, branch);
    }, [activeFileTreeSource, remoteData.owner, remoteData.repo, remoteData.defaultBranch]);
    // RepositoryExplorationView should never load its own tree - always use the one from RepositoryManager
    useEffect(() => {
        if (!sharedFileTree) {
            setLoading(false);
            setError('File tree not provided by RepositoryManager');
            console.error('[RepositoryExploration] No file tree provided by RepositoryManager');
        }
        else {
            setLoading(false);
            setError(null);
            // Call onFileTreeLoaded if provided
            if (onFileTreeLoaded) {
                onFileTreeLoaded(sharedFileTree);
            }
        }
    }, [sharedFileTree, onFileTreeLoaded]);
    // Fetch README content
    useEffect(() => {
        const fetchReadme = async () => {
            if (!fileTree) {
                return;
            }
            // For local sources, read README from the actual local file system
            if (activeFileTreeSource?.type === 'local') {
                try {
                    const localBasePath = activeFileTreeSource.location;
                    const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'README.txt', 'readme.txt'];
                    let content = null;
                    for (const filename of readmeFiles) {
                        const fullPath = `${localBasePath}/${filename}`;
                        const result = await adapters?.fileSystem.readFile(fullPath);
                        if (result?.content) {
                            content = result.content;
                            break;
                        }
                    }
                    setReadmeContent(content);
                    setLoadingReadme(false);
                    return;
                }
                catch (error) {
                    console.error('Error reading local README:', error);
                    setReadmeContent('# Error loading README\n\nFailed to load the local README file.');
                    setLoadingReadme(false);
                }
                return;
            }
            // For remote sources, use GitHub adapters
            if (!adapters) {
                return;
            }
            const activeRef = activeFileTreeSource?.metadata?.currentBranch || remoteData.defaultBranch;
            setLoadingReadme(true);
            try {
                // Try to discover the actual README filename at the repo root via the already loaded file tree
                let discoveredPath = null;
                try {
                    if (fileTree) {
                        // Use the correct FileTree API - allFiles is an array of FileInfo objects
                        if (fileTree.allFiles) {
                            const readmeFile = fileTree.allFiles.find(file => {
                                // Check if it's a root-level file (no directory separator)
                                if (file.relativePath.includes('/'))
                                    return false;
                                // Check if it matches README pattern
                                return /^readme(\.[^/]*)?$/i.test(file.name);
                            });
                            discoveredPath = readmeFile?.relativePath || null;
                        }
                        else {
                            discoveredPath = null;
                        }
                        if (discoveredPath) {
                            // Found README path
                        }
                        else {
                            // No README content found
                        }
                    }
                    else {
                        // No fileTree available
                    }
                }
                catch (err) {
                    console.warn('[Exploration] README: fileTree discovery threw error', err);
                }
                const readmeVariants = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];
                let content = null;
                // Prefer discoveredPath if available
                if (discoveredPath) {
                    const result = await adapters.fileSystem.readFile(discoveredPath);
                    if (result && result.content) {
                        content = result.content;
                    }
                    else {
                        // No fileTree available
                    }
                }
                // Fallback to variant guesses at repo root
                if (!content) {
                    for (const variant of readmeVariants) {
                        const result = await adapters.fileSystem.readFile(variant);
                        if (result && result.content) {
                            content = result.content;
                            break;
                        }
                        else {
                            // No README content found
                        }
                    }
                }
                if (!content) {
                    console.warn('[Exploration] README: not found in repo root for any variant', {
                        owner: remoteData.owner,
                        repo: remoteData.repo,
                        ref: activeRef,
                    });
                }
                // If not found, leave readmeContent null so the UI shows the file tree list for verification
                if (content) {
                    setReadmeContent(content);
                }
                else {
                    setReadmeContent(null);
                }
            }
            catch (error) {
                console.error('Failed to fetch README:', error);
                setReadmeContent('# Error loading README\n\nFailed to load the README file.');
            }
            finally {
                setLoadingReadme(false);
            }
        };
        fetchReadme();
    }, [adapters, activeFileTreeSource, remoteData.owner, remoteData.repo, remoteData.defaultBranch, fileTree]);
    // Fetch repository notes
    useEffect(() => {
        const fetchNotes = async () => {
            if (!repository.remoteUrl)
                return;
            try {
                const notes = await RepositoryNotesService.getNotesForRepository(repository.remoteUrl);
                setTribalKnowledgeNotes(notes);
            }
            catch (error) {
                console.error('Failed to fetch repository notes:', error);
            }
        };
        fetchNotes();
    }, [repository.remoteUrl]);
    // a24z notes are now loaded in RepositoryManager and passed as props
    // Create a24z highlight layer from anchors
    useEffect(() => {
        if (!showA24zLayer || a24zNotes.length === 0) {
            setA24zHighlightLayer(null);
            return;
        }
        console.info('[ExploreView] Processing a24z notes for highlight layer:', a24zNotes.length, 'notes');
        // Collect all unique file paths from anchors
        const filePaths = new Set();
        for (const note of a24zNotes) {
            console.info('[ExploreView] Processing note:', {
                id: note.id,
                anchors: note.anchors,
                type: note.type,
                tags: note.tags
            });
            if (note.anchors && Array.isArray(note.anchors)) {
                for (const anchor of note.anchors) {
                    if (anchor && typeof anchor === 'string') {
                        // Remove leading slash if present
                        const cleanPath = anchor.startsWith('/') ? anchor.substring(1) : anchor;
                        filePaths.add(cleanPath);
                        console.info('[ExploreView] Added anchor path:', cleanPath);
                    }
                }
            }
        }
        console.info('[ExploreView] Total unique file paths from a24z notes:', filePaths.size);
        if (filePaths.size === 0) {
            setA24zHighlightLayer(null);
            return;
        }
        // Create highlight layer
        const layer = {
            id: 'a24z-memory',
            name: `a24z Memory (${a24zNotes.length} notes)`,
            enabled: true,
            color: '#9333ea', // Purple color for a24z
            priority: 15, // Lower priority than search/selection
            items: Array.from(filePaths).map(path => ({
                path,
                type: 'file',
                renderStrategy: 'border' // Use border to not interfere with other highlights
            }))
        };
        console.info('[ExploreView] Created a24z highlight layer with', layer.items.length, 'items');
        setA24zHighlightLayer(layer);
    }, [a24zNotes, showA24zLayer]);
    // Create search highlight layer
    useEffect(() => {
        if (searchResults.length === 0) {
            setSearchHighlightLayer(null);
            return;
        }
        const layer = {
            id: 'search-results',
            name: `Search Results (${searchResults.length})`,
            enabled: true,
            color: '#3b82f6', // Blue for search results
            priority: 25, // Higher than most layers
            items: searchResults.map(path => ({
                path,
                type: 'file'
            }))
        };
        setSearchHighlightLayer(layer);
    }, [searchResults]);
    // Create hover highlight layer for search results
    useEffect(() => {
        if (!hoveredSearchResult) {
            setHoveredSearchLayer(null);
            return;
        }
        const layer = {
            id: 'hovered-search-result',
            name: 'Hovered Result',
            enabled: true,
            color: '#fbbf24', // Amber/yellow for hover
            priority: 40, // Higher priority than other layers
            borderWidth: 3, // Thicker border for visibility
            items: [{
                    path: hoveredSearchResult,
                    type: 'file',
                    renderStrategy: 'fill' // Just outline for hover
                }]
        };
        setHoveredSearchLayer(layer);
    }, [hoveredSearchResult]);
    // Create selected file fill layer
    useEffect(() => {
        if (!selectedFile) {
            setSelectedFileLayer(null);
            return;
        }
        // Extract relative path from the selected file
        // The selectedFile might be an absolute path, so we need to convert it
        let relativePath = selectedFile;
        if (selectedFile.includes('/')) {
            // If it's an absolute path, try to find the relative part
            const parts = selectedFile.split('/');
            const repoNameIndex = parts.findIndex(part => part === repository.name);
            if (repoNameIndex !== -1 && repoNameIndex < parts.length - 1) {
                relativePath = parts.slice(repoNameIndex + 1).join('/');
            }
            else {
                // Fallback: just use the last part after the last slash
                relativePath = selectedFile.substring(selectedFile.lastIndexOf('/') + 1);
            }
        }
        const layer = {
            id: 'selected-file',
            name: 'Selected File',
            enabled: true,
            color: '#10b981', // Green for selected file
            priority: 30, // Higher priority than search results
            items: [{
                    path: relativePath,
                    type: 'file',
                    renderStrategy: 'fill' // Fill the building instead of just outline
                }]
        };
        setSelectedFileLayer(layer);
    }, [selectedFile, repository.name]);
    // Create note highlight layers
    useEffect(() => {
        if (selectedNoteIds.size === 0) {
            setNoteHighlightLayers([]);
            return;
        }
        const layers = [];
        const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
        let colorIndex = 0;
        for (const noteId of selectedNoteIds) {
            const note = tribalKnowledgeNotes.find(n => n.id === noteId);
            if (!note)
                continue;
            const color = colors[colorIndex % colors.length];
            colorIndex++;
            const items = [];
            if (note.relativePath) {
                items.push({ path: note.relativePath, type: 'directory' });
            }
            if (note.anchors) {
                for (const anchor of note.anchors) {
                    items.push({ path: anchor, type: 'file' });
                }
            }
            if (items.length > 0) {
                layers.push({
                    id: `note-${noteId}`,
                    name: `Note: ${note.note.substring(0, 30)}...`,
                    enabled: true,
                    color,
                    priority: 20 + colorIndex,
                    items
                });
            }
        }
        setNoteHighlightLayers(layers);
    }, [selectedNoteIds, tribalKnowledgeNotes]);
    // Create package highlight layers
    useEffect(() => {
        if (highlightedPackages.size === 0) {
            setPackageHighlightLayers([]);
            return;
        }
        if (!packageLayers) {
            setPackageHighlightLayers([]);
            return;
        }
        const layers = [];
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']; // Green, Blue, Orange, Purple, Pink
        let colorIndex = 0;
        for (const packageId of highlightedPackages) {
            // Find the package data
            const pkg = packageLayers.find(p => p.id === packageId);
            if (!pkg)
                continue;
            const items = [];
            // Handle root package - check for various root indicators including "package.json" itself
            const isRootPackage = !pkg.packageData.path ||
                pkg.packageData.path === '.' ||
                pkg.packageData.path === 'root' ||
                pkg.packageData.path === '' ||
                pkg.packageData.path === 'package.json';
            if (isRootPackage) {
                // For root packages, highlight both the root directory and package.json file
                items.push({
                    path: '',
                    type: 'directory',
                    renderStrategy: 'fill'
                });
                items.push({
                    path: 'package.json',
                    type: 'file',
                    renderStrategy: 'fill'
                });
            }
            else {
                // For non-root packages, highlight both the directory and package.json
                items.push({
                    path: pkg.packageData.path,
                    type: 'directory',
                    renderStrategy: 'fill'
                });
                items.push({
                    path: `${pkg.packageData.path}/package.json`,
                    type: 'file',
                    renderStrategy: 'fill'
                });
            }
            const layer = {
                id: `package-highlight-${packageId}`,
                name: `Package: ${pkg.packageData.name}`,
                enabled: true,
                color: colors[colorIndex % colors.length],
                priority: 35 + colorIndex, // Slightly different priorities to ensure all show
                items
            };
            layers.push(layer);
            colorIndex++;
        }
        setPackageHighlightLayers(layers);
    }, [highlightedPackages, packageLayers]);
    // Handle source change
    const handleSourceChange = (sourceId) => {
        const source = fileTreeSourceService.getSource(sourceId);
        if (source) {
            fileTreeSourceService.setActiveSource(sourceId);
            setActiveFileTreeSource(source);
        }
    };
    // Handle documentation selection
    const handleDocumentSelect = useCallback(async (filePath, type) => {
        setSelectedDocPath(filePath);
        setSelectedDocType(type);
        setLoadingDoc(true);
        // Use the preferred view mode when opening a new document
        setDocViewMode(preferredDocViewMode);
        setCurrentSlide(0); // Reset to first slide
        try {
            // For local sources, read from filesystem
            if (activeFileTreeSource?.type === 'local') {
                // Build full path for local files
                const fullPath = filePath.startsWith('/')
                    ? filePath
                    : `${activeFileTreeSource.location}/${filePath}`.replace(/\/+/g, '/');
                const result = await FileSystemService.readFile(fullPath);
                if (result?.content) {
                    setDocContent(result.content);
                }
                else {
                    setDocContent(null);
                }
            }
            else if (activeFileTreeSource?.type === 'remote') {
                // For remote sources, use GitHub API
                const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
                const content = await fileViewerContentProvider.readFileContent(relativePath);
                if (content) {
                    setDocContent(content);
                }
                else {
                    setDocContent(null);
                }
            }
        }
        catch (error) {
            console.error('Failed to load document:', error);
            setDocContent(null);
        }
        finally {
            setLoadingDoc(false);
        }
    }, [activeFileTreeSource, fileViewerContentProvider, preferredDocViewMode]);
    // Handle package highlighting (toggle)
    const handleHighlightPackage = (packagePath, packageName) => {
        // Find the package by path and name to get its ID
        const pkg = packageLayers?.find(p => p.packageData.path === packagePath && p.packageData.name === packageName);
        if (!pkg) {
            console.warn('[RepositoryExplorationView] Could not find package:', packageName, packagePath);
            return;
        }
        setHighlightedPackages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pkg.id)) {
                newSet.delete(pkg.id);
            }
            else {
                newSet.add(pkg.id);
            }
            return newSet;
        });
    };
    // Check if docs folder exists
    const hasDocsFolder = useMemo(() => {
        if (!fileTree)
            return false;
        // Check if there's a docs directory at the root
        if (fileTree.allDirectories) {
            const hasDocsDir = fileTree.allDirectories.some(dir => dir.relativePath === 'docs' || dir.name === 'docs');
            if (hasDocsDir)
                return true;
        }
        // Also check if there are any files in the docs/ directory
        const hasDocsFiles = fileTree.allFiles.some(file => file.relativePath.startsWith('docs/') && !file.relativePath.includes('.a24z'));
        return hasDocsFiles;
    }, [fileTree]);
    // Check if CHANGELOG.md exists at root
    const hasChangelog = useMemo(() => {
        if (!fileTree)
            return false;
        // Check for CHANGELOG.md at root (case-insensitive)
        return fileTree.allFiles.some(file => {
            const fileName = file.name.toLowerCase();
            const isAtRoot = !file.relativePath.includes('/');
            return isAtRoot && fileName === 'changelog.md';
        });
    }, [fileTree]);
    // Check if LICENSE file exists at root
    const hasLicense = useMemo(() => {
        if (!fileTree)
            return false;
        // Check for LICENSE files at root (various formats)
        return fileTree.allFiles.some(file => {
            const fileName = file.name.toLowerCase();
            const isAtRoot = !file.relativePath.includes('/');
            // Match LICENSE, LICENSE.txt, LICENSE.md, LICENCE (UK spelling), COPYING, etc.
            return isAtRoot && (fileName === 'license' ||
                fileName === 'license.txt' ||
                fileName === 'license.md' ||
                fileName === 'licence' ||
                fileName === 'licence.txt' ||
                fileName === 'licence.md' ||
                fileName === 'copying' ||
                fileName === 'copying.txt' ||
                fileName.startsWith('license.') // LICENSE.MIT, LICENSE.Apache, etc.
            );
        });
    }, [fileTree]);
    // Fetch CHANGELOG content
    useEffect(() => {
        const fetchChangelog = async () => {
            if (!fileTree || !hasChangelog) {
                setChangelogContent(null);
                return;
            }
            setLoadingChangelog(true);
            try {
                // For local sources, read CHANGELOG from the actual local file system
                if (activeFileTreeSource?.type === 'local') {
                    const localBasePath = activeFileTreeSource.location;
                    const changelogFiles = ['CHANGELOG.md', 'changelog.md', 'Changelog.md', 'CHANGELOG.MD'];
                    let content = null;
                    for (const filename of changelogFiles) {
                        const fullPath = `${localBasePath}/${filename}`;
                        const result = await adapters?.fileSystem.readFile(fullPath);
                        if (result?.content) {
                            content = result.content;
                            break;
                        }
                    }
                    setChangelogContent(content);
                    setLoadingChangelog(false);
                    return;
                }
                // For remote sources, use GitHub adapters
                if (!adapters) {
                    return;
                }
                const changelogVariants = ['CHANGELOG.md', 'changelog.md', 'Changelog.md', 'CHANGELOG.MD'];
                let content = null;
                for (const variant of changelogVariants) {
                    const result = await adapters.fileSystem.readFile(variant);
                    if (result && result.content) {
                        content = result.content;
                        break;
                    }
                }
                if (content) {
                    setChangelogContent(content);
                }
                else {
                    setChangelogContent(null);
                }
            }
            catch (error) {
                console.error('Failed to fetch CHANGELOG:', error);
                setChangelogContent('# Error loading CHANGELOG\n\nFailed to load the CHANGELOG file.');
            }
            finally {
                setLoadingChangelog(false);
            }
        };
        fetchChangelog();
    }, [adapters, activeFileTreeSource, remoteData.owner, remoteData.repo, fileTree, hasChangelog]);
    // Fetch LICENSE content
    useEffect(() => {
        const fetchLicense = async () => {
            if (!fileTree || !hasLicense) {
                setLicenseContent(null);
                return;
            }
            setLoadingLicense(true);
            try {
                // For local sources, read LICENSE from the actual local file system
                if (activeFileTreeSource?.type === 'local') {
                    const localBasePath = activeFileTreeSource.location;
                    // Try various LICENSE file formats
                    const licenseFiles = [
                        'LICENSE', 'LICENSE.txt', 'LICENSE.md',
                        'LICENCE', 'LICENCE.txt', 'LICENCE.md', // UK spelling
                        'license', 'license.txt', 'license.md',
                        'COPYING', 'COPYING.txt', 'copying',
                        'LICENSE.MIT', 'LICENSE.Apache', 'LICENSE.BSD' // Specific license types
                    ];
                    let content = null;
                    for (const filename of licenseFiles) {
                        const fullPath = `${localBasePath}/${filename}`;
                        const result = await adapters?.fileSystem.readFile(fullPath);
                        if (result?.content) {
                            content = result.content;
                            // Wrap plain text license in markdown code block for better formatting
                            if (!filename.endsWith('.md')) {
                                content = '```\n' + content + '\n```';
                            }
                            break;
                        }
                    }
                    setLicenseContent(content);
                    setLoadingLicense(false);
                    return;
                }
                // For remote sources, use GitHub adapters
                if (!adapters) {
                    return;
                }
                const licenseVariants = [
                    'LICENSE', 'LICENSE.txt', 'LICENSE.md',
                    'LICENCE', 'LICENCE.txt', 'LICENCE.md',
                    'license', 'license.txt', 'license.md',
                    'COPYING', 'COPYING.txt'
                ];
                let content = null;
                for (const variant of licenseVariants) {
                    const result = await adapters.fileSystem.readFile(variant);
                    if (result && result.content) {
                        content = result.content;
                        // Wrap plain text license in markdown code block for better formatting
                        if (!variant.endsWith('.md')) {
                            content = '```\n' + content + '\n```';
                        }
                        break;
                    }
                }
                if (content) {
                    setLicenseContent(content);
                }
                else {
                    setLicenseContent(null);
                }
            }
            catch (error) {
                console.error('Failed to fetch LICENSE:', error);
                setLicenseContent('# Error loading LICENSE\n\nFailed to load the LICENSE file.');
            }
            finally {
                setLoadingLicense(false);
            }
        };
        fetchLicense();
    }, [adapters, activeFileTreeSource, remoteData.owner, remoteData.repo, fileTree, hasLicense]);
    // Create tabs configuration
    const tabs = [
        {
            id: 'readme',
            label: 'README',
            icon: _jsx(BookOpen, { size: 14 }),
            visible: true,
            content: (_jsx("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: loadingReadme ? (_jsxs("div", { style: {
                        padding: '32px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px',
                    }, children: [_jsx("div", { style: {
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: `${theme.colors.primary}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                animation: 'gentlePulse 2s ease-in-out infinite',
                            }, children: _jsx(BookOpen, { size: 24, color: theme.colors.primary }) }), _jsx("h3", { style: {
                                fontSize: '15px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "Loading README" }), _jsx("p", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                marginBottom: '20px',
                            }, children: "Fetching repository documentation..." }), _jsx("div", { style: {
                                display: 'flex',
                                gap: '6px',
                            }, children: [...Array(3)].map((_, i) => (_jsx("div", { style: {
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: theme.colors.primary,
                                    opacity: 0.3,
                                    animation: 'bounce 1.4s ease-in-out infinite',
                                    animationDelay: `${i * 0.2}s`,
                                } }, `loading-dot-${i}`))) }), _jsx("style", { children: `
                @keyframes gentlePulse {
                  0%, 100% { 
                    opacity: 1;
                    transform: scale(1);
                  }
                  50% { 
                    opacity: 0.8;
                    transform: scale(1.05);
                  }
                }
                
                @keyframes bounce {
                  0%, 80%, 100% {
                    transform: scale(1);
                    opacity: 0.3;
                  }
                  40% {
                    transform: scale(1.3);
                    opacity: 1;
                  }
                }
              ` })] })) : readmeContent ? (_jsx("div", { id: "readme-container", style: { height: '100%', overflow: 'auto' }, children: _jsx(ThemedMarkdownSlide, { content: readmeContent, slideIdPrefix: "readme", slideIndex: 0, useCustomTheme: true, isVisible: true, theme: theme, onLinkClick: (href) => {
                            if (href.startsWith('#')) {
                                const elementId = href.substring(1);
                                setTimeout(() => {
                                    const element = document.getElementById(elementId);
                                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            }
                            else if (href.startsWith('http://') || href.startsWith('https://')) {
                                window.open(href, '_blank');
                            }
                        } }) })) : (_jsx("div", { style: {
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }, children: _jsxs("div", { style: {
                            width: '100%',
                            maxWidth: 720,
                            border: `1px dashed ${theme.colors.border}`,
                            borderRadius: 12,
                            padding: 24,
                            background: theme.colors.background,
                        }, children: [_jsxs("div", { style: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }, children: [_jsx("div", { style: {
                                            width: 44,
                                            height: 44,
                                            borderRadius: 8,
                                            background: theme.colors.primary + '22',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }, children: _jsx(BookOpen, { size: 22, color: theme.colors.primary }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 18, fontWeight: 700, color: theme.colors.text }, children: "No README found at repository root" }), _jsxs("div", { style: { fontSize: 13, color: theme.colors.textSecondary }, children: ["Add a README.md to the root of ", remoteData.owner, "/", remoteData.repo, " on branch ", activeFileTreeSource?.metadata?.currentBranch || remoteData.defaultBranch, " and it will render here automatically."] })] })] }), _jsxs("div", { style: {
                                    marginTop: 12,
                                    padding: '12px 14px',
                                    borderRadius: 8,
                                    background: theme.colors.backgroundSecondary || theme.colors.background,
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: [_jsx("div", { style: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }, children: "We look for a README file at the repository root using these common names:" }), _jsx("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: ['README.md', 'readme.md', 'Readme.md', 'README.MD'].map((name) => (_jsx("div", { style: {
                                                fontFamily: 'monospace',
                                                fontSize: 12,
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: `1px solid ${theme.colors.border}`,
                                                background: theme.colors.background,
                                                color: theme.colors.text,
                                            }, children: name }, name))) })] }), _jsxs("div", { style: { display: 'flex', gap: 12, marginTop: 16 }, children: [_jsx("button", { onClick: () => {
                                            const url = `https://github.com/${remoteData.owner}/${remoteData.repo}`;
                                            window.open(url, '_blank');
                                        }, style: {
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: `1px solid ${theme.colors.border}`,
                                            background: theme.colors.background,
                                            color: theme.colors.text,
                                            cursor: 'pointer',
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }, children: "Open repository on GitHub" }), _jsx("button", { onClick: () => {
                                            // Simple refresh: re-trigger the README effect by toggling active source
                                            if (activeFileTreeSource)
                                                setActiveFileTreeSource({ ...activeFileTreeSource });
                                        }, style: {
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: theme.colors.primary,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }, children: "Refresh" })] })] }) })) }))
        },
        {
            id: 'changelog',
            label: 'Changelog',
            icon: _jsx(Clock, { size: 14 }),
            visible: hasChangelog,
            content: (_jsx("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: loadingChangelog ? (_jsxs("div", { style: {
                        padding: '32px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px',
                    }, children: [_jsx("div", { style: {
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: `${theme.colors.primary}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                animation: 'gentlePulse 2s ease-in-out infinite',
                            }, children: _jsx(Clock, { size: 24, color: theme.colors.primary }) }), _jsx("h3", { style: {
                                fontSize: '15px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "Loading Changelog" }), _jsx("p", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                marginBottom: '20px',
                            }, children: "Fetching version history..." }), _jsx("div", { style: {
                                display: 'flex',
                                gap: '6px',
                            }, children: [...Array(3)].map((_, i) => (_jsx("div", { style: {
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: theme.colors.primary,
                                    opacity: 0.3,
                                    animation: 'bounce 1.4s ease-in-out infinite',
                                    animationDelay: `${i * 0.2}s`,
                                } }, `loading-dot-${i}`))) })] })) : changelogContent ? (_jsx("div", { id: "changelog-container", style: { height: '100%', overflow: 'auto' }, children: _jsx(ThemedMarkdownSlide, { content: changelogContent, slideIdPrefix: "changelog", slideIndex: 0, useCustomTheme: true, isVisible: true }) })) : (_jsxs("div", { style: {
                        padding: '40px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                    }, children: [_jsx("div", { style: {
                                width: '64px',
                                height: '64px',
                                borderRadius: '12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                            }, children: _jsx(Clock, { size: 32, color: theme.colors.textTertiary }) }), _jsx("h3", { style: {
                                fontSize: '16px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "No Changelog Found" }), _jsxs("p", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                textAlign: 'center',
                                maxWidth: '400px',
                                lineHeight: 1.5,
                            }, children: ["Add a CHANGELOG.md to the root of ", remoteData.owner, "/", remoteData.repo, " to display version history here."] })] })) }))
        },
        {
            id: 'license',
            label: 'License',
            icon: _jsx(Scale, { size: 14 }),
            visible: hasLicense,
            content: (_jsx("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: loadingLicense ? (_jsxs("div", { style: {
                        padding: '32px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px',
                    }, children: [_jsx("div", { style: {
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: `${theme.colors.primary}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                animation: 'gentlePulse 2s ease-in-out infinite',
                            }, children: _jsx(Scale, { size: 24, color: theme.colors.primary }) }), _jsx("h3", { style: {
                                fontSize: '15px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "Loading License" }), _jsx("p", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                marginBottom: '20px',
                            }, children: "Fetching license information..." }), _jsx("div", { style: {
                                display: 'flex',
                                gap: '6px',
                            }, children: [...Array(3)].map((_, i) => (_jsx("div", { style: {
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: theme.colors.primary,
                                    opacity: 0.3,
                                    animation: 'bounce 1.4s ease-in-out infinite',
                                    animationDelay: `${i * 0.2}s`,
                                } }, `loading-dot-${i}`))) })] })) : licenseContent ? (_jsx("div", { id: "license-container", style: {
                        height: '100%',
                        overflow: 'auto',
                        backgroundColor: theme.colors.backgroundLight,
                    }, children: _jsx(ThemedMarkdownSlide, { content: licenseContent, slideIdPrefix: "license", slideIndex: 0, useCustomTheme: true, isVisible: true }) })) : (_jsxs("div", { style: {
                        padding: '40px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                    }, children: [_jsx("div", { style: {
                                width: '64px',
                                height: '64px',
                                borderRadius: '12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                            }, children: _jsx(Scale, { size: 32, color: theme.colors.textTertiary }) }), _jsx("h3", { style: {
                                fontSize: '16px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "No License Found" }), _jsxs("p", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                textAlign: 'center',
                                maxWidth: '400px',
                                lineHeight: 1.5,
                            }, children: ["Add a LICENSE file to the root of ", remoteData.owner, "/", remoteData.repo, " to display licensing information here."] })] })) }))
        },
        {
            id: 'layers',
            label: 'Dependencies',
            icon: _jsx(Layers, { size: 14 }),
            visible: true,
            content: activeFileTreeSource ? (_jsx(RepoSourceArchitecturePanelSimple, { source: activeFileTreeSource, cacheService: cacheService, onError: (error) => {
                    console.error('Architecture panel error:', error);
                }, onPackageLayersChanged: setPackageLayers, onPackageAnalysisStart: handlePackageAnalysisStart, onPackageAnalysisEnd: handlePackageAnalysisEnd, onPackageSelected: handlePackageSelected, onPackageDeselected: handlePackageDeselected })) : (_jsx("div", { style: {
                    padding: '20px',
                    textAlign: 'center',
                    color: theme.colors.textSecondary
                }, children: "No source selected" }))
        },
        {
            id: 'docs',
            label: 'Docs',
            icon: _jsx(Book, { size: 14 }),
            visible: hasDocsFolder,
            content: (_jsx(DocumentationPanel, { fileTree: fileTree, onDocumentSelect: handleDocumentSelect, selectedDocument: selectedDocPath ?? undefined }))
        }
    ];
    // Get git state for source badges
    const gitState = activeFileTreeSource?.type === 'local' ? getGitState(activeFileTreeSource.id) : undefined;
    // Create toolbar items
    const toolbarItems = useMemo(() => {
        const items = [];
        // Git changes tool (for local sources)
        if (activeFileTreeSource?.type === 'local' && gitState) {
            const changeCount = (gitState.gitStatus?.modified?.length || 0) +
                (gitState.gitStatus?.created?.length || 0) +
                (gitState.gitStatus?.deleted?.length || 0);
            items.push({
                id: 'git-changes',
                label: gitState.hasNoCommits ? 'No commits yet' : `Git Changes`,
                shortLabel: 'Git',
                icon: _jsx(GitBranch, {}),
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
                    : `${gitState.enabled ? 'Hide' : 'Show'} git changes (${changeCount} changes)`
            });
        }
        // a24z memory tool (for local sources)
        if (activeFileTreeSource?.type === 'local' && a24zNotes.length > 0) {
            items.push({
                id: 'a24z-memory',
                label: 'a24z Memory',
                shortLabel: 'a24z',
                icon: _jsx(Brain, {}),
                count: a24zNotes.length,
                color: '#9333ea',
                active: showA24zLayer,
                onClick: () => setShowA24zLayer(!showA24zLayer),
                tooltip: `${showA24zLayer ? 'Hide' : 'Show'} a24z memory coverage (${a24zNotes.length} notes)`
            });
        }
        // Search results
        if (searchResults.length > 0) {
            items.push({
                id: 'search-results',
                label: 'Search Results',
                shortLabel: 'Search',
                icon: _jsx(Search, {}),
                count: searchResults.length,
                color: '#3b82f6',
                active: true,
                onClick: () => {
                    setSearchResults([]);
                    setSearchHighlightLayer(null);
                },
                tooltip: `Clear search results (${searchResults.length} files)`
            });
        }
        // Tribal knowledge notes
        if (selectedNoteIds.size > 0) {
            items.push({
                id: 'tribal-notes',
                label: 'Tribal Notes',
                shortLabel: 'Notes',
                icon: _jsx(FileText, {}),
                count: selectedNoteIds.size,
                color: '#8b5cf6',
                active: true,
                onClick: () => {
                    setSelectedNoteIds(new Set());
                },
                tooltip: `Clear selected notes (${selectedNoteIds.size} selected)`
            });
        }
        // Package highlights
        if (highlightedPackages.size > 0) {
            items.push({
                id: 'package-highlights',
                label: 'Package Highlights',
                shortLabel: 'Packages',
                icon: _jsx(Layers, {}),
                count: highlightedPackages.size,
                color: '#10b981',
                active: true,
                onClick: () => {
                    setHighlightedPackages(new Set());
                },
                tooltip: `Clear package highlights (${highlightedPackages.size} highlighted)`
            });
        }
        return items;
    }, [searchResults.length, selectedNoteIds.size, highlightedPackages.size, gitState, activeFileTreeSource, setGitChangesVisible, a24zNotes.length, showA24zLayer]);
    // Error handling
    if (error) {
        return (_jsx("div", { style: {
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: theme.colors.textSecondary
            }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h3", { style: { color: theme.colors.text, marginBottom: '8px' }, children: "Failed to Load Repository" }), _jsx("p", { children: error })] }) }));
    }
    // Create custom right panel content for document viewing
    const documentRightPanel = selectedDocPath && docContent && activeTab === 'docs' ? (_jsxs("div", { style: {
            width: '100%',
            height: '100%',
            backgroundColor: theme.colors.background,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }, children: [_jsxs("div", { style: {
                    padding: '12px 16px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    backgroundColor: theme.colors.backgroundLight
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("button", { onClick: () => setLeftPanelCollapsed(!leftPanelCollapsed), style: {
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    color: theme.colors.textSecondary,
                                    transition: 'all 0.2s'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }, title: leftPanelCollapsed ? 'Show panel' : 'Hide panel', children: leftPanelCollapsed ? _jsx(PanelLeft, { size: 16 }) : _jsx(PanelLeftClose, { size: 16 }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '2px' }, children: [_jsx("span", { style: {
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: theme.colors.text
                                        }, children: selectedDocPath.split('/').pop() }), _jsx("span", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary
                                        }, children: selectedDocPath })] })] }), selectedDocType === 'markdown' && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx("button", { onClick: () => {
                                    setDocViewMode('document');
                                    setPreferredDocViewMode('document');
                                }, style: {
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: docViewMode === 'document' ? theme.colors.primary : 'transparent',
                                    color: docViewMode === 'document' ? '#fff' : theme.colors.textSecondary,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    transition: 'all 0.15s ease'
                                }, title: "View as document", children: "Document" }), _jsx("button", { onClick: () => {
                                    setDocViewMode('slides');
                                    setPreferredDocViewMode('slides');
                                }, style: {
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: docViewMode === 'slides' ? theme.colors.primary : 'transparent',
                                    color: docViewMode === 'slides' ? '#fff' : theme.colors.textSecondary,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    transition: 'all 0.15s ease'
                                }, title: "View as slides", children: "Slides" })] }))] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: loadingDoc ? (_jsx("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: theme.colors.textSecondary
                    }, children: "Loading document..." })) : selectedDocType === 'excalidraw' ? (_jsx(ExcalidrawWrapper, { initialData: (() => {
                        try {
                            return JSON.parse(docContent);
                        }
                        catch {
                            return { elements: [], appState: {}, files: {} };
                        }
                    })(), onChange: () => { } })) : (_jsx(MarkdownDocumentViewer, { viewMode: docViewMode, showEditor: false, content: docContent, slides: docContent.split('\n\n---\n\n'), currentSlide: currentSlide, theme: theme, showSegmented: true, onContentChange: () => { }, onSlideNavigate: setCurrentSlide, onCheckboxChange: () => { } })) })] })) : null;
    // Check if we should show document view instead of city
    const showDocumentView = activeTab === 'docs' && selectedDocPath && docContent;
    return (_jsxs("div", { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }, children: [_jsx(CityMapManager, { fileTree: fileTree, activeSource: activeFileTreeSource, gitEnabled: gitState?.enabled, headTree: gitState?.headTree, hasNoCommits: gitState?.hasNoCommits, viewMode: "explore", showWorkingTree: gitState?.enabled, showHeadTree: gitState?.headTree !== undefined, onToggleWorkingTree: (_show) => {
                    if (activeFileTreeSource?.type === 'local') {
                        // TODO: Update git state for working tree toggle
                    }
                }, onToggleHeadTree: (_show) => {
                    if (activeFileTreeSource?.type === 'local') {
                        // TODO: Update git state for head tree toggle
                    }
                }, renderCustomBadges: () => (_jsx(_Fragment, { children: fileTreeSources.length > 1 && (_jsxs("button", { onClick: () => {
                            // TODO: Open source selector modal
                            console.info('Open source selector');
                        }, style: {
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                            color: theme.colors.textSecondary,
                            fontSize: 11,
                            cursor: 'pointer'
                        }, children: [fileTreeSources.length, " sources"] })) })), children: ({ cityData: managedCityData, sourceBadges, isBuilding }) => {
                    // When docs tab is active and left panel is collapsed, render in full width mode
                    if (activeTab === 'docs' && leftPanelCollapsed && selectedDocPath && docContent) {
                        return (_jsx("div", { style: {
                                width: '100%',
                                height: '100%',
                                padding: '16px',
                                boxSizing: 'border-box'
                            }, children: _jsx("div", { style: {
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '8px',
                                    border: `1px solid ${theme.colors.border}`,
                                    overflow: 'hidden'
                                }, children: documentRightPanel }) }));
                    }
                    // Otherwise use the standard skeleton with resizable layout
                    return (_jsx(RepositoryViewSkeleton, { tabs: tabs, activeTab: activeTab, onTabChange: (tabId) => {
                            setActiveTab(tabId);
                            // Clear document when switching away from docs
                            if (tabId !== 'docs') {
                                setSelectedDocPath(null);
                                setDocContent(null);
                            }
                        }, cityData: showDocumentView ? null : managedCityData, onFileClick: handleFileClick, highlightLayers: showDocumentView ? [] : [
                            ...fileColorHighlightLayers, // Add file colors as base layer
                            ...noteHighlightLayers,
                            ...(a24zHighlightLayer ? [a24zHighlightLayer] : []),
                            ...(searchHighlightLayer ? [searchHighlightLayer] : []),
                            ...(hoveredSearchLayer ? [hoveredSearchLayer] : []),
                            ...(selectedFileLayer ? [selectedFileLayer] : []),
                            ...dependencyAnalysisHighlightLayer,
                            ...packageHighlightLayers,
                            ...gitHighlightLayers
                        ], loading: showDocumentView ? false : (loading || isBuilding), treeStats: showDocumentView ? null : treeStats, sourceBadges: showDocumentView ? null : sourceBadges, activeSource: activeFileTreeSource, onHelpClick: () => setShowHelpModal(true), cityHeaderExtra: undefined, loadingMessage: "Loading repository structure", emptyMessage: "Select a branch to explore", rightPaneMode: rightPaneMode, onRightPaneModeChange: (mode) => {
                            if (mode === 'city') {
                                // Clear document selection when switching back to map
                                setSelectedDocPath(null);
                                setDocContent(null);
                            }
                        }, showViewSwitcher: true, 
                        // No terminalDirectory passed for remote view
                        toolbarItems: showDocumentView ? [] : toolbarItems, toolbarExpanded: toolbarExpanded, onToolbarExpandedChange: setToolbarExpanded, documentContent: documentRightPanel }));
                } }), showFileViewer && viewerFilePath && viewerRelativePath && (_jsx(RemoteFileViewerModal, { filePath: viewerFilePath, relativePath: viewerRelativePath, contentProvider: fileViewerContentProvider, onClose: () => {
                    setShowFileViewer(false);
                    setViewerFilePath(null);
                    setViewerRelativePath(null);
                }, repository: {
                    owner: remoteData.owner,
                    repo: remoteData.repo,
                    branch: activeFileTreeSource?.metadata?.currentBranch || remoteData.defaultBranch
                } })), _jsx(HelpModal, { isOpen: showHelpModal, onClose: () => setShowHelpModal(false), mode: "explore" })] }));
};

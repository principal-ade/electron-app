import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelsTheme } from '../../theme/panelsTheme';
import { FileText, Wrench, Globe, X, Clipboard, Check } from 'lucide-react';
import { AnimatedTimelineEvent } from '../landing-page/AnimatedTimelineEvent';
import { FileViewer } from '../FileViewer';
import { ShellService } from '../../main-process-api/ShellService';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';

interface ActiveSegmentTimelineProps {
  activeSegment: any;
  session: AgentSessionRecord;
  newEventIds: Set<string>;
}

export const ActiveSegmentTimeline: React.FC<ActiveSegmentTimelineProps> = ({
  activeSegment,
  session,
  newEventIds,
}) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [expandedEdits, setExpandedEdits] = useState<Set<string>>(new Set());
  const [grepResults, setGrepResults] = useState<
    Record<string, { loading: boolean; data: any }>
  >({});
  const [bashResults, setBashResults] = useState<
    Record<string, { loading: boolean; data: any }>
  >({});

  // Debug flag for showing path normalization info
  const DEBUG_SHOW_PATH_INFO = false;

  // Helper function to get relative path from git root
  const getRelativePath = (fullPath: string): string => {
    if (session?.basicGitInfo?.gitRoot) {
      const { gitRoot } = session.basicGitInfo;
      if (fullPath.startsWith(gitRoot)) {
        // Remove git root and leading slash
        return fullPath.slice(gitRoot.length).replace(/^\//, '');
      }
    }
    // Fallback to just the filename if no git info
    return fullPath.split('/').pop() || fullPath;
  };

  // Enhanced file path processing using available session data
  const processFilePath = (filePath: string) => {
    if (!filePath) return { fileName: '', dirPath: '', packageInfo: null };

    const fileName = filePath.split('/').pop() || filePath;
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '';

    // Step 1: Build a simple file tree from session data
    let allFilePaths: string[] = [];
    // Get all file paths from file accesses and writes
    allFilePaths = [
      ...Object.keys(session.fileAccesses || {}),
      ...Object.keys(session.fileWrites || {}),
    ];

    // Step 2: Try to find the complete path by searching session files
    let resolvedPath = null;

    // Look for exact matches or endings
    const exactMatch = allFilePaths.find((path) => path === filePath);
    if (exactMatch) {
      resolvedPath = exactMatch;
    } else {
      // Look for paths that end with our file path
      const endingMatch = allFilePaths.find(
        (path) => path.endsWith(`/${filePath}`) || path.endsWith(filePath),
      );
      if (endingMatch) {
        resolvedPath = endingMatch;
      }
    }

    // Step 3: Use resolved or original path for workspace matching
    const searchPath = resolvedPath || filePath;

    if (session?.workspaceBoundaries) {
      // Find the most specific workspace (longest rootPath match)
      let bestMatch = null;
      let longestMatch = 0;

      for (const workspace of session.workspaceBoundaries) {
        const { rootPath } = workspace;

        // Handle different root path patterns
        let isMatch = false;
        if (rootPath === '.' || rootPath === '') {
          // Root workspace - check if it's not in any sub-workspace
          isMatch = !session.workspaceBoundaries.some(
            (ws) =>
              ws !== workspace &&
              ws.rootPath !== '.' &&
              ws.rootPath !== '' &&
              searchPath.startsWith(`${ws.rootPath}/`),
          );
        } else if (rootPath.startsWith('../')) {
          // Parent directory workspace - extract the actual package name
          const packageName = rootPath.split('/').pop();
          isMatch =
            searchPath.includes(`${packageName}/`) ||
            searchPath.includes(`/${packageName}/`);
        } else {
          // Direct path match
          isMatch =
            searchPath.startsWith(`${rootPath}/`) || searchPath === rootPath;
        }

        if (isMatch && rootPath.length > longestMatch) {
          longestMatch = rootPath.length;
          bestMatch = workspace;
        }
      }

      if (bestMatch) {
        // Calculate relative path from workspace root
        let relativePath = searchPath;

        // For the principle-md-electron package (rootPath is '.'), extract relative path properly
        if (
          bestMatch.name === 'principle-md-electron' ||
          bestMatch.rootPath === '.' ||
          bestMatch.rootPath === ''
        ) {
          // This is the electron-react package
          // Find the part after 'electron-react' in the path
          const electronReactIndex = searchPath.indexOf('electron-react/');
          if (electronReactIndex >= 0) {
            relativePath = searchPath.substring(
              electronReactIndex + 'electron-react/'.length,
            );
          } else {
            // If no 'electron-react' found, use the original path (it's already relative)
            relativePath = searchPath;
          }
        } else if (bestMatch.rootPath.startsWith('../')) {
          // For parent workspaces, extract relative to package
          const packageName = bestMatch.rootPath.split('/').pop();
          const packageIndex = searchPath.indexOf(`${packageName}/`);
          if (packageIndex >= 0) {
            relativePath = searchPath.substring(
              packageIndex + (packageName?.length || 0) + 1,
            );
          }
        } else {
          // Direct path match
          relativePath = searchPath.substring(bestMatch.rootPath.length + 1);
        }

        const relDirPath =
          relativePath.substring(0, relativePath.lastIndexOf('/')) || '';

        const packageInfo = {
          name: bestMatch.name,
          type: 'npm',
          color: {
            background: `${theme.colors.surface}33`,
            color: theme.colors.textSecondary,
          },
        };

        return { fileName, dirPath: relDirPath, packageInfo };
      }
    }

    // Fallback: Try legacy repository matching
    if (session?.repositories) {
      let bestMatch = null;
      let longestMatch = 0;

      for (const repo of session.repositories) {
        for (const pkg of repo.packages) {
          const pkgPath = pkg.path.replace(/\/$/, '');
          const normalizedSearchPath = searchPath.startsWith('/')
            ? searchPath
            : `/${searchPath}`;
          const normalizedPkgPath = pkgPath.startsWith('/')
            ? pkgPath
            : `/${pkgPath}`;

          if (normalizedSearchPath.startsWith(`${normalizedPkgPath}/`)) {
            if (normalizedPkgPath.length > longestMatch) {
              longestMatch = normalizedPkgPath.length;
              bestMatch = {
                pkg,
                relativePath: normalizedSearchPath.substring(
                  normalizedPkgPath.length + 1,
                ),
              };
            }
          }
        }
      }

      if (bestMatch) {
        const packageInfo = {
          name: bestMatch.pkg.name,
          type: bestMatch.pkg.type,
          color:
            bestMatch.pkg.type === 'npm'
              ? {
                  background: `${theme.colors.success}33`,
                  color: theme.colors.success,
                }
              : bestMatch.pkg.type === 'yarn'
                ? {
                    background: `${theme.colors.primary}33`,
                    color: theme.colors.primary,
                  }
                : bestMatch.pkg.type === 'pnpm'
                  ? {
                      background: `${theme.colors.warning}33`,
                      color: theme.colors.warning,
                    }
                  : {
                      background: `${theme.colors.surface}33`,
                      color: theme.colors.textSecondary,
                    },
        };
        const relDirPath =
          bestMatch.relativePath.substring(
            0,
            bestMatch.relativePath.lastIndexOf('/'),
          ) || '';
        return { fileName, dirPath: relDirPath, packageInfo };
      }
    }

    // Final fallback to regular normalization
    return {
      fileName,
      dirPath,
      packageInfo: null,
    };
  };

  // Component to display file path with package badge
  function FilePathDisplay({
    filePath,
    originalPath,
    normalizedPath,
    onOpenFile,
    className = '',
    showDebug = false,
    showPackageInline = false,
  }: {
    filePath: string;
    originalPath?: string;
    normalizedPath?: string;
    onOpenFile?: () => void;
    className?: string;
    showDebug?: boolean;
    showPackageInline?: boolean;
  }) {
    const { fileName, dirPath, packageInfo } = processFilePath(filePath);

    // For debugging, show both paths if they differ (only when debug flag is enabled)
    const showDebugInfo =
      showDebug &&
      DEBUG_SHOW_PATH_INFO &&
      originalPath &&
      normalizedPath &&
      originalPath !== normalizedPath;

    if (showPackageInline && packageInfo) {
      // Inline package display
      return (
        <div className={`min-w-0 ${className}`}>
          <span
            className="font-mono text-base text-white truncate block"
            title={`${fileName} (from: ${filePath})`}
          >
            <span
              className="text-base px-2 py-0.5 mr-2"
              style={{
                backgroundColor: packageInfo.color.background,
                color: packageInfo.color.color,
              }}
            >
              {String(packageInfo.name)}
            </span>
            {fileName}
          </span>
          {dirPath && (
            <span
              className="font-mono text-sm truncate block mt-1"
              style={{ color: theme.colors.textSecondary }}
              title={dirPath}
            >
              {dirPath}
            </span>
          )}
          {showDebugInfo && (
            <div className="mt-1 text-xs font-mono">
              <div style={{ color: theme.colors.textMuted }}>
                Original: {originalPath || filePath}
              </div>
              <div style={{ color: theme.colors.textMuted }}>
                Normalized: {normalizedPath || filePath}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`min-w-0 ${className}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <span
              className="font-mono text-base text-white truncate block"
              title={`${fileName} (from: ${filePath})`}
            >
              {fileName}
            </span>
            {dirPath && (
              <span
                className="font-mono text-sm truncate block mt-1"
                style={{ color: theme.colors.textSecondary }}
                title={dirPath}
              >
                {dirPath}
              </span>
            )}
            {showDebugInfo && (
              <div className="mt-1 text-xs font-mono">
                <div style={{ color: theme.colors.textMuted }}>
                  Original: {originalPath || filePath}
                </div>
                <div style={{ color: theme.colors.textMuted }}>
                  Normalized: {normalizedPath || filePath}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onOpenFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFile();
                }}
                className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded"
                style={{
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Open file"
              >
                <FileText
                  size={14}
                  style={{ color: theme.colors.textSecondary }}
                />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const relativePath = getRelativePath(filePath);
                navigator.clipboard.writeText(relativePath);
                setCopiedPath(filePath);
                setTimeout(() => setCopiedPath(null), 2000);
              }}
              className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded"
              style={{
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={
                session?.basicGitInfo ? 'Copy relative path' : 'Copy filename'
              }
            >
              {copiedPath === filePath ? (
                <Check size={14} style={{ color: theme.colors.success }} />
              ) : (
                <Clipboard
                  size={14}
                  style={{ color: theme.colors.textSecondary }}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to handle file opening
  const handleOpenFile = (event: any) => {
    let filePath = null;
    if (event.type === 'grouped') {
      // For grouped events, prefer the original path from one of the events
      const firstEvent = event.data.events[0];
      filePath =
        firstEvent.data.originalPath ||
        firstEvent.data.file ||
        firstEvent.data.parameters?.file_path ||
        event.data.filePath;
    } else if (event.type === 'file-read' || event.type === 'file-write') {
      // Prefer original path over normalized
      filePath = event.data.originalPath || event.data.file;
    } else if (
      event.type === 'tool' &&
      (event.data.toolName === 'Edit' ||
        event.data.toolName === 'Write' ||
        event.data.toolName === 'Read' ||
        event.data.toolName === 'MultiEdit') &&
      event.data.parameters?.file_path
    ) {
      // Prefer original path over normalized
      filePath = event.data.originalPath || event.data.parameters?.file_path;
    }

    if (filePath) {
      // Convert relative path to absolute if needed
      if (!filePath.startsWith('/') && session.basicGitInfo?.gitRoot) {
        // If it's a relative path and we have git root, make it absolute
        filePath = `${session.basicGitInfo.gitRoot}/${filePath}`;
      } else if (!filePath.startsWith('/') && session.workingDirectory) {
        // Fallback to working directory
        filePath = `${session.workingDirectory}/${filePath}`;
      }
      setViewingFile(filePath);
    }
  };

  const renderEventContent = (event: any, timeStr: string) => {
    if (event.type === 'grouped') {
      // Render grouped events
      const { events, filePath } = event.data;
      const hasRead = events.some((e: any) => e.type === 'file-read');
      const hasWrite = events.some((e: any) => e.type === 'file-write');
      const editEvent = events.find(
        (e: any) => e.type === 'tool' && e.data.toolName === 'Edit',
      );

      // Build operation string
      let operationText = 'File ';
      if (hasWrite) {
        operationText += 'Write';
      } else if (hasRead) {
        operationText += 'Read';
      }

      const { packageInfo } = processFilePath(filePath);
      const expandKey = `${event.data.events[0].timestamp}-grouped`;

      return (
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-400">
              {operationText}
              {packageInfo && (
                <span
                  className="text-base px-2 py-0.5 ml-2"
                  style={{
                    backgroundColor: packageInfo.color.background,
                    color: packageInfo.color.color,
                  }}
                >
                  {String(packageInfo.name)}
                </span>
              )}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: theme.colors.surface,
                color: theme.colors.textSecondary,
              }}
            >
              {events.length} operations
            </span>
          </div>
          <span
            className="absolute top-0 right-0 text-xs"
            style={{ color: theme.colors.textMuted }}
          >
            {timeStr}
          </span>
          <FilePathDisplay
            filePath={filePath}
            originalPath={
              event.data.events[0].data.originalPath ||
              event.data.events[0].data.parameters?.file_path ||
              event.data.events[0].data.file
            }
            normalizedPath={event.data.events[0].data.normalizedPath}
            onOpenFile={() => handleOpenFile(event)}
            className="mt-1"
            showDebug
            showPackageInline={false}
          />

          {/* Show expandable diff if there's an Edit event */}
          {editEvent && editEvent.data.parameters.old_string && (
            <div className="mt-2">
              {expandedEdits.has(expandKey) ? (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedEdits);
                      newExpanded.delete(expandKey);
                      setExpandedEdits(newExpanded);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    ↑ Collapse edit
                  </button>
                  <div
                    className="rounded p-2 text-xs font-mono"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="text-red-400 line-through whitespace-pre-wrap">
                      {editEvent.data.parameters.old_string}
                    </div>
                    <div
                      className="my-2"
                      style={{ color: theme.colors.textMuted }}
                    >
                      →
                    </div>
                    <div className="text-green-400 whitespace-pre-wrap">
                      {editEvent.data.parameters.new_string}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setExpandedEdits(new Set([...expandedEdits, expandKey]));
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  ↓ Show edit diff
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (event.type === 'tool') {
      // Get package info if this is a file-related tool
      let packageInfo = null;
      if (
        (event.data.toolName === 'Edit' ||
          event.data.toolName === 'Write' ||
          event.data.toolName === 'Read' ||
          event.data.toolName === 'MultiEdit') &&
        event.data.parameters?.file_path
      ) {
        const pathInfo = processFilePath(event.data.parameters.file_path);
        packageInfo = pathInfo.packageInfo;
      }

      return (
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">
              {event.data.toolName}
              {packageInfo && (
                <span
                  className="text-base px-2 py-0.5 ml-2"
                  style={{
                    backgroundColor: packageInfo.color.background,
                    color: packageInfo.color.color,
                  }}
                >
                  {String(packageInfo.name)}
                </span>
              )}
            </span>
          </div>
          <span
            className="absolute top-0 right-0 text-xs"
            style={{ color: theme.colors.textMuted }}
          >
            {timeStr}
          </span>
          {event.data.parameters && (
            <>
              {/* For file-related tools, show the file path prominently */}
              {(event.data.toolName === 'Edit' ||
                event.data.toolName === 'Write' ||
                event.data.toolName === 'Read' ||
                event.data.toolName === 'MultiEdit') &&
                event.data.parameters?.file_path && (
                  <FilePathDisplay
                    filePath={event.data.parameters.file_path}
                    originalPath={
                      event.data.originalPath || event.data.parameters.file_path
                    }
                    normalizedPath={event.data.normalizedPath}
                    onOpenFile={() => handleOpenFile(event)}
                    className="mt-1"
                    showDebug
                    showPackageInline={false}
                  />
                )}

              {/* Special handling for different tool types */}
              {event.data.toolName === 'Edit' &&
                event.data.parameters?.old_string && (
                  <div className="mt-2">
                    {expandedEdits.has(
                      `${event.data.timestamp}-${event.data.toolName}`,
                    ) ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            const key = `${event.data.timestamp}-${event.data.toolName}`;
                            const newExpanded = new Set(expandedEdits);
                            newExpanded.delete(key);
                            setExpandedEdits(newExpanded);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          ↑ Collapse edit
                        </button>
                        <div
                          className="rounded p-2 text-xs font-mono"
                          style={{ backgroundColor: theme.colors.background }}
                        >
                          <div className="text-red-400 line-through whitespace-pre-wrap">
                            {event.data.parameters?.old_string}
                          </div>
                          <div className="text-green-400 mt-2 whitespace-pre-wrap">
                            {event.data.parameters?.new_string}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const key = `${event.data.timestamp}-${event.data.toolName}`;
                          const newExpanded = new Set(expandedEdits);
                          newExpanded.add(key);
                          setExpandedEdits(newExpanded);
                        }}
                        className="text-xs"
                        style={{
                          color: theme.colors.textMuted,
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color =
                            theme.colors.textSecondary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = theme.colors.textMuted;
                        }}
                      >
                        ↓ Show edit (
                        {event.data.parameters?.old_string?.split('\n')
                          .length || 0}{' '}
                        lines changed)
                      </button>
                    )}
                  </div>
                )}

              {event.data.toolName === 'Grep' && (
                <div className="mt-2 space-y-2">
                  <p
                    className="text-sm"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Searched for "{event.data.parameters?.pattern || 'pattern'}"
                    {event.data.parameters?.glob &&
                      ` in ${event.data.parameters.glob} files`}
                    {event.data.parameters?.path &&
                      ` within ${processFilePath(event.data.parameters.path).dirPath || event.data.parameters.path}`}
                    {event.data.parameters?.output_mode &&
                      event.data.parameters.output_mode !==
                        'files_with_matches' &&
                      ` (${event.data.parameters.output_mode} mode)`}
                  </p>
                  {/* Re-run button for grep */}
                  <button
                    onClick={async () => {
                      const key = `grep-${event.data.timestamp}`;
                      setGrepResults((prev) => ({
                        ...prev,
                        [key]: { loading: true, data: null },
                      }));

                      try {
                        // TODO: runGrep method not available in ShellService
                        // Using runCommand as fallback
                        const result = await ShellService.runCommand(
                          `grep ${event.data.parameters?.pattern || ''} ${event.data.parameters?.path || ''}`,
                          { cwd: session.workingDirectory }
                        );
                        setGrepResults((prev) => ({
                          ...prev,
                          [key]: { loading: false, data: result },
                        }));
                      } catch (error) {
                        console.error('Grep failed:', error);
                        setGrepResults((prev) => ({
                          ...prev,
                          [key]: {
                            loading: false,
                            data: { error: (error as Error).message },
                          },
                        }));
                      }
                    }}
                    className="text-xs px-2 py-1 text-white rounded"
                    style={{
                      backgroundColor: theme.colors.background,
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.surface;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.background;
                    }}
                  >
                    Re-run
                  </button>

                  {/* Show grep results if available */}
                  {grepResults[`grep-${event.data.timestamp}`] && (
                    <div
                      className="mt-2 rounded p-2"
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      {grepResults[`grep-${event.data.timestamp}`].loading ? (
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          Running grep...
                        </p>
                      ) : grepResults[`grep-${event.data.timestamp}`].data
                          ?.error ? (
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.error }}
                        >
                          Error:{' '}
                          {
                            grepResults[`grep-${event.data.timestamp}`].data
                              .error
                          }
                        </p>
                      ) : grepResults[`grep-${event.data.timestamp}`].data
                          ?.matches ? (
                        <div className="space-y-1">
                          <p
                            className="text-xs"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            Found{' '}
                            {
                              grepResults[`grep-${event.data.timestamp}`].data
                                .matches.length
                            }{' '}
                            matches:
                          </p>
                          <div className="max-h-40 overflow-y-auto">
                            {grepResults[
                              `grep-${event.data.timestamp}`
                            ].data.matches
                              .slice(0, 20)
                              .map((match: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="text-xs font-mono"
                                  style={{ color: theme.colors.textTertiary }}
                                >
                                  {match}
                                </div>
                              ))}
                            {grepResults[`grep-${event.data.timestamp}`].data
                              .matches.length > 20 && (
                              <p
                                className="text-xs mt-1"
                                style={{ color: theme.colors.textMuted }}
                              >
                                ... and{' '}
                                {grepResults[`grep-${event.data.timestamp}`]
                                  .data.matches.length - 20}{' '}
                                more
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          No results
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {event.data.toolName === 'Bash' && (
                <div className="mt-2 space-y-2">
                  {event.data.parameters?.description && (
                    <p className="text-sm font-medium text-white">
                      {event.data.parameters.description}
                    </p>
                  )}
                  <div
                    className="rounded p-2"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <code
                      className="text-xs font-mono block whitespace-pre-wrap"
                      style={{ color: theme.colors.textTertiary }}
                    >
                      {event.data.parameters?.command}
                    </code>
                  </div>

                  {/* Re-run button for bash */}
                  <button
                    onClick={async () => {
                      const key = `bash-${event.data.timestamp}`;
                      setBashResults((prev) => ({
                        ...prev,
                        [key]: { loading: true, data: null },
                      }));

                      try {
                        // TODO: runBashCommand method not available in ShellService
                        // Using runCommand as fallback
                        const result = await ShellService.runCommand(
                          event.data.parameters?.command || '',
                          { cwd: event.data.parameters?.cwd || session.workingDirectory }
                        );
                        setBashResults((prev) => ({
                          ...prev,
                          [key]: { loading: false, data: result },
                        }));
                      } catch (error) {
                        console.error('Bash command failed:', error);
                        setBashResults((prev) => ({
                          ...prev,
                          [key]: {
                            loading: false,
                            data: { error: (error as Error).message },
                          },
                        }));
                      }
                    }}
                    className="text-xs px-2 py-1 text-white rounded"
                    style={{
                      backgroundColor: theme.colors.background,
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.surface;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.background;
                    }}
                  >
                    Re-run
                  </button>

                  {/* Show bash results if available */}
                  {bashResults[`bash-${event.data.timestamp}`] && (
                    <div
                      className="mt-2 rounded p-2"
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      {bashResults[`bash-${event.data.timestamp}`].loading ? (
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          Running command...
                        </p>
                      ) : bashResults[`bash-${event.data.timestamp}`].data
                          ?.error ? (
                        <p
                          className="text-xs"
                          style={{ color: theme.colors.error }}
                        >
                          Error:{' '}
                          {
                            bashResults[`bash-${event.data.timestamp}`].data
                              .error
                          }
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {bashResults[`bash-${event.data.timestamp}`].data
                            ?.stdout && (
                            <div className="max-h-40 overflow-y-auto">
                              <p
                                className="text-xs mb-1"
                                style={{ color: theme.colors.textMuted }}
                              >
                                Output:
                              </p>
                              <pre
                                className="text-xs font-mono whitespace-pre-wrap"
                                style={{ color: theme.colors.success }}
                              >
                                {
                                  bashResults[`bash-${event.data.timestamp}`]
                                    .data.stdout
                                }
                              </pre>
                            </div>
                          )}
                          {bashResults[`bash-${event.data.timestamp}`].data
                            ?.stderr && (
                            <div className="mt-2">
                              <p
                                className="text-xs mb-1"
                                style={{ color: theme.colors.textMuted }}
                              >
                                Errors:
                              </p>
                              <pre
                                className="text-xs font-mono whitespace-pre-wrap"
                                style={{ color: theme.colors.error }}
                              >
                                {
                                  bashResults[`bash-${event.data.timestamp}`]
                                    .data.stderr
                                }
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (event.type === 'file-read') {
      const { fileName, packageInfo } = processFilePath(event.data.file);
      return (
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">
              File {event.data.write?.operation || 'Read'}
              {packageInfo && (
                <span
                  className="text-base px-2 py-0.5 ml-2"
                  style={{
                    backgroundColor: packageInfo.color.background,
                    color: packageInfo.color.color,
                  }}
                >
                  {String(packageInfo.name)}
                </span>
              )}
            </span>
          </div>
          <span
            className="absolute top-0 right-0 text-xs"
            style={{ color: theme.colors.textMuted }}
          >
            {timeStr}
          </span>
          <FilePathDisplay
            filePath={event.data.file}
            originalPath={event.data.originalPath || event.data.file}
            normalizedPath={event.data.normalizedPath}
            onOpenFile={() => handleOpenFile(event)}
            className="mt-1"
            showDebug
            showPackageInline={false}
          />
        </div>
      );
    }

    if (event.type === 'file-write') {
      const { packageInfo } = processFilePath(event.data.file);
      const operation = event.data.write?.operation || 'update';
      return (
        <div className="relative">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${
                operation === 'create'
                  ? 'text-green-400'
                  : operation === 'delete'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }`}
            >
              File{' '}
              {operation === 'create'
                ? 'Create'
                : operation === 'delete'
                  ? 'Delete'
                  : 'Update'}
              {packageInfo && (
                <span
                  className="text-base px-2 py-0.5 ml-2"
                  style={{
                    backgroundColor: packageInfo.color.background,
                    color: packageInfo.color.color,
                  }}
                >
                  {String(packageInfo.name)}
                </span>
              )}
            </span>
          </div>
          <span
            className="absolute top-0 right-0 text-xs"
            style={{ color: theme.colors.textMuted }}
          >
            {timeStr}
          </span>
          <FilePathDisplay
            filePath={event.data.file}
            originalPath={event.data.originalPath || event.data.file}
            normalizedPath={event.data.normalizedPath}
            onOpenFile={() => handleOpenFile(event)}
            className="mt-1"
            showDebug
            showPackageInline={false}
          />
        </div>
      );
    }

    if (event.type === 'web') {
      return (
        <>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">Web Access</span>
            <span className="text-xs" style={{ color: theme.colors.textMuted }}>
              {timeStr}
            </span>
          </div>
          <p
            className="text-sm mt-1 truncate"
            style={{ color: theme.colors.textSecondary }}
            title={event.data.url}
          >
            {event.data.url}
          </p>
          {event.data.prompt && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: theme.colors.textMuted }}
            >
              {event.data.prompt}
            </p>
          )}
        </>
      );
    }

    if (event.type === 'stop') {
      return (
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="font-medium text-red-400">Session Stop</span>
            <span className="text-xs" style={{ color: theme.colors.textMuted }}>
              {timeStr}
            </span>
          </div>
          {event.data.trigger && (
            <p
              className="text-sm mt-1"
              style={{ color: theme.colors.textSecondary }}
            >
              Trigger: <span className="text-white">{event.data.trigger}</span>
            </p>
          )}
          {event.data.reason && (
            <p
              className="text-xs mt-1"
              style={{ color: theme.colors.textMuted }}
            >
              {event.data.reason}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      {viewingFile ? (
        <AnimatedResizableLayout
          minSize={30}
          theme={panelsTheme}
          leftPanel={
            <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {activeSegment && activeSegment.events ? (
                  activeSegment.events
                    .filter((event: any) => event.type !== 'stop')
                    .map((event: any, index: number) => {
                      return (
                        <AnimatedTimelineEvent
                          key={`${activeSegment.segmentNumber}-${index}`}
                          event={event}
                          isNew={newEventIds.has(event.id)}
                          renderContent={() =>
                            renderEventContent(
                              event,
                              new Date(event.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              }),
                            )
                          }
                        />
                      );
                    })
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <p>No events in this segment</p>
                  </div>
                )}
              </div>
            </div>
          }
          rightPanel={
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: `1px solid ${theme.colors.border}`,
              }}
            >
              {/* FileViewer Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: theme.colors.text,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {viewingFile.split('/').pop()}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {viewingFile}
                  </span>
                </div>
                <button
                  onClick={() => setViewingFile(null)}
                  style={{
                    padding: '6px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
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
                >
                  <X size={16} />
                </button>
              </div>

              {/* FileViewer Content */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <FileViewer
                  key={viewingFile} // Force remount when file changes
                  filePath={viewingFile}
                  onClose={() => setViewingFile(null)}
                />
              </div>
            </div>
          }
        />
      ) : (
        /* No file viewing - show full width timeline */
        <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {activeSegment && activeSegment.events ? (
              activeSegment.events
                .filter((event: any) => event.type !== 'stop')
                .map((event: any, index: number) => (
                  <AnimatedTimelineEvent
                    key={`${activeSegment.segmentNumber}-${index}`}
                    event={event}
                    isNew={newEventIds.has(event.id)}
                    renderContent={() =>
                      renderEventContent(
                        event,
                        new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                      )
                    }
                  />
                ))
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: theme.colors.textSecondary,
                }}
              >
                <p>No events in this segment</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

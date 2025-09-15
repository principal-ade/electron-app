import React, { useState, useMemo } from 'react';
import { FileText, Edit, Search, List, Globe, Code, ChevronRight, ChevronDown, File, FolderOpen, StopCircle, MessageCircle, Rocket, Flag } from 'lucide-react';
import { EventSegment } from '../../services/EventSegmenterService';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";

interface EventSegmentViewProps {
  segment: EventSegment;
  theme: any;
}

export const EventSegmentView: React.FC<EventSegmentViewProps> = ({ segment, theme }) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [showRawEvents, setShowRawEvents] = useState(false);
  const [showPathDiagnostics, setShowPathDiagnostics] = useState(false);

  const toggleEvent = (index: number) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'Read':
      case 'NotebookRead':
        return <FileText size={14} />;
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
      case 'NotebookEdit':
        return <Edit size={14} />;
      case 'Grep':
      case 'WebSearch':
        return <Search size={14} />;
      case 'LS':
      case 'Glob':
        return <List size={14} />;
      case 'WebFetch':
        return <Globe size={14} />;
      case 'Bash':
      case 'Task':
        return <Code size={14} />;
      default:
        return <File size={14} />;
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getEventColor = (event: NormalizedAgentSessionEvent): string => {
    if (event.eventType === 'pre-tool-use') return theme.colors?.warning || '#f59e0b';
    if (event.eventType === 'post-tool-use') return theme.colors?.success || '#10b981';
    if (event.eventType === 'stop') return theme.colors?.danger || '#ef4444';
    if (event.eventType === 'notification') return theme.colors?.info || '#3b82f6';
    return theme.colors?.text?.secondary || '#6b7280';
  };

  const formatPath = (path: string, normalizedWorkingDir?: string): string => {
    // If it's already a relative path, return as-is
    if (!path.startsWith('/')) {
      return path;
    }
    
    // Try to make it relative to the normalized working directory
    if (normalizedWorkingDir && path.startsWith(normalizedWorkingDir)) {
      const relativePath = path.substring(normalizedWorkingDir.length);
      return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    }
    
    // If path is short enough, show it as-is
    if (path.length < 60) {
      return path;
    }
    
    const parts = path.split('/');
    
    // Check if it's in a project directory (common patterns)
    const projectIndicators = ['Developer', 'Projects', 'repos', 'github', 'src', 'workspace'];
    let projectIndex = -1;
    
    for (let i = 0; i < parts.length; i++) {
      if (projectIndicators.some(indicator => parts[i].toLowerCase().includes(indicator.toLowerCase()))) {
        projectIndex = i;
        break;
      }
    }
    
    // If we found a project directory, show from there
    if (projectIndex >= 0 && projectIndex < parts.length - 3) {
      return `.../${parts.slice(projectIndex + 1).join('/')}`;
    }
    
    // For very long paths, show first part and last 3 parts
    if (parts.length > 6) {
      return `${parts[1]}/.../${parts.slice(-3).join('/')}`;
    }
    
    // Default: show last 4 parts
    if (parts.length > 4) {
      return `.../${parts.slice(-4).join('/')}`;
    }
    
    return path;
  };

  // Helper to determine path quality/normalization status
  const getPathQuality = (event: NormalizedAgentSessionEvent): {
    quality: 'normalized' | 'partial' | 'raw' | 'missing';
    indicator: string;
    color: string;
    tooltip: string;
  } => {
    if (!event.files || event.files.length === 0) {
      return {
        quality: 'missing',
        indicator: '⚠️',
        color: theme.colors?.warning || '#f59e0b',
        tooltip: 'No path information available'
      };
    }
    
    const firstFile = event.files[0];
    
    // Check if we have repository context (best case)
    if (firstFile.repository?.relativePath) {
      return {
        quality: 'normalized',
        indicator: '✓',
        color: theme.colors?.success || '#10b981',
        tooltip: 'Path normalized with repository context'
      };
    }
    
    // Check if we have a display path (normalization successful)
    if (firstFile.displayPath && firstFile.displayPath !== '[path not normalized]') {
      return {
        quality: 'partial',
        indicator: '~',
        color: theme.colors?.info || '#3b82f6',
        tooltip: 'Path partially normalized'
      };
    }
    
    // We only have raw paths
    return {
      quality: 'raw',
      indicator: '!',
      color: theme.colors?.textSecondary || '#6b7280',
      tooltip: 'Using raw path (not normalized)'
    };
  };

  const renderEventDetails = (event: NormalizedAgentSessionEvent) => {
    const details: React.ReactElement[] = [];
    const pathQuality = getPathQuality(event);

    // Show Read operations with more detail
    if (event.toolName === 'Read' && event.toolInput) {
      const filePath = (event.toolInput as any).file_path;
      const limit = (event.toolInput as any).limit;
      const offset = (event.toolInput as any).offset;
      if (filePath) {
        const output = event.toolOutput as any;
        const numLines = output?.file?.numLines || output?.numLines;
        const totalLines = output?.file?.totalLines || output?.totalLines;
        
        // Use normalized path from event.files if available
        const displayPath = event.files?.[0]?.displayPath || 
                           event.files?.[0]?.repository?.relativePath ||
                           filePath;
        
        details.push(
          <div key="read-operation" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📖 File Read
              {pathQuality.quality !== 'normalized' && (
                <span 
                  title={pathQuality.tooltip}
                  style={{ 
                    fontSize: '10px', 
                    color: pathQuality.color,
                    cursor: 'help'
                  }}
                >
                  {pathQuality.indicator}
                </span>
              )}
            </div>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: theme.colors.textSecondary,
            }}>
              <File size={10} />
              {formatPath(displayPath, event.normalizedWorkingDirectory)}
            </div>
            {event.eventType === 'post-tool-use' && numLines && (
              <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginTop: '4px' }}>
                Read {numLines} lines
                {totalLines && ` of ${totalLines} total`}
                {offset && ` (starting at line ${offset})`}
                {limit && ` (limit: ${limit})`}
              </div>
            )}
          </div>
        );
      }
    } else if (event.files && event.files.length > 0) {
      // Generic file path display for other tools
      const firstFile = event.files[0];
      const displayPath = firstFile.displayPath || 
                         firstFile.repository?.relativePath ||
                         '[path not normalized]';
      details.push(
        <div key="primary-path" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: theme.colors.textSecondary,
        }}>
          <File size={12} />
          <span>{formatPath(displayPath, event.normalizedWorkingDirectory)}</span>
          {pathQuality.quality !== 'normalized' && (
            <span 
              title={pathQuality.tooltip}
              style={{ 
                fontSize: '10px', 
                color: pathQuality.color,
                cursor: 'help',
                marginLeft: '4px'
              }}
            >
              {pathQuality.indicator}
            </span>
          )}
        </div>
      );
      
      // Show additional files if present
      if (event.files.length > 1) {
        details.push(
          <div key="additional-files" style={{
            fontSize: '11px',
            color: theme.colors.textSecondary,
            marginTop: '4px',
            marginLeft: '20px'
          }}>
            +{event.files.length - 1} more file{event.files.length > 2 ? 's' : ''}
          </div>
        );
      }
    }

    // Show tool input for specific tools
    if (event.toolName === 'Bash' && event.toolInput) {
      const command = (event.toolInput as any).command;
      if (command) {
        details.push(
          <div key="bash-command" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            $ {command}
          </div>
        );
      }
    }

    // Show Glob pattern searches
    if (event.toolName === 'Glob' && event.toolInput) {
      const pattern = (event.toolInput as any).pattern;
      const path = (event.toolInput as any).path;
      if (pattern) {
        const output = event.toolOutput as any;
        const filenames = output?.filenames || [];
        const numFiles = output?.numFiles || 0;
        
        details.push(
          <div key="glob-pattern" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>🔍 File Pattern Search</div>
            <div style={{ fontFamily: 'monospace' }}>Pattern: {pattern}</div>
            {path && <div style={{ fontFamily: 'monospace', fontSize: '11px', color: theme.colors.textSecondary }}>Path: {path}</div>}
            {event.eventType === 'post-tool-use' && output && (
              <div style={{ marginTop: '4px', fontSize: '11px' }}>
                <div style={{ color: numFiles > 0 ? theme.colors.success || '#10b981' : theme.colors.textSecondary }}>
                  Found: {numFiles > 0 ? `${numFiles} file${numFiles > 1 ? 's' : ''}` : 'No matches'}
                </div>
                {filenames.length > 0 && (
                  <div style={{ marginTop: '4px', paddingLeft: '8px', color: theme.colors.textSecondary }}>
                    {filenames.slice(0, 3).map((file: string, i: number) => (
                      <div key={i} style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                        • {formatPath(file, event.normalizedWorkingDirectory)}
                      </div>
                    ))}
                    {filenames.length > 3 && (
                      <div style={{ fontSize: '10px', fontStyle: 'italic' }}>
                        ...and {filenames.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }
    }

    // Show Grep searches
    if (event.toolName === 'Grep' && event.toolInput) {
      const pattern = (event.toolInput as any).pattern;
      const glob = (event.toolInput as any).glob;
      const path = (event.toolInput as any).path;
      const outputMode = (event.toolInput as any).output_mode;
      if (pattern) {
        const output = event.toolOutput as any;
        const numLines = output?.numLines || 0;
        const numFiles = output?.numFiles || 0;
        const content = output?.content;
        
        details.push(
          <div key="grep-search" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>🔎 Text Search</div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>Pattern: {pattern}</div>
            {glob && <div style={{ fontFamily: 'monospace', fontSize: '11px', color: theme.colors.textSecondary }}>Files: {glob}</div>}
            {path && <div style={{ fontFamily: 'monospace', fontSize: '11px', color: theme.colors.textSecondary }}>In: {formatPath(path, event.normalizedWorkingDirectory)}</div>}
            {event.eventType === 'post-tool-use' && output && (
              <div style={{ marginTop: '4px', fontSize: '11px' }}>
                <div style={{ color: (numLines > 0 || numFiles > 0) ? theme.colors.success || '#10b981' : theme.colors.textSecondary }}>
                  {outputMode === 'files_with_matches' 
                    ? `Found in ${numFiles} file${numFiles !== 1 ? 's' : ''}`
                    : numLines > 0 
                      ? `Found ${numLines} match${numLines !== 1 ? 'es' : ''}`
                      : 'No matches found'}
                </div>
                {content && outputMode === 'content' && (
                  <div style={{ 
                    marginTop: '4px',
                    padding: '4px',
                    backgroundColor: theme.colors?.background || '#ffffff',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: theme.colors.textSecondary,
                    maxHeight: '100px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {content.substring(0, 200)}{content.length > 200 ? '...' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }
    }

    // Show LS directory listings
    if (event.toolName === 'LS' && event.toolInput) {
      const path = (event.toolInput as any).path;
      if (path) {
        details.push(
          <div key="ls-listing" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>📁 Directory Listing</div>
            <div style={{ fontFamily: 'monospace' }}>{formatPath(path, event.normalizedWorkingDirectory)}</div>
          </div>
        );
      }
    }

    // Show Edit/Write operations
    if ((event.toolName === 'Edit' || event.toolName === 'MultiEdit') && event.toolInput) {
      const input = event.toolInput as any;
      details.push(
        <div key="edit-operation" style={{
          padding: '8px',
          backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
          borderRadius: '6px',
          fontSize: '12px',
          color: theme.colors.text,
          marginTop: '8px',
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>✏️ File Edit</div>
          {input.old_string && (
            <div style={{ 
              fontSize: '11px', 
              color: theme.colors.textSecondary,
              marginTop: '4px',
              maxHeight: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              Changed: {input.old_string.substring(0, 50)}...
            </div>
          )}
          {input.edits && Array.isArray(input.edits) && (
            <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
              {input.edits.length} edits made
            </div>
          )}
        </div>
      );
    }

    if (event.toolName === 'Write' && event.toolInput) {
      const input = event.toolInput as any;
      const content = input.content || '';
      const lines = content.split('\n').length;
      details.push(
        <div key="write-operation" style={{
          padding: '8px',
          backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
          borderRadius: '6px',
          fontSize: '12px',
          color: theme.colors.text,
          marginTop: '8px',
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>📝 File Write</div>
          <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
            Wrote {lines} lines ({content.length} characters)
          </div>
        </div>
      );
    }

    if (event.toolName === 'TodoWrite' && event.toolInput) {
      const todos = (event.toolInput as any).todos;
      if (todos && Array.isArray(todos)) {
        const inProgress = todos.filter((t: any) => t.status === 'in_progress');
        const completed = todos.filter((t: any) => t.status === 'completed');
        const pending = todos.filter((t: any) => t.status === 'pending');

        details.push(
          <div key="todos" style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
            marginTop: '8px',
          }}>
            <div>📋 Todos: {completed.length} completed, {inProgress.length} active, {pending.length} pending</div>
            {inProgress.length > 0 && (
              <div style={{ marginTop: '4px', paddingLeft: '16px' }}>
                Active: {inProgress[0].content}
              </div>
            )}
          </div>
        );
      }
    }

    // Show WebSearch and WebFetch
    if (event.toolName === 'WebSearch' && event.toolInput) {
      const query = (event.toolInput as any).query;
      if (query) {
        details.push(
          <div key="web-search" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>🌐 Web Search</div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>Query: {query}</div>
          </div>
        );
      }
    }

    if (event.toolName === 'WebFetch' && event.toolInput) {
      const url = (event.toolInput as any).url;
      if (url) {
        details.push(
          <div key="web-fetch" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>🌐 Web Fetch</div>
            <div style={{ 
              fontFamily: 'monospace', 
              fontSize: '11px',
              wordBreak: 'break-all',
            }}>
              URL: {url}
            </div>
          </div>
        );
      }
    }

    // Show output for post-tool events (for Bash commands)
    if (event.eventType === 'post-tool-use' && event.toolOutput && event.toolName === 'Bash') {
      const output = event.toolOutput as any;
      if (output.stdout) {
        const preview = output.stdout.substring(0, 200);
        details.push(
          <div key="output" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: theme.colors.textSecondary,
            marginTop: '8px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            Output: {preview}{output.stdout.length > 200 ? '...' : ''}
          </div>
        );
      }
    }

    // Show stop event details
    if (event.eventType === 'stop') {
      const stopHookActive = event.raw?.stop_hook_active;
      details.push(
        <div key="stop-event" style={{
          padding: '8px',
          backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
          borderRadius: '6px',
          fontSize: '12px',
          color: theme.colors.text,
          marginTop: '8px',
          border: `1px solid ${theme.colors?.danger || '#ef4444'}`,
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px', color: theme.colors?.danger || '#ef4444' }}>
            🛑 Session Stop
          </div>
          <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
            {stopHookActive !== undefined && (
              <div>Stop hook: {stopHookActive ? 'Active' : 'Inactive'}</div>
            )}
            <div style={{ marginTop: '4px' }}>
              This marks a pause or end in the AI's processing
            </div>
          </div>
        </div>
      );
    }

    // Show notification event details
    if (event.eventType === 'notification') {
      const message = event.data?.message || event.raw?.message;
      if (message) {
        details.push(
          <div key="notification-event" style={{
            padding: '8px',
            backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.colors.text,
            marginTop: '8px',
            border: `1px solid ${theme.colors?.info || '#3b82f6'}`,
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px', color: theme.colors?.info || '#3b82f6' }}>
              💬 Notification
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
            }}>
              "{message}"
            </div>
          </div>
        );
      }
    }

    // Show subagent events
    if (event.eventType === 'subagent-start' || event.eventType === 'subagent-stop') {
      const isStart = event.eventType === 'subagent-start';
      const agentData = event.data as any;
      details.push(
        <div key="subagent-event" style={{
          padding: '8px',
          backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
          borderRadius: '6px',
          fontSize: '12px',
          color: theme.colors.text,
          marginTop: '8px',
          border: `1px solid ${isStart ? theme.colors?.success || '#10b981' : theme.colors?.warning || '#f59e0b'}`,
        }}>
          <div style={{ 
            fontWeight: 500, 
            marginBottom: '4px', 
            color: isStart ? theme.colors?.success || '#10b981' : theme.colors?.warning || '#f59e0b'
          }}>
            {isStart ? '🚀 Subagent Started' : '🏁 Subagent Stopped'}
          </div>
          {agentData && (
            <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
              {agentData.agent_type && <div>Type: {agentData.agent_type}</div>}
              {agentData.description && <div>Task: {agentData.description}</div>}
              {agentData.prompt && (
                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                  "{agentData.prompt.substring(0, 100)}{agentData.prompt.length > 100 ? '...' : ''}"
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Add path diagnostics if enabled and we have path issues
    if (showPathDiagnostics && event.files && event.files.length > 0 && pathQuality.quality !== 'normalized') {
      details.push(
        <div key="path-diagnostics" style={{
          padding: '8px',
          backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
          borderRadius: '6px',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: theme.colors.textSecondary,
          marginTop: '8px',
          border: `1px solid ${pathQuality.color}`,
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px', color: pathQuality.color }}>
            🔍 Path Diagnostics ({pathQuality.quality})
          </div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify({
              files: event.files.map(f => ({
                displayPath: f.displayPath,
                repository: f.repository,
                context: f.context
              })),
              operation: event.operation,
              normalizedWorkingDir: event.normalizedWorkingDirectory,
              workingDir: event.workingDirectory
            }, null, 2)}
          </div>
        </div>
      );
    }

    return details;
  };

  // Calculate path quality statistics for the segment
  const pathStats = useMemo(() => {
    const stats = { normalized: 0, partial: 0, raw: 0, missing: 0, total: 0 };
    segment.events.forEach(event => {
      if (event.toolName && ['Read', 'Write', 'Edit', 'MultiEdit', 'Grep', 'Glob', 'LS'].includes(event.toolName)) {
        stats.total++;
        const quality = getPathQuality(event);
        stats[quality.quality]++;
      }
    });
    return stats;
  }, [segment.events]);

  return (
    <div style={{ padding: '16px' }}>
      {/* Path Quality Summary (if there are issues) */}
      {pathStats.total > 0 && (pathStats.raw > 0 || pathStats.missing > 0 || pathStats.partial > 0) && (
        <div style={{
          padding: '8px',
          backgroundColor: theme.colors?.backgroundTertiary || theme.colors?.backgroundSecondary || '#f3f4f6',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ fontWeight: 500, color: theme.colors.textSecondary }}>Path Quality:</div>
          {pathStats.normalized > 0 && (
            <span style={{ color: theme.colors?.success || '#10b981' }}>
              ✓ {pathStats.normalized} normalized
            </span>
          )}
          {pathStats.partial > 0 && (
            <span style={{ color: theme.colors?.info || '#3b82f6' }}>
              ~ {pathStats.partial} partial
            </span>
          )}
          {pathStats.raw > 0 && (
            <span style={{ color: theme.colors?.textSecondary || '#6b7280' }}>
              ! {pathStats.raw} raw
            </span>
          )}
          {pathStats.missing > 0 && (
            <span style={{ color: theme.colors?.warning || '#f59e0b' }}>
              ⚠️ {pathStats.missing} missing
            </span>
          )}
        </div>
      )}

      {/* Statistics Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}>
        {/* Tool Usage */}
        {Object.keys(segment.stats.toolCounts).length > 0 && (
          <div style={{
            padding: '12px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 500,
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}>
              Tool Usage
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(segment.stats.toolCounts).map(([tool, count]) => (
                <div
                  key={tool}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                >
                  {getToolIcon(tool)}
                  <span>{tool}</span>
                  <span style={{ color: theme.colors.textSecondary }}>×{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Accessed */}
        {segment.stats.filesAccessed.length > 0 && (
          <div style={{
            padding: '12px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 500,
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}>
              Files Accessed ({segment.stats.filesAccessed.length})
            </div>
            <div style={{ fontSize: '12px' }}>
              {segment.stats.filesAccessed.slice(0, 3).map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '2px 0',
                    color: theme.colors.text,
                  }}
                >
                  <File size={10} />
                  <span style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {file.split('/').pop()}
                  </span>
                </div>
              ))}
              {segment.stats.filesAccessed.length > 3 && (
                <div style={{ color: theme.colors.textSecondary, marginTop: '4px' }}>
                  +{segment.stats.filesAccessed.length - 3} more files
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files Modified */}
        {segment.stats.fileWrites.length > 0 && (
          <div style={{
            padding: '12px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 500,
              color: theme.colors.textSecondary,
              marginBottom: '8px',
            }}>
              Files Modified ({segment.stats.fileWrites.length})
            </div>
            <div style={{ fontSize: '12px' }}>
              {segment.stats.fileWrites.slice(0, 3).map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '2px 0',
                    color: theme.colors.warning,
                  }}
                >
                  <Edit size={10} />
                  <span style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {file.split('/').pop()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event Timeline Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 500,
          color: theme.colors.text,
        }}>
          Event Timeline
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowPathDiagnostics(!showPathDiagnostics)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: showPathDiagnostics ? theme.colors.warning : 'transparent',
              color: showPathDiagnostics ? '#fff' : theme.colors.text,
              cursor: 'pointer',
            }}
            title="Show detailed path information for debugging"
          >
            🔍 Paths
          </button>
          <button
            onClick={() => setShowRawEvents(!showRawEvents)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: showRawEvents ? theme.colors.primary : 'transparent',
              color: showRawEvents ? '#fff' : theme.colors.text,
              cursor: 'pointer',
            }}
          >
            {showRawEvents ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* Event List */}
      {showRawEvents && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '8px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
        }}>
          {segment.events.map((event, index) => (
            <div
              key={index}
              style={{
                padding: '8px',
                backgroundColor: theme.colors.background,
                borderRadius: '6px',
                borderLeft: `3px solid ${getEventColor(event)}`,
              }}
            >
              <div
                onClick={() => toggleEvent(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                {expandedEvents.has(index) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flex: 1,
                }}
              >
                  {event.toolName ? getToolIcon(event.toolName) : 
                   event.eventType === 'stop' ? <StopCircle size={14} /> :
                   event.eventType === 'notification' ? <MessageCircle size={14} /> :
                   event.eventType === 'subagent-start' ? <Rocket size={14} /> :
                   event.eventType === 'subagent-stop' ? <Flag size={14} /> :
                   null}
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: theme.colors.text,
                  }}>
                    {event.toolName || 
                     (event.eventType === 'stop' ? 'Stop' : 
                      event.eventType === 'notification' ? 'Notification' :
                      event.eventType === 'subagent-start' ? 'Subagent Start' :
                      event.eventType === 'subagent-stop' ? 'Subagent Stop' :
                      event.eventType)}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginLeft: 'auto',
                  }}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>

              {expandedEvents.has(index) && (
                <div style={{
                  marginTop: '8px',
                  paddingLeft: '22px',
                }}>
                  {renderEventDetails(event)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
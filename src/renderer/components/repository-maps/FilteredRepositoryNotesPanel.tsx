import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { 
  BookOpen, 
  MessageSquare, 
  Clock, 
  FolderTree, 
  MapPin,
  Eye,
  EyeOff,
  Target,
  Layers,
  CheckCircle2,
  FileText,
  ChevronRight,
  Filter,
  Search,
  X
} from 'lucide-react';
import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
import { SessionFileActivity } from '../../contexts/FileChangeContext';
import { 
  filterNotesBySession, 
  filterNotesByPath,
  FilteredNote, 
  calculateNoteCoverage 
} from '../../../shared/utils/noteFiltering';

type FilterMode = 'all' | 'active';

interface FilteredRepositoryNotesPanelProps {
  notes: RepositoryNote[];
  sessions: EnhancedUIAgentSessionData[];
  sessionFileActivities: Map<string, SessionFileActivity[]>;
  selectedSessionId?: string;
  remoteUrl?: string;
  onNoteToggle?: (noteId: string) => void;
  selectedNoteIds?: Set<string>;
  repository?: {
    name: string;
    localClones?: Array<{ path: string }>;
  };
  onNotesUpdated?: (notes: RepositoryNote[]) => void;
}

export const FilteredRepositoryNotesPanel: React.FC<FilteredRepositoryNotesPanelProps> = ({
  notes,
  sessions,
  sessionFileActivities,
  selectedSessionId,
  remoteUrl,
  onNoteToggle,
  selectedNoteIds = new Set(),
  repository,
  onNotesUpdated,
}) => {
  const { theme } = useTheme();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showParentNotes, setShowParentNotes] = useState(true);
  const [groupByDepth, setGroupByDepth] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-switch to active mode when a session is selected from outside
  useEffect(() => {
    if (selectedSessionId && filterMode === 'all') {
      setFilterMode('active');
    }
    // Clear selected files when session changes
    setSelectedFiles(new Set());
    setShowFileSelector(false);
  }, [selectedSessionId]);
  
  // Get session file paths for filtering
  const sessionFilePaths = useMemo(() => {
    if (!selectedSessionId) {
      console.log('[FilteredNotes] No selectedSessionId');
      return [];
    }
    
    console.log('[FilteredNotes] Looking for activities for session:', selectedSessionId);
    console.log('[FilteredNotes] sessionFileActivities Map size:', sessionFileActivities.size);
    console.log('[FilteredNotes] sessionFileActivities keys (sourceIds):', Array.from(sessionFileActivities.keys()));
    
    // sessionFileActivities is keyed by sourceId, not sessionId
    // We need to look through all sources to find activities for this session
    const paths = new Set<string>();
    
    sessionFileActivities.forEach((activities, sourceId) => {
      console.log(`[FilteredNotes] Checking source ${sourceId} with ${activities.length} activities`);
      
      activities.forEach(activity => {
        if (activity.sessionId === selectedSessionId) {
          console.log('[FilteredNotes] Found matching activity:', activity.filePath);
          if (activity.filePath) {
            // Ensure consistent path format (no leading slash)
            let normalizedPath = activity.filePath;
            if (normalizedPath.startsWith('/')) {
              normalizedPath = normalizedPath.substring(1);
            }
            paths.add(normalizedPath);
          }
        }
      });
    });
    
    const result = Array.from(paths);
    console.log('[FilteredNotes] Total paths extracted for session:', result.length, result);
    return result;
  }, [selectedSessionId, sessionFileActivities]);
  
  // Filter notes based on current mode
  const { filteredNotes, coverage } = useMemo(() => {
    if (filterMode === 'all' || !selectedSessionId) {
      // Show all notes when in 'all' mode or no session selected
      return {
        filteredNotes: notes.map(n => ({ ...n, relevance: 'none' as const })),
        coverage: calculateNoteCoverage(notes as FilteredNote[], notes, sessionFilePaths)
      };
    }
    
    // In active mode with a session selected
    if (sessionFilePaths.length === 0) {
      // Session has no file activities - show no notes
      return {
        filteredNotes: [],
        coverage: {
          totalNotes: notes.length,
          relevantNotes: 0,
          exactMatches: 0,
          parentMatches: 0,
          coveragePercent: 0,
          filesCovered: 0,
          totalFiles: 0
        }
      };
    }
    
    // Filter by active session - use selected files if any, otherwise all session files
    const pathsToFilter = selectedFiles.size > 0 
      ? Array.from(selectedFiles)
      : sessionFilePaths;
    
    console.log('[FilteredNotes] Filtering notes:');
    console.log('  - Paths to filter:', pathsToFilter);
    console.log('  - Total notes available:', notes.length);
    console.log('  - Note paths:', notes.map(n => n.relativePath));
    console.log('  - Include parent notes:', showParentNotes);
    
    const result = filterNotesBySession(notes, pathsToFilter, showParentNotes);
    console.log('[FilteredNotes] Filter result:', result.filteredNotes.length, 'notes matched');
    
    return result;
  }, [notes, filterMode, selectedSessionId, sessionFilePaths, selectedFiles, showParentNotes]);
  
  // Apply search filter on top of other filters
  const searchFilteredNotes = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredNotes;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return filteredNotes.filter(note => {
      // Search in note content
      if (note.note.toLowerCase().includes(query)) return true;
      // Search in path
      if (note.relativePath.toLowerCase().includes(query)) return true;
      // Search in metadata
      if (note.metadata) {
        const metadataString = JSON.stringify(note.metadata).toLowerCase();
        if (metadataString.includes(query)) return true;
      }
      // Search in tags
      if (note.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [filteredNotes, searchQuery]);
  
  // Group notes by depth level for better visualization
  const notesByDepth = useMemo(() => {
    const groups: Map<number, FilteredNote[]> = new Map();
    
    searchFilteredNotes.forEach(note => {
      const depth = note.pathDistance ?? -1;
      if (!groups.has(depth)) {
        groups.set(depth, []);
      }
      groups.get(depth)!.push(note);
    });
    
    // Sort by depth (0 first, then 1, 2, 3, etc.)
    return Array.from(groups.entries())
      .sort((a, b) => {
        if (a[0] === -1) return 1; // Put "none" relevance at the end
        if (b[0] === -1) return -1;
        return a[0] - b[0];
      });
  }, [searchFilteredNotes]);
  
  // Calculate which files each note applies to
  const getFilesForNote = (note: FilteredNote): string[] => {
    if (!sessionFilePaths.length) return [];
    
    // For exact matches, return the file itself
    if (note.pathDistance === 0) {
      return sessionFilePaths.filter(fp => fp === note.relativePath);
    }
    
    // For parent notes, find all files under that directory
    if (note.isParentDirectory) {
      const notePath = note.relativePath === '.' ? '' : note.relativePath;
      return sessionFilePaths.filter(fp => {
        if (notePath === '') return true; // Root applies to all
        return fp.startsWith(notePath + '/');
      });
    }
    
    return [];
  };
  
  // Get session info for display
  const selectedSession = sessions.find(s => s.sessionId === selectedSessionId);
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '16px', 
      padding: '16px',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Filter Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
      }}>
        {/* Filter Mode Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilterMode('all')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: filterMode === 'all' ? 'none' : `1px solid ${theme.colors.border}`,
              backgroundColor: filterMode === 'all' ? theme.colors.primary : theme.colors.backgroundSecondary,
              color: filterMode === 'all' ? 'white' : theme.colors.text,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Layers size={14} />
            All Notes
          </button>
          <button
            onClick={() => setFilterMode('active')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: filterMode === 'active' ? 'none' : `1px solid ${theme.colors.border}`,
              backgroundColor: filterMode === 'active' ? theme.colors.primary : theme.colors.backgroundSecondary,
              color: filterMode === 'active' ? 'white' : theme.colors.text,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              opacity: selectedSessionId ? 1 : 0.5,
            }}
            disabled={!selectedSessionId}
            title={selectedSessionId ? `Show notes for session: ${selectedSession?.customName || selectedSessionId.substring(0, 8)}` : 'No session selected'}
          >
            <Target size={14} />
            Session Context
          </button>
        </div>
        
        {/* Search Bar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Search 
              size={14} 
              style={{ 
                position: 'absolute', 
                left: '10px', 
                color: theme.colors.textSecondary,
                pointerEvents: 'none'
              }} 
            />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 30px 6px 32px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '12px',
                color: theme.colors.text,
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  padding: '2px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div style={{
              fontSize: '11px',
              color: searchFilteredNotes.length > 0 ? theme.colors.textSecondary : theme.colors.warning,
              paddingLeft: '4px',
            }}>
              {searchFilteredNotes.length === 0 
                ? 'No matches found'
                : `${searchFilteredNotes.length} of ${filteredNotes.length} notes match`}
            </div>
          )}
        </div>
        
        
        {/* Active Session Info */}
        {filterMode === 'active' && selectedSession && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '8px',
              backgroundColor: theme.colors.primary + '11',
              borderRadius: '4px',
              fontSize: '12px',
              color: theme.colors.text,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={14} color={theme.colors.primary} />
                <span>Filtering by session:</span>
                <strong>{selectedSession.customName || selectedSession.sessionId.substring(0, 8)}</strong>
                {selectedSession.fileAccessCount && (
                  <span style={{ color: theme.colors.textSecondary }}>
                    • {selectedSession.fileAccessCount} files accessed
                  </span>
                )}
              </div>
              
              {sessionFilePaths.length > 0 && (
                <button
                  onClick={() => setShowFileSelector(!showFileSelector)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: selectedFiles.size > 0 
                      ? theme.colors.primary 
                      : 'transparent',
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: '4px',
                    color: selectedFiles.size > 0 ? 'white' : theme.colors.primary,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Filter size={12} />
                  {selectedFiles.size > 0 
                    ? `${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} selected`
                    : 'Filter by files'
                  }
                  <ChevronRight 
                    size={12} 
                    style={{ 
                      transform: showFileSelector ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }} 
                  />
                </button>
              )}
            </div>
            
            {/* File Selector */}
            {showFileSelector && sessionFilePaths.length > 0 && (
              <div style={{
                backgroundColor: theme.colors.backgroundLight,
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                padding: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  paddingBottom: '8px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                  <span style={{ fontSize: '11px', color: theme.colors.textSecondary, fontWeight: 600 }}>
                    SELECT FILES TO FILTER
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setSelectedFiles(new Set(sessionFilePaths))}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '3px',
                        color: theme.colors.text,
                        cursor: 'pointer',
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedFiles(new Set())}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '3px',
                        color: theme.colors.text,
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {sessionFilePaths.map(filePath => {
                    const isSelected = selectedFiles.has(filePath);
                    // Count notes that would match this file
                    const fileNotes = filterNotesByPath(notes, filePath, showParentNotes);
                    
                    return (
                      <label
                        key={filePath}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px',
                          backgroundColor: isSelected 
                            ? theme.colors.primary + '11' 
                            : 'transparent',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedFiles);
                            if (e.target.checked) {
                              newSelected.add(filePath);
                            } else {
                              newSelected.delete(filePath);
                            }
                            setSelectedFiles(newSelected);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <FileText size={12} color={theme.colors.primary} />
                        <span style={{ 
                          flex: 1, 
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                        }}>
                          {filePath}
                        </span>
                        <span style={{ 
                          fontSize: '10px', 
                          color: theme.colors.textTertiary,
                          padding: '2px 4px',
                          backgroundColor: theme.colors.backgroundTertiary,
                          borderRadius: '3px',
                        }}>
                          {fileNotes.length} note{fileNotes.length !== 1 ? 's' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Options */}
        {filterMode !== 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: theme.colors.text,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={showParentNotes}
                  onChange={(e) => setShowParentNotes(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Include parent directory notes
              </label>
              
              {sessionFilePaths.length > 0 && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={groupByDepth}
                    onChange={(e) => setGroupByDepth(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Group by depth
                </label>
              )}
            </div>
            
            {/* Coverage Stats */}
            {selectedSessionId && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}>
                {selectedFiles.size > 0 && (
                  <span style={{ 
                    color: theme.colors.warning,
                    fontWeight: 600,
                  }}>
                    Filtered: {selectedFiles.size}/{sessionFilePaths.length} files
                  </span>
                )}
                <span>
                  {coverage.relevantNotes} / {coverage.totalNotes} notes
                </span>
                {coverage.filesCovered !== undefined && (
                  <span>
                    {coverage.filesCovered} / {coverage.totalFiles} files covered
                  </span>
                )}
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: theme.colors.primary + '22',
                  color: theme.colors.primary,
                  fontWeight: 600,
                }}>
                  {coverage.coveragePercent}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Notes List */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {searchFilteredNotes.length === 0 ? (
          <div style={{
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '8px',
            padding: '16px',
            border: `1px solid ${theme.colors.border}`,
          }}>
            {searchQuery ? (
              <div style={{
                textAlign: 'center',
                padding: '8px',
                color: theme.colors.textSecondary,
                fontSize: '14px',
              }}>
                No notes match your search "{searchQuery}"
              </div>
            ) : filterMode === 'all' ? (
              <div style={{
                textAlign: 'center',
                padding: '8px',
                color: theme.colors.textSecondary,
                fontSize: '14px',
              }}>
                No tribal knowledge notes yet
              </div>
            ) : sessionFilePaths.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '8px',
                color: theme.colors.textSecondary,
                fontSize: '14px',
              }}>
                This session has no file activities recorded
              </div>
            ) : (
              <>
                <div style={{
                  marginBottom: '12px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '4px',
                  }}>
                    {selectedFiles.size > 0 
                      ? `No notes match the ${selectedFiles.size} selected file${selectedFiles.size > 1 ? 's' : ''}`
                      : `No notes match these ${sessionFilePaths.length} session file${sessionFilePaths.length > 1 ? 's' : ''}`}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                  }}>
                    Consider adding tribal knowledge notes to provide context for future sessions
                  </div>
                </div>
                
                <div style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Files touched by this session:
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}>
                  {(selectedFiles.size > 0 ? Array.from(selectedFiles) : sessionFilePaths).map(filePath => (
                    <div
                      key={filePath}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <FileText size={14} color={theme.colors.primary} />
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: theme.colors.text,
                      }}>
                        {filePath}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : groupByDepth && filterMode !== 'all' ? (
          // Grouped by depth view
          notesByDepth.map(([depth, depthNotes]) => (
            <div key={depth} style={{
              backgroundColor: theme.colors.backgroundLight,
              borderRadius: '8px',
              padding: '12px',
              border: `1px solid ${theme.colors.border}`,
            }}>
              {/* Depth Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: `1px solid ${theme.colors.border}`,
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: depth === 0 
                    ? theme.colors.success + '22'
                    : depth === -1 
                    ? theme.colors.backgroundTertiary
                    : theme.colors.warning + '22',
                  color: depth === 0 
                    ? theme.colors.success
                    : depth === -1
                    ? theme.colors.textSecondary
                    : theme.colors.warning,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {depth === -1 ? '?' : depth}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: theme.colors.text }}>
                    {depth === 0 ? 'Exact Matches' : 
                     depth === -1 ? 'Other Notes' :
                     `Parent Level ${depth}`}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
                    {depthNotes.length} note{depthNotes.length > 1 ? 's' : ''}
                    {depth > 0 && ` • ${depth} level${depth > 1 ? 's' : ''} up from session files`}
                  </div>
                </div>
              </div>
              
              {/* Notes in this depth level */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {depthNotes.map(note => (
                  <div
                    key={note.id}
                    style={{
                      backgroundColor: selectedNoteIds.has(note.id) 
                        ? theme.colors.primary + '11' 
                        : theme.colors.backgroundSecondary,
                      borderRadius: '6px',
                      padding: '10px',
                      border: `1px solid ${
                        selectedNoteIds.has(note.id) 
                          ? theme.colors.primary 
                          : theme.colors.border
                      }`,
                      cursor: onNoteToggle ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => onNoteToggle?.(note.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      {selectedNoteIds.has(note.id) && (
                        <CheckCircle2 size={12} color={theme.colors.primary} />
                      )}
                      <FolderTree size={12} color={theme.colors.primary} />
                      <span style={{ fontSize: '11px', color: theme.colors.primary, fontFamily: 'monospace' }}>
                        {note.relativePath || '/'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: theme.colors.text, margin: 0, lineHeight: '1.4' }}>
                      {note.note}
                    </p>
                    
                    {/* Show which files this note applies to */}
                    {(() => {
                      const applicableFiles = getFilesForNote(note);
                      if (applicableFiles.length > 0 && applicableFiles.length <= 3) {
                        return (
                          <div style={{ 
                            marginTop: '6px', 
                            paddingTop: '6px', 
                            borderTop: `1px solid ${theme.colors.border}`,
                            fontSize: '10px',
                            color: theme.colors.textSecondary,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                              <MapPin size={10} />
                              <span>Applies to:</span>
                            </div>
                            {applicableFiles.map((file, idx) => (
                              <div key={idx} style={{ 
                                marginLeft: '14px',
                                fontFamily: 'monospace',
                                color: theme.colors.primary + 'aa',
                              }}>
                                {file}
                              </div>
                            ))}
                          </div>
                        );
                      } else if (applicableFiles.length > 3) {
                        return (
                          <div style={{ 
                            marginTop: '6px', 
                            paddingTop: '6px', 
                            borderTop: `1px solid ${theme.colors.border}`,
                            fontSize: '10px',
                            color: theme.colors.textSecondary,
                          }}>
                            <MapPin size={10} style={{ display: 'inline', marginRight: '4px' }} />
                            Applies to {applicableFiles.length} files in session
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          searchFilteredNotes.map((note) => {
            const isSelected = selectedNoteIds.has(note.id);
            return (
              <div
                key={note.id}
                style={{
                  backgroundColor: isSelected ? theme.colors.primary + '11' : theme.colors.backgroundLight,
                  borderRadius: '8px',
                  padding: '12px',
                  border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                  transition: 'all 0.2s',
                  cursor: onNoteToggle ? 'pointer' : 'default',
                  position: 'relative',
                }}
                onClick={() => onNoteToggle?.(note.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = theme.colors.primary + '66';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
                {/* Header with path and relevance */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSelected && (
                      <CheckCircle2 size={14} color={theme.colors.primary} />
                    )}
                    <FolderTree size={14} color={theme.colors.primary} />
                    <span style={{ 
                      fontSize: '12px', 
                      color: theme.colors.primary, 
                      fontFamily: 'monospace' 
                    }}>
                      {note.relativePath || '/'}
                    </span>
                    
                    {/* Relevance indicator */}
                    {note.relevance && note.relevance !== 'none' && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: note.relevance === 'exact' 
                          ? theme.colors.success + '22'
                          : theme.colors.warning + '22',
                        color: note.relevance === 'exact'
                          ? theme.colors.success
                          : theme.colors.warning,
                      }}>
                        {note.relevance === 'exact' ? 'EXACT' : `PARENT (${note.pathDistance} levels)`}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    fontSize: '11px', 
                    color: theme.colors.textSecondary 
                  }}>
                    <Clock size={12} />
                    {new Date(note.timestamp).toLocaleDateString()}
                  </div>
                </div>
                
                {/* Note content */}
                <p style={{ 
                  fontSize: '13px', 
                  color: theme.colors.text, 
                  margin: 0, 
                  lineHeight: '1.5' 
                }}>
                  {note.note}
                </p>
                
                {/* Metadata */}
                {note.metadata && Object.keys(note.metadata).length > 0 && (
                  <div style={{ 
                    marginTop: '8px', 
                    paddingTop: '8px', 
                    borderTop: `1px solid ${theme.colors.border}`, 
                    fontSize: '11px', 
                    color: theme.colors.textSecondary 
                  }}>
                    {Object.entries(note.metadata).map(([key, value]) => (
                      <span key={key} style={{ marginRight: '12px' }}>
                        <strong>{key}:</strong> {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Map Coverage Toggle */}
      {onNoteToggle && searchFilteredNotes.length > 0 && (
        <div style={{
          padding: '12px',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => {
              // Toggle all search filtered notes
              if (selectedNoteIds.size === searchFilteredNotes.length) {
                // Clear all
                searchFilteredNotes.forEach(note => onNoteToggle(note.id));
              } else {
                // Select all filtered
                searchFilteredNotes.forEach(note => {
                  if (!selectedNoteIds.has(note.id)) {
                    onNoteToggle(note.id);
                  }
                });
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: selectedNoteIds.size === searchFilteredNotes.length 
                ? theme.colors.primary 
                : theme.colors.backgroundTertiary,
              color: selectedNoteIds.size === searchFilteredNotes.length 
                ? 'white' 
                : theme.colors.text,
              border: `1px solid ${
                selectedNoteIds.size === searchFilteredNotes.length 
                  ? theme.colors.primary 
                  : theme.colors.border
              }`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            {selectedNoteIds.size === searchFilteredNotes.length ? (
              <>
                <EyeOff size={14} />
                Hide Map Coverage
              </>
            ) : (
              <>
                <Eye size={14} />
                Show Map Coverage
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
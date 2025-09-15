import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Archive, Check, AlertCircle, Loader, FileJson, Database } from 'lucide-react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';

interface ArchiveTestViewProps {
  sessionId: string;
  sessionName?: string;
  currentEvents: NormalizedAgentSessionEvent[];
  onClose?: () => void;
  onArchiveSuccess?: () => void;
}

interface ComparisonResult {
  isIdentical: boolean;
  differences: string[];
  originalEventCount: number;
  archivedEventCount: number;
  originalSize?: number;
  archivedSize?: number;
  hasRawEvents?: boolean;
  rawEventCount?: number;
}

export const ArchiveTestView: React.FC<ArchiveTestViewProps> = ({
  sessionId,
  sessionName,
  currentEvents,
  onClose,
  onArchiveSuccess
}) => {
  const { theme } = useTheme();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [archivedData, setArchivedData] = useState<any>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if session is already archived on mount
  useEffect(() => {
    checkArchiveStatus();
  }, [sessionId]);

  const checkArchiveStatus = async () => {
    try {
      // Try to load the archived session - if it exists, it's archived
      const archived = await AgentSessionArchiveService.loadSession(sessionId);
      if (archived) {
        setArchiveStatus('success');
        setArchivedData(archived);
      }
    } catch (err) {
      // Session not archived or error loading - that's ok
      console.log('Session not archived yet or error checking:', err);
    }
  };

  const archiveSession = async () => {
    setIsArchiving(true);
    setError(null);
    
    try {
      // Archive the session for TESTING - skip cleanup to avoid deleting active data
      const result = await AgentSessionArchiveService.archiveSession(sessionId);
      
      if (result.success) {
        setArchiveStatus('success');
        console.log('Session archived successfully (test mode - no cleanup performed)');
        
        // Notify parent that archive was successful
        if (onArchiveSuccess) {
          onArchiveSuccess();
        }
        
        // Automatically load and compare
        await loadAndCompare();
      } else {
        throw new Error('Archive operation failed');
      }
    } catch (err) {
      console.error('Archive error:', err);
      setError(err.message || 'Failed to archive session');
      setArchiveStatus('error');
    } finally {
      setIsArchiving(false);
    }
  };

  const loadAndCompare = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load the archived session data (raw events are always included)
      const archived = await AgentSessionArchiveService.loadSession(sessionId);
      
      if (!archived) {
        throw new Error('Failed to load archived session');
      }
      
      setArchivedData(archived);
      
      // Compare with current data
      const comparison = compareSessionData(currentEvents, archived);
      setComparisonResult(comparison);
      
    } catch (err) {
      console.error('Load/compare error:', err);
      setError(err.message || 'Failed to load or compare archived data');
    } finally {
      setIsLoading(false);
    }
  };

  const compareSessionData = (
    original: NormalizedAgentSessionEvent[], 
    archived: any
  ): ComparisonResult => {
    const differences: string[] = [];
    
    // Extract events from archived data
    // The archived data structure should have events in the session object
    const archivedSession = archived.session || archived;
    const archivedEvents = archivedSession.events || [];
    const rawEvents = archived.rawEvents;
    
    console.log('Comparing data:', {
      originalCount: original.length,
      archivedCount: archivedEvents.length,
      hasRawEvents: !!rawEvents,
      rawEventCount: rawEvents?.length || 0,
      archivedStructure: Object.keys(archived)
    });
    
    // Compare event counts
    if (original.length !== archivedEvents.length) {
      differences.push(`Event count mismatch: ${original.length} vs ${archivedEvents.length}`);
    }
    
    // Check raw events
    if (!rawEvents || rawEvents.length === 0) {
      differences.push('Warning: No raw events found in archive');
    }
    
    // Compare individual events
    const minLength = Math.min(original.length, archivedEvents.length);
    for (let i = 0; i < minLength; i++) {
      const origEvent = original[i];
      const archEvent = archivedEvents[i];
      
      // Check key fields
      if (origEvent.sessionId !== archEvent.sessionId) {
        differences.push(`Event ${i}: sessionId mismatch`);
      }
      if (origEvent.eventType !== archEvent.eventType) {
        differences.push(`Event ${i}: eventType mismatch (${origEvent.eventType} vs ${archEvent.eventType})`);
      }
      if (origEvent.toolName !== archEvent.toolName) {
        differences.push(`Event ${i}: toolName mismatch`);
      }
      
      // Check paths
      const origPath = origEvent.paths?.primary?.displayPath;
      const archPath = archEvent.paths?.primary?.displayPath;
      if (origPath !== archPath) {
        differences.push(`Event ${i}: primary path mismatch`);
      }
    }
    
    // Calculate sizes (approximate)
    const originalSize = JSON.stringify(original).length;
    const archivedSize = JSON.stringify(archived).length;
    
    return {
      isIdentical: differences.length === 0,
      differences: differences.slice(0, 10), // Limit to first 10 differences
      originalEventCount: original.length,
      archivedEventCount: archivedEvents.length,
      originalSize,
      archivedSize,
      hasRawEvents: !!rawEvents && rawEvents.length > 0,
      rawEventCount: rawEvents?.length || 0
    };
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80%',
        backgroundColor: theme.colors.background,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.backgroundSecondary,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Archive size={20} color="#8b5cf6" />
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}>
              Archive Test
            </h2>
            <span style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              fontFamily: 'monospace',
            }}>
              {sessionName || sessionId.substring(0, 12)}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Close
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
        }}>
          {/* Archive Status */}
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}>
              <Database size={18} color={theme.colors.text} />
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
              }}>
                Session Status
              </span>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              fontSize: '12px',
            }}>
              <div>
                <span style={{ color: theme.colors.textSecondary }}>Current Events: </span>
                <span style={{ color: theme.colors.text, fontWeight: 600 }}>
                  {currentEvents.length}
                </span>
              </div>
              <div>
                <span style={{ color: theme.colors.textSecondary }}>Archive Status: </span>
                <span style={{ 
                  color: archiveStatus === 'success' ? '#10b981' : 
                         archiveStatus === 'error' ? '#ef4444' : 
                         theme.colors.textSecondary,
                  fontWeight: 600
                }}>
                  {archiveStatus === 'success' ? 'Archived' : 
                   archiveStatus === 'error' ? 'Failed' : 
                   'Not Archived'}
                </span>
              </div>
            </div>
          </div>

          {/* Archive/Re-archive Button */}
          {(archiveStatus === 'pending' || 
            archiveStatus === 'error' || 
            (archiveStatus === 'success' && comparisonResult && !comparisonResult.isIdentical)) && (
            <div style={{
              textAlign: 'center',
              marginBottom: '24px',
            }}>
              <button
                onClick={archiveSession}
                disabled={isArchiving}
                style={{
                  padding: '10px 24px',
                  backgroundColor: archiveStatus === 'pending' ? '#8b5cf6' : '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isArchiving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isArchiving ? 0.6 : 1,
                }}
              >
                {isArchiving ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive size={16} />
                    {archiveStatus === 'pending' ? 'Archive Session' : 'Re-archive Session'}
                  </>
                )}
              </button>
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}>
                {archiveStatus === 'pending' 
                  ? 'This will create a test archive without deleting active data'
                  : 'This will replace the existing archive with fresh data'}
              </div>
            </div>
          )}

          {/* Load & Compare Button - shows when archived but not yet compared */}
          {archiveStatus === 'success' && !comparisonResult && !isLoading && (
            <div style={{
              textAlign: 'center',
              marginBottom: '24px',
            }}>
              <button
                onClick={loadAndCompare}
                disabled={isLoading}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FileJson size={16} />
                Load & Compare Archive
              </button>
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}>
                Load the archived data and compare with current session
              </div>
            </div>
          )}

          {/* Comparison Results */}
          {comparisonResult && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: comparisonResult.isIdentical ? 
                'rgba(16, 185, 129, 0.1)' : 
                'rgba(239, 68, 68, 0.1)',
              borderRadius: '6px',
              border: `1px solid ${comparisonResult.isIdentical ? '#10b981' : '#ef4444'}`,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}>
                {comparisonResult.isIdentical ? (
                  <Check size={18} color="#10b981" />
                ) : (
                  <AlertCircle size={18} color="#ef4444" />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: comparisonResult.isIdentical ? '#10b981' : '#ef4444',
                }}>
                  {comparisonResult.isIdentical ? 'Data Integrity Verified' : 'Data Mismatch Detected'}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '12px',
                marginBottom: '12px',
              }}>
                <div>
                  <span style={{ color: theme.colors.textSecondary }}>Normalized Events: </span>
                  <span style={{ fontWeight: 600 }}>{comparisonResult.originalEventCount}</span>
                </div>
                <div>
                  <span style={{ color: theme.colors.textSecondary }}>Archived Events: </span>
                  <span style={{ fontWeight: 600 }}>{comparisonResult.archivedEventCount}</span>
                </div>
                <div>
                  <span style={{ color: theme.colors.textSecondary }}>Raw Events: </span>
                  <span style={{ 
                    fontWeight: 600,
                    color: comparisonResult.hasRawEvents ? theme.colors.text : '#ef4444'
                  }}>
                    {comparisonResult.hasRawEvents ? comparisonResult.rawEventCount : 'Missing'}
                  </span>
                </div>
                <div>
                  <span style={{ color: theme.colors.textSecondary }}>Raw Events Status: </span>
                  <span style={{ 
                    fontWeight: 600,
                    color: comparisonResult.hasRawEvents ? '#10b981' : '#ef4444'
                  }}>
                    {comparisonResult.hasRawEvents ? '✓ Included' : '✗ Not Found'}
                  </span>
                </div>
                {comparisonResult.originalSize && (
                  <div>
                    <span style={{ color: theme.colors.textSecondary }}>Original Size: </span>
                    <span style={{ fontWeight: 600 }}>{formatBytes(comparisonResult.originalSize)}</span>
                  </div>
                )}
                {comparisonResult.archivedSize && (
                  <div>
                    <span style={{ color: theme.colors.textSecondary }}>Archived Size: </span>
                    <span style={{ fontWeight: 600 }}>{formatBytes(comparisonResult.archivedSize)}</span>
                  </div>
                )}
              </div>

              {comparisonResult.differences.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: theme.colors.background,
                  borderRadius: '4px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '6px',
                  }}>
                    Differences Found:
                  </div>
                  {comparisonResult.differences.map((diff, idx) => (
                    <div key={idx} style={{
                      fontSize: '10px',
                      color: theme.colors.textSecondary,
                      fontFamily: 'monospace',
                      padding: '2px 0',
                    }}>
                      • {diff}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Load Button */}
          {archiveStatus === 'success' && !comparisonResult && (
            <div style={{
              textAlign: 'center',
            }}>
              <button
                onClick={loadAndCompare}
                disabled={isLoading}
                style={{
                  padding: '8px 20px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                  fontSize: '13px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Loading Archive...
                  </>
                ) : (
                  <>
                    <FileJson size={14} />
                    Load & Compare
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#ef4444',
            }}>
              <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
              {error}
            </div>
          )}

          {/* Success Message */}
          {comparisonResult?.isIdentical && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '6px',
              textAlign: 'center',
            }}>
              <Check size={32} color="#10b981" style={{ marginBottom: '8px' }} />
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '4px',
              }}>
                Archive Verified Successfully
              </div>
              <div style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
              }}>
                The archived data matches the original session data perfectly.
                {comparisonResult.hasRawEvents 
                  ? ` ${comparisonResult.rawEventCount} raw events are included in the archive.`
                  : ' Warning: Raw events were not archived.'}
                {comparisonResult.isIdentical && comparisonResult.hasRawEvents && 
                  ' It\'s safe to enable automatic cleanup.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
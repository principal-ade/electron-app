import React from 'react';
import { X, Database, ChevronRight, FolderOpen, Archive, Info, Clock, HardDrive } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { APP_BRANDING } from '../../shared/config/appBranding';

interface ArchiveInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchiveInfoModal: React.FC<ArchiveInfoModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: theme.colors.background || theme.colors.backgroundPrimary,
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '700px',
        maxHeight: '85vh',
        overflow: 'auto',
        border: `1px solid ${theme.colors.border}`,
        position: 'relative',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={20} color={theme.colors.textSecondary} />
        </button>

        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Archive size={20} />
          Session Archiving & Storage
        </h2>

        {/* Visual Archiving Flow */}
        <div style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}>
            <div style={{
              textAlign: 'center',
              flex: 1,
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundPrimary,
                border: `2px solid ${theme.colors.primary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
              }}>
                <FolderOpen size={24} color={theme.colors.primary} />
              </div>
              <div style={{ fontWeight: 600, color: theme.colors.text }}>Active Sessions</div>
              <div style={{ fontSize: '10px', color: theme.colors.textSecondary }}>In memory</div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}>
              <Clock size={16} color={theme.colors.warning} />
              <ChevronRight size={20} color={theme.colors.textSecondary} />
              <span style={{ fontSize: '10px', color: theme.colors.textSecondary }}>24h inactive</span>
            </div>

            <div style={{
              textAlign: 'center',
              flex: 1,
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundPrimary,
                border: `2px solid ${theme.colors.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
              }}>
                <Archive size={24} color={theme.colors.accent} />
              </div>
              <div style={{ fontWeight: 600, color: theme.colors.text }}>Archived</div>
              <div style={{ fontSize: '10px', color: theme.colors.textSecondary }}>On disk</div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}>
              <Clock size={16} color={theme.colors.error} />
              <ChevronRight size={20} color={theme.colors.textSecondary} />
              <span style={{ fontSize: '10px', color: theme.colors.textSecondary }}>30 days</span>
            </div>

            <div style={{
              textAlign: 'center',
              flex: 1,
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundPrimary,
                border: `2px solid ${theme.colors.error}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
                opacity: 0.6,
              }}>
                <X size={24} color={theme.colors.error} />
              </div>
              <div style={{ fontWeight: 600, color: theme.colors.text }}>Deleted</div>
              <div style={{ fontSize: '10px', color: theme.colors.textSecondary }}>Permanent</div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.primary,
              marginBottom: '8px',
            }}>
              When Sessions Are Archived
            </h3>
            <p style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}>
              Sessions move from active memory to disk storage when:
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li><strong>Session ends:</strong> Stop event received + 5 second delay</li>
                <li><strong>Inactivity timeout:</strong> No events for 24 hours (configurable)</li>
                <li><strong>Manual trigger:</strong> "Archive All" button in settings</li>
                <li><strong>Storage pressure:</strong> When approaching storage limits</li>
              </ul>
            </p>
          </div>

          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.primary,
              marginBottom: '8px',
            }}>
              Archive Storage Structure
            </h3>
            <p style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}>
              <div style={{ marginTop: '12px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: theme.colors.text }}>Archive Location</strong>
                  <code style={{ 
                    display: 'block',
                    backgroundColor: theme.colors.backgroundSecondary, 
                    padding: '6px 10px', 
                    borderRadius: '4px',
                    marginTop: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}>
                    {`~/Library/Application Support/${APP_BRANDING.COMPANY_NAME}/archived-sessions/`}
                  </code>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: theme.colors.text }}>Directory Structure</strong>
                  <code style={{ 
                    display: 'block',
                    backgroundColor: theme.colors.backgroundSecondary, 
                    padding: '8px 10px', 
                    borderRadius: '4px',
                    marginTop: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                  }}>
                    [sessionId]_[YYYY-MM-DD]/<br/>
                    ├── metadata.json     <span style={{ color: theme.colors.textSecondary }}>// Summary & archive info</span><br/>
                    ├── session.json      <span style={{ color: theme.colors.textSecondary }}>// Processed session data</span><br/>
                    └── raw-events.json   <span style={{ color: theme.colors.textSecondary }}>// Original hook events</span>
                  </code>
                  <span style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginTop: '4px' }}>
                    Each session stored in its own directory for better organization
                  </span>
                </div>
              </div>
            </p>
          </div>

          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.primary,
              marginBottom: '8px',
            }}>
              What Gets Archived
            </h3>
            <p style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}>
              Each archive directory contains:
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li><strong>metadata.json:</strong> Session summary, timestamps, and archive info</li>
                <li><strong>session.json:</strong> Processed events with enriched data
                  <ul style={{ marginLeft: '20px', fontSize: '13px', marginTop: '4px' }}>
                    <li>Normalized events with timestamps</li>
                    <li>Session segments and activity counters</li>
                    <li>Repository access patterns</li>
                    <li>Tool usage statistics</li>
                  </ul>
                </li>
                <li><strong>raw-events.json:</strong> Original unprocessed hook events
                  <ul style={{ marginLeft: '20px', fontSize: '13px', marginTop: '4px' }}>
                    <li>Preserved for future reprocessing</li>
                    <li>Contains complete agent event data</li>
                    <li>Optionally excluded to save space</li>
                  </ul>
                </li>
              </ul>
            </p>
          </div>

          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.warning,
              marginBottom: '8px',
            }}>
              Data Retention Policy
            </h3>
            <div style={{ 
              padding: '12px',
              backgroundColor: `${theme.colors.warning}10`,
              borderRadius: '6px',
              border: `1px solid ${theme.colors.warning}30`,
            }}>
              <div style={{ marginBottom: '8px' }}>
                <HardDrive size={14} style={{ display: 'inline', marginRight: '6px' }} />
                <strong style={{ fontSize: '13px', color: theme.colors.text }}>Default Retention</strong>
              </div>
              <ul style={{ 
                fontSize: '12px', 
                color: theme.colors.textSecondary,
                paddingLeft: '20px',
                margin: '4px 0',
              }}>
                <li>Active sessions: Until archived</li>
                <li>Archive files: 30 days</li>
                <li>Session summaries: 7 days</li>
                <li>Total storage limit: 1GB</li>
              </ul>
              <div style={{ 
                marginTop: '8px',
                fontSize: '11px',
                color: theme.colors.textSecondary,
                fontStyle: 'italic',
              }}>
                All values configurable in Archive Settings
              </div>
            </div>
          </div>

          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.info || theme.colors.primary,
              marginBottom: '8px',
            }}>
              Accessing Archived Data
            </h3>
            <p style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}>
              <ul style={{ paddingLeft: '20px' }}>
                <li><strong>Store Viewer:</strong> Click archive count in pipeline view</li>
                <li><strong>Export:</strong> Use Archive Settings → Export options</li>
                <li><strong>Direct access:</strong> JSON files in archive directory</li>
                <li><strong>API:</strong> Available via IPC handlers for extensions</li>
              </ul>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
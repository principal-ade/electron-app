import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Archive,
  Clock,
  HardDrive,
  Package,
  Download,
  Info,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';

interface ArchiveConfiguration {
  autoArchive: {
    enabled: boolean;
    inactivityThreshold: number;
    completedSessionDelay: number;
    checkInterval: number;
  };
  storage: {
    maxArchiveAge: number;
    maxSummaryAge: number;
    maxArchiveSize: number;
    compressArchives: boolean;
  };
  sessions: {
    archiveIncompleteSessions: boolean;
    minEventsToArchive: number;
    keepRawEvents: boolean;
    groupByRepository: boolean;
  };
  export: {
    defaultFormat: 'json' | 'csv' | 'markdown';
    includeRawEvents: boolean;
    includeMetrics: boolean;
  };
}

interface ArchiveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchiveSettingsModal: React.FC<ArchiveSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<ArchiveConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [archiveStats, setArchiveStats] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfiguration();
      loadStatistics();
    }
  }, [isOpen]);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      const result = await AgentSessionArchiveService.getConfiguration();
      setConfig(result as any);
    } catch (error) {
      console.error('Failed to load archive configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await AgentSessionArchiveService.getStatistics();
      setArchiveStats(stats);
    } catch (error) {
      console.error('Failed to load archive statistics:', error);
    }
  };

  const saveConfiguration = async () => {
    if (!config) return;

    try {
      setIsSaving(true);
      await AgentSessionArchiveService.updateConfiguration(config as any);
      onClose();
    } catch (error) {
      console.error('Failed to save archive configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const archiveAllSessions = async () => {
    try {
      const result = await AgentSessionArchiveService.archiveAllSessions();
      if (result.success) {
        alert(`Archived ${result.archived} sessions`);
        loadStatistics();
      } else {
        alert(`Failed to archive sessions: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to archive all sessions:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.isDark
          ? 'rgba(0, 0, 0, 0.7)'
          : 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor:
            theme.colors.background || theme.colors.backgroundPrimary,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Archive size={26} />
            Archive Settings
          </h2>
          <button
            onClick={onClose}
            style={{
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
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} color={theme.colors.textSecondary} />
          </button>
        </div>

        {/* Statistics Bar */}
        {archiveStats && (
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              gap: '32px',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{ fontSize: '14px', color: theme.colors.textSecondary }}
              >
                Active Sessions:
              </span>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: theme.colors.primary,
                }}
              >
                {archiveStats.activeSessionCount}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{ fontSize: '14px', color: theme.colors.textSecondary }}
              >
                Archived:
              </span>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: theme.colors.accent,
                }}
              >
                {archiveStats.archivedSessionCount}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{ fontSize: '14px', color: theme.colors.textSecondary }}
              >
                Storage Used:
              </span>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                {Math.round(archiveStats.totalStorageUsed / 1024 / 1024)} MB
              </span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={archiveAllSessions}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.background,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Archive size={14} />
                Archive All Now
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: theme.colors.textSecondary,
              }}
            >
              Loading configuration...
            </div>
          ) : config ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
              }}
            >
              {/* Auto-Archive Column */}
              <div
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  padding: '20px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Clock size={20} />
                  Auto-Archiving
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.autoArchive.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          autoArchive: {
                            ...config.autoArchive,
                            enabled: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Enable auto-archiving
                    </span>
                  </label>

                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Inactivity threshold (hours)
                    </label>
                    <input
                      type="number"
                      value={config.autoArchive.inactivityThreshold}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          autoArchive: {
                            ...config.autoArchive,
                            inactivityThreshold: parseInt(e.target.value) || 24,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Check interval (minutes)
                    </label>
                    <input
                      type="number"
                      value={config.autoArchive.checkInterval}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          autoArchive: {
                            ...config.autoArchive,
                            checkInterval: parseInt(e.target.value) || 60,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Completed session delay (seconds)
                    </label>
                    <input
                      type="number"
                      value={config.autoArchive.completedSessionDelay}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          autoArchive: {
                            ...config.autoArchive,
                            completedSessionDelay:
                              parseInt(e.target.value) || 5,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Storage Management Column */}
              <div
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  padding: '20px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <HardDrive size={20} />
                  Storage Management
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Max archive age (days)
                    </label>
                    <input
                      type="number"
                      value={config.storage.maxArchiveAge}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          storage: {
                            ...config.storage,
                            maxArchiveAge: parseInt(e.target.value) || 30,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Max summary age (days)
                    </label>
                    <input
                      type="number"
                      value={config.storage.maxSummaryAge}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          storage: {
                            ...config.storage,
                            maxSummaryAge: parseInt(e.target.value) || 7,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Max archive size (MB)
                    </label>
                    <input
                      type="number"
                      value={config.storage.maxArchiveSize}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          storage: {
                            ...config.storage,
                            maxArchiveSize: parseInt(e.target.value) || 1000,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.storage.compressArchives}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          storage: {
                            ...config.storage,
                            compressArchives: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Compress archives
                    </span>
                  </label>
                </div>
              </div>

              {/* Session Handling Column */}
              <div
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  padding: '20px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Package size={20} />
                  Session Handling
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.sessions.archiveIncompleteSessions}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sessions: {
                            ...config.sessions,
                            archiveIncompleteSessions: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Archive incomplete sessions
                    </span>
                  </label>

                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Min events to archive
                    </label>
                    <input
                      type="number"
                      value={config.sessions.minEventsToArchive}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sessions: {
                            ...config.sessions,
                            minEventsToArchive: parseInt(e.target.value) || 5,
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    />
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.sessions.keepRawEvents}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sessions: {
                            ...config.sessions,
                            keepRawEvents: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Include raw events in archives
                    </span>
                  </label>
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginLeft: '26px',
                      marginTop: '-8px',
                      display: 'block',
                      opacity: 0.8,
                    }}
                  >
                    Preserves original data for future reprocessing
                  </span>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.sessions.groupByRepository}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          sessions: {
                            ...config.sessions,
                            groupByRepository: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Group by repository
                    </span>
                  </label>
                </div>
              </div>

              {/* Export Settings Column */}
              <div
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  padding: '20px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Download size={20} />
                  Export Settings
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Default format
                    </label>
                    <select
                      value={config.export.defaultFormat}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          export: {
                            ...config.export,
                            defaultFormat: e.target.value as
                              | 'json'
                              | 'csv'
                              | 'markdown',
                          },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.text,
                      }}
                    >
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                      <option value="markdown">Markdown</option>
                    </select>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.export.includeRawEvents}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          export: {
                            ...config.export,
                            includeRawEvents: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Include raw events
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.export.includeMetrics}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          export: {
                            ...config.export,
                            includeMetrics: e.target.checked,
                          },
                        })
                      }
                    />
                    <span
                      style={{ fontSize: '15px', color: theme.colors.text }}
                    >
                      Include metrics
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: theme.colors.textSecondary,
              }}
            >
              Failed to load configuration
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Info size={16} />
            Changes will take effect immediately
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveConfiguration}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                fontSize: '15px',
                fontWeight: 500,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

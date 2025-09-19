import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { X, Save, RotateCcw } from 'lucide-react';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';

interface ArchiveConfiguration {
  autoArchive: {
    enabled: boolean;
    inactivityThreshold: number; // hours
    completedSessionDelay: number; // seconds
    checkInterval: number; // minutes
  };
  storage: {
    maxArchiveAge: number; // days
    maxSummaryAge: number; // days
    maxArchiveSize: number; // MB
    compressArchives: boolean;
  };
  sessions: {
    archiveIncompleteSessions: boolean;
    minEventsToArchive: number;
    keepRawEvents: boolean;
    groupByRepository: boolean;
  };
  export: {
    defaultFormat: string;
    includeRawEvents: boolean;
    includeMetrics: boolean;
  };
}

interface AgentSessionArchiveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentSessionArchiveConfigModal: React.FC<
  AgentSessionArchiveConfigModalProps
> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<ArchiveConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current configuration
  useEffect(() => {
    if (isOpen) {
      loadConfiguration();
    }
  }, [isOpen]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      // Get configuration from main process
      const currentConfig = await AgentSessionArchiveService.getConfiguration();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load archive configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      // Save configuration to main process
      await AgentSessionArchiveService.updateConfiguration(config);
      onClose();
    } catch (error) {
      console.error('Failed to save archive configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      // Reset to default configuration
      await AgentSessionArchiveService.resetConfiguration();
      await loadConfiguration();
    } catch (error) {
      console.error('Failed to reset configuration:', error);
    } finally {
      setLoading(false);
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Archive Configuration
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: theme.colors.textSecondary,
              }}
            >
              Loading configuration...
            </div>
          ) : config ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
              {/* Auto-Archive Settings */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '12px',
                  }}
                >
                  Auto-Archive Settings
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.text,
                      fontSize: '13px',
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
                    Enable auto-archiving
                  </label>

                  <div
                    style={{
                      marginLeft: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: theme.colors.textSecondary,
                        fontSize: '13px',
                      }}
                    >
                      Inactivity threshold:
                      <input
                        type="number"
                        min="1"
                        value={config.autoArchive.inactivityThreshold}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            autoArchive: {
                              ...config.autoArchive,
                              inactivityThreshold:
                                parseInt(e.target.value) || 24,
                            },
                          })
                        }
                        disabled={!config.autoArchive.enabled}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          backgroundColor: theme.colors.backgroundSecondary,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px',
                          color: theme.colors.text,
                        }}
                      />
                      hours
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: theme.colors.textSecondary,
                        fontSize: '13px',
                      }}
                    >
                      Check interval:
                      <input
                        type="number"
                        min="1"
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
                        disabled={!config.autoArchive.enabled}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          backgroundColor: theme.colors.backgroundSecondary,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px',
                          color: theme.colors.text,
                        }}
                      />
                      minutes
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: theme.colors.textSecondary,
                        fontSize: '13px',
                      }}
                    >
                      Completed session delay:
                      <input
                        type="number"
                        min="0"
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
                        disabled={!config.autoArchive.enabled}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          backgroundColor: theme.colors.backgroundSecondary,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '4px',
                          color: theme.colors.text,
                        }}
                      />
                      seconds
                    </label>
                  </div>
                </div>
              </div>

              {/* Storage Settings */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '12px',
                  }}
                >
                  Storage Settings
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.textSecondary,
                      fontSize: '13px',
                    }}
                  >
                    Max archive age:
                    <input
                      type="number"
                      min="1"
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
                        width: '60px',
                        padding: '4px 8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        color: theme.colors.text,
                      }}
                    />
                    days
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.textSecondary,
                      fontSize: '13px',
                    }}
                  >
                    Max archive size:
                    <input
                      type="number"
                      min="100"
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
                        width: '80px',
                        padding: '4px 8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        color: theme.colors.text,
                      }}
                    />
                    MB
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.text,
                      fontSize: '13px',
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
                    Compress archives
                  </label>
                </div>
              </div>

              {/* Session Settings */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '12px',
                  }}
                >
                  Session Settings
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.textSecondary,
                      fontSize: '13px',
                    }}
                  >
                    Minimum events to archive:
                    <input
                      type="number"
                      min="0"
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
                        width: '60px',
                        padding: '4px 8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        color: theme.colors.text,
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.text,
                      fontSize: '13px',
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
                    Archive incomplete sessions
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.text,
                      fontSize: '13px',
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
                    Keep raw events in archives
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
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
            padding: '20px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={handleReset}
            disabled={loading || saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.textSecondary,
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading || saving ? 'not-allowed' : 'pointer',
              opacity: loading || saving ? 0.5 : 1,
            }}
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                color: theme.colors.text,
                fontSize: '13px',
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1,
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={loading || saving || !config}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: theme.colors.primary,
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                cursor:
                  loading || saving || !config ? 'not-allowed' : 'pointer',
                opacity: loading || saving || !config ? 0.5 : 1,
              }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

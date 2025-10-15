import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ExternalLink, FolderOpen, Edit2 } from 'lucide-react';
import {
  ObservabilityService,
  ObservabilityConfig,
  ConnectionTestResult,
  StorageMode,
} from '../../../../main-process-api/ObservabilityService';

export const ObservabilitySettings: React.FC = () => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<ObservabilityConfig>({
    storageMode: 'none',
    tursoUrl: '',
    tursoAuthToken: '',
    syncInterval: 5000,
    enabled: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dbPath, setDbPath] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedConfig = await ObservabilityService.getConfiguration();
      setConfig(loadedConfig);

      // Load DB path if configured
      if (loadedConfig.storageMode !== 'none') {
        try {
          const path = await ObservabilityService.getDbPath();
          setDbPath(path);
        } catch {
          // DB path not available yet
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setTestResult(null);
    setSaveSuccess(false);
    try {
      const configToSave = {
        ...config,
        enabled: config.storageMode !== 'none',
      };
      await ObservabilityService.saveConfiguration(configToSave);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadConfiguration(); // Reload to get DB path
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const configToTest = {
        ...config,
        enabled: config.storageMode !== 'none',
      };
      const result = await ObservabilityService.testConnection(configToTest);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleOpenInFinder = async () => {
    try {
      await ObservabilityService.openDbInFinder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open in Finder');
    }
  };

  const isValidTursoUrl = (url: string): boolean => {
    if (!url) return false;
    return (
      url.startsWith('libsql://') ||
      url.startsWith('wss://') ||
      url.startsWith('https://')
    );
  };

  const canSave =
    config.storageMode === 'none' ||
    config.storageMode === 'local' ||
    (config.storageMode === 'local-with-sync' && config.tursoUrl && isValidTursoUrl(config.tursoUrl));

  const canTest =
    config.storageMode === 'local' ||
    (config.storageMode === 'local-with-sync' && config.tursoUrl && isValidTursoUrl(config.tursoUrl));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader2 size={32} className="animate-spin" color={theme.colors.primary} />
      </div>
    );
  }

  // Display mode
  if (!isEditing) {
    return (
      <>
        <style>
          {`
            .observability-button:hover {
              opacity: 0.9;
            }
          `}
        </style>
        <div style={{ maxWidth: '800px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Observability Configuration
            </h3>
            <p style={{
              marginTop: 0,
              marginBottom: '24px',
              color: theme.colors.textSecondary,
              fontSize: '14px',
            }}>
              Configure how agent event data is stored and tracked.
            </p>

            {/* Display based on storage mode */}
            {config.storageMode === 'none' ? (
              // Not configured
              <div style={{
                padding: '32px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <AlertCircle size={48} color={theme.colors.textSecondary} style={{ marginBottom: '16px' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                  Observability Not Configured
                </h4>
                <p style={{ color: theme.colors.textSecondary, marginBottom: '24px' }}>
                  Set up observability to track and analyze agent activity.
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="observability-button"
                  style={{
                    padding: '10px 24px',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  Configure Observability
                </button>
              </div>
            ) : (
              // Configured - show details
              <div>
                <div style={{
                  padding: '20px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                      Storage Mode
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {config.storageMode === 'local' ? 'Local Only' : 'Local with Cloud Sync'}
                    </div>
                    <div style={{ fontSize: '14px', color: theme.colors.textSecondary, marginTop: '4px' }}>
                      {config.storageMode === 'local'
                        ? 'Data stored locally in SQLite database'
                        : 'Local database syncing to Turso cloud'}
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                      Local Database
                    </div>
                    {dbPath ? (
                      <>
                        <div style={{
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          color: theme.colors.text,
                          marginBottom: '8px',
                          wordBreak: 'break-all',
                        }}>
                          {dbPath}
                        </div>
                        <button
                          onClick={handleOpenInFinder}
                          className="observability-button"
                          style={{
                            padding: '8px 16px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            color: theme.colors.text,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <FolderOpen size={14} />
                          Open in Finder
                        </button>
                      </>
                    ) : (
                      <div style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        fontStyle: 'italic',
                      }}>
                        Database path not available
                      </div>
                    )}
                  </div>

                  {config.storageMode === 'local-with-sync' && (
                    <div>
                      <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                        Cloud Database
                      </div>
                      <a
                        href="https://app.turso.tech/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          color: theme.colors.primary,
                          textDecoration: 'none',
                        }}
                      >
                        Open Turso Dashboard
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsEditing(true)}
                  className="observability-button"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Edit2 size={16} />
                  Edit Configuration
                </button>
              </div>
            )}

            {/* Success message */}
            {saveSuccess && (
              <div style={{
                padding: '12px',
                backgroundColor: theme.colors.success + '20',
                border: `1px solid ${theme.colors.success}40`,
                borderRadius: '8px',
                marginTop: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <CheckCircle size={16} color={theme.colors.success} style={{ marginTop: '2px' }} />
                <span style={{ fontSize: '14px', color: theme.colors.success }}>
                  Configuration saved successfully!
                </span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: theme.colors.error + '20',
                border: `1px solid ${theme.colors.error}40`,
                borderRadius: '8px',
                marginTop: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <AlertCircle size={16} color={theme.colors.error} style={{ marginTop: '2px' }} />
                <span style={{ fontSize: '14px', color: theme.colors.error }}>
                  {error}
                </span>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Edit mode (existing form)
  return (
    <>
      <style>
        {`
          .observability-input:focus {
            outline: none;
            border-color: ${theme.colors.primary};
            box-shadow: 0 0 0 3px ${theme.colors.primary}20;
          }
          .observability-select:focus {
            outline: none;
            border-color: ${theme.colors.primary};
            box-shadow: 0 0 0 3px ${theme.colors.primary}20;
          }
        `}
      </style>
      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              Edit Observability Configuration
            </h3>
            <button
              onClick={() => {
                setIsEditing(false);
                setError(null);
                setTestResult(null);
                loadConfiguration(); // Reset form
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          <p style={{
            marginTop: 0,
            marginBottom: '24px',
            color: theme.colors.textSecondary,
            fontSize: '14px',
          }}>
            Configure how agent event data is stored and tracked.
          </p>

          {/* Storage Mode Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 500,
            }}>
              Storage Mode
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '12px',
                border: `1px solid ${config.storageMode === 'none' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '8px',
                backgroundColor: config.storageMode === 'none' ? theme.colors.primary + '10' : 'transparent',
              }}>
                <input
                  type="radio"
                  name="storageMode"
                  checked={config.storageMode === 'none'}
                  onChange={() => setConfig({ ...config, storageMode: 'none' })}
                  style={{ marginRight: '8px', marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>None</div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginTop: '4px' }}>
                    Disable observability tracking completely
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '12px',
                border: `1px solid ${config.storageMode === 'local' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '8px',
                backgroundColor: config.storageMode === 'local' ? theme.colors.primary + '10' : 'transparent',
              }}>
                <input
                  type="radio"
                  name="storageMode"
                  checked={config.storageMode === 'local'}
                  onChange={() => setConfig({ ...config, storageMode: 'local' })}
                  style={{ marginRight: '8px', marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Local</div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginTop: '4px' }}>
                    Store data locally in SQLite database (offline, privacy-focused)
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '12px',
                border: `1px solid ${config.storageMode === 'local-with-sync' ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '8px',
                backgroundColor: config.storageMode === 'local-with-sync' ? theme.colors.primary + '10' : 'transparent',
              }}>
                <input
                  type="radio"
                  name="storageMode"
                  checked={config.storageMode === 'local-with-sync'}
                  onChange={() => setConfig({ ...config, storageMode: 'local-with-sync' })}
                  style={{ marginRight: '8px', marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Local with Cloud Sync</div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginTop: '4px' }}>
                    Local database with background sync to Turso cloud (best of both worlds)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Turso Database URL - only for local-with-sync mode */}
          {config.storageMode === 'local-with-sync' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
              }}>
                Turso Database URL
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showUrl ? 'text' : 'password'}
                  value={config.tursoUrl ?? ''}
                  onChange={(e) => setConfig({ ...config, tursoUrl: e.target.value })}
                  placeholder="libsql://[database]-[org].turso.io"
                  className="observability-input"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: `1px solid ${
                      config.tursoUrl && !isValidTursoUrl(config.tursoUrl)
                        ? theme.colors.error
                        : theme.colors.border
                    }`,
                    borderRadius: '8px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    fontSize: '14px',
                    transition: 'all 0.2s',
                  }}
                />
                <button
                  onClick={() => setShowUrl(!showUrl)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showUrl ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {config.tursoUrl && !isValidTursoUrl(config.tursoUrl) && (
                <p style={{
                  color: theme.colors.error,
                  fontSize: '12px',
                  marginTop: '4px',
                }}>
                  Please enter a valid Turso URL (libsql://, wss://, or https://)
                </p>
              )}
              <p style={{
                color: theme.colors.textSecondary,
                fontSize: '12px',
                marginTop: '4px',
              }}>
                Your Turso database URL from the Turso dashboard
              </p>
            </div>
          )}

          {/* Turso Auth Token - only for local-with-sync mode */}
          {config.storageMode === 'local-with-sync' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
              }}>
                Turso Auth Token
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAuthToken ? 'text' : 'password'}
                  value={config.tursoAuthToken ?? ''}
                  onChange={(e) => setConfig({ ...config, tursoAuthToken: e.target.value })}
                  placeholder="Your Turso database auth token"
                  className="observability-input"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    fontSize: '14px',
                    transition: 'all 0.2s',
                  }}
                />
                {config.tursoAuthToken && (
                  <button
                    onClick={() => setShowAuthToken(!showAuthToken)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '4px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showAuthToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
              <p style={{
                color: theme.colors.textSecondary,
                fontSize: '12px',
                marginTop: '4px',
              }}>
                Get this from your Turso dashboard under "Database Tokens"
              </p>
            </div>
          )}

          {/* Sync Interval - only for local-with-sync mode */}
          {config.storageMode === 'local-with-sync' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
              }}>
                Sync Interval (milliseconds)
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={config.syncInterval ?? 5000}
                onChange={(e) =>
                  setConfig({ ...config, syncInterval: parseInt(e.target.value) || 5000 })
                }
                placeholder="5000"
                className="observability-input"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: '14px',
                  transition: 'all 0.2s',
                }}
              />
              <p style={{
                color: theme.colors.textSecondary,
                fontSize: '12px',
                marginTop: '4px',
              }}>
                How often to sync local data to cloud (in milliseconds, e.g., 5000 = 5 seconds)
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: theme.colors.error + '20',
              border: `1px solid ${theme.colors.error}40`,
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}>
              <AlertCircle size={16} color={theme.colors.error} style={{ marginTop: '2px' }} />
              <span style={{ fontSize: '14px', color: theme.colors.error }}>
                {error}
              </span>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: '12px',
              backgroundColor: testResult.success
                ? theme.colors.success + '20'
                : theme.colors.error + '20',
              border: `1px solid ${
                testResult.success ? theme.colors.success : theme.colors.error
              }40`,
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}>
              {testResult.success ? (
                <CheckCircle size={16} color={theme.colors.success} style={{ marginTop: '2px' }} />
              ) : (
                <AlertCircle size={16} color={theme.colors.error} style={{ marginTop: '2px' }} />
              )}
              <span style={{
                fontSize: '14px',
                color: testResult.success ? theme.colors.success : theme.colors.error,
              }}>
                {testResult.success
                  ? 'Connection successful! The database is accessible.'
                  : `Connection failed: ${testResult.error || 'Unknown error'}`}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleTest}
              disabled={!canTest || testing || saving}
              style={{
                padding: '10px 20px',
                backgroundColor: theme.colors.backgroundSecondary,
                color: canTest ? theme.colors.text : theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: canTest && !testing && !saving ? 'pointer' : 'not-allowed',
                opacity: canTest && !testing && !saving ? 1 : 0.5,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {testing && <Loader2 size={14} className="animate-spin" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              onClick={handleSave}
              disabled={!canSave || saving || testing}
              style={{
                padding: '10px 20px',
                backgroundColor: canSave
                  ? theme.colors.primary
                  : theme.colors.backgroundSecondary,
                color: canSave ? '#fff' : theme.colors.textSecondary,
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: canSave && !saving && !testing ? 'pointer' : 'not-allowed',
                opacity: canSave && !saving && !testing ? 1 : 0.5,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

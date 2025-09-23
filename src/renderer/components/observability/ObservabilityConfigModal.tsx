import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  Activity,
  X,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  ObservabilityService,
  ObservabilityConfig,
  ConnectionTestResult,
} from '../../main-process-api/ObservabilityService';

interface ObservabilityConfigModalProps {
  open: boolean;
  onClose: () => void;
}

export const ObservabilityConfigModal: React.FC<ObservabilityConfigModalProps> = ({
  open,
  onClose,
}) => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<ObservabilityConfig>({
    tursoUrl: '',
    tursoAuthToken: '',
    environment: 'development',
    enabled: false,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);

  useEffect(() => {
    if (open) {
      loadConfiguration();
    }
  }, [open]);

  const loadConfiguration = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedConfig = await ObservabilityService.getConfiguration();
      setConfig(loadedConfig);
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
    try {
      await ObservabilityService.saveConfiguration(config);
      onClose();
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
      const result = await ObservabilityService.testConnection(config);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    if (!saving && !testing) {
      onClose();
    }
  };

  const isValidTursoUrl = (url: string): boolean => {
    if (!url) return false;
    // Turso URLs typically look like: libsql://[database]-[org].turso.io or wss://[database]-[org].turso.io
    return url.startsWith('libsql://') || url.startsWith('wss://') || url.startsWith('https://');
  };

  const canSave = config.tursoUrl && isValidTursoUrl(config.tursoUrl);
  const canTest = config.tursoUrl && isValidTursoUrl(config.tursoUrl);

  if (!open) return null;

  return (
    <>
      <style>
        {`
          .observability-input:focus {
            outline: none;
            border-color: ${theme.colors.primary};
            box-shadow: 0 0 0 3px ${theme.colors.primary}20;
          }

          .observability-checkbox {
            width: 16px;
            height: 16px;
            margin-right: 8px;
            cursor: pointer;
          }

          .observability-select:focus {
            outline: none;
            border-color: ${theme.colors.primary};
            box-shadow: 0 0 0 3px ${theme.colors.primary}20;
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
        onClick={handleClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            width: '90%',
            maxWidth: '600px',
            margin: '0 16px',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color={theme.colors.text} />
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
                Observability Configuration
              </h2>
            </div>
            <button
              onClick={handleClose}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={20} color={theme.colors.text} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '60vh' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={32} className="animate-spin" color={theme.colors.primary} />
              </div>
            ) : (
              <>
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: '24px',
                    color: theme.colors.textSecondary,
                    fontSize: '14px',
                  }}
                >
                  Configure the connection to your Turso database for agent event tracking.
                </p>

                {/* Enable toggle */}
                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                      className="observability-checkbox"
                    />
                    <span style={{ fontWeight: 500 }}>Enable Observability</span>
                  </label>
                </div>

                {/* Turso Database URL */}
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Turso Database URL
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showUrl ? 'text' : 'password'}
                      value={config.tursoUrl || ''}
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
                    <p style={{ color: theme.colors.error, fontSize: '12px', marginTop: '4px' }}>
                      Please enter a valid Turso URL (libsql://, wss://, or https://)
                    </p>
                  )}
                  <p style={{ color: theme.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
                    Your Turso database URL from the Turso dashboard
                  </p>
                </div>

                {/* Turso Auth Token */}
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Turso Auth Token
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAuthToken ? 'text' : 'password'}
                      value={config.tursoAuthToken || ''}
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
                  <p style={{ color: theme.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
                    Get this from your Turso dashboard under "Database Tokens"
                  </p>
                </div>

                {/* Environment */}
                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    Environment
                  </label>
                  <select
                    value={config.environment || 'development'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        environment: e.target.value as 'development' | 'staging' | 'production',
                      })
                    }
                    className="observability-select"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      color: theme.colors.text,
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                {/* Error message */}
                {error && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: theme.colors.error + '20',
                      border: `1px solid ${theme.colors.error}40`,
                      borderRadius: '8px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={16} color={theme.colors.error} style={{ marginTop: '2px' }} />
                    <span style={{ fontSize: '14px', color: theme.colors.error }}>{error}</span>
                  </div>
                )}

                {/* Test result */}
                {testResult && (
                  <div
                    style={{
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
                    }}
                  >
                    {testResult.success ? (
                      <CheckCircle size={16} color={theme.colors.success} style={{ marginTop: '2px' }} />
                    ) : (
                      <AlertCircle size={16} color={theme.colors.error} style={{ marginTop: '2px' }} />
                    )}
                    <span
                      style={{
                        fontSize: '14px',
                        color: testResult.success ? theme.colors.success : theme.colors.error,
                      }}
                    >
                      {testResult.success
                        ? 'Connection successful! The database is accessible.'
                        : `Connection failed: ${testResult.error || 'Unknown error'}`}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <button
              onClick={handleTest}
              disabled={!canTest || testing || saving || loading}
              style={{
                padding: '8px 16px',
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

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleClose}
                disabled={saving || testing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: saving || testing ? 'not-allowed' : 'pointer',
                  opacity: saving || testing ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving || testing || loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: canSave ? theme.colors.primary : theme.colors.backgroundSecondary,
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
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
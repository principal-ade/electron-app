import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Sparkles, Info } from 'lucide-react';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { getTracer } from '../../../../telemetry';
import type { Span } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';

const tracer = getTracer('principal-ade-principal-window');

export const UpdatesSettings: React.FC = () => {
  const { theme } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [isDevMode, setIsDevMode] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const isDownloadingRef = useRef(false);
  const isDownloadedRef = useRef(false);

  // UI workflow span - active while settings panel is open
  const uiSpanRef = useRef<Span | null>(null);

  useEffect(() => {
    isDownloadingRef.current = isDownloading;
  }, [isDownloading]);

  useEffect(() => {
    isDownloadedRef.current = isDownloaded;
  }, [isDownloaded]);

  useEffect(() => {
    // Start UI workflow span when settings opens
    uiSpanRef.current = tracer.startSpan('app_updates.ui');

    // Get version info and emit settings opened event
    AppVersionManagerService.getVersion().then((version) => {
      setCurrentVersion(version);
      AppVersionManagerService.isDevMode().then((devMode) => {
        setIsDevMode(devMode);
        uiSpanRef.current?.addEvent('app_updates.ui.settings_opened', {
          current_version: version,
          is_dev_mode: devMode,
        });
      });
    });

    const handleUpdateAvailable = (info: { version: string }) => {
      // If update is already downloaded, don't reset the downloaded state
      if (isDownloadedRef.current) {
        setIsChecking(false);
        return;
      }
      setUpdateAvailable(true);
      setAvailableVersion(info.version);
      setUpdateStatus(`Update available: v${info.version}`);
      setLastCheck(new Date());
      setIsChecking(false);
      setIsDownloaded(false);
      isDownloadedRef.current = false;
      setDownloadProgress(0);
      setDownloadError(null);
    };

    const handleUpdateNotAvailable = () => {
      if (isDownloadedRef.current) {
        return;
      }
      setUpdateAvailable(false);
      setAvailableVersion(null);
      setUpdateStatus('You have the latest version');
      setLastCheck(new Date());
      setIsChecking(false);
    };

    const handleUpdateError = (
      err: Error | { message?: string; toString(): string },
    ) => {
      const errorMessage = parseUpdateError(err);

      // Emit error displayed event
      uiSpanRef.current?.addEvent('app_updates.ui.error_displayed', {
        error_type: isDownloadingRef.current ? 'download' : 'check',
        user_message: errorMessage,
      });

      if (isDownloadingRef.current) {
        setDownloadError(errorMessage);
        setIsDownloading(false);
        setUpdateStatus('Download failed');
      } else {
        setUpdateAvailable(false);
        setAvailableVersion(null);
        setUpdateStatus(`Error: ${errorMessage}`);
      }
      setIsChecking(false);
    };

    const handleUpdateDownloadProgress = (progress: {
      percent?: number;
      transferred?: number;
      total?: number;
    }) => {
      const derivedPercent =
        typeof progress.percent === 'number'
          ? progress.percent
          : progress.total
            ? ((progress.transferred || 0) / progress.total) * 100
            : 0;

      // Emit progress updated event (throttled to 25% increments to reduce noise)
      if (Math.floor(derivedPercent) % 25 === 0 && derivedPercent > 0) {
        uiSpanRef.current?.addEvent('app_updates.ui.progress_updated', {
          percent: derivedPercent,
        });
      }

      setDownloadProgress(Math.max(0, Math.min(100, derivedPercent)));
      setIsDownloading(true);
      setUpdateStatus('Downloading update...');
    };

    const handleUpdateDownloaded = () => {
      setIsDownloaded(true);
      isDownloadedRef.current = true;
      setIsDownloading(false);
      setDownloadProgress(100);
      setUpdateStatus('Update downloaded successfully');
    };

    const handleUpdateCheckComplete = () => {
      setIsChecking(false);
    };

    const unsubscribe = [
      AppVersionManagerService.onUpdateAvailable(handleUpdateAvailable),
      AppVersionManagerService.onUpdateNotAvailable(handleUpdateNotAvailable),
      AppVersionManagerService.onUpdateError(handleUpdateError),
      AppVersionManagerService.onUpdateDownloadProgress(
        handleUpdateDownloadProgress,
      ),
      AppVersionManagerService.onUpdateDownloaded(handleUpdateDownloaded),
      AppVersionManagerService.onUpdateCheckComplete(handleUpdateCheckComplete),
    ];

    // Start silent update check
    setIsChecking(true);
    AppVersionManagerService.checkForUpdateSilently();

    return () => {
      unsubscribe.forEach((fn) => fn());
      // End UI workflow span when settings closes
      if (uiSpanRef.current) {
        uiSpanRef.current.setStatus({ code: SpanStatusCode.OK });
        uiSpanRef.current.end();
        uiSpanRef.current = null;
      }
    };
  }, []);

  const parseUpdateError = (
    err: Error | { message?: string; toString(): string },
  ): string => {
    let errorMessage = err.message || err.toString();

    if (
      errorMessage.includes('ENOENT') ||
      errorMessage.includes('no such file')
    ) {
      return 'Update file not found. The update server may be temporarily unavailable.';
    } else if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('connect')
    ) {
      return 'Cannot connect to update server. Please check your internet connection.';
    } else if (errorMessage.includes('ETIMEDOUT')) {
      return 'Update server timeout. Please try again later.';
    } else if (
      errorMessage.includes('403') ||
      errorMessage.includes('Forbidden')
    ) {
      return 'Access denied. The update may not be available for your platform.';
    } else if (
      errorMessage.includes('404') ||
      errorMessage.includes('Not Found')
    ) {
      return 'Update not found. There may be no update available for your version.';
    } else if (
      errorMessage.includes('CERT') ||
      errorMessage.includes('certificate')
    ) {
      return 'Certificate error. Please check your system date/time or proxy settings.';
    } else if (
      errorMessage.includes('sha512') ||
      errorMessage.includes('checksum')
    ) {
      return 'Update verification failed. The update file may be corrupted or the server configuration may be incorrect.';
    }
    return errorMessage;
  };

  const checkForUpdates = () => {
    // Emit user check requested event
    uiSpanRef.current?.addEvent('app_updates.user.check_requested', {
      trigger: 'manual',
    });

    setIsChecking(true);
    setUpdateStatus(null);
    setDownloadError(null);
    AppVersionManagerService.checkForUpdate();
  };

  const downloadUpdate = () => {
    // Emit user download requested event
    uiSpanRef.current?.addEvent('app_updates.user.download_requested', {
      available_version: availableVersion || '',
    });

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress(0);
    setUpdateStatus('Downloading update...');
    AppVersionManagerService.downloadUpdate();
  };

  const installUpdate = () => {
    // Emit user install requested event
    uiSpanRef.current?.addEvent('app_updates.user.install_requested', {
      version: availableVersion || '',
    });

    setUpdateStatus('Installing update...');
    AppVersionManagerService.installUpdate();
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      {/* Current Version */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  margin: '0 0 8px 0',
                }}
              >
                Current Version
              </h4>
              <p
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: theme.colors.primary,
                  margin: 0,
                }}
              >
                v{currentVersion}
              </p>
              {lastCheck && (
                <p
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    marginTop: '8px',
                  }}
                >
                  Last checked: {lastCheck.toLocaleTimeString()}
                </p>
              )}
            </div>
            <button
              onClick={checkForUpdates}
              disabled={isChecking}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: isChecking
                  ? theme.colors.backgroundTertiary
                  : theme.colors.primary,
                color: isChecking
                  ? theme.colors.textSecondary
                  : theme.colors.background,
                border: 'none',
                borderRadius: '8px',
                cursor: isChecking ? 'not-allowed' : 'pointer',
                opacity: isChecking ? 0.5 : 1,
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                if (!isChecking) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <RefreshCw
                size={16}
                style={
                  isChecking ? { animation: 'spin 1s linear infinite' } : {}
                }
              />
              {isChecking ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>

          {updateStatus && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: updateStatus.includes('available')
                  ? `${theme.colors.warning}15`
                  : updateStatus.includes('Error')
                    ? `${theme.colors.error}15`
                    : `${theme.colors.success}15`,
                borderRadius: '8px',
                border: `1px solid ${
                  updateStatus.includes('available')
                    ? theme.colors.warning + '30'
                    : updateStatus.includes('Error')
                      ? theme.colors.error + '30'
                      : theme.colors.success + '30'
                }`,
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  margin: 0,
                  color: updateStatus.includes('available')
                    ? theme.colors.warning
                    : updateStatus.includes('Error')
                      ? theme.colors.error
                      : theme.colors.success,
                }}
              >
                {updateStatus}
              </p>
            </div>
          )}

          {/* Update Available Section */}
          {updateAvailable && availableVersion && (
            <div
              style={{
                marginTop: '20px',
                padding: '20px',
                backgroundColor: `${theme.colors.warning}10`,
                border: `2px solid ${theme.colors.warning}`,
                borderRadius: '12px',
              }}
            >
              <h4
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  margin: '0 0 16px 0',
                  color: theme.colors.warning,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={20} />
                New Version Available!
              </h4>

              <div style={{ marginBottom: '20px' }}>
                <p
                  style={{
                    fontSize: '14px',
                    margin: '0 0 8px 0',
                    color: theme.colors.text,
                  }}
                >
                  <strong>Current:</strong> v{currentVersion} →{' '}
                  <strong>Available:</strong> v{availableVersion}
                </p>
              </div>

              {isDevMode ? (
                <div>
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '8px',
                      marginBottom: '12px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '13px',
                        margin: 0,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      <Info
                        size={14}
                        style={{
                          display: 'inline',
                          marginRight: '6px',
                          verticalAlign: 'text-bottom',
                        }}
                      />
                      Development mode: Updates are detected but not
                      automatically downloaded.
                    </p>
                  </div>
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: theme.colors.warning,
                      color: theme.colors.background,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      uiSpanRef.current?.addEvent('app_updates.user.download_requested', {
                        available_version: availableVersion,
                        test_mode: true,
                      });
                      setIsDownloading(true);
                      setDownloadError(null);
                      setDownloadProgress(0);
                      setUpdateStatus(
                        "Test downloading update (won't auto-install)...",
                      );
                      AppVersionManagerService.testDownloadUpdate();
                    }}
                    disabled={isDownloading || !updateAvailable}
                  >
                    Test Download (No Auto-Install)
                  </button>
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      marginLeft: '12px',
                    }}
                    onClick={() => {
                      uiSpanRef.current?.addEvent('app_updates.user.test_goodbye_screen');
                      AppVersionManagerService.testGoodbyeScreen();
                    }}
                  >
                    Test Goodbye Screen
                  </button>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      style={{
                        padding: '10px 20px',
                        backgroundColor: isDownloaded
                          ? theme.colors.success
                          : isDownloading
                            ? theme.colors.backgroundTertiary
                            : theme.colors.warning,
                        color: isDownloading
                          ? theme.colors.textSecondary
                          : theme.colors.background,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        opacity: isDownloading ? 0.7 : 1,
                        transition: 'all 0.2s',
                      }}
                      onClick={isDownloaded ? installUpdate : downloadUpdate}
                      disabled={isDownloading}
                    >
                      {isDownloading
                        ? `Downloading... ${Math.round(downloadProgress)}%`
                        : isDownloaded
                          ? 'Install & Restart'
                          : 'Download Update'}
                    </button>
                    <span
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {isDownloaded
                        ? 'Ready to install'
                        : 'The app will restart after installation'}
                    </span>
                  </div>

                  {isDownloading && (
                    <div
                      style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginTop: '12px',
                      }}
                    >
                      <div
                        style={{
                          width: `${downloadProgress}%`,
                          height: '100%',
                          backgroundColor: theme.colors.primary,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}

                  {downloadError && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: `${theme.colors.error}15`,
                        border: `1px solid ${theme.colors.error}30`,
                        borderRadius: '8px',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '13px',
                          margin: 0,
                          color: theme.colors.error,
                        }}
                      >
                        {downloadError}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Auto-update info */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 600,
            margin: '0 0 12px 0',
          }}
        >
          Automatic Updates
        </h4>
        <p
          style={{
            fontSize: '14px',
            margin: 0,
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          The application checks for updates on startup and every hour while
          running. Updates are downloaded automatically and you'll be prompted
          to restart when ready.
        </p>
      </div>
    </div>
  );
};

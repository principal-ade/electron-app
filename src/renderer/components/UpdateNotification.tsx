import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { AppVersionManagerService } from '../main-process-api/AppVersionManagerService';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseName?: string;
}

interface UpdateNotificationProps {
  style?: React.CSSProperties;
  onUpdateAvailable?: (hasUpdate: boolean) => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  style,
  onUpdateAvailable,
}) => {
  const { theme } = useTheme();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [bannerVisible, setBannerVisible] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    // Get current version
    AppVersionManagerService.getVersion().then((version) => {
      setCurrentVersion(version);
      console.log('[UpdateNotification] Current version:', version);
    });
    const handleUpdateAvailable = (info: UpdateInfo) => {
      console.log('[UpdateNotification] Update available:', info);
      setUpdateAvailable(true);
      setUpdateInfo(info);
      setError(null);
      setIsChecking(false);
      setBannerVisible(true);
      setBannerDismissed(false);

      // Notify parent component
      onUpdateAvailable?.(true);

      // Auto-hide banner after 10 seconds
      setTimeout(() => {
        setBannerVisible(false);
      }, 10000);
    };

    const handleUpdateNotAvailable = (info: any) => {
      console.log('[UpdateNotification] No update available', info);
      setUpdateAvailable(false);
      setUpdateInfo(null);
      setIsChecking(false);

      // Notify parent component
      onUpdateAvailable?.(false);
    };

    const handleDownloadProgress = (progress: any) => {
      console.log('[UpdateNotification] Download progress:', progress.percent);
      setDownloadProgress(Math.round(progress.percent));
      setIsDownloading(true);
    };

    const handleUpdateDownloaded = (info: UpdateInfo) => {
      console.log('[UpdateNotification] Update downloaded:', info);
      setUpdateDownloaded(true);
      setIsDownloading(false);
      setDownloadProgress(null);
      setUpdateInfo(info);
    };

    const handleUpdateError = (err: any) => {
      console.error('[UpdateNotification] Update error:', err);
      setError(err?.message || 'Update failed');
      setIsDownloading(false);
      setDownloadProgress(null);
    };

    // Use the mainProcess API for update events
    const unsubscribeAvailable = AppVersionManagerService.onUpdateAvailable(
      handleUpdateAvailable,
    );
    const unsubscribeNotAvailable =
      AppVersionManagerService.onUpdateNotAvailable(handleUpdateNotAvailable);
    const unsubscribeProgress =
      AppVersionManagerService.onUpdateDownloadProgress(handleDownloadProgress);
    const unsubscribeDownloaded = AppVersionManagerService.onUpdateDownloaded(
      handleUpdateDownloaded,
    );
    const unsubscribeError =
      AppVersionManagerService.onUpdateError(handleUpdateError);

    // Check for updates silently on mount
    AppVersionManagerService.checkForUpdateSilently();

    return () => {
      unsubscribeAvailable();
      unsubscribeNotAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
      unsubscribeError();
    };
  }, []);

  const handleDownload = () => {
    console.log('[UpdateNotification] Starting download');
    setIsDownloading(true);
    setError(null);
    AppVersionManagerService.downloadUpdate();
  };

  const handleInstall = () => {
    console.log('[UpdateNotification] Installing update and restarting');
    AppVersionManagerService.installUpdate();
  };

  // Show nothing if we're not checking and no update is available and banner was dismissed
  if (!isChecking && !updateAvailable && !updateDownloaded && !error) {
    return null;
  }

  // If update is available but banner is hidden and not dismissed manually, show nothing
  // (the dot notification will be shown in the parent component)
  if (
    updateAvailable &&
    !bannerVisible &&
    !bannerDismissed &&
    !updateDownloaded
  ) {
    return null;
  }

  const handleCheckForUpdate = () => {
    console.log('[UpdateNotification] Manual check triggered');
    setIsChecking(true);
    setError(null);
    AppVersionManagerService.checkForUpdateManually();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        background:
          updateAvailable || updateDownloaded
            ? theme.colors.primary
            : theme.colors.backgroundSecondary,
        borderRadius: '6px',
        color:
          updateAvailable || updateDownloaded
            ? theme.colors.background
            : theme.colors.textSecondary,
        fontSize: '13px',
        fontWeight: 500,
        border: `1px solid ${updateAvailable || updateDownloaded ? theme.colors.primary : theme.colors.border}`,
        animation: 'fadeIn 0.3s ease-out',
        position: 'relative',
        ...style,
      }}
    >
      <Sparkles size={14} />

      <div style={{ flex: 1 }}>
        {updateDownloaded ? (
          <span>Update v{updateInfo?.version} is ready to install!</span>
        ) : isDownloading ? (
          <span>
            Downloading update...{' '}
            {downloadProgress !== null ? `${downloadProgress}%` : ''}
          </span>
        ) : updateAvailable ? (
          <span>New version v{updateInfo?.version} available</span>
        ) : isChecking ? (
          <span>Checking for updates... (Current: v{currentVersion})</span>
        ) : error ? (
          <span>{error}</span>
        ) : (
          <span>No updates available (Current: v{currentVersion})</span>
        )}
        {error && !isChecking && (
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
            Click to retry
          </div>
        )}
      </div>

      {updateDownloaded ? (
        <button
          onClick={handleInstall}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            backgroundColor: theme.colors.background,
            color: theme.colors.primary,
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <RefreshCw size={12} />
          Restart & Install
        </button>
      ) : isDownloading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            backgroundColor: `${theme.colors.background}33`,
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '4px',
              backgroundColor: `${theme.colors.background}4D`,
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${downloadProgress || 0}%`,
                height: '100%',
                backgroundColor: theme.colors.background,
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      ) : updateAvailable ? (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            backgroundColor: theme.colors.background,
            color: theme.colors.primary,
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            opacity: isDownloading ? 0.6 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Download size={12} />
          Download Update
        </button>
      ) : !isChecking && error ? (
        <button
          onClick={handleCheckForUpdate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            backgroundColor: theme.colors.backgroundTertiary,
            color: theme.colors.text,
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      ) : null}

      {/* Dismiss button for manual dismissal */}
      {(updateAvailable || updateDownloaded) && (
        <button
          onClick={() => {
            setBannerVisible(false);
            setBannerDismissed(true);
            // Still notify parent that update is available even when dismissed
            onUpdateAvailable?.(updateAvailable);
          }}
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: `${theme.colors.background}33`,
            color: theme.colors.background,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            opacity: 0.7,
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
          }}
          title="Dismiss notification"
        >
          ×
        </button>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

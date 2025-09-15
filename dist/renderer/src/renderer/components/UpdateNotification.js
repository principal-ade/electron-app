import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { AppVersionManagerService } from '../main-process-api/AppVersionManagerService';
export const UpdateNotification = ({ style, onUpdateAvailable }) => {
    const { theme } = useTheme();
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState(null);
    const [isChecking, setIsChecking] = useState(true);
    const [currentVersion, setCurrentVersion] = useState('');
    const [bannerVisible, setBannerVisible] = useState(true);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    useEffect(() => {
        // Get current version
        AppVersionManagerService.getVersion().then(version => {
            setCurrentVersion(version);
            console.log('[UpdateNotification] Current version:', version);
        });
        const handleUpdateAvailable = (info) => {
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
        const handleUpdateNotAvailable = (info) => {
            console.log('[UpdateNotification] No update available', info);
            setUpdateAvailable(false);
            setUpdateInfo(null);
            setIsChecking(false);
            // Notify parent component
            onUpdateAvailable?.(false);
        };
        const handleDownloadProgress = (progress) => {
            console.log('[UpdateNotification] Download progress:', progress.percent);
            setDownloadProgress(Math.round(progress.percent));
            setIsDownloading(true);
        };
        const handleUpdateDownloaded = (info) => {
            console.log('[UpdateNotification] Update downloaded:', info);
            setUpdateDownloaded(true);
            setIsDownloading(false);
            setDownloadProgress(null);
            setUpdateInfo(info);
        };
        const handleUpdateError = (err) => {
            console.error('[UpdateNotification] Update error:', err);
            setError(err?.message || 'Update failed');
            setIsDownloading(false);
            setDownloadProgress(null);
        };
        // Use the mainProcess API for update events
        const unsubscribeAvailable = AppVersionManagerService.onUpdateAvailable(handleUpdateAvailable);
        const unsubscribeNotAvailable = AppVersionManagerService.onUpdateNotAvailable(handleUpdateNotAvailable);
        const unsubscribeProgress = AppVersionManagerService.onUpdateDownloadProgress(handleDownloadProgress);
        const unsubscribeDownloaded = AppVersionManagerService.onUpdateDownloaded(handleUpdateDownloaded);
        const unsubscribeError = AppVersionManagerService.onUpdateError(handleUpdateError);
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
    if (updateAvailable && !bannerVisible && !bannerDismissed && !updateDownloaded) {
        return null;
    }
    const handleCheckForUpdate = () => {
        console.log('[UpdateNotification] Manual check triggered');
        setIsChecking(true);
        setError(null);
        AppVersionManagerService.checkForUpdateManually();
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: updateAvailable || updateDownloaded
                ? theme.colors.primary
                : theme.colors.backgroundSecondary,
            borderRadius: '6px',
            color: updateAvailable || updateDownloaded
                ? 'white'
                : theme.colors.textSecondary,
            fontSize: '13px',
            fontWeight: 500,
            border: `1px solid ${updateAvailable || updateDownloaded ? theme.colors.primary : theme.colors.border}`,
            animation: 'fadeIn 0.3s ease-out',
            position: 'relative',
            ...style,
        }, children: [_jsx(Sparkles, { size: 14 }), _jsxs("div", { style: { flex: 1 }, children: [updateDownloaded ? (_jsxs("span", { children: ["Update v", updateInfo?.version, " is ready to install!"] })) : isDownloading ? (_jsxs("span", { children: ["Downloading update... ", downloadProgress !== null ? `${downloadProgress}%` : ''] })) : updateAvailable ? (_jsxs("span", { children: ["New version v", updateInfo?.version, " available"] })) : isChecking ? (_jsxs("span", { children: ["Checking for updates... (Current: v", currentVersion, ")"] })) : error ? (_jsx("span", { children: error })) : (_jsxs("span", { children: ["No updates available (Current: v", currentVersion, ")"] })), error && !isChecking && (_jsx("div", { style: { fontSize: '12px', opacity: 0.9, marginTop: '2px' }, children: "Click to retry" }))] }), updateDownloaded ? (_jsxs("button", { onClick: handleInstall, style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    backgroundColor: 'white',
                    color: theme.colors.primary,
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }, children: [_jsx(RefreshCw, { size: 12 }), "Restart & Install"] })) : isDownloading ? (_jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                }, children: _jsx("div", { style: {
                        width: '100px',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                    }, children: _jsx("div", { style: {
                            width: `${downloadProgress || 0}%`,
                            height: '100%',
                            backgroundColor: 'white',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                        } }) }) })) : updateAvailable ? (_jsxs("button", { onClick: handleDownload, disabled: isDownloading, style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    backgroundColor: 'white',
                    color: theme.colors.primary,
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isDownloading ? 'not-allowed' : 'pointer',
                    opacity: isDownloading ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                }, onMouseEnter: (e) => {
                    if (!isDownloading) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }, children: [_jsx(Download, { size: 12 }), "Download Update"] })) : !isChecking && error ? (_jsxs("button", { onClick: handleCheckForUpdate, style: {
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
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }, children: [_jsx(RefreshCw, { size: 12 }), "Retry"] })) : null, (updateAvailable || updateDownloaded) && (_jsx("button", { onClick: () => {
                    setBannerVisible(false);
                    setBannerDismissed(true);
                    // Still notify parent that update is available even when dismissed
                    onUpdateAvailable?.(updateAvailable);
                }, style: {
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    opacity: 0.7,
                    transition: 'opacity 0.2s ease',
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.opacity = '1';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.opacity = '0.7';
                }, title: "Dismiss notification", children: "\u00D7" })), _jsx("style", { children: `
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      ` })] }));
};

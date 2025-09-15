import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';
export const UpdateSettings = () => {
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);
    const [currentVersion] = useState(() => {
        // Get version from package.json or electron app
        return window.electron?.app?.getVersion?.() || '0.0.1';
    });
    const checkForUpdates = async () => {
        setIsChecking(true);
        try {
            const result = await SystemService.checkForUpdateManually();
            setLastCheck(new Date());
            if (result.error) {
                console.error('Update check failed:', result.error);
            }
            if (result.updateAvailable && result.version) {
                console.log('Update available:', result.version);
            }
        }
        catch (error) {
            console.error('Error checking for updates:', error);
        }
        finally {
            setIsChecking(false);
        }
    };
    return (_jsx("div", { className: "space-y-6", children: _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-4", children: "Application Updates" }), _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Info, { className: "w-5 h-5 text-gray-500" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900 dark:text-white", children: "Current Version" }), _jsxs("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: ["v", currentVersion] })] })] }) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900 dark:text-white", children: "Automatic Updates" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Automatically check for updates on startup" }), lastCheck && (_jsxs("p", { className: "text-xs text-gray-400 dark:text-gray-500 mt-1", children: ["Last checked: ", lastCheck.toLocaleString()] }))] }), _jsxs("button", { onClick: checkForUpdates, disabled: isChecking, className: "flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: [_jsx(RefreshCw, { className: `w-4 h-4 ${isChecking ? 'animate-spin' : ''}` }), isChecking ? 'Checking...' : 'Check Now'] })] }), _jsxs("div", { className: "border-t border-gray-200 dark:border-gray-700 pt-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 dark:text-white mb-2", children: "Update Channel" }), _jsxs("select", { className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white", defaultValue: "latest", children: [_jsx("option", { value: "latest", children: "Stable (Recommended)" }), _jsx("option", { value: "beta", children: "Beta" }), _jsx("option", { value: "alpha", children: "Alpha (Unstable)" })] }), _jsx("p", { className: "text-xs text-gray-500 dark:text-gray-400 mt-1", children: "Choose which release channel to receive updates from" })] }), _jsxs("div", { className: "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900 dark:text-blue-100 mb-1", children: "About Auto-Updates" }), _jsx("p", { className: "text-sm text-blue-700 dark:text-blue-300", children: "When updates are available, you'll be notified and can choose when to install them. The app will download updates in the background and prompt you to restart when ready." })] })] })] }) }));
};

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { waitForWindowAPIs } from './utils/ipcServices';
import { useTheme } from 'themed-markdown';
export const AppInitializer = ({ children }) => {
    const { theme } = useTheme();
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        const initialize = async () => {
            try {
                // Wait for Electron APIs to be available
                const apisAvailable = await waitForWindowAPIs(5000);
                if (!apisAvailable) {
                    setError('Electron APIs not available. Preload may have failed to load.');
                    return;
                }
                setIsInitialized(true);
            }
            catch (err) {
                console.error('Initialization error:', err);
                setError(err instanceof Error ? err.message : 'Unknown initialization error');
            }
        };
        initialize();
    }, []);
    if (error) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-8", style: {
                backgroundColor: theme.colors.background,
                color: theme.colors.text
            }, children: _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Initialization Error" }), _jsx("p", { className: "text-red-400 mb-4", children: error }), _jsx("button", { onClick: () => window.location.reload(), className: "px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg", children: "Retry" })] }) }));
    }
    if (!isInitialized) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", style: {
                backgroundColor: theme.colors.background,
                color: theme.colors.text
            }, children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" }), _jsx("p", { style: { color: theme.colors.textSecondary }, children: "Initializing application..." })] }) }));
    }
    return _jsx(_Fragment, { children: children });
};

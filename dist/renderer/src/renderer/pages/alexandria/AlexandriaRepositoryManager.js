import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { AlexandriaRepositoryList } from '../../components/alexandria/AlexandriaRepositoryList';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WindowService } from '../../main-process-api/WindowService';
export const AlexandriaRepositoryManager = () => {
    const { theme } = useTheme();
    const [repositories, setRepositories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Load repositories on mount and listen for backend events
    useEffect(() => {
        loadRepositories();
        // Subscribe to repository changes from backend
        const unsubscribe = window.mainProcess.alexandria.onRepositoryChange(() => {
            // Reload repositories when any change occurs
            loadRepositories();
        });
        // Cleanup subscription on unmount
        return () => {
            unsubscribe();
        };
    }, []);
    const loadRepositories = async () => {
        try {
            setIsLoading(true);
            setError(null);
            // Call the Alexandria service
            const repos = await AlexandriaService.getRepositories();
            setRepositories(repos);
        }
        catch (err) {
            console.error('Failed to load repositories:', err);
            setError('Failed to load repositories');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSelectRepository = async (repo) => {
        try {
            // Open repository dashboard - backend will handle the mapping
            await WindowService.openRepositoryDashboard(repo);
        }
        catch (err) {
            console.error('Failed to open repository:', err);
        }
    };
    const handleRefresh = async () => {
        await loadRepositories();
    };
    if (error) {
        return (_jsxs("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: theme.colors.background,
                color: theme.colors.error
            }, children: [_jsx("h2", { style: { marginBottom: theme.space[3] }, children: "Error" }), _jsx("p", { children: error }), _jsx("button", { onClick: loadRepositories, style: {
                        marginTop: theme.space[4],
                        padding: `${theme.space[2]}px ${theme.space[4]}px`,
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.background,
                        border: 'none',
                        borderRadius: theme.radii[2],
                        cursor: 'pointer'
                    }, children: "Retry" })] }));
    }
    return (_jsx(AlexandriaRepositoryList, { repositories: repositories, onSelectRepository: handleSelectRepository, onRefresh: handleRefresh, isLoading: isLoading }));
};

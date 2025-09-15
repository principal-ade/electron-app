import { useState, useEffect, useCallback } from 'react';
import { GithubService } from '../main-process-api/GithubService';
export function useGitHubDetection(directoryPath) {
    const [result, setResult] = useState({
        isGitRepository: false,
        repositoryInfo: null,
        isLoading: false,
        error: null,
    });
    const detectRepository = useCallback(async (path) => {
        setResult((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
            console.log('[useGitHubDetection] Checking directory:', path);
            const repoInfo = await GithubService.detectRepository(path);
            if (repoInfo) {
                console.log('[useGitHubDetection] GitHub repository detected:', repoInfo);
                setResult({
                    isGitRepository: true,
                    repositoryInfo: { ...repoInfo, path },
                    isLoading: false,
                    error: null,
                });
            }
            else {
                console.log('[useGitHubDetection] No GitHub repository found');
                setResult({
                    isGitRepository: false,
                    repositoryInfo: null,
                    isLoading: false,
                    error: null,
                });
            }
        }
        catch (error) {
            console.error('[useGitHubDetection] Error detecting repository:', error);
            setResult({
                isGitRepository: false,
                repositoryInfo: null,
                isLoading: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to detect repository',
            });
        }
    }, []);
    useEffect(() => {
        if (directoryPath) {
            detectRepository(directoryPath);
        }
        else {
            setResult({
                isGitRepository: false,
                repositoryInfo: null,
                isLoading: false,
                error: null,
            });
        }
    }, [directoryPath, detectRepository]);
    return result;
}

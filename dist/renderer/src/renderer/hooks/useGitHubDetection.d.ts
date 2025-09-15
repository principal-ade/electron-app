import { GitHubRepositoryInfo } from '../store/contexts/AppContext';
export interface GitHubDetectionResult {
    isGitRepository: boolean;
    repositoryInfo: GitHubRepositoryInfo | null;
    isLoading: boolean;
    error: string | null;
}
export declare function useGitHubDetection(directoryPath: string | null): GitHubDetectionResult;
//# sourceMappingURL=useGitHubDetection.d.ts.map
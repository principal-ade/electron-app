/**
 * Service for analyzing gitignore patterns and their effects
 * Uses bash commands to avoid storing large amounts of data in memory
 */
export class GitignoreAnalysisService {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    /**
     * Get all .gitignore files in the repository
     */
    async getGitignoreFiles() {
        try {
            // Find all .gitignore files
            // TODO: System Service executeCommand under review
            const result = await window.mainProcess.system.executeCommand({
                command: 'find',
                args: [this.repositoryRoot, '-name', '.gitignore', '-type', 'f'],
                cwd: this.repositoryRoot,
            });
            if (result.error) {
                console.error('[GitignoreAnalysisService] Error finding .gitignore files:', result.error);
                return [];
            }
            const gitignoreFiles = result.stdout.trim().split('\n').filter(Boolean);
            const analyses = [];
            for (const filePath of gitignoreFiles) {
                const analysis = await this.analyzeGitignoreFile(filePath);
                if (analysis) {
                    analyses.push(analysis);
                }
            }
            return analyses.sort((a, b) => {
                // Root .gitignore first, then by path depth
                if (a.relativePath === '.gitignore' && b.relativePath !== '.gitignore')
                    return -1;
                if (b.relativePath === '.gitignore' && a.relativePath !== '.gitignore')
                    return 1;
                return (a.relativePath.split('/').length - b.relativePath.split('/').length);
            });
        }
        catch (error) {
            console.error('[GitignoreAnalysisService] Error analyzing gitignore files:', error);
            return [];
        }
    }
    /**
     * Analyze a specific .gitignore file
     */
    async analyzeGitignoreFile(filePath) {
        try {
            // Read the .gitignore file content
            const result = await window.mainProcess.system.executeCommand({
                command: 'cat',
                args: [filePath],
                cwd: this.repositoryRoot,
            });
            if (result.error) {
                console.error(`[GitignoreAnalysisService] Error reading ${filePath}:`, result.error);
                return null;
            }
            const content = result.stdout;
            const lines = content.split('\n');
            const patterns = [];
            // Parse patterns from the file
            lines.forEach((line, index) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    return;
                const isNegated = trimmed.startsWith('!');
                const pattern = isNegated ? trimmed.slice(1) : trimmed;
                const isDirectory = pattern.endsWith('/');
                patterns.push({
                    pattern,
                    source: filePath,
                    lineNumber: index + 1,
                    isNegated,
                    isDirectory,
                });
            });
            // Calculate relative path from repository root
            const relativePath = filePath.replace(`${this.repositoryRoot}/`, '');
            return {
                filePath,
                relativePath,
                patterns,
                totalMatches: 0, // Will be calculated on demand
                isActive: true, // Assume active for now
            };
        }
        catch (error) {
            console.error(`[GitignoreAnalysisService] Error analyzing ${filePath}:`, error);
            return null;
        }
    }
    /**
     * Analyze the impact of a specific pattern
     */
    async analyzePattern(pattern) {
        try {
            // Use git check-ignore to find files that match this pattern
            // First, get all files in the repository
            const allFilesResult = await window.mainProcess.system.executeCommand({
                command: 'git',
                args: ['ls-files', '--cached', '--others', '--exclude-standard'],
                cwd: this.repositoryRoot,
            });
            if (allFilesResult.error) {
                throw new Error(`Git ls-files failed: ${allFilesResult.error}`);
            }
            const allFiles = allFilesResult.stdout.trim().split('\n').filter(Boolean);
            // Test each file against the pattern using git check-ignore
            const matchedFiles = [];
            const sampleFiles = [];
            // Process files in batches to avoid overwhelming the system
            const batchSize = 100;
            for (let i = 0; i < allFiles.length; i += batchSize) {
                const batch = allFiles.slice(i, i + batchSize);
                for (const file of batch) {
                    // Check if this specific pattern would ignore this file
                    const checkResult = await window.mainProcess.system.executeCommand({
                        command: 'git',
                        args: ['check-ignore', '--verbose', file],
                        cwd: this.repositoryRoot,
                    });
                    // git check-ignore returns 0 if file is ignored, 1 if not ignored
                    if (checkResult.code === 0) {
                        const output = checkResult.stdout.trim();
                        // Parse output: .gitignore:line:pattern file
                        if (output.includes(pattern.pattern)) {
                            matchedFiles.push(file);
                            if (sampleFiles.length < 10) {
                                sampleFiles.push(file);
                            }
                        }
                    }
                }
                // Break early if we have enough samples and don't need exact count
                if (sampleFiles.length >= 10 && matchedFiles.length > 50) {
                    break;
                }
            }
            const matchCount = matchedFiles.length;
            let impact;
            if (matchCount < 10)
                impact = 'low';
            else if (matchCount < 100)
                impact = 'medium';
            else
                impact = 'high';
            return {
                pattern,
                matchedFiles: matchedFiles.slice(0, 100), // Limit to prevent memory issues
                matchCount,
                sampleFiles,
                impact,
            };
        }
        catch (error) {
            console.error('[GitignoreAnalysisService] Error analyzing pattern:', error);
            return {
                pattern,
                matchedFiles: [],
                matchCount: 0,
                sampleFiles: [],
                impact: 'low',
            };
        }
    }
    /**
     * Get ignored files summary using git commands
     */
    async getIgnoredFilesSummary() {
        try {
            // Get all ignored files
            const result = await window.mainProcess.system.executeCommand({
                command: 'git',
                args: ['ls-files', '--others', '--ignored', '--exclude-standard'],
                cwd: this.repositoryRoot,
            });
            if (result.error) {
                throw new Error(`Git ls-files failed: ${result.error}`);
            }
            const ignoredFiles = result.stdout.trim().split('\n').filter(Boolean);
            const totalIgnored = ignoredFiles.length;
            // Count by extension
            const byExtension = {};
            const directoryCounts = {};
            ignoredFiles.forEach((file) => {
                // Extension counting
                const ext = file.split('.').pop() || 'no-extension';
                byExtension[ext] = (byExtension[ext] || 0) + 1;
                // Directory counting (top-level only)
                const topDir = file.split('/')[0];
                directoryCounts[topDir] = (directoryCounts[topDir] || 0) + 1;
            });
            // Sort directories by count
            const topDirectories = Object.entries(directoryCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([path, count]) => ({ path, count }));
            return {
                totalIgnored,
                byExtension,
                topDirectories,
            };
        }
        catch (error) {
            console.error('[GitignoreAnalysisService] Error getting ignored files summary:', error);
            return {
                totalIgnored: 0,
                byExtension: {},
                topDirectories: [],
            };
        }
    }
}

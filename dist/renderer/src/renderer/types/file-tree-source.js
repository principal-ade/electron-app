/**
 * Factory functions for creating sources
 */
export const createFileTreeSource = {
    /**
     * Create a local file tree source (working copy)
     */
    localWorkingCopy(path, owner, repo, remoteUrl, currentBranch) {
        return {
            id: `local-${path}`,
            type: 'local',
            owner,
            name: repo,
            remoteUrl,
            location: path,
            locationType: 'working',
            label: `Local: ${repo}${currentBranch ? ` (${currentBranch})` : ''}`,
            provider: 'local',
            metadata: {
                currentBranch,
            },
        };
    },
    /**
     * Create a remote branch source (GitHub, etc.)
     */
    remoteBranch(owner, repo, remoteUrl, branch, provider = 'github') {
        return {
            id: `${provider}-${owner}-${repo}-${branch}`,
            type: 'remote',
            owner,
            name: repo,
            remoteUrl,
            location: branch,
            locationType: 'branch',
            label: `${repo}@${branch}`,
            provider,
            apiUrl: provider === 'github' ? 'https://api.github.com' : undefined,
        };
    },
    /**
     * Create a remote tag source
     */
    remoteTag(owner, repo, remoteUrl, tag, provider = 'github') {
        return {
            id: `${provider}-${owner}-${repo}-tag-${tag}`,
            type: 'remote',
            owner,
            name: repo,
            remoteUrl,
            location: tag,
            locationType: 'tag',
            label: `${repo}@${tag}`,
            provider,
            apiUrl: provider === 'github' ? 'https://api.github.com' : undefined,
        };
    },
    /**
     * Create a remote commit source
     */
    remoteCommit(owner, repo, remoteUrl, commitSha, provider = 'github') {
        const shortSha = commitSha.substring(0, 7);
        return {
            id: `${provider}-${owner}-${repo}-commit-${shortSha}`,
            type: 'remote',
            owner,
            name: repo,
            remoteUrl,
            location: commitSha,
            locationType: 'commit',
            label: `${repo}@${shortSha}`,
            provider,
            apiUrl: provider === 'github' ? 'https://api.github.com' : undefined,
            metadata: {
                commitSha,
            },
        };
    },
    /**
     * Create a temporary/experimental source
     */
    temporary(baseSource, location, locationType) {
        return {
            ...baseSource,
            id: `temp-${baseSource.id}-${Date.now()}`,
            location,
            locationType,
            label: `${baseSource.label} (temporary)`,
            isTemporary: true,
            createdAt: Date.now(),
        };
    },
};
/**
 * Type guards
 */
export const isLocalSource = (source) => source.type === 'local';
export const isRemoteSource = (source) => source.type === 'remote';
export const isTemporarySource = (source) => source.isTemporary === true;
export const isGitHubSource = (source) => source.provider === 'github';
/**
 * Utility functions
 */
export function getSourceDisplayName(source) {
    if (source.label)
        return source.label;
    const prefix = source.type === 'local' ? 'Local: ' : '';
    const suffix = source.locationType === 'branch' ? `@${source.location}` :
        source.locationType === 'tag' ? `@${source.location}` :
            source.locationType === 'commit' ? `@${source.location.substring(0, 7)}` : '';
    return `${prefix}${source.name}${suffix}`;
}
export function getSourceIdentifier(source) {
    // Returns a stable identifier for deduplication
    if (source.type === 'local') {
        return `local:${source.location}`;
    }
    return `${source.provider}:${source.owner}/${source.name}:${source.locationType}:${source.location}`;
}
export function shouldCacheSource(source) {
    // Temporary sources might not need caching, or need shorter TTL
    return !source.isTemporary;
}
export function getSourceCacheTTL(source) {
    // Cache TTL in milliseconds
    if (source.isTemporary)
        return 5 * 60 * 1000; // 5 minutes for temporary
    if (source.type === 'local')
        return 10 * 60 * 1000; // 10 minutes for local
    if (source.locationType === 'commit')
        return 60 * 60 * 1000; // 1 hour for commits (immutable)
    return 30 * 60 * 1000; // 30 minutes default
}
/**
 * Source comparison for sorting
 */
export function compareFileTreeSources(a, b) {
    // Sort order: default first, then local, then remote, then by label
    if (a.isDefault && !b.isDefault)
        return -1;
    if (!a.isDefault && b.isDefault)
        return 1;
    if (a.type === 'local' && b.type === 'remote')
        return -1;
    if (a.type === 'remote' && b.type === 'local')
        return 1;
    return a.label.localeCompare(b.label);
}

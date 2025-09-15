import { jsx as _jsx } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { Github, Gitlab, GitBranch, GitCommitHorizontal, FolderOpen } from 'lucide-react';
/**
 * Displays repository avatars with semantic shapes:
 * - Circles (50% border radius) for remote/cloud entities (owner, repository)
 * - Rounded squares (8px border radius) for local entities (clones)
 */
export const RepositoryAvatar = ({ repository, localClone, customAvatarUrl, size = 40, type, fallbackIcon, }) => {
    const { theme } = useTheme();
    // Use rounded squares for all types
    const borderRadius = `${Math.min(12, size / 4)}px`;
    // Determine what to display
    const getContent = () => {
        // Custom avatar URL takes priority
        if (customAvatarUrl) {
            return (_jsx("img", { src: customAvatarUrl, alt: type === 'clone' ? 'Clone' : repository?.name || 'Repository', style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                } }));
        }
        // For owner type, use repository's GitHub avatar
        if (type === 'owner' && repository?.avatarUrl) {
            return (_jsx("img", { src: repository.avatarUrl, alt: repository.owner, style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                } }));
        }
        // For repository type without custom, show GitHub avatar or fallback
        if (type === 'repository' && repository?.avatarUrl && !customAvatarUrl) {
            return (_jsx("img", { src: repository.avatarUrl, alt: repository.owner, style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                } }));
        }
        // Fallback icons
        if (fallbackIcon) {
            return fallbackIcon;
        }
        // Default icons based on type and VCS
        if (type === 'clone') {
            return _jsx(FolderOpen, { size: size * 0.4, color: theme.colors.textSecondary });
        }
        if (repository?.vcsType === 'gitlab') {
            return _jsx(Gitlab, { size: size * 0.5 });
        }
        else if (repository?.vcsType === 'bitbucket') {
            return _jsx(GitCommitHorizontal, { size: size * 0.5 });
        }
        else if (repository?.vcsType === 'generic') {
            return _jsx(GitBranch, { size: size * 0.5 });
        }
        return _jsx(Github, { size: size * 0.5 });
    };
    return (_jsx("div", { style: {
            width: `${size}px`,
            height: `${size}px`,
            borderRadius,
            backgroundColor: theme.colors.backgroundTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
        }, children: getContent() }));
};

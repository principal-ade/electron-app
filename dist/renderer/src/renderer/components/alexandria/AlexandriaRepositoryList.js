import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { AlexandriaRepositoryCard } from './AlexandriaRepositoryCard';
export const AlexandriaRepositoryList = ({ repositories, onSelectRepository, onRefresh, isLoading = false }) => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterByViews, setFilterByViews] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    // Filter repositories based on search and filters
    const filteredRepos = repositories.filter(repo => {
        const matchesSearch = !searchQuery ||
            repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            repo.github?.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            repo.github?.topics?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = !filterByViews || repo.hasViews;
        return matchesSearch && matchesFilter;
    });
    // Sort repositories
    const sortedRepos = [...filteredRepos].sort((a, b) => {
        switch (sortBy) {
            case 'stars':
                return (b.github?.stars || 0) - (a.github?.stars || 0);
            case 'views':
                return b.viewCount - a.viewCount;
            case 'name':
            default:
                return a.name.localeCompare(b.name);
        }
    });
    return (_jsx("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.background
        }, children: _jsx("div", { style: {
                flex: 1,
                overflow: 'auto',
                padding: theme.space[4]
            }, children: sortedRepos.length === 0 ? (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: theme.colors.textMuted
                }, children: [_jsx("div", { style: { fontSize: theme.fontSizes[6], marginBottom: theme.space[3] }, children: "\uD83D\uDCDA" }), _jsx("h3", { style: {
                            fontSize: theme.fontSizes[4],
                            fontWeight: theme.fontWeights.medium,
                            marginBottom: theme.space[2]
                        }, children: "No repositories found" }), _jsx("p", { style: { fontSize: theme.fontSizes[2] }, children: searchQuery ? 'Try adjusting your search' : 'Add your first repository to get started' })] })) : (_jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: theme.space[5],
                    paddingBottom: theme.space[4]
                }, children: sortedRepos.map(repo => (_jsx(AlexandriaRepositoryCard, { repository: repo, onSelect: onSelectRepository }, repo.name))) })) }) }));
};

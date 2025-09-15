import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { MultiVersionCityBuilder } from "@principal-ai/code-city-react";
import { SourceSelectionService } from '../../../services/SourceSelectionService';
/**
 * Centralized component for managing city data building and source badges
 * across different repository views (explore, develop, maintain)
 */
export const CityMapManager = ({ fileTree, activeSource, gitEnabled = false, headTree = null, hasNoCommits = false, viewMode, showWorkingTree = true, showHeadTree = true, onToggleWorkingTree, onToggleHeadTree, renderCustomBadges, children, }) => {
    const { theme } = useTheme();
    const [cityData, setCityData] = useState(null);
    const [isBuilding, setIsBuilding] = useState(false);
    // Build city data whenever inputs change
    useEffect(() => {
        const buildCity = async () => {
            if (!fileTree || !activeSource) {
                setCityData(null);
                return;
            }
            setIsBuilding(true);
            try {
                // Determine which trees to include based on mode and settings
                const versions = new Map();
                // Always add the main tree
                versions.set(activeSource.id, fileTree);
                // Add HEAD tree for git-enabled views
                if (gitEnabled && headTree && !hasNoCommits) {
                    if (viewMode === 'explore') {
                        // Explore: Add HEAD when git changes are enabled
                        versions.set(`${activeSource.id}-HEAD`, headTree);
                    }
                    else if (viewMode === 'develop') {
                        // Develop: Always add HEAD for stable layout
                        versions.set(`${activeSource.id}-HEAD`, headTree);
                    }
                }
                // Build multi-version city using new API
                const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(versions, {});
                // Determine which files to show based on mode and toggles
                let finalPresence;
                if (viewMode === 'develop' && headTree) {
                    // Develop mode: Filter based on toggle states
                    finalPresence = new Set();
                    // Get all file paths from the union city
                    const allPaths = new Set();
                    unionCity.buildings?.forEach(building => {
                        if (building.path)
                            allPaths.add(building.path);
                    });
                    allPaths.forEach(filePath => {
                        let shouldShow = false;
                        // Check working tree visibility
                        if (showWorkingTree && presenceByVersion.get(activeSource.id)?.has(filePath)) {
                            shouldShow = true;
                        }
                        // Check HEAD tree visibility
                        if (showHeadTree && presenceByVersion.get(`${activeSource.id}-HEAD`)?.has(filePath)) {
                            shouldShow = true;
                        }
                        if (shouldShow) {
                            finalPresence.add(filePath);
                        }
                    });
                }
                else if (gitEnabled && headTree) {
                    // Git-enabled explore mode: Show union of both trees
                    finalPresence = new Set();
                    const workingPresence = presenceByVersion.get(activeSource.id);
                    const headPresence = presenceByVersion.get(`${activeSource.id}-HEAD`);
                    if (workingPresence) {
                        workingPresence.forEach(path => finalPresence.add(path));
                    }
                    if (headPresence) {
                        headPresence.forEach(path => finalPresence.add(path));
                    }
                }
                else {
                    // Default: Show only the main tree
                    finalPresence = presenceByVersion.get(activeSource.id) || new Set();
                }
                // Get version view with the appropriate presence
                const city = MultiVersionCityBuilder.getVersionView(unionCity, finalPresence);
                setCityData(city);
            }
            catch (error) {
                console.error('[CityMapManager] Error building city:', error);
                setCityData(null);
            }
            finally {
                setIsBuilding(false);
            }
        };
        buildCity();
    }, [fileTree, activeSource, gitEnabled, headTree, hasNoCommits, viewMode, showWorkingTree, showHeadTree]);
    // Generate source badges based on mode and state
    const sourceBadges = useMemo(() => {
        if (!activeSource)
            return null;
        // Get folder name for local sources
        const getFolderName = () => {
            if (activeSource.type === 'local') {
                return activeSource.location.split('/').pop() || activeSource.name;
            }
            return activeSource.name;
        };
        // Maintain mode: Simple single badge
        if (viewMode === 'maintain') {
            return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: theme.colors.primary + '22',
                            color: theme.colors.primary,
                            fontSize: 12,
                            fontWeight: 600
                        }, children: [_jsx(GitBranch, { size: 12 }), SourceSelectionService.getSourceDisplayName(activeSource)] }), renderCustomBadges?.()] }));
        }
        // Explore mode: Show HEAD badge when git is enabled
        if (viewMode === 'explore') {
            return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [gitEnabled && !hasNoCommits && headTree && (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#64748b22',
                            color: '#64748b',
                            fontSize: 12,
                            fontWeight: 600
                        }, children: [_jsx(GitBranch, { size: 12 }), getFolderName(), " (HEAD)"] })), _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: theme.colors.primary + '22',
                            color: theme.colors.primary,
                            fontSize: 12,
                            fontWeight: 600
                        }, children: [_jsx(GitBranch, { size: 12 }), activeSource.type === 'local'
                                ? `${getFolderName()} (${activeSource.metadata?.currentBranch || 'main'})`
                                : SourceSelectionService.getSourceDisplayName(activeSource)] }), renderCustomBadges?.()] }));
        }
        // Develop mode: Toggleable badges
        if (viewMode === 'develop') {
            return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [activeSource.type === 'local' && headTree && (_jsxs("button", { onClick: () => onToggleHeadTree?.(!showHeadTree), disabled: showHeadTree && !showWorkingTree, style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: showHeadTree ? theme.colors.primary + '22' : theme.colors.backgroundTertiary,
                            color: showHeadTree ? theme.colors.primary : theme.colors.textSecondary,
                            fontSize: 12,
                            fontWeight: 600,
                            border: 'none',
                            cursor: showHeadTree && !showWorkingTree ? 'not-allowed' : 'pointer',
                            opacity: !showHeadTree ? 0.7 : 1,
                            transition: 'all 0.2s',
                        }, title: showHeadTree ? 'Click to hide HEAD' : 'Click to show HEAD', children: [_jsx(GitBranch, { size: 12 }), getFolderName(), " (HEAD)"] })), _jsxs("button", { onClick: () => onToggleWorkingTree?.(!showWorkingTree), disabled: !showHeadTree && showWorkingTree, style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: showWorkingTree ? theme.colors.primary + '22' : theme.colors.backgroundTertiary,
                            color: showWorkingTree ? theme.colors.primary : theme.colors.textSecondary,
                            fontSize: 12,
                            fontWeight: 600,
                            border: 'none',
                            cursor: !showHeadTree && showWorkingTree ? 'not-allowed' : 'pointer',
                            opacity: !showWorkingTree ? 0.7 : 1,
                            transition: 'all 0.2s',
                        }, title: showWorkingTree ? 'Click to hide working tree' : 'Click to show working tree', children: [_jsx(GitBranch, { size: 12 }), activeSource.type === 'local'
                                ? `${getFolderName()} (${activeSource.metadata?.currentBranch || 'Working'})`
                                : SourceSelectionService.getSourceDisplayName(activeSource)] }), renderCustomBadges?.()] }));
        }
        return null;
    }, [activeSource, viewMode, gitEnabled, headTree, hasNoCommits, showWorkingTree, showHeadTree,
        onToggleWorkingTree, onToggleHeadTree, theme, renderCustomBadges]);
    // Render children with built data
    return (_jsx(_Fragment, { children: children({
            cityData,
            sourceBadges,
            isBuilding
        }) }));
};

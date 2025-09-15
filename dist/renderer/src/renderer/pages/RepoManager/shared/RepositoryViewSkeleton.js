import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { AnimatedResizableLayout } from "@a24z/panels";
import "@a24z/panels/style.css";
import { RightPaneContainer } from '../../../components/repository-maps/RightPaneContainer';
export const RepositoryViewSkeleton = ({ tabs, activeTab, onTabChange, cityData, highlightLayers, loading, treeStats, sourceBadges, activeSource, onHelpClick, cityHeaderExtra, loadingMessage = 'Building your city', emptyMessage = 'No city data available', onFileClick, rightPaneMode = 'city', onRightPaneModeChange, terminalDirectory, terminalTabsRef, showViewSwitcher = true, sessions = [], sessionFileActivities = new Map(), selectedSessionId, repository, selectedSessionCardData, sessionColor, repositoryPath, sources, onOpenInEditor, onOpenAllInEditor, onOpenTerminal, onShowContext, onViewEvents, onArchive, onOpenPackageCommands, getTimeAgo, toolbarItems = [], toolbarExpanded = false, onToolbarExpandedChange, documentContent, }) => {
    const { theme } = useTheme();
    // Filter out hidden tabs
    const visibleTabs = tabs.filter(tab => tab.visible !== false);
    const activeTabConfig = visibleTabs.find(tab => tab.id === activeTab);
    // Left panel content
    const leftPanel = (_jsxs("div", { style: {
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px 0 0 8px', // Round only left corners
            border: `1px solid ${theme.colors.border}`,
            borderRight: 'none', // Remove right border since resize handle will be there
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%'
        }, children: [_jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)`,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight,
                    padding: '0 8px',
                    flexShrink: 0
                }, children: visibleTabs.map(tab => (_jsxs("button", { onClick: () => onTabChange(tab.id), style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '12px 16px',
                        backgroundColor: 'transparent',
                        color: activeTab === tab.id ? theme.colors.primary : theme.colors.textSecondary,
                        border: 'none',
                        borderBottom: activeTab === tab.id ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
                        marginBottom: activeTab === tab.id ? '-2px' : '-2px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: activeTab === tab.id ? 600 : 400,
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        opacity: activeTab === tab.id ? 1 : 0.7
                    }, onMouseEnter: (e) => {
                        if (activeTab !== tab.id) {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.color = theme.colors.text;
                        }
                    }, onMouseLeave: (e) => {
                        if (activeTab !== tab.id) {
                            e.currentTarget.style.opacity = '0.7';
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }
                    }, children: [tab.icon, _jsx("span", { style: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }, children: tab.label })] }, tab.id))) }), _jsx("div", { style: {
                    flex: 1,
                    overflow: 'auto',
                    padding: '16px'
                }, children: activeTabConfig?.content })] }));
    // Right panel content with adjusted border radius
    const rightPanel = (_jsx("div", { style: {
            borderRadius: '0 8px 8px 0', // Round only right corners
            border: `1px solid ${theme.colors.border}`,
            borderLeft: 'none', // Remove left border since resize handle will be there
            overflow: 'hidden',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }, children: _jsx(RightPaneContainer, { activeView: rightPaneMode, onViewChange: (view) => onRightPaneModeChange?.(view), cityData: cityData, highlightLayers: highlightLayers, loading: loading, treeStats: treeStats, onFileClick: onFileClick, activeSource: activeSource, sessions: sessions, sessionFileActivities: sessionFileActivities, selectedSessionId: selectedSessionId, repository: repository, onHelpClick: onHelpClick, headerExtra: cityHeaderExtra, sourceBadges: sourceBadges, loadingMessage: loadingMessage, emptyMessage: emptyMessage, showViewSwitcher: showViewSwitcher, selectedSessionCardData: selectedSessionCardData, sessionColor: sessionColor, repositoryPath: repositoryPath, sources: sources, onOpenInEditor: onOpenInEditor, onOpenAllInEditor: onOpenAllInEditor, onOpenTerminal: onOpenTerminal, hasTerminalWindow: false, onShowContext: onShowContext, onViewEvents: onViewEvents, onArchive: onArchive, onOpenPackageCommands: onOpenPackageCommands, getTimeAgo: getTimeAgo, toolbarItems: toolbarItems, toolbarExpanded: toolbarExpanded, onToolbarExpandedChange: onToolbarExpandedChange, documentContent: documentContent }) }));
    return (_jsx("div", { style: { width: '100%', height: '100%', padding: '16px', boxSizing: 'border-box' }, children: _jsx(AnimatedResizableLayout, { leftPanel: leftPanel, rightPanel: rightPanel, collapsibleSide: "left", defaultSize: 50, minSize: 25, style: { height: '100%', width: '100%' } }) }));
};

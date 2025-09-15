import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
export const FileView = ({ fileTypeStats, enabledLayers, onToggleLayer, }) => {
    const { theme } = useTheme();
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                }, children: [_jsx("h3", { style: {
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: '600',
                            color: theme.colors.text,
                        }, children: "File Types" }), _jsxs("span", { style: {
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                        }, children: [fileTypeStats.reduce((sum, stat) => sum + stat.count, 0), " files"] })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: fileTypeStats.map((stat) => {
                    const layerId = `tech-layer-${stat.extension}`;
                    const isEnabled = enabledLayers.has(layerId);
                    return (_jsxs("div", { onClick: () => onToggleLayer(layerId), style: {
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            opacity: isEnabled ? 1 : 0.6,
                            border: `2px solid ${isEnabled ? stat.color : 'transparent'}`,
                        }, children: [_jsx("div", { style: {
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    backgroundColor: stat.color,
                                    marginRight: '12px',
                                } }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: {
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: theme.colors.text,
                                        }, children: stat.name }), _jsxs("div", { style: {
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                        }, children: [stat.extension, " \u2022 ", stat.count, " file", stat.count !== 1 ? 's' : ''] })] }), _jsx("div", { style: {
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '4px',
                                    border: `2px solid ${isEnabled ? stat.color : theme.colors.border}`,
                                    backgroundColor: isEnabled ? stat.color : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }, children: isEnabled && (_jsx("svg", { width: "12", height: "10", viewBox: "0 0 12 10", fill: "none", children: _jsx("path", { d: "M1 5L4 8L11 1", stroke: "white", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) })) })] }, stat.extension));
                }) })] }));
};

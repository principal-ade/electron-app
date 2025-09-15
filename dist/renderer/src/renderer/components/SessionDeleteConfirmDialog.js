import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { CustomLayersStorageService } from '../services/storage/CustomLayersStorageService';
export const SessionDeleteConfirmDialog = ({ session, directory, onConfirm, onCancel }) => {
    const { theme } = useTheme();
    const [persistLayers, setPersistLayers] = useState(true); // Default to yes
    // Check if session has file activity that would create layers
    const hasFileActivity = Object.keys(session.fileAccesses || {}).length > 0 ||
        Object.keys(session.fileWrites || {}).length > 0;
    const handleDelete = async () => {
        if (persistLayers && hasFileActivity) {
            // Convert session layer to custom layer for persistence
            const layerItems = [];
            // Add accessed files
            Object.keys(session.fileAccesses || {}).forEach((filePath) => {
                layerItems.push({
                    path: filePath.startsWith('/') ? filePath : `/${filePath}`,
                    type: 'file',
                    renderStrategy: 'border',
                });
            });
            // Add written files with different style
            if (session.fileWrites) {
                Object.keys(session.fileWrites).forEach((filePath) => {
                    layerItems.push({
                        path: filePath.startsWith('/') ? filePath : `/${filePath}`,
                        type: 'file',
                        renderStrategy: 'fill',
                    });
                });
            }
            if (layerItems.length > 0) {
                const sessionName = session.metadata?.customName ||
                    `Session ${session.sessionId.substring(0, 8)}`;
                const customLayer = {
                    id: `custom-session-${session.sessionId}`,
                    name: `${sessionName} Files`,
                    enabled: true,
                    color: '#3b82f6',
                    opacity: 0.5,
                    borderWidth: 2,
                    priority: 40,
                    dynamic: false,
                    items: layerItems,
                };
                try {
                    await CustomLayersStorageService.addOrUpdateLayer(directory, customLayer);
                }
                catch (error) {
                    console.error('Failed to save session layer:', error);
                }
            }
        }
        onConfirm(persistLayers);
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
        }, onClick: (e) => {
            if (e.target === e.currentTarget) {
                onCancel();
            }
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                border: `1px solid ${theme.colors.border}`,
            }, onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { style: {
                        margin: '0 0 16px 0',
                        fontSize: '20px',
                        fontWeight: '600',
                        color: theme.colors.text,
                    }, children: "Delete Agent Session?" }), _jsxs("p", { style: {
                        margin: '0 0 20px 0',
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        lineHeight: '1.5',
                    }, children: ["This will permanently delete session", ' ', _jsx("strong", { children: session.sessionId.substring(0, 8) }), "."] }), hasFileActivity && (_jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        padding: '12px',
                        marginBottom: '20px',
                        fontSize: '13px',
                    }, children: [_jsx("div", { style: { marginBottom: '8px', color: theme.colors.text }, children: _jsx("strong", { children: "Session file activity:" }) }), _jsxs("div", { style: { color: theme.colors.textSecondary, marginBottom: '4px' }, children: ["\u2022 ", Object.keys(session.fileAccesses || {}).length, " files accessed"] }), Object.keys(session.fileWrites || {}).length > 0 && (_jsxs("div", { style: { color: theme.colors.textSecondary }, children: ["\u2022 ", Object.keys(session.fileWrites || {}).length, " files modified"] }))] })), hasFileActivity && (_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsxs("label", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: theme.colors.text,
                            }, children: [_jsx("input", { type: "checkbox", checked: persistLayers, onChange: (e) => setPersistLayers(e.target.checked), style: {
                                        width: '16px',
                                        height: '16px',
                                        cursor: 'pointer',
                                    } }), "Save session layer before deleting"] }), _jsx("p", { style: {
                                margin: '8px 0 0 24px',
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                                lineHeight: '1.4',
                            }, children: "This will save the files accessed and modified in this session as a persistent layer that you can toggle on/off in the Layers tab." })] })), _jsxs("div", { style: {
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                    }, children: [_jsx("button", { onClick: onCancel, style: {
                                padding: '8px 16px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                color: theme.colors.text,
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundSecondary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }, children: "Cancel" }), _jsx("button", { onClick: handleDelete, style: {
                                padding: '8px 16px',
                                backgroundColor: theme.colors.error || '#ef4444',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = '#dc2626';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor =
                                    theme.colors.error || '#ef4444';
                            }, children: "Delete Session" })] })] }) }));
};

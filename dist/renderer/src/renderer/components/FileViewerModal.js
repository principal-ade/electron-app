import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { X } from 'lucide-react';
import { FileViewer } from './FileViewer';
export const FileViewerModal = ({ filePath, displayPath, onClose, contentLoader, initialContent, editable = false, onSave, }) => {
    const { theme } = useTheme();
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }, children: _jsxs("div", { style: {
                width: '90%',
                maxWidth: '1200px',
                height: '85%',
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                position: 'relative',
            }, children: [_jsx("button", { onClick: onClose, style: {
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        cursor: 'pointer',
                        color: theme.colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 10,
                    }, title: "Close (Esc)", children: _jsx(X, { size: 20 }) }), _jsx("div", { style: {
                        flex: 1,
                        overflow: 'hidden',
                        borderRadius: '12px',
                    }, children: _jsx(FileViewer, { filePath: filePath, displayPath: displayPath, className: "full-height", contentLoader: contentLoader, initialContent: initialContent, editable: editable, onSave: onSave, enableVimMode: false }) })] }) }));
};

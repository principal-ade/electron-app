import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FileText } from 'lucide-react';
export const MarkdownEmptyOverlay = ({ theme }) => {
    return (_jsx("div", { style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            pointerEvents: 'none',
            zIndex: 10
        }, children: _jsxs("div", { style: {
                textAlign: 'center',
                padding: '40px',
                maxWidth: '500px'
            }, children: [_jsx(FileText, { size: 64, color: theme.colors.textSecondary, style: {
                        opacity: 0.2,
                        marginBottom: '24px'
                    } }), _jsx("h2", { style: {
                        fontSize: '24px',
                        fontWeight: 600,
                        color: theme.colors.textSecondary,
                        marginBottom: '16px',
                        opacity: 0.6
                    }, children: "Your markdown content will appear here" }), _jsx("p", { style: {
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        opacity: 0.5,
                        lineHeight: 1.6
                    }, children: "Start typing in the editor to begin creating your planning document" })] }) }));
};

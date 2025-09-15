import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { FileText, PenTool, FolderOpen, Plus } from 'lucide-react';
export const PlanningStartOverlay = ({ theme, onStart, onCancel, initialStep = 'document' }) => {
    const [step, setStep] = useState(initialStep);
    const handleDocumentChoice = (type) => {
        if (type === 'existing') {
            // For existing documents, directly start
            onStart({ documentType: 'existing' });
        }
        else {
            // For new documents, ask about format
            setStep('format');
        }
    };
    const handleFormatChoice = (format) => {
        onStart({
            documentType: 'new',
            format
        });
    };
    return (_jsxs("div", { style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.background,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10
        }, children: [_jsx("div", { style: {
                    padding: '40px',
                    textAlign: 'center',
                    flexShrink: 0
                }, children: _jsxs("h2", { style: {
                        fontSize: '28px',
                        fontWeight: 600,
                        color: theme.colors.text,
                        marginBottom: '12px'
                    }, children: [step === 'document' && 'What would you like to work on?', step === 'format' && 'Choose Document Format'] }) }), step === 'document' && (_jsxs("div", { style: {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'stretch',
                    padding: '0 40px 40px 40px',
                    gap: '40px'
                }, children: [_jsxs("button", { onClick: () => handleDocumentChoice('new'), style: {
                            flex: 1,
                            backgroundColor: theme.colors.backgroundSecondary,
                            color: theme.colors.text,
                            border: `2px solid ${theme.colors.border}`,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '20px',
                            transition: 'all 0.2s',
                            padding: '40px'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                            e.currentTarget.style.borderColor = theme.colors.primary;
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                            e.currentTarget.style.borderColor = theme.colors.border;
                            e.currentTarget.style.transform = 'scale(1)';
                        }, children: [_jsx(Plus, { size: 64, style: { color: theme.colors.primary } }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '24px', fontWeight: 600, marginBottom: '8px' }, children: "New Document" }), _jsx("div", { style: { fontSize: '16px', color: theme.colors.textSecondary }, children: "Start Fresh with a Blank Document" })] })] }), _jsxs("button", { onClick: () => handleDocumentChoice('existing'), style: {
                            flex: 1,
                            backgroundColor: theme.colors.backgroundSecondary,
                            color: theme.colors.text,
                            border: `2px solid ${theme.colors.border}`,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '20px',
                            transition: 'all 0.2s',
                            padding: '40px'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                            e.currentTarget.style.borderColor = theme.colors.primary;
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                            e.currentTarget.style.borderColor = theme.colors.border;
                            e.currentTarget.style.transform = 'scale(1)';
                        }, children: [_jsx(FolderOpen, { size: 64, style: { color: theme.colors.primary } }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '24px', fontWeight: 600, marginBottom: '8px' }, children: "Existing Document" }), _jsx("div", { style: { fontSize: '16px', color: theme.colors.textSecondary }, children: "Continue Working on a Saved Plan" })] })] })] })), step === 'format' && (_jsxs("div", { style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '40px'
                }, children: [_jsxs("div", { style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'stretch',
                            gap: '40px',
                            marginBottom: '40px'
                        }, children: [_jsxs("button", { onClick: () => handleFormatChoice('excalidraw'), style: {
                                    flex: 1,
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    color: theme.colors.text,
                                    border: `2px solid ${theme.colors.border}`,
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '20px',
                                    transition: 'all 0.2s',
                                    padding: '40px'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                    e.currentTarget.style.transform = 'scale(1)';
                                }, children: [_jsx(PenTool, { size: 64, style: { color: theme.colors.primary } }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '24px', fontWeight: 600, marginBottom: '8px' }, children: "Excalidraw" }), _jsx("div", { style: { fontSize: '16px', color: theme.colors.textSecondary }, children: "Visual planning with drawings and diagrams" })] })] }), _jsxs("button", { onClick: () => handleFormatChoice('markdown'), style: {
                                    flex: 1,
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    color: theme.colors.text,
                                    border: `2px solid ${theme.colors.border}`,
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '20px',
                                    transition: 'all 0.2s',
                                    padding: '40px'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                    e.currentTarget.style.transform = 'scale(1)';
                                }, children: [_jsx(FileText, { size: 64, style: { color: theme.colors.primary } }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: '24px', fontWeight: 600, marginBottom: '8px' }, children: "Markdown" }), _jsx("div", { style: { fontSize: '16px', color: theme.colors.textSecondary }, children: "Text-based planning with slides and formatting" })] })] })] }), _jsx("div", { style: { display: 'flex', justifyContent: 'center' }, children: _jsx("button", { onClick: () => setStep('document'), style: {
                                padding: '12px 24px',
                                backgroundColor: 'transparent',
                                color: theme.colors.textSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.borderColor = theme.colors.primary;
                                e.currentTarget.style.color = theme.colors.text;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.borderColor = theme.colors.border;
                                e.currentTarget.style.color = theme.colors.textSecondary;
                            }, children: "Back" }) })] }))] }));
};

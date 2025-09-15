import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Github, Key, CheckCircle, XCircle } from 'lucide-react';
export const OAuthCallbackModal = ({ isOpen, onClose, onCodeSubmit, }) => {
    const { theme } = useTheme();
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    useEffect(() => {
        if (isOpen) {
            setCode('');
            setError(null);
        }
    }, [isOpen]);
    const handleSubmit = () => {
        if (!code.trim()) {
            setError('Please enter the authorization code');
            return;
        }
        onCodeSubmit(code);
        onClose();
    };
    const handleCancel = () => {
        onClose();
    };
    if (!isOpen)
        return null;
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
            zIndex: 10000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                padding: '24px',
                width: '90%',
                maxWidth: '500px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '20px',
                    }, children: [_jsx(Github, { size: 24, color: theme.colors.primary }), _jsx("h2", { style: {
                                fontSize: '20px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                margin: 0,
                            }, children: "GitHub Authorization" })] }), _jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '20px',
                    }, children: [_jsx("h3", { style: {
                                fontSize: '14px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginTop: 0,
                                marginBottom: '12px',
                            }, children: "Complete GitHub Authorization" }), _jsxs("ol", { style: {
                                margin: 0,
                                paddingLeft: '20px',
                                color: theme.colors.textSecondary,
                                fontSize: '13px',
                                lineHeight: '1.6',
                            }, children: [_jsx("li", { children: "A browser window should have opened to GitHub" }), _jsx("li", { children: "Authorize the application if prompted" }), _jsx("li", { children: "You'll be redirected to a success page with your token" }), _jsx("li", { children: "Copy the token from the success page" }), _jsx("li", { children: "Paste the token in the field below" })] }), _jsx("div", { style: {
                                marginTop: '12px',
                                padding: '8px',
                                backgroundColor: theme.colors.background,
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: theme.colors.textSecondary,
                            }, children: "\uD83D\uDCA1 Your token will be displayed on the success page after authorization" }), _jsxs("div", { style: {
                                marginTop: '8px',
                                fontSize: '11px',
                                color: theme.colors.textTertiary,
                            }, children: ["Browser didn't open?", _jsx("button", { onClick: () => window.open('https://principle-md.com/api/orbit/auth/github', '_blank'), style: {
                                        marginLeft: '4px',
                                        padding: '2px 4px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: theme.colors.primary,
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                    }, children: "Click here" })] })] }), _jsxs("div", { style: { marginBottom: '20px' }, children: [_jsx("label", { style: {
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: theme.colors.textSecondary,
                                marginBottom: '8px',
                            }, children: "Access Token" }), _jsx("div", { style: {
                                display: 'flex',
                                gap: '8px',
                            }, children: _jsxs("div", { style: {
                                    position: 'relative',
                                    flex: 1,
                                }, children: [_jsx(Key, { size: 16, style: {
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: theme.colors.textSecondary,
                                        } }), _jsx("input", { type: "text", value: code, onChange: (e) => {
                                            setCode(e.target.value);
                                            setError(null);
                                        }, onKeyPress: (e) => {
                                            if (e.key === 'Enter') {
                                                handleSubmit();
                                            }
                                        }, placeholder: "Paste your access token here", style: {
                                            width: '100%',
                                            padding: '10px 12px 10px 36px',
                                            backgroundColor: theme.colors.backgroundSecondary,
                                            border: `1px solid ${error ? theme.colors.error : theme.colors.border}`,
                                            borderRadius: '6px',
                                            color: theme.colors.text,
                                            fontSize: '14px',
                                            outline: 'none',
                                            fontFamily: 'monospace',
                                        }, autoFocus: true })] }) }), error && (_jsxs("div", { style: {
                                marginTop: '8px',
                                fontSize: '13px',
                                color: theme.colors.error,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }, children: [_jsx(XCircle, { size: 14 }), error] }))] }), _jsxs("div", { style: {
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                    }, children: [_jsx("button", { onClick: handleCancel, style: {
                                padding: '8px 16px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '6px',
                                color: theme.colors.textSecondary,
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                            }, children: "Cancel" }), _jsxs("button", { onClick: handleSubmit, style: {
                                padding: '8px 20px',
                                backgroundColor: theme.colors.primary,
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.opacity = '0.9';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.opacity = '1';
                            }, children: [_jsx(CheckCircle, { size: 16 }), "Authorize"] })] })] }) }));
};

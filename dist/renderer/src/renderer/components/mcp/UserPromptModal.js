import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { UserPromptService } from '../../main-process-api/UserPromptService';
export const UserPromptModal = ({ isOpen, onClose, prompt, onResponse, }) => {
    const { theme } = useTheme();
    const [value, setValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        if (prompt?.defaultValue !== undefined) {
            setValue(prompt.defaultValue);
        }
        else {
            setValue('');
        }
    }, [prompt]);
    const handleSubmit = useCallback(() => {
        if (!prompt)
            return;
        if (prompt.required && !value) {
            // Could add a visual indicator here
            return;
        }
        setIsSubmitting(true);
        const response = {
            id: prompt.id,
            success: true,
            value: value || null,
        };
        onResponse(response);
        setValue('');
        setIsSubmitting(false);
        onClose();
    }, [prompt, value, onResponse, onClose]);
    const handleCancel = useCallback(() => {
        if (!prompt)
            return;
        const response = {
            id: prompt.id,
            success: false,
            cancelled: true,
        };
        onResponse(response);
        setValue('');
        onClose();
    }, [prompt, onResponse, onClose]);
    const handleIgnore = useCallback(() => {
        // Same as cancel, but explicitly labeled as ignore for UX
        handleCancel();
    }, [handleCancel]);
    const handleSnooze = useCallback((minutes = 10) => {
        if (!prompt)
            return;
        // For now, just cancel and let caller re-issue later; store an FYI in console
        console.log(`[UserPrompt] Snoozed for ${minutes} minutes`, { id: prompt.id, filePath: prompt.filePath });
        handleCancel();
    }, [prompt, handleCancel]);
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && prompt?.type !== 'multiline') {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape' && !prompt?.required) {
            handleCancel();
        }
    };
    const renderInput = () => {
        if (!prompt)
            return null;
        const inputStyle = {
            width: '100%',
            padding: '8px 12px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            color: theme.colors.text,
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
        };
        switch (prompt.type) {
            case 'text':
                return (_jsx("input", { type: "text", value: value, onChange: (e) => setValue(e.target.value), placeholder: prompt.placeholder, autoFocus: true, onKeyPress: handleKeyPress, style: inputStyle, onFocus: (e) => {
                        e.currentTarget.style.borderColor = theme.colors.primary;
                    }, onBlur: (e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                    } }));
            case 'multiline':
                return (_jsx("textarea", { value: value, onChange: (e) => setValue(e.target.value), placeholder: prompt.placeholder, rows: 5, autoFocus: true, style: {
                        ...inputStyle,
                        resize: 'vertical',
                        minHeight: '100px',
                        fontFamily: 'inherit',
                    }, onFocus: (e) => {
                        e.currentTarget.style.borderColor = theme.colors.primary;
                    }, onBlur: (e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                    } }));
            case 'confirm':
                return (_jsx("p", { style: {
                        margin: '16px 0',
                        fontSize: '14px',
                        color: theme.colors.text,
                        lineHeight: '1.5',
                    }, children: prompt.message }));
            case 'select':
                return (_jsxs("select", { value: value, onChange: (e) => setValue(e.target.value), autoFocus: true, style: inputStyle, onFocus: (e) => {
                        e.currentTarget.style.borderColor = theme.colors.primary;
                    }, onBlur: (e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                    }, children: [_jsx("option", { value: "", children: "Select an option" }), prompt.options?.map((option) => (_jsx("option", { value: option, children: option }, option)))] }));
            default:
                return null;
        }
    };
    if (!prompt || !isOpen)
        return null;
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
            zIndex: 10000,
            padding: '20px',
        }, onClick: !prompt.required ? handleCancel : undefined, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '560px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                border: `1px solid ${theme.colors.border}`,
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                        marginBottom: '16px',
                    }, children: [_jsx("h3", { style: {
                                margin: '0 0 6px 0',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                            }, children: _jsx("span", { children: prompt.title || 'Input Required' }) }), prompt.filePath && (_jsxs("div", { style: {
                                marginTop: 4,
                                fontSize: 12,
                                color: theme.colors.textSecondary,
                                wordBreak: 'break-all',
                            }, children: ["Context: ", prompt.filePath] })), prompt.type !== 'confirm' && (_jsx("p", { style: {
                                margin: '8px 0 0 0',
                                fontSize: '14px',
                                color: theme.colors.textSecondary,
                                lineHeight: '1.5',
                            }, children: prompt.message }))] }), _jsxs("div", { style: { marginBottom: '20px' }, children: [renderInput(), prompt.required && !value && prompt.type !== 'confirm' && (_jsx("p", { style: {
                                margin: '8px 0 0 0',
                                fontSize: '12px',
                                color: theme.colors.error || '#ef4444',
                            }, children: "This field is required" }))] }), _jsxs("div", { style: {
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                    }, children: [!prompt.required && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleIgnore, style: {
                                        padding: '8px 12px',
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '4px',
                                        color: theme.colors.text,
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }, children: "Ignore" }), _jsx("button", { onClick: () => handleSnooze(10), title: "Remind me in 10 minutes", style: {
                                        padding: '8px 12px',
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '4px',
                                        color: theme.colors.text,
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }, children: "Snooze 10m" })] })), _jsx("button", { onClick: handleSubmit, disabled: isSubmitting || (prompt.required && !value && prompt.type !== 'confirm'), style: {
                                padding: '8px 16px',
                                backgroundColor: theme.colors.primary,
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                cursor: isSubmitting || (prompt.required && !value && prompt.type !== 'confirm') ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                opacity: isSubmitting || (prompt.required && !value && prompt.type !== 'confirm') ? 0.6 : 1,
                            }, children: prompt.type === 'confirm' ? 'Confirm' : 'Submit' })] })] }) }));
};
// Hook to manage user prompts globally
export const useUserPrompts = () => {
    const [activePrompt, setActivePrompt] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        // Listen for prompt requests from main process
        const unsubscribe = UserPromptService.onShowPrompt((request) => {
            setActivePrompt(request);
            setIsOpen(true);
        });
        return unsubscribe;
    }, []);
    const handleResponse = useCallback((response) => {
        // Send response back to main process
        UserPromptService.sendResponse(response);
        setIsOpen(false);
        setActivePrompt(null);
    }, []);
    const handleClose = useCallback(() => {
        if (activePrompt && !activePrompt.required) {
            UserPromptService.sendCancelled(activePrompt.id);
            setIsOpen(false);
            setActivePrompt(null);
        }
    }, [activePrompt]);
    return {
        activePrompt,
        isOpen,
        handleResponse,
        handleClose,
    };
};

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Key, Plus, Trash2, Eye, EyeOff, Save, AlertCircle, Shield } from 'lucide-react';
import { SecretsService } from '../../../main-process-api/SecretsService';
export const SecretsModal = ({ isOpen, onClose, repository, selectedSource, }) => {
    const { theme } = useTheme();
    const [secrets, setSecrets] = useState({});
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [editingKey, setEditingKey] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [showValues, setShowValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    // Generate repository ID from repository data
    const getRepoId = () => {
        if (repository.owner && repository.name) {
            return `${repository.owner}/${repository.name}`;
        }
        return repository.name || 'unknown';
    };
    // Get repository path (prefer selected local source)
    const getRepoPath = () => {
        if (selectedSource?.type === 'local' && selectedSource.location) {
            return selectedSource.location;
        }
        if (repository.localClones?.length > 0) {
            return repository.localClones[0].path;
        }
        return repository.remoteUrl || '';
    };
    // Load secrets when modal opens
    useEffect(() => {
        if (isOpen) {
            loadSecrets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);
    const loadSecrets = async () => {
        setLoading(true);
        setError(null);
        try {
            const repoId = getRepoId();
            const storedSecrets = await SecretsService.get(repoId);
            if (storedSecrets) {
                setSecrets(storedSecrets);
                // Get metadata
                const allMetadata = await SecretsService.list();
                const repoMeta = allMetadata.find(m => m.repoId === repoId);
                setMetadata(repoMeta || null);
            }
            else {
                setSecrets({});
                setMetadata(null);
            }
            setHasChanges(false);
        }
        catch (err) {
            console.error('Failed to load secrets:', err);
            setError('Failed to load secrets');
        }
        finally {
            setLoading(false);
        }
    };
    const saveSecrets = async () => {
        setSaving(true);
        setError(null);
        try {
            const result = await SecretsService.store({
                repoId: getRepoId(),
                repoPath: getRepoPath(),
                secrets,
            });
            if (result.success) {
                setMetadata(result.metadata || null);
                setHasChanges(false);
                // Show success feedback
                setError(null);
            }
            else {
                setError(result.error || 'Failed to save secrets');
            }
        }
        catch (err) {
            console.error('Failed to save secrets:', err);
            setError('Failed to save secrets');
        }
        finally {
            setSaving(false);
        }
    };
    const addSecret = () => {
        // Validate key format
        if (!newKey || !newValue) {
            setError('Both key and value are required');
            return;
        }
        if (!/^[A-Z_][A-Z0-9_]*$/i.test(newKey)) {
            setError('Key must be a valid environment variable name (letters, numbers, underscore)');
            return;
        }
        if (secrets[newKey]) {
            setError('Key already exists');
            return;
        }
        setSecrets({ ...secrets, [newKey]: newValue });
        setNewKey('');
        setNewValue('');
        setError(null);
        setHasChanges(true);
    };
    const updateSecret = (key, value) => {
        setSecrets({ ...secrets, [key]: value });
        setEditingKey(null);
        setEditingValue('');
        setHasChanges(true);
    };
    const deleteSecret = (key) => {
        const newSecrets = { ...secrets };
        delete newSecrets[key];
        setSecrets(newSecrets);
        setHasChanges(true);
    };
    const toggleShowValue = (key) => {
        setShowValues({ ...showValues, [key]: !showValues[key] });
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
                width: '90%',
                maxWidth: '700px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${theme.colors.border}`,
            }, children: [_jsxs("div", { style: {
                        padding: '20px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Shield, { size: 20, color: theme.colors.primary }), _jsx("h2", { style: { margin: 0, fontSize: '18px', fontWeight: 600, color: theme.colors.text }, children: "Environment Secrets" }), _jsx("span", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                        padding: '2px 8px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '4px',
                                    }, children: repository.name })] }), _jsx("button", { onClick: onClose, style: {
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                fontSize: '24px',
                                padding: '0',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, children: "\u00D7" })] }), _jsxs("div", { style: {
                        margin: '16px 24px 0',
                        padding: '12px',
                        backgroundColor: `${theme.colors.primary}10`,
                        border: `1px solid ${theme.colors.primary}30`,
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                    }, children: [_jsx(AlertCircle, { size: 16, color: theme.colors.primary, style: { flexShrink: 0, marginTop: '2px' } }), _jsxs("div", { style: { fontSize: '13px', color: theme.colors.text, lineHeight: '1.5' }, children: [_jsx("strong", { children: "Secure Storage:" }), " Secrets are encrypted using your system's secure storage. They are never logged or exposed in plain text. Environment files are created only when needed and automatically cleaned up."] })] }), metadata && (_jsxs("div", { style: {
                        margin: '12px 24px 0',
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                    }, children: ["Last updated: ", new Date(metadata.updatedAt).toLocaleString(), " \u2022", ' ', metadata.secretCount, " secret", metadata.secretCount !== 1 ? 's' : ''] })), _jsx("div", { style: {
                        flex: 1,
                        padding: '16px 24px',
                        overflowY: 'auto',
                    }, children: loading ? (_jsx("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px',
                            color: theme.colors.textSecondary,
                        }, children: "Loading secrets..." })) : (_jsxs(_Fragment, { children: [Object.keys(secrets).length > 0 && (_jsxs("div", { style: { marginBottom: '24px' }, children: [_jsx("h3", { style: {
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '12px',
                                        }, children: "Stored Secrets" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: Object.entries(secrets).map(([key, value]) => (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 12px',
                                                backgroundColor: theme.colors.backgroundSecondary,
                                                borderRadius: '6px',
                                                border: `1px solid ${theme.colors.border}`,
                                            }, children: [_jsx(Key, { size: 14, color: theme.colors.textSecondary }), _jsx("span", { style: {
                                                        fontFamily: 'monospace',
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        color: theme.colors.text,
                                                        minWidth: '150px',
                                                    }, children: key }), editingKey === key ? (_jsxs(_Fragment, { children: [_jsx("input", { type: "text", value: editingValue, onChange: (e) => setEditingValue(e.target.value), onKeyDown: (e) => {
                                                                if (e.key === 'Enter') {
                                                                    updateSecret(key, editingValue);
                                                                }
                                                                else if (e.key === 'Escape') {
                                                                    setEditingKey(null);
                                                                    setEditingValue('');
                                                                }
                                                            }, style: {
                                                                flex: 1,
                                                                padding: '4px 8px',
                                                                backgroundColor: theme.colors.background,
                                                                border: `1px solid ${theme.colors.primary}`,
                                                                borderRadius: '4px',
                                                                fontSize: '13px',
                                                                fontFamily: 'monospace',
                                                                color: theme.colors.text,
                                                                outline: 'none',
                                                            }, autoFocus: true }), _jsx("button", { onClick: () => updateSecret(key, editingValue), style: {
                                                                padding: '4px 8px',
                                                                backgroundColor: theme.colors.primary,
                                                                color: theme.colors.background,
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                cursor: 'pointer',
                                                            }, children: "Save" }), _jsx("button", { onClick: () => {
                                                                setEditingKey(null);
                                                                setEditingValue('');
                                                            }, style: {
                                                                padding: '4px 8px',
                                                                backgroundColor: theme.colors.backgroundTertiary,
                                                                color: theme.colors.text,
                                                                border: `1px solid ${theme.colors.border}`,
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                cursor: 'pointer',
                                                            }, children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                                flex: 1,
                                                                fontFamily: 'monospace',
                                                                fontSize: '13px',
                                                                color: theme.colors.textSecondary,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }, children: showValues[key] ? value : '••••••••' }), _jsx("button", { onClick: () => toggleShowValue(key), style: {
                                                                padding: '4px',
                                                                backgroundColor: 'transparent',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: theme.colors.textSecondary,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                            }, title: showValues[key] ? 'Hide value' : 'Show value', children: showValues[key] ? _jsx(EyeOff, { size: 14 }) : _jsx(Eye, { size: 14 }) }), _jsx("button", { onClick: () => {
                                                                setEditingKey(key);
                                                                setEditingValue(value);
                                                            }, style: {
                                                                padding: '4px 8px',
                                                                backgroundColor: 'transparent',
                                                                color: theme.colors.primary,
                                                                border: `1px solid ${theme.colors.border}`,
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                cursor: 'pointer',
                                                            }, children: "Edit" }), _jsx("button", { onClick: () => {
                                                                if (confirm(`Delete secret "${key}"?`)) {
                                                                    deleteSecret(key);
                                                                }
                                                            }, style: {
                                                                padding: '4px',
                                                                backgroundColor: 'transparent',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: theme.colors.error || '#ef4444',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                            }, title: "Delete secret", children: _jsx(Trash2, { size: 14 }) })] }))] }, key))) })] })), _jsxs("div", { children: [_jsx("h3", { style: {
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '12px',
                                        }, children: "Add New Secret" }), _jsxs("div", { style: {
                                            display: 'flex',
                                            gap: '8px',
                                            alignItems: 'flex-start',
                                        }, children: [_jsx("input", { type: "text", placeholder: "KEY_NAME", value: newKey, onChange: (e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')), onKeyDown: (e) => {
                                                    if (e.key === 'Enter' && newKey) {
                                                        document.getElementById('secret-value-input')?.focus();
                                                    }
                                                }, style: {
                                                    width: '200px',
                                                    padding: '8px 12px',
                                                    backgroundColor: theme.colors.backgroundSecondary,
                                                    border: `1px solid ${theme.colors.border}`,
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontFamily: 'monospace',
                                                    color: theme.colors.text,
                                                    outline: 'none',
                                                } }), _jsx("input", { id: "secret-value-input", type: "password", placeholder: "Secret value", value: newValue, onChange: (e) => setNewValue(e.target.value), onKeyDown: (e) => {
                                                    if (e.key === 'Enter' && newKey && newValue) {
                                                        addSecret();
                                                    }
                                                }, style: {
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    backgroundColor: theme.colors.backgroundSecondary,
                                                    border: `1px solid ${theme.colors.border}`,
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontFamily: 'monospace',
                                                    color: theme.colors.text,
                                                    outline: 'none',
                                                } }), _jsxs("button", { onClick: addSecret, disabled: !newKey || !newValue, style: {
                                                    padding: '8px 16px',
                                                    backgroundColor: newKey && newValue ? theme.colors.primary : theme.colors.backgroundTertiary,
                                                    color: newKey && newValue ? theme.colors.background : theme.colors.textSecondary,
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: 500,
                                                    cursor: newKey && newValue ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    opacity: newKey && newValue ? 1 : 0.5,
                                                }, children: [_jsx(Plus, { size: 14 }), "Add"] })] }), error && (_jsx("div", { style: {
                                            marginTop: '8px',
                                            padding: '8px 12px',
                                            backgroundColor: `${theme.colors.error || '#ef4444'}10`,
                                            border: `1px solid ${theme.colors.error || '#ef4444'}30`,
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            color: theme.colors.error || '#ef4444',
                                        }, children: error }))] })] })) }), _jsxs("div", { style: {
                        padding: '16px 24px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }, children: [_jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: hasChanges && '• Unsaved changes' }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("button", { onClick: onClose, style: {
                                        padding: '8px 16px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        color: theme.colors.text,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }, children: "Cancel" }), _jsxs("button", { onClick: saveSecrets, disabled: !hasChanges || saving, style: {
                                        padding: '8px 16px',
                                        backgroundColor: hasChanges ? theme.colors.primary : theme.colors.backgroundTertiary,
                                        color: hasChanges ? theme.colors.background : theme.colors.textSecondary,
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: hasChanges ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        opacity: hasChanges ? 1 : 0.5,
                                    }, children: [_jsx(Save, { size: 14 }), saving ? 'Saving...' : 'Save Changes'] })] })] })] }) }));
};

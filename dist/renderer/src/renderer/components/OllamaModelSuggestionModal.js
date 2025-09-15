import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { aiService } from '../main-process-api/AIService';
import { X, Download, Cpu, Code, Brain, Zap, Check, AlertCircle, } from 'lucide-react';
// Curated list of models good for architectural analysis
const SUGGESTED_MODELS = [
    {
        name: 'deepseek-coder-v2:16b',
        size: '8.9GB',
        description: 'Specialized code understanding model with strong architectural analysis',
        strengths: [
            'Code comprehension',
            'Pattern recognition',
            'API understanding',
        ],
        category: 'code',
        recommended: true,
    },
    {
        name: 'llama3.2:3b',
        size: '2.0GB',
        description: 'Latest Llama model, good balance of speed and capability',
        strengths: ['Fast inference', 'Good reasoning', 'Structured output'],
        category: 'general',
    },
    {
        name: 'qwen2.5-coder:7b',
        size: '4.7GB',
        description: "Alibaba's code-focused model with strong multilingual support",
        strengths: ['Code analysis', 'Multiple languages', 'Good with types'],
        category: 'code',
    },
    {
        name: 'codellama:13b',
        size: '7.4GB',
        description: "Meta's code-specific model, excellent for understanding code structure",
        strengths: ['Code generation', 'Refactoring', 'Documentation'],
        category: 'code',
    },
    {
        name: 'mistral:7b',
        size: '4.1GB',
        description: 'Fast and efficient general purpose model',
        strengths: ['Speed', 'Instruction following', 'JSON output'],
        category: 'general',
    },
    {
        name: 'phi3:mini',
        size: '2.3GB',
        description: "Microsoft's small but capable model",
        strengths: ['Very fast', 'Low memory', 'Good for simple tasks'],
        category: 'small',
    },
    {
        name: 'granite-code:3b',
        size: '2.0GB',
        description: "IBM's code model trained on diverse codebases",
        strengths: ['Enterprise code', 'Documentation', 'Best practices'],
        category: 'code',
    },
    {
        name: 'starcoder2:3b',
        size: '1.7GB',
        description: 'Lightweight code model from BigCode',
        strengths: ['Fast', 'Good accuracy', 'Multi-language'],
        category: 'small',
    },
];
export const OllamaModelSuggestionModal = ({ isOpen, onClose, installedModels, onModelSelected, onModelsChanged, }) => {
    const { theme } = useTheme();
    const [downloadingModels, setDownloadingModels] = useState(new Set());
    const [downloadProgress, setDownloadProgress] = useState({});
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [downloadQueue, setDownloadQueue] = useState([]);
    useEffect(() => {
        if (!isOpen) {
            setDownloadingModels(new Set());
            setDownloadProgress({});
            setDownloadQueue([]);
        }
    }, [isOpen]);
    // Process download queue
    useEffect(() => {
        if (downloadQueue.length > 0 && downloadingModels.size === 0) {
            const nextModel = downloadQueue[0];
            setDownloadQueue((prev) => prev.slice(1));
            handleDownload(nextModel);
        }
    }, [downloadQueue, downloadingModels]);
    // Listen for download progress
    useEffect(() => {
        const unsubscribe = aiService.onPullOllamaProgress((data) => {
            if (downloadingModels.has(data.progressId)) {
                setDownloadProgress((prev) => ({
                    ...prev,
                    [data.progressId]: data.percent || 0,
                }));
                if (data.status === 'success' || data.status === 'error') {
                    setDownloadingModels((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(data.progressId);
                        return newSet;
                    });
                    if (data.status === 'success' && onModelsChanged) {
                        onModelsChanged();
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [downloadingModels, onModelsChanged]);
    const handleDownload = async (modelName) => {
        setDownloadingModels((prev) => new Set(prev).add(modelName));
        try {
            await aiService.pullOllamaModel({
                modelName,
                progressId: modelName,
            });
        }
        catch (error) {
            console.error('Error downloading model:', error);
            setDownloadingModels((prev) => {
                const newSet = new Set(prev);
                newSet.delete(modelName);
                return newSet;
            });
        }
    };
    const handleDownloadClick = (modelName) => {
        if (downloadingModels.size === 0) {
            // If nothing is downloading, start immediately
            handleDownload(modelName);
        }
        else {
            // Add to queue
            setDownloadQueue((prev) => [...prev, modelName]);
        }
    };
    const filteredModels = SUGGESTED_MODELS.filter((model) => selectedCategory === 'all' || model.category === selectedCategory);
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'code':
                return _jsx(Code, { size: 14 });
            case 'general':
                return _jsx(Brain, { size: 14 });
            case 'small':
                return _jsx(Zap, { size: 14 });
            default:
                return null;
        }
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
            zIndex: 1000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                width: '90%',
                maxWidth: '800px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }, children: [_jsxs("div", { style: {
                        padding: '20px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }, children: [_jsxs("div", { children: [_jsxs("h2", { style: {
                                        margin: 0,
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }, children: [_jsx(Cpu, { size: 20 }), "Recommended Models for Architectural Analysis"] }), _jsx("p", { style: {
                                        margin: '4px 0 0 0',
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                    }, children: "These models are optimized for understanding code structure and patterns" })] }), _jsx("button", { onClick: onClose, style: {
                                padding: '8px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                borderRadius: '4px',
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundSecondary;
                                e.currentTarget.style.color = theme.colors.text;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = theme.colors.textSecondary;
                            }, children: _jsx(X, { size: 20 }) })] }), _jsx("div", { style: {
                        padding: '16px 24px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        gap: '8px',
                    }, children: ['all', 'code', 'general', 'small'].map((category) => (_jsxs("button", { onClick: () => setSelectedCategory(category), style: {
                            padding: '6px 16px',
                            backgroundColor: selectedCategory === category
                                ? theme.colors.primary
                                : theme.colors.backgroundSecondary,
                            color: selectedCategory === category
                                ? theme.colors.background
                                : theme.colors.text,
                            border: `1px solid ${selectedCategory === category ? theme.colors.primary : theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }, children: [category !== 'all' && getCategoryIcon(category), category.charAt(0).toUpperCase() + category.slice(1)] }, category))) }), _jsx("div", { style: {
                        flex: 1,
                        padding: '16px',
                        overflowY: 'auto',
                    }, children: _jsx("div", { style: {
                            display: 'grid',
                            gap: '12px',
                        }, children: filteredModels.map((model) => {
                            const isInstalled = installedModels.some((m) => m.startsWith(model.name.split(':')[0]));
                            const isDownloading = downloadingModels.has(model.name);
                            const isQueued = downloadQueue.includes(model.name);
                            const progress = downloadProgress[model.name] || 0;
                            return (_jsxs("div", { style: {
                                    padding: '16px',
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '8px',
                                    border: `1px solid ${model.recommended ? `${theme.colors.primary}40` : theme.colors.border}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }, children: [model.recommended && (_jsx("div", { style: {
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            padding: '4px 8px',
                                            backgroundColor: `${theme.colors.primary}20`,
                                            color: theme.colors.primary,
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                        }, children: "RECOMMENDED" })), _jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            marginBottom: '12px',
                                        }, children: [_jsxs("div", { children: [_jsxs("h3", { style: {
                                                            margin: 0,
                                                            fontSize: '15px',
                                                            fontWeight: 600,
                                                            color: theme.colors.text,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                        }, children: [getCategoryIcon(model.category), model.name, _jsxs("span", { style: {
                                                                    fontSize: '12px',
                                                                    color: theme.colors.textSecondary,
                                                                    fontWeight: 400,
                                                                }, children: ["(", model.size, ")"] })] }), _jsx("p", { style: {
                                                            margin: '4px 0 0 0',
                                                            fontSize: '13px',
                                                            color: theme.colors.textSecondary,
                                                        }, children: model.description })] }), isInstalled ? (_jsxs("button", { onClick: () => onModelSelected(model.name.split(':')[0]), style: {
                                                    padding: '8px 16px',
                                                    backgroundColor: `${theme.colors.success}20`,
                                                    color: theme.colors.success,
                                                    border: `1px solid ${theme.colors.success}40`,
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s',
                                                }, onMouseEnter: (e) => {
                                                    e.currentTarget.style.backgroundColor = `${theme.colors.success}30`;
                                                }, onMouseLeave: (e) => {
                                                    e.currentTarget.style.backgroundColor = `${theme.colors.success}20`;
                                                }, children: [_jsx(Check, { size: 14 }), "Use Model"] })) : (_jsx("button", { onClick: () => handleDownloadClick(model.name), disabled: isDownloading || isQueued, style: {
                                                    padding: '8px 16px',
                                                    backgroundColor: isDownloading || isQueued
                                                        ? theme.colors.backgroundTertiary
                                                        : theme.colors.primary,
                                                    color: isDownloading || isQueued
                                                        ? theme.colors.textSecondary
                                                        : theme.colors.background,
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    cursor: isDownloading || isQueued
                                                        ? 'not-allowed'
                                                        : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s',
                                                    minWidth: '120px',
                                                    justifyContent: 'center',
                                                }, children: isDownloading ? (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                                width: '14px',
                                                                height: '14px',
                                                                border: '2px solid transparent',
                                                                borderTopColor: theme.colors.textSecondary,
                                                                borderRadius: '50%',
                                                                animation: 'spin 1s linear infinite',
                                                            } }), progress > 0
                                                            ? `${Math.round(progress)}%`
                                                            : 'Downloading...'] })) : isQueued ? (_jsxs(_Fragment, { children: [_jsx(Clock, { size: 14 }), "Queued"] })) : (_jsxs(_Fragment, { children: [_jsx(Download, { size: 14 }), "Download"] })) }))] }), _jsx("div", { style: {
                                            display: 'flex',
                                            gap: '8px',
                                            flexWrap: 'wrap',
                                        }, children: model.strengths.map((strength, index) => (_jsx("span", { style: {
                                                padding: '4px 8px',
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                color: theme.colors.textSecondary,
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                border: `1px solid ${theme.colors.border}`,
                                            }, children: strength }, index))) }), isDownloading && progress > 0 && (_jsx("div", { style: {
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '3px',
                                            backgroundColor: theme.colors.backgroundTertiary,
                                        }, children: _jsx("div", { style: {
                                                height: '100%',
                                                width: `${progress}%`,
                                                backgroundColor: theme.colors.primary,
                                                transition: 'width 0.3s ease',
                                            } }) }))] }, model.name));
                        }) }) }), _jsxs("div", { style: {
                        padding: '16px 24px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                    }, children: [(downloadingModels.size > 0 || downloadQueue.length > 0) && (_jsx("div", { style: {
                                marginBottom: '12px',
                                padding: '8px 12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                borderRadius: '6px',
                                border: `1px solid ${theme.colors.border}`,
                                fontSize: '12px',
                                color: theme.colors.text,
                            }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("div", { style: {
                                            width: '12px',
                                            height: '12px',
                                            border: '2px solid transparent',
                                            borderTopColor: theme.colors.primary,
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite',
                                        } }), downloadingModels.size > 0 && (_jsxs("span", { children: ["Downloading ", Array.from(downloadingModels)[0].split(':')[0]] })), downloadQueue.length > 0 && (_jsxs("span", { style: { color: theme.colors.textSecondary }, children: ["\u2022 ", downloadQueue.length, " in queue"] }))] }) })), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [_jsx(AlertCircle, { size: 16, style: { color: theme.colors.textSecondary, flexShrink: 0 } }), _jsx("p", { style: {
                                        margin: 0,
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary,
                                    }, children: "Code-specific models provide better architectural analysis. Small models are faster but less accurate." })] })] })] }) }));
};

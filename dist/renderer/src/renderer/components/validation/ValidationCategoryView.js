import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { Wrench } from 'lucide-react';
import { getTemplate } from '../../services/validation/templates';
import { validationService } from '../../main-process-api/ValidationService';
import { toolDetectionService } from '../../main-process-api/ToolDetectionService';
const categoryInfo = {
    quality: {
        icon: '✨',
        name: 'Code Quality',
        description: 'Ensure clean, maintainable, and well-formatted code',
    },
    correctness: {
        icon: '✓',
        name: 'Correctness',
        description: 'Verify code logic and type safety',
    },
    security: {
        icon: '🔒',
        name: 'Security',
        description: 'Identify vulnerabilities and security issues',
    },
    performance: {
        icon: '⚡',
        name: 'Performance',
        description: 'Optimize code performance and bundle size',
    },
    build: {
        icon: '🔨',
        name: 'Build & Deploy',
        description: 'Ensure successful builds and deployments',
    },
    custom: {
        icon: '⚙️',
        name: 'Custom',
        description: 'Project-specific validations',
    },
};
// Separate component for preview items to avoid hooks in map
const PreviewActionItem = ({ action, selectedValidation, workingDirectory, selectedLayers, layerFileInfo, theme, testResults, onTestRun, }) => {
    const [fullCommand, setFullCommand] = React.useState('');
    // Generate command with selected layers
    React.useEffect(() => {
        const generateCmd = async () => {
            const cmd = await toolDetectionService.generateCommand(action.command, selectedValidation.detectedTool.packageManager, selectedValidation.packagePath, workingDirectory || selectedValidation.packagePath, action, selectedLayers.get(action.id)
                ? Array.from(selectedLayers.get(action.id))
                : undefined);
            setFullCommand(cmd);
        };
        generateCmd();
    }, [
        action,
        selectedLayers.get(action.id),
        selectedValidation,
        workingDirectory,
    ]);
    return (_jsxs("div", { style: {
            padding: '16px',
            marginBottom: '12px',
            backgroundColor: theme.colors.backgroundLight,
            border: `1px solid ${theme.colors.primary}`,
            borderRadius: '8px',
            position: 'relative',
        }, children: [_jsx("span", { style: {
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    fontSize: '16px',
                    color: theme.colors.primary,
                }, children: "\u2713" }), _jsx("h5", { style: {
                    margin: '0 0 6px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.colors.text,
                }, children: action.name }), _jsx("p", { style: {
                    margin: '0 0 10px 0',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    lineHeight: 1.4,
                }, children: action.description }), action.targetLayers && selectedLayers.get(action.id)?.size ? (_jsxs("div", { style: {
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '4px',
                }, children: [_jsx("div", { style: {
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            marginBottom: '4px',
                        }, children: "Target Layers:" }), _jsx("div", { style: {
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                        }, children: Array.from(selectedLayers.get(action.id) || []).map((layer) => {
                            const fileInfo = layerFileInfo[layer];
                            const fileCount = fileInfo?.count ?? 0;
                            const extensions = fileInfo?.extensions ?? [];
                            return (_jsxs("span", { title: `${layer}: ${extensions.join(', ')} (${fileCount} files found)`, style: {
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    backgroundColor: `${theme.colors.primary}20`,
                                    color: theme.colors.primary,
                                    borderRadius: '4px',
                                    textTransform: 'capitalize',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }, children: [_jsx("span", { style: { fontWeight: '500' }, children: layer }), _jsx("span", { style: {
                                            fontSize: '9px',
                                            opacity: 0.8,
                                            backgroundColor: `${theme.colors.primary}15`,
                                            padding: '1px 4px',
                                            borderRadius: '2px',
                                        }, children: fileCount })] }, layer));
                        }) })] })) : null, _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                }, children: [_jsx("div", { style: {
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            marginBottom: '4px',
                            fontWeight: '500',
                        }, children: "Full command (shows working directory):" }), _jsx("code", { style: {
                            fontSize: '12px',
                            color: theme.colors.text,
                            fontFamily: 'monospace',
                            display: 'block',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                        }, children: fullCommand })] }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '11px',
                        }, children: [_jsxs("span", { style: {
                                    color: theme.colors.textSecondary,
                                }, children: ["Severity:", ' ', _jsx("strong", { style: {
                                            color: action.severity === 'error'
                                                ? theme.colors.error
                                                : action.severity === 'warning'
                                                    ? theme.colors.warning
                                                    : theme.colors.info,
                                        }, children: action.severity })] }), _jsxs("span", { style: {
                                    color: theme.colors.textSecondary,
                                }, children: ["Timeout: ", _jsxs("strong", { children: [(action.timeout || 60000) / 1000, "s"] })] })] }), _jsx("button", { onClick: () => onTestRun(action.id, fullCommand), disabled: testResults.get(action.id)?.running, style: {
                            padding: '6px 12px',
                            backgroundColor: theme.colors.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }, children: testResults.get(action.id)?.running ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "spinner", style: { width: '12px', height: '12px' } }), "Running..."] })) : (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: '14px' }, children: "\u25B6\uFE0F" }), "Test Run"] })) })] }), testResults.get(action.id)?.result &&
                !testResults.get(action.id)?.running && (_jsxs("div", { style: {
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: testResults.get(action.id)?.result?.status === 'success'
                        ? `${theme.colors.success}10`
                        : testResults.get(action.id)?.result?.status === 'warning'
                            ? `${theme.colors.warning}10`
                            : `${theme.colors.error}10`,
                    border: `1px solid ${testResults.get(action.id)?.result?.status === 'success'
                        ? theme.colors.success
                        : testResults.get(action.id)?.result?.status === 'warning'
                            ? theme.colors.warning
                            : theme.colors.error}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: testResults.get(action.id)?.result?.output
                                ? '8px'
                                : 0,
                        }, children: [_jsx("span", { style: {
                                    fontSize: '16px',
                                }, children: testResults.get(action.id)?.result?.status === 'success'
                                    ? '✅'
                                    : testResults.get(action.id)?.result?.status === 'warning'
                                        ? '⚠️'
                                        : '❌' }), _jsxs("strong", { style: {
                                    color: testResults.get(action.id)?.result?.status === 'success'
                                        ? theme.colors.success
                                        : testResults.get(action.id)?.result?.status === 'warning'
                                            ? theme.colors.warning
                                            : theme.colors.error,
                                }, children: ["Test", ' ', testResults.get(action.id)?.result?.status === 'success'
                                        ? 'Passed'
                                        : testResults.get(action.id)?.result?.status === 'warning'
                                            ? 'Warning'
                                            : 'Failed'] }), testResults.get(action.id)?.result?.duration && (_jsxs("span", { style: {
                                    color: theme.colors.textSecondary,
                                    fontSize: '11px',
                                }, children: ["(", (testResults.get(action.id)?.result?.duration / 1000).toFixed(2), "s)"] }))] }), (testResults.get(action.id)?.result?.output ||
                        testResults.get(action.id)?.result?.error) && (_jsx("div", { style: {
                            backgroundColor: theme.colors.backgroundSecondary,
                            padding: '8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            color: theme.colors.text,
                        }, children: testResults.get(action.id)?.result?.error ||
                            testResults.get(action.id)?.result?.output }))] }))] }, action.id));
};
export const ValidationCategoryView = ({ validations, workingDirectory, onAddValidation, onCancel, }) => {
    const { theme } = useTheme();
    const [viewState, setViewState] = useState('categories');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedValidation, setSelectedValidation] = useState(null);
    const [selectedActions, setSelectedActions] = useState(new Set());
    const [selectedLayers, setSelectedLayers] = useState(new Map()); // actionId -> Set of layerIds
    const [detectedLayers, setDetectedLayers] = useState([]);
    const [layerSelectionMode, setLayerSelectionMode] = useState(new Map()); // actionId -> mode
    const [testResults, setTestResults] = useState(new Map());
    const [layerFileInfo, setLayerFileInfo] = useState({}); // layerId -> file info
    const [ignorePatterns, setIgnorePatterns] = useState([]); // Parsed ignore patterns
    // Detect layers when moving to actions view
    React.useEffect(() => {
        if (viewState === 'actions' && selectedValidation) {
            Promise.all([
                toolDetectionService.detectActiveLayers(selectedValidation.packagePath),
                // Get ignore patterns if tool requires ignore file
                (async () => {
                    const template = getTemplate(selectedValidation.templateId);
                    if (template?.tool.requiresIgnoreFile &&
                        selectedValidation.detectedTool.hasIgnoreFile) {
                        return toolDetectionService.readIgnorePatterns(selectedValidation.packagePath, template.tool.requiresIgnoreFile);
                    }
                    return [];
                })(),
                // Get all possible target layers for file counting
                (async () => {
                    const template = getTemplate(selectedValidation.templateId);
                    if (template) {
                        const allTargetLayers = new Set();
                        template.actions
                            .filter((group) => group.category === selectedCategory)
                            .forEach((group) => {
                            group.items.forEach((action) => {
                                if (action.targetLayers) {
                                    action.targetLayers.forEach((layer) => allTargetLayers.add(layer));
                                }
                            });
                        });
                        // Get ignore patterns for accurate file counting
                        let patterns = [];
                        if (template.tool.requiresIgnoreFile &&
                            selectedValidation.detectedTool.hasIgnoreFile) {
                            patterns = await toolDetectionService.readIgnorePatterns(selectedValidation.packagePath, template.tool.requiresIgnoreFile);
                        }
                        return toolDetectionService.getLayerFileInfo(selectedValidation.packagePath, Array.from(allTargetLayers), patterns);
                    }
                    return {};
                })(),
            ])
                .then(([layers, patterns, fileInfo]) => {
                setDetectedLayers(layers);
                setIgnorePatterns(patterns);
                setLayerFileInfo(fileInfo);
                // Pre-select all detected layers for each action and set mode to "all"
                const template = getTemplate(selectedValidation.templateId);
                if (template) {
                    const newSelectedLayers = new Map();
                    const newLayerModes = new Map();
                    template.actions
                        .filter((group) => group.category === selectedCategory)
                        .forEach((group) => {
                        group.items.forEach((action) => {
                            if (action.targetLayers) {
                                // Only include layers that the action targets
                                const applicableLayers = layers.filter((layer) => action.targetLayers.includes(layer));
                                if (applicableLayers.length > 0) {
                                    newSelectedLayers.set(action.id, new Set(applicableLayers));
                                    newLayerModes.set(action.id, 'all'); // Default to "all"
                                }
                            }
                        });
                    });
                    setSelectedLayers(newSelectedLayers);
                    setLayerSelectionMode(newLayerModes);
                }
            })
                .catch(console.error);
        }
    }, [viewState, selectedValidation, selectedCategory]);
    // Group validations by category
    const validationsByCategory = validations.reduce((acc, validation) => {
        const template = getTemplate(validation.templateId);
        if (!template)
            return acc;
        template.actions.forEach((actionGroup) => {
            if (!acc[actionGroup.category]) {
                acc[actionGroup.category] = [];
            }
            if (!acc[actionGroup.category].some((v) => v.id === validation.id)) {
                acc[actionGroup.category].push(validation);
            }
        });
        return acc;
    }, {});
    const handleCreateValidation = () => {
        if (selectedValidation) {
            // Create a copy of the validation with only selected actions and layers
            const configuredValidation = {
                ...selectedValidation,
                availableActions: Array.from(selectedActions),
                selectedLayers: selectedLayers.size > 0
                    ? Array.from(new Set(Array.from(selectedLayers.values()).flatMap((s) => Array.from(s))))
                    : undefined,
            };
            onAddValidation(configuredValidation);
        }
    };
    const getTitle = () => {
        switch (viewState) {
            case 'categories':
                return 'Select a Validation Category';
            case 'tools':
                return 'Select a Validation Tool';
            case 'actions':
                return 'Select Actions to Include';
            case 'preview':
                return 'Preview Validation Layer';
        }
    };
    const handleBack = () => {
        switch (viewState) {
            case 'tools':
                setViewState('categories');
                setSelectedCategory(null);
                break;
            case 'actions':
                setViewState('tools');
                setSelectedActions(new Set());
                break;
            case 'preview':
                setViewState('actions');
                setTestResults(new Map());
                break;
            default:
                onCancel();
        }
    };
    const handleNext = () => {
        if (viewState === 'tools' && selectedValidation) {
            setViewState('actions');
        }
        else if (viewState === 'actions' && selectedActions.size > 0) {
            setViewState('preview');
        }
    };
    return (_jsxs("div", { children: [_jsxs("div", { style: {
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsx("h3", { style: {
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: '600',
                            color: theme.colors.text,
                        }, children: getTitle() }), _jsxs("div", { style: {
                            display: 'flex',
                            gap: '8px',
                        }, children: [_jsx("button", { onClick: handleBack, style: {
                                    padding: '6px 12px',
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    color: theme.colors.text,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                }, children: viewState === 'categories' ? 'Cancel' : 'Back' }), ((viewState === 'tools' && selectedValidation) ||
                                (viewState === 'actions' && selectedActions.size > 0)) && (_jsx("button", { onClick: handleNext, style: {
                                    padding: '6px 12px',
                                    backgroundColor: theme.colors.primary,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s',
                                }, onMouseEnter: (e) => (e.currentTarget.style.opacity = '0.9'), onMouseLeave: (e) => (e.currentTarget.style.opacity = '1'), children: viewState === 'tools' ? 'Next: Select Actions' : 'Next: Preview' }))] })] }), viewState === 'categories' && (
            // Show categories
            _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px',
                }, children: Object.entries(categoryInfo).map(([category, info]) => {
                    const categoryValidations = validationsByCategory[category] || [];
                    if (categoryValidations.length === 0)
                        return null;
                    return (_jsxs("button", { onClick: () => {
                            setSelectedCategory(category);
                            setViewState('tools');
                        }, style: {
                            padding: '16px',
                            backgroundColor: theme.colors.backgroundLight,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.borderColor = theme.colors.primary;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow =
                                '0 4px 12px rgba(0,0,0,0.1)';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.borderColor = theme.colors.border;
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '10px',
                                }, children: [_jsx("span", { style: {
                                            fontSize: '24px',
                                        }, children: info.icon }), _jsx("h4", { style: {
                                            margin: 0,
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            color: theme.colors.text,
                                        }, children: info.name })] }), _jsx("p", { style: {
                                    margin: '0 0 8px 0',
                                    fontSize: '13px',
                                    color: theme.colors.textSecondary,
                                    lineHeight: 1.4,
                                }, children: info.description }), _jsxs("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.primary,
                                    fontWeight: '500',
                                }, children: [categoryValidations.length, " tool", categoryValidations.length !== 1 ? 's' : '', " available"] })] }, category));
                }) })), viewState === 'tools' && selectedCategory && (
            // Show tools in selected category
            _jsxs("div", { children: [_jsxs("div", { style: {
                            marginBottom: '16px',
                            padding: '12px 16px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }, children: [_jsx("span", { style: { fontSize: '20px' }, children: categoryInfo[selectedCategory].icon }), _jsxs("div", { children: [_jsx("h4", { style: {
                                            margin: 0,
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: theme.colors.text,
                                        }, children: categoryInfo[selectedCategory].name }), _jsx("p", { style: {
                                            margin: '2px 0 0 0',
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                        }, children: categoryInfo[selectedCategory].description })] })] }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                            gap: '16px',
                        }, children: validationsByCategory[selectedCategory]?.map((validation) => {
                            const template = getTemplate(validation.templateId);
                            if (!template)
                                return null;
                            const isSelected = selectedValidation?.id === validation.id;
                            return (_jsxs("button", { onClick: () => setSelectedValidation(validation), style: {
                                    padding: '14px',
                                    backgroundColor: isSelected
                                        ? `${theme.colors.primary}10`
                                        : theme.colors.backgroundLight,
                                    border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                }, onMouseEnter: (e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                    }
                                }, onMouseLeave: (e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.borderColor = theme.colors.border;
                                    }
                                }, children: [isSelected && (_jsx("span", { style: {
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            fontSize: '14px',
                                            color: theme.colors.primary,
                                        }, children: "\u2713" })), _jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            marginBottom: '8px',
                                        }, children: [_jsx("span", { style: { fontSize: '20px' }, children: template.tool.icon || _jsx(Wrench, { size: 20 }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                        }, children: [_jsx("h5", { style: {
                                                                    margin: 0,
                                                                    fontSize: '14px',
                                                                    fontWeight: '600',
                                                                    color: theme.colors.text,
                                                                }, children: template.name }), (() => {
                                                                console.log('[ValidationView] Badge check:', {
                                                                    toolName: template.tool.name,
                                                                    requiresIgnoreFile: template.tool.requiresIgnoreFile,
                                                                    hasIgnoreFile: validation.detectedTool.hasIgnoreFile,
                                                                    shouldShowBadge: !!template.tool.requiresIgnoreFile,
                                                                });
                                                                if (!template.tool.requiresIgnoreFile)
                                                                    return null;
                                                                const { hasIgnoreFile } = validation.detectedTool;
                                                                const isConfigured = hasIgnoreFile === true;
                                                                return (_jsxs("span", { title: isConfigured
                                                                        ? `${template.tool.requiresIgnoreFile} found - Directory layer is configured. ${template.tool.name} will respect your ignore patterns.`
                                                                        : `No ${template.tool.requiresIgnoreFile} file found. Directory layer configuration needed for optimal performance.`, style: {
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px',
                                                                        padding: '2px 6px',
                                                                        fontSize: '10px',
                                                                        fontWeight: '500',
                                                                        backgroundColor: isConfigured
                                                                            ? `${theme.colors.success}20`
                                                                            : `${theme.colors.warning}20`,
                                                                        color: isConfigured
                                                                            ? theme.colors.success
                                                                            : theme.colors.warning,
                                                                        border: `1px solid ${isConfigured
                                                                            ? `${theme.colors.success}40`
                                                                            : `${theme.colors.warning}40`}`,
                                                                        borderRadius: '4px',
                                                                        cursor: 'help',
                                                                    }, children: [_jsx("span", { style: { fontSize: '11px' }, children: isConfigured ? '✓' : '📁' }), isConfigured ? 'Configured' : 'Config Missing'] }));
                                                            })()] }), _jsx("div", { style: {
                                                            fontSize: '11px',
                                                            color: theme.colors.textSecondary,
                                                            marginTop: '1px',
                                                        }, children: validation.detectedTool.version })] })] }), _jsx("p", { style: {
                                            margin: '0 0 8px 0',
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                            lineHeight: 1.4,
                                        }, children: template.description }), _jsxs("div", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                        }, children: [template.actions
                                                .filter((group) => group.category === selectedCategory)
                                                .flatMap((group) => group.items).length, ' ', "actions available"] })] }, validation.id));
                        }) })] })), viewState === 'actions' && selectedValidation && selectedCategory && (
            // Show action selection
            _jsxs("div", { children: [_jsxs("div", { style: {
                            marginBottom: '16px',
                            padding: '12px 16px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }, children: [_jsx("span", { style: { fontSize: '20px' }, children: getTemplate(selectedValidation.templateId)?.tool.icon || (_jsx(Wrench, { size: 20 })) }), _jsxs("div", { children: [_jsx("h4", { style: {
                                            margin: 0,
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: theme.colors.text,
                                        }, children: getTemplate(selectedValidation.templateId)?.name }), _jsxs("div", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                            marginTop: '1px',
                                        }, children: [selectedValidation.detectedTool.version, " \u2022", ' ', categoryInfo[selectedCategory].name] })] })] }), _jsx("div", { style: {
                            marginBottom: '16px',
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            textAlign: 'center',
                        }, children: "Select the actions you want to include. You'll see the exact commands that will run." }), getTemplate(selectedValidation.templateId)?.tool
                        .requiresIgnoreFile &&
                        selectedValidation.detectedTool.hasIgnoreFile === false && (_jsx("div", { style: {
                            marginBottom: '16px',
                            padding: '12px 16px',
                            backgroundColor: `${theme.colors.warning}20`,
                            border: `1px solid ${theme.colors.warning}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: theme.colors.text,
                        }, children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                            }, children: [_jsx("span", { style: { fontSize: '14px' }, children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsxs("div", { style: { fontWeight: '500', marginBottom: '4px' }, children: ["No", ' ', getTemplate(selectedValidation.templateId)?.tool
                                                    .requiresIgnoreFile, ' ', "file found"] }), _jsxs("div", { style: {
                                                color: theme.colors.textSecondary,
                                                lineHeight: 1.4,
                                            }, children: [(() => {
                                                    const toolName = getTemplate(selectedValidation.templateId)?.tool.name;
                                                    if (toolName === 'eslint') {
                                                        return 'ESLint will scan all directories including build outputs (dist/, node_modules/, etc.).';
                                                    }
                                                    if (toolName === 'prettier') {
                                                        return 'Prettier will format all files including generated code and dependencies.';
                                                    }
                                                    return 'This tool will process all files without filtering.';
                                                })(), "The directory layer is defined by your ignore file. Consider creating one to improve performance and accuracy.", getTemplate(selectedValidation.templateId)?.tool
                                                    .documentationUrl && (_jsxs(_Fragment, { children: [' ', _jsx("a", { href: getTemplate(selectedValidation.templateId)?.tool
                                                                .documentationUrl, target: "_blank", rel: "noopener noreferrer", style: {
                                                                color: theme.colors.primary,
                                                                textDecoration: 'underline',
                                                                cursor: 'pointer',
                                                            }, onClick: (e) => {
                                                                e.stopPropagation();
                                                            }, children: "Learn more" })] }))] })] })] }) })), getTemplate(selectedValidation.templateId)
                        ?.actions.filter((group) => group.category === selectedCategory)
                        .map((group) => (_jsx("div", { style: { marginBottom: '20px' }, children: group.items.map((action) => {
                            const isSelected = selectedActions.has(action.id);
                            const packageManager = selectedValidation.detectedTool.packageManager || 'npm';
                            const pmCommand = packageManager === 'yarn'
                                ? 'yarn'
                                : `${packageManager} run`;
                            const command = action.command.replace('${pm}', pmCommand);
                            return (_jsxs("div", { style: {
                                    width: '100%',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    backgroundColor: isSelected
                                        ? `${theme.colors.primary}10`
                                        : theme.colors.backgroundLight,
                                    border: `1px solid ${isSelected
                                        ? theme.colors.primary
                                        : theme.colors.border}`,
                                    borderRadius: '8px',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                }, children: [_jsxs("div", { onClick: () => {
                                            const next = new Set(selectedActions);
                                            if (next.has(action.id)) {
                                                next.delete(action.id);
                                            }
                                            else {
                                                next.add(action.id);
                                            }
                                            setSelectedActions(next);
                                        }, style: {
                                            cursor: 'pointer',
                                            padding: '4px',
                                            margin: '-4px',
                                            borderRadius: '4px',
                                            transition: 'background-color 0.2s',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor =
                                                theme.colors.backgroundSecondary;
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }, children: [_jsx("div", { style: { flex: 1 }, children: _jsx("h5", { style: {
                                                        margin: '0 0 6px 0',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        color: theme.colors.text,
                                                    }, children: action.name }) }), _jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '12px',
                                                    color: isSelected
                                                        ? theme.colors.primary
                                                        : theme.colors.textSecondary,
                                                    fontWeight: '500',
                                                    marginTop: '1px',
                                                }, children: [_jsx("span", { style: {
                                                            fontSize: '14px',
                                                            transition: 'transform 0.2s',
                                                        }, children: isSelected ? '✓' : '○' }), _jsx("span", { children: isSelected ? 'Included' : 'Click to include' })] })] }), _jsx("p", { style: {
                                            margin: '0 0 10px 0',
                                            fontSize: '12px',
                                            color: theme.colors.textSecondary,
                                            lineHeight: 1.4,
                                        }, children: action.description }), _jsxs("div", { style: {
                                            backgroundColor: theme.colors.backgroundSecondary,
                                            padding: '10px 12px',
                                            borderRadius: '6px',
                                            marginBottom: '8px',
                                        }, children: [_jsx("div", { style: {
                                                    fontSize: '11px',
                                                    color: theme.colors.textSecondary,
                                                    marginBottom: '4px',
                                                    fontWeight: '500',
                                                }, children: "Command that will run:" }), _jsx("code", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.text,
                                                    fontFamily: 'monospace',
                                                    display: 'block',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-all',
                                                }, children: command })] }), action.targetLayers && detectedLayers.length > 0 && (_jsxs("div", { style: {
                                            marginTop: '10px',
                                            padding: '10px',
                                            backgroundColor: theme.colors.backgroundTertiary,
                                            borderRadius: '6px',
                                        }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '8px',
                                                }, children: [_jsx("div", { style: {
                                                            fontSize: '11px',
                                                            color: theme.colors.textSecondary,
                                                            fontWeight: '500',
                                                        }, children: "Target Layers:" }), _jsxs("div", { style: {
                                                            display: 'flex',
                                                            border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: '4px',
                                                            overflow: 'hidden',
                                                        }, children: [_jsx("button", { onClick: () => {
                                                                    const currentMode = layerSelectionMode.get(action.id) || 'all';
                                                                    if (currentMode !== 'all') {
                                                                        // Switch to "all" mode - select all applicable layers
                                                                        const applicableLayers = action.targetLayers.filter((layer) => detectedLayers.includes(layer));
                                                                        setSelectedLayers((prev) => new Map(prev).set(action.id, new Set(applicableLayers)));
                                                                        setLayerSelectionMode((prev) => new Map(prev).set(action.id, 'all'));
                                                                    }
                                                                }, style: {
                                                                    padding: '4px 8px',
                                                                    fontSize: '10px',
                                                                    backgroundColor: (layerSelectionMode.get(action.id) ||
                                                                        'all') === 'all'
                                                                        ? theme.colors.primary
                                                                        : 'transparent',
                                                                    color: (layerSelectionMode.get(action.id) ||
                                                                        'all') === 'all'
                                                                        ? 'white'
                                                                        : theme.colors.text,
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                }, children: "All" }), _jsx("button", { onClick: () => {
                                                                    const currentMode = layerSelectionMode.get(action.id) || 'all';
                                                                    if (currentMode !== 'custom') {
                                                                        // Switch to "custom" mode - keep current selection
                                                                        setLayerSelectionMode((prev) => new Map(prev).set(action.id, 'custom'));
                                                                    }
                                                                }, style: {
                                                                    padding: '4px 8px',
                                                                    fontSize: '10px',
                                                                    backgroundColor: layerSelectionMode.get(action.id) ===
                                                                        'custom'
                                                                        ? theme.colors.primary
                                                                        : 'transparent',
                                                                    color: layerSelectionMode.get(action.id) ===
                                                                        'custom'
                                                                        ? 'white'
                                                                        : theme.colors.text,
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                }, children: "Custom" })] })] }), _jsx("div", { style: {
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '6px',
                                                }, children: action.targetLayers
                                                    .filter((layer) => detectedLayers.includes(layer))
                                                    .map((layer) => {
                                                    const isSelected = selectedLayers.get(action.id)?.has(layer) ??
                                                        false;
                                                    const isCustomMode = layerSelectionMode.get(action.id) ===
                                                        'custom';
                                                    const isDisabled = !isCustomMode;
                                                    const fileInfo = layerFileInfo[layer];
                                                    const fileCount = fileInfo?.count ?? 0;
                                                    const extensions = fileInfo?.extensions ?? [];
                                                    const hasIgnorePatterns = ignorePatterns.length > 0;
                                                    return (_jsxs("button", { onClick: () => {
                                                            if (!isCustomMode)
                                                                return; // Don't allow changes in "all" mode
                                                            const actionLayers = selectedLayers.get(action.id) ||
                                                                new Set();
                                                            const newActionLayers = new Set(actionLayers);
                                                            if (isSelected) {
                                                                newActionLayers.delete(layer);
                                                            }
                                                            else {
                                                                newActionLayers.add(layer);
                                                            }
                                                            setSelectedLayers(new Map(selectedLayers).set(action.id, newActionLayers));
                                                        }, disabled: isDisabled, title: `${layer} files: ${extensions.join(', ')} (${fileCount} files found${hasIgnorePatterns ? ` after applying ${getTemplate(selectedValidation.templateId)?.tool.requiresIgnoreFile || 'ignore patterns'}` : ''})`, style: {
                                                            padding: '6px 10px',
                                                            fontSize: '11px',
                                                            backgroundColor: isSelected
                                                                ? theme.colors.primary
                                                                : theme.colors.backgroundSecondary,
                                                            color: isSelected
                                                                ? 'white'
                                                                : theme.colors.text,
                                                            border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                                                            borderRadius: '4px',
                                                            cursor: isDisabled
                                                                ? 'not-allowed'
                                                                : 'pointer',
                                                            transition: 'all 0.2s',
                                                            textTransform: 'capitalize',
                                                            opacity: isDisabled ? 0.6 : 1,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            minWidth: '60px',
                                                        }, onMouseEnter: (e) => {
                                                            if (!isSelected && !isDisabled) {
                                                                e.currentTarget.style.borderColor =
                                                                    theme.colors.primary;
                                                                e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
                                                            }
                                                        }, onMouseLeave: (e) => {
                                                            if (!isSelected && !isDisabled) {
                                                                e.currentTarget.style.borderColor =
                                                                    theme.colors.border;
                                                                e.currentTarget.style.backgroundColor =
                                                                    theme.colors.backgroundSecondary;
                                                            }
                                                        }, children: [_jsx("div", { style: { fontWeight: '500' }, children: layer }), _jsxs("div", { style: {
                                                                    fontSize: '9px',
                                                                    opacity: 0.8,
                                                                    marginTop: '1px',
                                                                }, children: [fileCount, " files"] })] }, layer));
                                                }) }), action.targetLayers.filter((layer) => !detectedLayers.includes(layer)).length > 0 && (_jsxs("div", { style: {
                                                    marginTop: '6px',
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                    fontStyle: 'italic',
                                                }, children: ["Not detected:", ' ', action.targetLayers
                                                        .filter((layer) => !detectedLayers.includes(layer))
                                                        .join(', ')] })), ignorePatterns.length > 0 && (_jsxs("div", { style: {
                                                    marginTop: '8px',
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                    fontStyle: 'italic',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }, children: [_jsx("span", { children: "\uD83D\uDCA1" }), "File counts respect", ' ', getTemplate(selectedValidation.templateId)?.tool
                                                        .requiresIgnoreFile || 'ignore', ' ', "patterns"] }))] })), _jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            fontSize: '11px',
                                        }, children: [_jsxs("span", { style: {
                                                    color: theme.colors.textSecondary,
                                                }, children: ["Severity:", ' ', _jsx("strong", { style: {
                                                            color: action.severity === 'error'
                                                                ? theme.colors.error
                                                                : action.severity === 'warning'
                                                                    ? theme.colors.warning
                                                                    : theme.colors.info,
                                                        }, children: action.severity })] }), _jsxs("span", { style: {
                                                    color: theme.colors.textSecondary,
                                                }, children: ["Timeout:", ' ', _jsxs("strong", { children: [(action.timeout || 60000) / 1000, "s"] })] })] })] }, action.id));
                        }) }, group.category))), selectedActions.size === 0 && (_jsx("div", { style: {
                            textAlign: 'center',
                            padding: '40px',
                            color: theme.colors.textSecondary,
                            fontSize: '13px',
                        }, children: "Select at least one action to continue" }))] })), viewState === 'preview' && selectedValidation && selectedCategory && (
            // Show preview - same format as action selection but only selected ones
            _jsxs("div", { children: [_jsxs("div", { style: {
                            marginBottom: '16px',
                            padding: '12px 16px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }, children: [_jsx("span", { style: { fontSize: '20px' }, children: getTemplate(selectedValidation.templateId)?.tool.icon || (_jsx(Wrench, { size: 20 })) }), _jsxs("div", { children: [_jsx("h4", { style: {
                                            margin: 0,
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: theme.colors.text,
                                        }, children: getTemplate(selectedValidation.templateId)?.name }), _jsxs("div", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                            marginTop: '1px',
                                        }, children: [selectedValidation.detectedTool.version, " \u2022", ' ', categoryInfo[selectedCategory].name] })] })] }), _jsx("div", { style: {
                            marginBottom: '16px',
                            padding: '12px',
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            textAlign: 'center',
                        }, children: "Preview your selected actions and test run them before creating the validation layer." }), getTemplate(selectedValidation.templateId)
                        ?.actions.filter((group) => group.category === selectedCategory)
                        .map((group) => (_jsx("div", { style: { marginBottom: '20px' }, children: group.items
                            .filter((action) => selectedActions.has(action.id))
                            .map((action) => (_jsx(PreviewActionItem, { action: action, selectedValidation: selectedValidation, workingDirectory: workingDirectory, selectedLayers: selectedLayers, layerFileInfo: layerFileInfo, theme: theme, testResults: testResults, onTestRun: async (actionId, fullCommand) => {
                                console.log('[ValidationCategoryView] Test run clicked:', {
                                    actionId,
                                    packagePath: selectedValidation.packagePath,
                                    workingDirectory,
                                    fullCommand,
                                });
                                setTestResults((prev) => {
                                    const next = new Map(prev);
                                    next.set(actionId, { running: true });
                                    return next;
                                });
                                try {
                                    const result = await validationService.testRunAction(selectedValidation.packagePath, selectedValidation.templateId, actionId, selectedValidation.detectedTool, workingDirectory || selectedValidation.packagePath, selectedLayers.get(actionId)
                                        ? Array.from(selectedLayers.get(actionId))
                                        : undefined);
                                    setTestResults((prev) => {
                                        const next = new Map(prev);
                                        next.set(actionId, { running: false, result });
                                        return next;
                                    });
                                    console.log('[ValidationCategoryView] Test result:', result);
                                }
                                catch (error) {
                                    console.error('[ValidationCategoryView] Test run failed:', error);
                                    setTestResults((prev) => {
                                        const next = new Map(prev);
                                        next.set(actionId, {
                                            running: false,
                                            result: {
                                                status: 'failure',
                                                error: error instanceof Error
                                                    ? error.message
                                                    : 'Test run failed',
                                            },
                                        });
                                        return next;
                                    });
                                }
                            } }, action.id))) }, group.category))), (() => {
                        const allSelectedResults = Array.from(selectedActions)
                            .map((id) => testResults.get(id))
                            .filter((r) => r?.result);
                        if (allSelectedResults.length > 0) {
                            const successCount = allSelectedResults.filter((r) => r?.result?.status === 'success').length;
                            const warningCount = allSelectedResults.filter((r) => r?.result?.status === 'warning').length;
                            const failureCount = allSelectedResults.filter((r) => r?.result?.status === 'failure').length;
                            return (_jsxs("div", { style: {
                                    marginTop: '16px',
                                    padding: '16px',
                                    backgroundColor: theme.colors.backgroundLight,
                                    borderRadius: '8px',
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: [_jsx("h5", { style: {
                                            margin: '0 0 12px 0',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: theme.colors.text,
                                        }, children: "Test Results Summary" }), _jsxs("div", { style: {
                                            display: 'flex',
                                            gap: '24px',
                                            fontSize: '13px',
                                        }, children: [successCount > 0 && (_jsxs("div", { style: { color: theme.colors.success }, children: ["\u2705 ", successCount, " Passed"] })), warningCount > 0 && (_jsxs("div", { style: { color: theme.colors.warning }, children: ["\u26A0\uFE0F ", warningCount, " Warnings"] })), failureCount > 0 && (_jsxs("div", { style: { color: theme.colors.error }, children: ["\u274C ", failureCount, " Failed"] }))] }), failureCount > 0 && (_jsx("div", { style: {
                                            marginTop: '12px',
                                            padding: '12px',
                                            backgroundColor: `${theme.colors.error}10`,
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            color: theme.colors.error,
                                        }, children: "\u26A0\uFE0F Some tests failed. You can still create the validation layer, but you may want to fix the issues first." }))] }));
                        }
                        return null;
                    })(), _jsxs("div", { style: {
                            marginTop: '24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '8px',
                        }, children: [_jsx("div", { children: _jsx("button", { onClick: async () => {
                                        const allActionIds = Array.from(selectedActions);
                                        // Mark all as running
                                        setTestResults(() => {
                                            const next = new Map();
                                            allActionIds.forEach((id) => next.set(id, { running: true }));
                                            return next;
                                        });
                                        // Run all tests in parallel
                                        const testPromises = allActionIds.map(async (actionId) => {
                                            try {
                                                const result = await validationService.testRunAction(selectedValidation.packagePath, selectedValidation.templateId, actionId, selectedValidation.detectedTool, workingDirectory || selectedValidation.packagePath, selectedLayers.get(actionId)
                                                    ? Array.from(selectedLayers.get(actionId))
                                                    : undefined);
                                                return { actionId, result };
                                            }
                                            catch (error) {
                                                return {
                                                    actionId,
                                                    result: {
                                                        status: 'failure',
                                                        error: error instanceof Error
                                                            ? error.message
                                                            : 'Test run failed',
                                                    },
                                                };
                                            }
                                        });
                                        const results = await Promise.all(testPromises);
                                        // Update all results
                                        setTestResults(() => {
                                            const next = new Map();
                                            results.forEach(({ actionId, result }) => {
                                                next.set(actionId, { running: false, result });
                                            });
                                            return next;
                                        });
                                    }, disabled: Array.from(selectedActions).some((id) => testResults.get(id)?.running), style: {
                                        padding: '8px 16px',
                                        backgroundColor: theme.colors.primary,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }, children: Array.from(selectedActions).some((id) => testResults.get(id)?.running) ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "spinner", style: { width: '14px', height: '14px' } }), "Running Tests..."] })) : (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: '16px' }, children: "\u25B6\uFE0F" }), "Test Run All (", selectedActions.size, " actions)"] })) }) }), _jsx("button", { onClick: handleCreateValidation, style: {
                                    padding: '10px 20px',
                                    backgroundColor: theme.colors.success,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s',
                                }, onMouseEnter: (e) => (e.currentTarget.style.opacity = '0.9'), onMouseLeave: (e) => (e.currentTarget.style.opacity = '1'), children: "Create Validation Layer" })] })] }))] }));
};

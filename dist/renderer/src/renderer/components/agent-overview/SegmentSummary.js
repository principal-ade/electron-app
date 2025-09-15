import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, memo } from 'react';
import { useTheme } from 'themed-markdown';
import { SupportedLLMProvider } from '../../../shared/main-process-api-interfaces/LLMModelsAPI';
import { Sparkles, Loader2 } from 'lucide-react';
import { formatDuration } from './SessionSummaryOverlay/utils';
const SegmentSummaryComponent = ({ segment, session, segmentSummary, onSummaryGenerated, onRegenerateSummary, selectedModel = '', availableModels = [], }) => {
    const { theme } = useTheme();
    const [isGenerating, setIsGenerating] = useState(false);
    const [summary, setSummary] = useState(segmentSummary || null);
    const [error, setError] = useState(null);
    const [modelToUse, setModelToUse] = useState(selectedModel);
    // Reset summary when segment changes or segmentSummary prop changes
    useEffect(() => {
        setSummary(segmentSummary || null);
        setError(null);
    }, [segment?.segmentNumber, segmentSummary]);
    useEffect(() => {
        setModelToUse(selectedModel);
    }, [selectedModel]);
    // Add CSS animation for spinner
    useEffect(() => {
        const styleId = 'segment-summary-animations';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
            document.head.appendChild(style);
        }
    }, []);
    // Extract segment information
    const extractSegmentInfo = () => {
        if (!segment || !segment.events) {
            return {
                modifiedFiles: [],
                filesAccessed: [],
                toolsUsed: [],
                totalEvents: 0,
                duration: 0,
            };
        }
        const modifiedFiles = new Map();
        const filesAccessed = new Set();
        const toolsUsed = new Set();
        // Process events in the segment
        segment.events.forEach((event) => {
            if (event.type === 'file-read') {
                filesAccessed.add(event.data.file);
            }
            else if (event.type === 'file-write') {
                filesAccessed.add(event.data.file);
                modifiedFiles.set(event.data.file, {
                    path: event.data.file,
                    changeType: event.data.write?.operation === 'create'
                        ? 'created'
                        : event.data.write?.operation === 'delete'
                            ? 'deleted'
                            : 'modified',
                    additions: undefined,
                    deletions: undefined,
                });
            }
            else if (event.type === 'tool') {
                toolsUsed.add(event.data.toolName);
            }
            else if (event.type === 'grouped') {
                // Handle grouped events
                event.data.events.forEach((subEvent) => {
                    if (subEvent.type === 'file-read' || subEvent.type === 'file-write') {
                        filesAccessed.add(subEvent.data.file || event.data.filePath);
                        if (subEvent.type === 'file-write') {
                            modifiedFiles.set(subEvent.data.file || event.data.filePath, {
                                path: subEvent.data.file || event.data.filePath,
                                changeType: 'modified',
                                additions: undefined,
                                deletions: undefined,
                            });
                        }
                    }
                    else if (subEvent.type === 'tool') {
                        toolsUsed.add(subEvent.data.toolName);
                    }
                });
            }
        });
        const duration = segment.endTime
            ? segment.endTime - segment.startTime
            : Date.now() - segment.startTime;
        return {
            modifiedFiles: Array.from(modifiedFiles.values()),
            filesAccessed: Array.from(filesAccessed),
            toolsUsed: Array.from(toolsUsed),
            totalEvents: segment.events.filter((e) => e.type !== 'stop').length,
            duration,
        };
    };
    const generateSegmentSummary = async () => {
        if (!segment || !session)
            return;
        setIsGenerating(true);
        setError(null);
        try {
            const segmentInfo = extractSegmentInfo();
            const repoName = session.basicGitInfo?.githubRepo ||
                session.basicGitInfo?.gitRoot?.split('/').pop() ||
                'Current Repository';
            // Create a work session for this segment
            const segmentWorkSession = {
                id: `${session.sessionId}-segment-${segment.segmentNumber}`,
                startTime: segment.startTime,
                endTime: segment.endTime || Date.now(),
                modifiedFiles: segmentInfo.modifiedFiles,
                description: `Segment ${segment.segmentNumber} of development session (${formatDuration(segment.startTime, segment.endTime || Date.now())} duration, ${segmentInfo.totalEvents} events, tools used: ${segmentInfo.toolsUsed.join(', ') || 'none'})`,
                associatedLayers: {
                    validationLayers: [],
                    viewLayers: [],
                    scaffoldLayers: [],
                },
            };
            // SessionSummaryService removed - placeholder implementation
            const result = {
                title: 'Summary unavailable',
                keyPoints: ['Session summary service has been removed'],
                provider: SupportedLLMProvider.OLLAMA,
                modelUsed: 'N/A',
                generatedAt: Date.now()
            };
            // Original call was: sessionSummaryService.generateSessionSummary(...)
            // Now using placeholder implementation
            setSummary(result);
            onSummaryGenerated?.(result);
        }
        catch (error) {
            console.error('Error generating segment summary:', error);
            setError(error instanceof Error ? error.message : 'Failed to generate summary');
        }
        finally {
            setIsGenerating(false);
        }
    };
    return (_jsx("div", { style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.colors.background,
            overflow: 'hidden',
        }, children: isGenerating ? (_jsxs("div", { style: {
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px',
            }, children: [_jsx(Loader2, { size: 48, style: {
                        animation: 'spin 1s linear infinite',
                        color: theme.colors.primary,
                    } }), _jsx("div", { style: {
                        fontSize: '16px',
                        color: theme.colors.textSecondary,
                    }, children: "Generating segment summary..." })] })) : summary ? (_jsxs("div", { style: { height: '100%', display: 'flex', flexDirection: 'column' }, children: [_jsx("div", { style: {
                        padding: '8px 16px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        backgroundColor: theme.colors.backgroundSecondary,
                    }, children: _jsxs("button", { onClick: () => {
                            setSummary(null);
                            setError(null);
                            onRegenerateSummary?.();
                        }, style: {
                            padding: '6px 12px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            color: theme.colors.text,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }, children: [_jsx(Sparkles, { size: 14 }), "Regenerate"] }) }), _jsx("div", { style: { flex: 1, overflow: 'auto' }, children: _jsx("div", { style: {
                            padding: '20px',
                            color: theme.colors.text,
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: '14px',
                        }, children: summary.markdownContent }) })] })) : error ? (_jsxs("div", { style: {
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px',
                padding: '40px',
            }, children: [_jsx("div", { style: {
                        color: theme.colors.danger,
                        fontSize: '16px',
                        textAlign: 'center',
                    }, children: error }), _jsx("button", { onClick: generateSegmentSummary, style: {
                        padding: '8px 16px',
                        backgroundColor: theme.colors.primary,
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }, children: "Retry" })] })) : (_jsxs("div", { style: {
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '24px',
                padding: '40px',
            }, children: [_jsx(Sparkles, { size: 64, style: {
                        color: theme.colors.primary,
                        opacity: 0.3,
                    } }), _jsxs("div", { style: {
                        textAlign: 'center',
                        maxWidth: '400px',
                    }, children: [_jsx("h3", { style: {
                                fontSize: '20px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '12px',
                            }, children: "Segment Summary" }), _jsxs("p", { style: {
                                fontSize: '14px',
                                color: theme.colors.textSecondary,
                                lineHeight: 1.6,
                                marginBottom: '24px',
                            }, children: ["Generate a summary of the work done in Segment", ' ', segment?.segmentNumber || 'N/A', "."] }), modelToUse && availableModels.includes(modelToUse) && (_jsxs("button", { onClick: generateSegmentSummary, style: {
                                padding: '12px 24px',
                                backgroundColor: theme.colors.primary,
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                            }, children: [_jsx(Sparkles, { size: 16 }), "Generate Summary"] }))] })] })) }));
};
export const SegmentSummary = memo(SegmentSummaryComponent);

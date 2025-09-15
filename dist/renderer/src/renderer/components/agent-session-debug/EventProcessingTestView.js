import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { ArrowRight, Play, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
export const EventProcessingTestView = ({ onClose, initialEvent }) => {
    const { theme } = useTheme();
    const [rawEventText, setRawEventText] = useState(initialEvent?.raw ? JSON.stringify(initialEvent.raw, null, 2) : '');
    const [selectedAgent, setSelectedAgent] = useState(initialEvent?.provider || SupportedAgent.CLAUDE);
    const [processedEvent, setProcessedEvent] = useState(initialEvent || null);
    const [processingError, setProcessingError] = useState(null);
    const [copied, setCopied] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    // Sample raw events for quick testing
    const sampleEvents = {
        [SupportedAgent.CLAUDE]: {
            name: 'Claude Read Event',
            event: JSON.stringify({
                type: 'pre-tool-use',
                sessionId: 'test-session-123',
                workingDirectory: '/Users/test/project',
                timestamp: Date.now(),
                tool: 'Read',
                input: {
                    file_path: '/Users/test/project/src/index.ts',
                    limit: 100
                }
            }, null, 2)
        },
        [SupportedAgent.GEMINI]: {
            name: 'Gemini Tool Event',
            event: JSON.stringify({
                eventType: 'tool_call',
                sessionId: 'gemini-test-456',
                directory: '/home/user/code',
                timestamp: Date.now(),
                toolName: 'file_read',
                parameters: {
                    path: 'src/main.py'
                }
            }, null, 2)
        }
    };
    const processEvent = async () => {
        setIsProcessing(true);
        setProcessingError(null);
        setProcessedEvent(null);
        try {
            // Parse the raw event
            let rawEvent;
            try {
                rawEvent = JSON.parse(rawEventText);
            }
            catch (e) {
                throw new Error('Invalid JSON: ' + e.message);
            }
            // Call the main process to process this event
            // Using testDebug API - this is a debug/test utility
            const result = await window.mainProcess.testDebug.processEvent(selectedAgent, rawEvent);
            if (result.success) {
                setProcessedEvent(result.data);
            }
            else {
                setProcessingError(result.error || 'Failed to process event');
            }
        }
        catch (error) {
            setProcessingError(error.message || 'An error occurred');
        }
        finally {
            setIsProcessing(false);
        }
    };
    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        });
    };
    const loadSampleEvent = () => {
        const sample = sampleEvents[selectedAgent];
        if (sample) {
            setRawEventText(sample.event);
            setProcessedEvent(null);
            setProcessingError(null);
        }
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }, children: _jsxs("div", { style: {
                width: '90%',
                maxWidth: '1600px',
                height: '90%',
                backgroundColor: theme.colors.background,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }, children: [_jsxs("div", { style: {
                        padding: '16px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: theme.colors.backgroundSecondary,
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Play, { size: 20, color: "#10b981" }), _jsx("h2", { style: {
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        margin: 0,
                                    }, children: "Event Processing Test" }), initialEvent && (_jsxs("span", { style: {
                                        fontSize: '12px',
                                        color: '#10b981',
                                        padding: '2px 8px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                        borderRadius: '4px',
                                        marginLeft: '8px',
                                    }, children: ["Testing Event #", initialEvent.eventType] }))] }), onClose && (_jsx("button", { onClick: onClose, style: {
                                padding: '6px 12px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                color: theme.colors.text,
                                cursor: 'pointer',
                                fontSize: '13px',
                            }, children: "Close" }))] }), _jsxs("div", { style: {
                        padding: '16px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        backgroundColor: theme.colors.backgroundSecondary,
                    }, children: [_jsxs("select", { value: selectedAgent, onChange: (e) => setSelectedAgent(e.target.value), style: {
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: `1px solid ${theme.colors.border}`,
                                backgroundColor: theme.colors.background,
                                color: theme.colors.text,
                                fontSize: '13px',
                                cursor: 'pointer',
                            }, children: [_jsx("option", { value: SupportedAgent.CLAUDE, children: "Claude" }), _jsx("option", { value: SupportedAgent.GEMINI, children: "Gemini" }), _jsx("option", { value: SupportedAgent.OPENCODE, children: "OpenCode" })] }), _jsx("button", { onClick: loadSampleEvent, style: {
                                padding: '8px 16px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                color: theme.colors.text,
                                cursor: 'pointer',
                                fontSize: '13px',
                            }, children: "Load Sample Event" }), _jsxs("button", { onClick: processEvent, disabled: !rawEventText || isProcessing, style: {
                                padding: '8px 16px',
                                backgroundColor: isProcessing ? theme.colors.backgroundTertiary : '#10b981',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: !rawEventText || isProcessing ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: !rawEventText || isProcessing ? 0.5 : 1,
                            }, children: [_jsx(Play, { size: 14 }), isProcessing ? 'Processing...' : 'Process Event'] }), processingError && (_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: '#ef4444',
                                fontSize: '12px',
                            }, children: [_jsx(AlertCircle, { size: 14 }), processingError] }))] }), _jsxs("div", { style: {
                        flex: 1,
                        display: 'flex',
                        gap: '16px',
                        padding: '16px',
                        overflow: 'hidden',
                    }, children: [_jsxs("div", { style: {
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '8px',
                                    }, children: [_jsx("h3", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0,
                                            }, children: "Raw Event (Input)" }), _jsxs("button", { onClick: () => copyToClipboard(rawEventText, 'raw'), disabled: !rawEventText, style: {
                                                padding: '4px 8px',
                                                backgroundColor: 'transparent',
                                                border: `1px solid ${theme.colors.border}`,
                                                borderRadius: '4px',
                                                color: copied === 'raw' ? '#10b981' : theme.colors.textSecondary,
                                                cursor: rawEventText ? 'pointer' : 'not-allowed',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }, children: [copied === 'raw' ? _jsx(CheckCircle, { size: 12 }) : _jsx(Copy, { size: 12 }), copied === 'raw' ? 'Copied!' : 'Copy'] })] }), _jsx("textarea", { value: rawEventText, onChange: (e) => setRawEventText(e.target.value), placeholder: initialEvent ? "Raw event loaded from session" : "Paste or type raw event JSON here...", style: {
                                        flex: 1,
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '4px',
                                        color: theme.colors.text,
                                        fontFamily: 'monospace',
                                        fontSize: '12px',
                                        resize: 'none',
                                        outline: 'none',
                                    } })] }), _jsx("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 8px',
                            }, children: _jsx(ArrowRight, { size: 24, color: theme.colors.textSecondary }) }), _jsxs("div", { style: {
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '8px',
                                    }, children: [_jsx("h3", { style: {
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                                margin: 0,
                                            }, children: "Normalized Event (Output)" }), _jsxs("button", { onClick: () => copyToClipboard(JSON.stringify(processedEvent, null, 2), 'processed'), disabled: !processedEvent, style: {
                                                padding: '4px 8px',
                                                backgroundColor: 'transparent',
                                                border: `1px solid ${theme.colors.border}`,
                                                borderRadius: '4px',
                                                color: copied === 'processed' ? '#10b981' : theme.colors.textSecondary,
                                                cursor: processedEvent ? 'pointer' : 'not-allowed',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }, children: [copied === 'processed' ? _jsx(CheckCircle, { size: 12 }) : _jsx(Copy, { size: 12 }), copied === 'processed' ? 'Copied!' : 'Copy'] })] }), _jsx("div", { style: {
                                        flex: 1,
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '4px',
                                        overflowY: 'auto',
                                    }, children: processedEvent ? (_jsx("pre", { style: {
                                            margin: 0,
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            color: theme.colors.text,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                        }, children: JSON.stringify(processedEvent, null, 2) })) : (_jsx("div", { style: {
                                            color: theme.colors.textSecondary,
                                            fontSize: '13px',
                                            textAlign: 'center',
                                            marginTop: '20px',
                                        }, children: rawEventText ? 'Click "Process Event" to see normalized output' : 'Enter a raw event and click "Process Event"' })) })] })] }), processedEvent?.paths && (_jsxs("div", { style: {
                        padding: '16px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                    }, children: [_jsx("h4", { style: {
                                fontSize: '13px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "Extracted Paths" }), _jsxs("div", { style: {
                                display: 'flex',
                                gap: '16px',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                            }, children: [processedEvent.files && processedEvent.files.length > 0 && (_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Primary: " }), _jsx("span", { style: { color: '#7c3aed' }, children: processedEvent.files[0].displayPath || '[path not normalized]' })] })), processedEvent.files && processedEvent.files.length > 1 && (_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Secondary: " }), _jsxs("span", { style: { color: '#7c3aed' }, children: [processedEvent.files.length - 1, " files"] })] }))] })] }))] }) }));
};

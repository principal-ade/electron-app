import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Brain, Settings, Save, Code, AlertTriangle, Lightbulb, BookOpen, Users, Sparkles, ChevronDown, ChevronUp, Check, ChevronRight, } from 'lucide-react';
import { useTheme } from 'themed-markdown';
const EXAMPLE_NOTES = [
    {
        type: 'pattern',
        content: 'Always use the @Authenticated decorator for protected endpoints, not middleware',
        tags: ['authentication', 'api', 'security'],
        confidence: 'high',
    },
    {
        type: 'gotcha',
        content: 'Redis connection pool is limited to 10 - rate limiter uses dedicated pool to avoid exhaustion',
        tags: ['redis', 'performance', 'rate-limiting'],
        confidence: 'high',
    },
    {
        type: 'decision',
        content: 'We cache JWT validation for 5 minutes to reduce auth service load. Trade-off: revoked tokens work briefly',
        tags: ['authentication', 'caching', 'performance'],
        confidence: 'medium',
    },
    {
        type: 'explanation',
        content: 'Webhook endpoints need higher rate limits (1000/hour) since external services retry on failure',
        tags: ['webhooks', 'rate-limiting', 'api'],
        confidence: 'high',
    },
];
export const PrincipalIntroPanel = () => {
    const { theme } = useTheme();
    const [activeStep, setActiveStep] = useState(0);
    const [showConfig, setShowConfig] = useState(false);
    const [conceptExpanded, setConceptExpanded] = useState(true);
    const handleNext = () => {
        setActiveStep((prev) => Math.min(prev + 1, 3));
    };
    const handleBack = () => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    };
    const getTypeIcon = (type) => {
        switch (type) {
            case 'pattern':
                return _jsx(Code, { size: 18, color: theme.colors.primary });
            case 'gotcha':
                return _jsx(AlertTriangle, { size: 18, color: "#f59e0b" });
            case 'decision':
                return _jsx(Lightbulb, { size: 18, color: "#10b981" });
            case 'explanation':
                return _jsx(BookOpen, { size: 18, color: "#3b82f6" });
            default:
                return _jsx(Code, { size: 18 });
        }
    };
    const getConfidenceColor = (confidence) => {
        switch (confidence) {
            case 'high':
                return '#10b981';
            case 'medium':
                return '#f59e0b';
            case 'low':
                return '#ef4444';
            default:
                return theme.colors.textSecondary;
        }
    };
    const steps = [
        {
            title: 'Configure Your LLM',
            description: 'Choose your preferred LLM model (GPT-4, Claude, or local models) and set the temperature for response creativity.',
        },
        {
            title: 'Set Response Style',
            description: 'Choose the conversational tone: Mentor (educational), Peer (collaborative), or Expert (authoritative).',
        },
        {
            title: 'Start Saving Notes',
            description: 'As you work with AI agents, save tribal knowledge using the repository_note tool. Tag your notes with relevant keywords.',
        },
        {
            title: 'Query Your Principal',
            description: 'Your AI agents can now ask the principal engineer for guidance. The more notes you save, the smarter the responses!',
        },
    ];
    return (_jsx("div", { style: {
            height: '100%',
            width: '100%',
            overflow: 'auto',
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            padding: '40px',
        }, children: _jsxs("div", { style: { maxWidth: '1200px', margin: '0 auto' }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '40px' }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                marginBottom: '12px',
                            }, children: [_jsx(Brain, { size: 40, color: theme.colors.primary }), _jsx("h1", { style: {
                                        fontSize: '36px',
                                        fontWeight: 700,
                                        margin: 0,
                                        color: theme.colors.text,
                                    }, children: "Principal MCP: Your AI Development Mentor" })] }), _jsx("p", { style: {
                                fontSize: '18px',
                                color: theme.colors.textSecondary,
                                maxWidth: '800px',
                                margin: '0 auto',
                            }, children: "Capture and share tribal knowledge to make your AI agents smarter about your codebase" })] }), _jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '32px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                marginBottom: conceptExpanded ? '20px' : '0',
                            }, onClick: () => setConceptExpanded(!conceptExpanded), children: [_jsx(Sparkles, { size: 24, color: theme.colors.primary, style: { marginRight: '12px' } }), _jsx("h2", { style: { fontSize: '24px', fontWeight: 600, flex: 1, margin: 0 }, children: "The Concept" }), conceptExpanded ? _jsx(ChevronUp, { size: 20 }) : _jsx(ChevronDown, { size: 20 })] }), conceptExpanded && (_jsxs("div", { children: [_jsxs("p", { style: { marginBottom: '16px', lineHeight: 1.6 }, children: [_jsx("strong", { children: "The Problem:" }), " AI agents are powerful but lack context about your specific codebase - its patterns, decisions, gotchas, and tribal knowledge that experienced developers know."] }), _jsxs("p", { style: { marginBottom: '20px', lineHeight: 1.6 }, children: [_jsx("strong", { children: "The Solution:" }), " Principal MCP acts as a virtual principal engineer that learns from notes saved during development. It uses a set-based approach where knowledge naturally overlaps and connects through shared paths and tags."] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }, children: [_jsxs("div", { style: {
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                borderRadius: '8px',
                                                padding: '20px',
                                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '16px' }, children: [_jsx(Users, { size: 20, color: theme.colors.primary, style: { marginRight: '8px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, margin: 0 }, children: "How It Works" })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start' }, children: [_jsx(Check, { size: 16, color: "#10b981", style: { marginRight: '8px', marginTop: '2px', flexShrink: 0 } }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: "Agent asks for advice" }), _jsx("div", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Queries the principal engineer for guidance" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start' }, children: [_jsx(Check, { size: 16, color: "#10b981", style: { marginRight: '8px', marginTop: '2px', flexShrink: 0 } }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: "Principal searches notes" }), _jsx("div", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Finds relevant tribal knowledge from overlapping sets" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start' }, children: [_jsx(Check, { size: 16, color: "#10b981", style: { marginRight: '8px', marginTop: '2px', flexShrink: 0 } }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: "Provides answer or guidance" }), _jsx("div", { style: { fontSize: '14px', color: theme.colors.textSecondary }, children: "Either shares knowledge or encourages note-saving" })] })] })] })] }), _jsxs("div", { style: {
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                borderRadius: '8px',
                                                padding: '20px',
                                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '16px' }, children: [_jsx(Check, { size: 20, color: "#10b981", style: { marginRight: '8px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, margin: 0 }, children: "When Knowledge Exists" })] }), _jsxs("div", { style: {
                                                        backgroundColor: theme.colors.background,
                                                        borderRadius: '6px',
                                                        padding: '12px',
                                                        fontFamily: 'monospace',
                                                        fontSize: '13px',
                                                        lineHeight: 1.5,
                                                    }, children: [_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("strong", { style: { color: theme.colors.primary }, children: "Agent:" }), " \"How should I handle rate limiting for webhooks?\""] }), _jsxs("div", { children: [_jsx("strong", { style: { color: '#10b981' }, children: "Principal:" }), " \"Based on our patterns, webhook endpoints need higher limits (1000/hour) since external services retry. Also, always validate signatures BEFORE rate limit checks to prevent DoS. See similar implementation in /src/api/webhooks.\""] })] })] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }, children: [_jsxs("div", { style: {
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                borderRadius: '8px',
                                                padding: '20px',
                                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '16px' }, children: [_jsx(Lightbulb, { size: 20, color: "#f59e0b", style: { marginRight: '8px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, margin: 0 }, children: "When Knowledge Missing" })] }), _jsxs("div", { style: {
                                                        backgroundColor: theme.colors.background,
                                                        borderRadius: '6px',
                                                        padding: '12px',
                                                        fontFamily: 'monospace',
                                                        fontSize: '13px',
                                                        lineHeight: 1.5,
                                                    }, children: [_jsxs("div", { style: { marginBottom: '8px' }, children: [_jsx("strong", { style: { color: theme.colors.primary }, children: "Agent:" }), " \"How should I structure the payment provider integration?\""] }), _jsxs("div", { children: [_jsx("strong", { style: { color: '#f59e0b' }, children: "Principal:" }), " \"I don't have notes about payment providers yet. After you figure this out, please save a note with: your approach, any gotchas you found, and patterns you established. This will help the next person!\""] })] })] }), _jsxs("div", { style: {
                                                backgroundColor: theme.colors.backgroundTertiary,
                                                borderRadius: '8px',
                                                padding: '20px',
                                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '16px' }, children: [_jsx(Save, { size: 20, color: theme.colors.primary, style: { marginRight: '8px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, margin: 0 }, children: "Agent Saves Knowledge" })] }), _jsx("div", { style: {
                                                        backgroundColor: theme.colors.background,
                                                        borderRadius: '6px',
                                                        padding: '12px',
                                                        fontFamily: 'monospace',
                                                        fontSize: '13px',
                                                        lineHeight: 1.5,
                                                    }, children: _jsxs("div", { children: [_jsx("strong", { style: { color: theme.colors.primary }, children: "repository_note" }), "(", '{', _jsx("br", {}), "\u00A0\u00A0note: \"Use provider abstraction pattern\",", _jsx("br", {}), "\u00A0\u00A0path: \"/src/services/payment\",", _jsx("br", {}), "\u00A0\u00A0tags: [\"payment\", \"architecture\"],", _jsx("br", {}), "\u00A0\u00A0type: \"pattern\",", _jsx("br", {}), "\u00A0\u00A0confidence: \"high\"", _jsx("br", {}), '}', ")"] }) })] })] })] }))] }), _jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '32px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '20px' }, children: [_jsx(Save, { size: 24, color: theme.colors.primary, style: { marginRight: '12px' } }), _jsx("h2", { style: { fontSize: '24px', fontWeight: 600, margin: 0 }, children: "Types of Tribal Knowledge" })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }, children: EXAMPLE_NOTES.map((note, index) => (_jsx("div", { style: {
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    borderRadius: '8px',
                                    padding: '16px',
                                    border: `1px solid ${theme.colors.border}`,
                                }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }, children: [getTypeIcon(note.type), _jsxs("div", { style: { marginLeft: '12px', flex: 1 }, children: [_jsx("div", { style: {
                                                        fontWeight: 600,
                                                        marginBottom: '6px',
                                                        textTransform: 'capitalize',
                                                    }, children: note.type }), _jsx("div", { style: {
                                                        fontSize: '14px',
                                                        lineHeight: 1.5,
                                                        marginBottom: '8px',
                                                    }, children: note.content }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' }, children: [note.tags.map((tag) => (_jsx("span", { style: {
                                                                fontSize: '12px',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                backgroundColor: theme.colors.background,
                                                                border: `1px solid ${theme.colors.border}`,
                                                            }, children: tag }, tag))), _jsx("span", { style: {
                                                                fontSize: '12px',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                backgroundColor: getConfidenceColor(note.confidence),
                                                                color: 'white',
                                                            }, children: note.confidence })] })] })] }) }, index))) })] }), _jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '32px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '20px' }, children: [_jsx(Settings, { size: 24, color: theme.colors.primary, style: { marginRight: '12px' } }), _jsx("h2", { style: { fontSize: '24px', fontWeight: 600, margin: 0 }, children: "Quick Setup Guide" })] }), _jsx("div", { style: {
                                height: '4px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                borderRadius: '2px',
                                marginBottom: '24px',
                                overflow: 'hidden',
                            }, children: _jsx("div", { style: {
                                    height: '100%',
                                    width: `${((activeStep + 1) / steps.length) * 100}%`,
                                    backgroundColor: theme.colors.primary,
                                    transition: 'width 0.3s ease',
                                } }) }), _jsx("div", { children: steps.map((step, index) => (_jsxs("div", { style: {
                                    marginBottom: '20px',
                                    opacity: index === activeStep ? 1 : 0.5,
                                    transition: 'opacity 0.3s ease',
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginBottom: '8px',
                                        }, children: [_jsx("div", { style: {
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    backgroundColor: index <= activeStep ? theme.colors.primary : theme.colors.backgroundTertiary,
                                                    color: index <= activeStep ? 'white' : theme.colors.textSecondary,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 600,
                                                    fontSize: '14px',
                                                    marginRight: '12px',
                                                }, children: index < activeStep ? _jsx(Check, { size: 16 }) : index + 1 }), _jsx("h3", { style: {
                                                    fontSize: '18px',
                                                    fontWeight: 600,
                                                    margin: 0,
                                                }, children: step.title })] }), index === activeStep && (_jsx("div", { style: {
                                            marginLeft: '40px',
                                            fontSize: '14px',
                                            color: theme.colors.textSecondary,
                                            lineHeight: 1.5,
                                        }, children: step.description }))] }, index))) }), _jsxs("div", { style: {
                                display: 'flex',
                                gap: '12px',
                                marginTop: '24px',
                                marginLeft: '40px',
                            }, children: [activeStep > 0 && (_jsx("button", { onClick: handleBack, style: {
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        color: theme.colors.text,
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.border;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                    }, children: "Back" })), activeStep < steps.length - 1 ? (_jsxs("button", { onClick: handleNext, style: {
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        backgroundColor: theme.colors.primary,
                                        color: 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }, children: ["Continue", _jsx(ChevronRight, { size: 16 })] })) : (_jsxs("button", { onClick: () => window.alert('Configuration panel coming soon!'), style: {
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }, children: [_jsx(Settings, { size: 16 }), "Open Configuration"] }))] })] }), _jsxs("div", { style: {
                        backgroundColor: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1))',
                        backgroundImage: `linear-gradient(135deg, ${theme.colors.primary}15, #10b98115)`,
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '32px',
                        border: `2px dashed ${theme.colors.primary}`,
                        textAlign: 'center',
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }, children: [_jsx(Sparkles, { size: 24, color: theme.colors.primary, style: { marginRight: '12px' } }), _jsx("h2", { style: {
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        margin: 0,
                                        background: `linear-gradient(135deg, ${theme.colors.primary}, #10b981)`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }, children: "Coming Soon: Interactive Mode" }), _jsx(Sparkles, { size: 24, color: "#10b981", style: { marginLeft: '12px' } })] }), _jsxs("p", { style: {
                                fontSize: '16px',
                                lineHeight: 1.6,
                                maxWidth: '800px',
                                margin: '0 auto',
                                color: theme.colors.text,
                            }, children: ["When the Principal doesn't have an answer, you'll be able to ", _jsx("strong", { children: "receive the question directly" }), " and provide real-time guidance to your AI agents. Your answers automatically become tribal knowledge, building a living documentation that grows smarter with every interaction."] }), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '32px',
                                marginTop: '20px',
                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(AlertTriangle, { size: 18, color: "#f59e0b" }), _jsx("span", { style: { fontSize: '14px' }, children: "Agent asks question" })] }), _jsx(ChevronRight, { size: 20, color: theme.colors.textSecondary }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Users, { size: 18, color: theme.colors.primary }), _jsx("span", { style: { fontSize: '14px' }, children: "Routed to you" })] }), _jsx(ChevronRight, { size: 20, color: theme.colors.textSecondary }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Save, { size: 18, color: "#10b981" }), _jsx("span", { style: { fontSize: '14px' }, children: "Saved as knowledge" })] })] })] }), _jsxs("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '20px',
                        marginBottom: '32px',
                    }, children: [_jsxs("div", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '12px',
                                padding: '24px',
                                border: `1px solid ${theme.colors.border}`,
                                textAlign: 'center',
                            }, children: [_jsx(BookOpen, { size: 40, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, marginBottom: '8px' }, children: "Continuous Learning" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }, children: "Every note makes your AI agents smarter about your specific codebase and its unique patterns." })] }), _jsxs("div", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '12px',
                                padding: '24px',
                                border: `1px solid ${theme.colors.border}`,
                                textAlign: 'center',
                            }, children: [_jsx(Users, { size: 40, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, marginBottom: '8px' }, children: "Team Knowledge Sharing" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }, children: "Tribal knowledge is preserved and shared across your team, reducing onboarding time." })] }), _jsxs("div", { style: {
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderRadius: '12px',
                                padding: '24px',
                                border: `1px solid ${theme.colors.border}`,
                                textAlign: 'center',
                            }, children: [_jsx(Sparkles, { size: 40, color: theme.colors.primary, style: { marginBottom: '12px' } }), _jsx("h3", { style: { fontSize: '18px', fontWeight: 600, marginBottom: '8px' }, children: "Natural Connections" }), _jsx("p", { style: { fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }, children: "No complex graphs - knowledge naturally connects through overlapping sets of paths and tags." })] })] }), _jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '40px',
                        border: `1px solid ${theme.colors.border}`,
                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '20px' }, children: [_jsx(Settings, { size: 24, color: theme.colors.primary, style: { marginRight: '12px' } }), _jsx("h2", { style: { fontSize: '24px', fontWeight: 600, margin: 0 }, children: "Self-Managing Knowledge Base" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }, children: [_jsxs("div", { children: [_jsx("h3", { style: { fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: theme.colors.text }, children: "\uD83E\uDDF9 Automatic Cleanup" }), _jsx("p", { style: { fontSize: '14px', lineHeight: 1.6, color: theme.colors.textSecondary, margin: 0 }, children: "When files are deleted or refactored, associated notes are automatically archived or flagged for review. Your knowledge base stays relevant without manual maintenance." })] }), _jsxs("div", { children: [_jsx("h3", { style: { fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: theme.colors.text }, children: "\uD83D\uDCC1 Path-Based Lifecycle" }), _jsx("p", { style: { fontSize: '14px', lineHeight: 1.6, color: theme.colors.textSecondary, margin: 0 }, children: "Notes are tied to file paths and directories. As your codebase evolves, outdated knowledge naturally phases out while relevant patterns persist across refactors." })] })] }), _jsx("div", { style: {
                                marginTop: '20px',
                                padding: '16px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                borderRadius: '8px',
                                borderLeft: `4px solid ${theme.colors.primary}`,
                            }, children: _jsxs("p", { style: { fontSize: '14px', lineHeight: 1.6, margin: 0 }, children: [_jsx("strong", { children: "No maintenance burden:" }), " Unlike traditional documentation that goes stale, the Principal's knowledge base self-manages through your natural development workflow. Delete old code? The notes go with it. Refactor a module? Notes get reviewed and updated. It's documentation that evolves with your code."] }) })] })] }) }));
};

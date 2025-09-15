import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { X, Brain, Lightbulb, MessageSquare, GitBranch, Zap, Shield, Github, Code, ExternalLink } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const A24zMemoryInfoModal = ({ isOpen, onClose, noteCount = 0 }) => {
    const { theme } = useTheme();
    // Handle ESC key
    React.useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (_jsxs("div", { style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out'
        }, onClick: onClose, children: [_jsxs("div", { style: {
                    backgroundColor: theme.colors.background,
                    borderRadius: '16px',
                    maxWidth: '600px',
                    width: '90%',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                    border: `1px solid ${theme.colors.border}`,
                    animation: 'slideUp 0.3s ease-out',
                    overflow: 'hidden'
                }, onClick: (e) => e.stopPropagation(), children: [_jsx("button", { onClick: onClose, style: {
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: `${theme.colors.background}80`,
                            backdropFilter: 'blur(8px)',
                            color: theme.colors.textSecondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10,
                            transition: 'all 0.2s'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.background;
                            e.currentTarget.style.color = theme.colors.text;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = `${theme.colors.background}80`;
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }, children: _jsx(X, { size: 16 }) }), _jsx("div", { style: {
                            height: '180px',
                            background: `linear-gradient(135deg, #9333ea15, #ec489915)`,
                            position: 'relative',
                            overflow: 'hidden',
                            borderBottom: `1px solid ${theme.colors.border}`,
                        }, children: _jsxs("svg", { viewBox: "0 0 400 180", style: {
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                                bottom: 0,
                            }, children: [_jsx("line", { x1: "100", y1: "90", x2: "200", y2: "60", stroke: "#9333ea", strokeWidth: "2", opacity: "0.3" }), _jsx("line", { x1: "200", y1: "60", x2: "300", y2: "90", stroke: "#9333ea", strokeWidth: "2", opacity: "0.3" }), _jsx("line", { x1: "100", y1: "90", x2: "150", y2: "130", stroke: "#9333ea", strokeWidth: "2", opacity: "0.3" }), _jsx("line", { x1: "150", y1: "130", x2: "250", y2: "130", stroke: "#9333ea", strokeWidth: "2", opacity: "0.3" }), _jsx("line", { x1: "250", y1: "130", x2: "300", y2: "90", stroke: "#9333ea", strokeWidth: "2", opacity: "0.3" }), _jsx("line", { x1: "200", y1: "60", x2: "250", y2: "130", stroke: "#9333ea", strokeWidth: "2", opacity: "0.3" }), _jsx("circle", { cx: "100", cy: "90", r: "20", fill: "#9333ea", opacity: "0.8" }), _jsx("circle", { cx: "200", cy: "60", r: "25", fill: "#ec4899", opacity: "0.8" }), _jsx("circle", { cx: "300", cy: "90", r: "20", fill: "#9333ea", opacity: "0.8" }), _jsx("circle", { cx: "150", cy: "130", r: "15", fill: "#a855f7", opacity: "0.7" }), _jsx("circle", { cx: "250", cy: "130", r: "18", fill: "#ec4899", opacity: "0.7" }), _jsx("text", { x: "100", y: "95", fill: "white", fontSize: "16", textAnchor: "middle", fontFamily: "system-ui", children: "\uD83D\uDCA1" }), _jsx("text", { x: "200", y: "65", fill: "white", fontSize: "20", textAnchor: "middle", fontFamily: "system-ui", children: "\uD83E\uDDE0" }), _jsx("text", { x: "300", y: "95", fill: "white", fontSize: "16", textAnchor: "middle", fontFamily: "system-ui", children: "\uD83D\uDCDD" }), _jsx("text", { x: "150", y: "135", fill: "white", fontSize: "14", textAnchor: "middle", fontFamily: "system-ui", children: "\uD83D\uDD27" }), _jsx("text", { x: "250", y: "135", fill: "white", fontSize: "14", textAnchor: "middle", fontFamily: "system-ui", children: "\u26A1" })] }) }), _jsxs("div", { style: {
                            padding: '24px',
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '16px',
                                }, children: [_jsx(Brain, { size: 24, color: "#9333ea" }), _jsx("h2", { style: {
                                            color: theme.colors.text,
                                            margin: 0,
                                            fontSize: '22px',
                                            fontWeight: 600,
                                        }, children: "a24z Memory - Your Repository's Knowledge Base" })] }), _jsxs("p", { style: {
                                    color: theme.colors.textSecondary,
                                    fontSize: '15px',
                                    lineHeight: 1.7,
                                    margin: '0 0 24px 0',
                                }, children: ["a24z Memory captures and preserves the ", _jsx("strong", { style: { color: '#9333ea' }, children: "tribal knowledge" }), " of your codebase - the wisdom, gotchas, and insights that usually live only in developers' heads."] }), noteCount > 0 && (_jsx("div", { style: {
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: '#9333ea10',
                                    border: '1px solid #9333ea30',
                                    marginBottom: '20px',
                                }, children: _jsxs("p", { style: {
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        margin: 0,
                                        fontWeight: 500,
                                    }, children: ["\uD83D\uDCDA This repository has ", _jsxs("strong", { style: { color: '#9333ea' }, children: [noteCount, " knowledge note", noteCount !== 1 ? 's' : ''] }), " stored"] }) })), _jsxs("div", { style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: '12px',
                                    marginBottom: '24px',
                                }, children: [_jsx(FeatureBox, { icon: _jsx(Lightbulb, { size: 18 }), title: "Architectural Decisions", description: "Document why things were built a certain way", color: "#f59e0b", theme: theme }), _jsx(FeatureBox, { icon: _jsx(Shield, { size: 18 }), title: "Gotchas & Warnings", description: "Capture tricky bugs and edge cases", color: "#ef4444", theme: theme }), _jsx(FeatureBox, { icon: _jsx(GitBranch, { size: 18 }), title: "Implementation Patterns", description: "Share reusable solutions and approaches", color: "#10b981", theme: theme }), _jsx(FeatureBox, { icon: _jsx(MessageSquare, { size: 18 }), title: "Context & Explanations", description: "Explain complex code sections", color: "#3b82f6", theme: theme })] }), _jsxs("div", { style: {
                                    padding: '16px',
                                    borderRadius: '12px',
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    border: `1px solid ${theme.colors.border}`,
                                    marginBottom: '24px',
                                }, children: [_jsxs("h3", { style: {
                                            color: theme.colors.text,
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            margin: '0 0 12px 0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [_jsx(Zap, { size: 16, color: "#9333ea" }), "How it works"] }), _jsxs("ul", { style: {
                                            color: theme.colors.textSecondary,
                                            fontSize: '13px',
                                            margin: 0,
                                            paddingLeft: '20px',
                                            lineHeight: 1.6,
                                        }, children: [_jsx("li", { children: "AI agents automatically document important discoveries as they work" }), _jsxs("li", { children: ["Knowledge is stored locally in your repository's ", _jsx("code", { style: {
                                                            backgroundColor: theme.colors.backgroundTertiary,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                        }, children: ".a24z/" }), " directory"] }), _jsx("li", { children: "Notes are searchable and surface automatically when relevant" }), _jsx("li", { children: "Helps new team members and AI agents understand your codebase faster" })] })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '12px',
                                    marginBottom: '24px',
                                }, children: [_jsxs("a", { href: "https://github.com/a24z-ai/a24z-memory", target: "_blank", rel: "noopener noreferrer", style: {
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundTertiary,
                                            border: `1px solid ${theme.colors.border}`,
                                            color: theme.colors.text,
                                            textDecoration: 'none',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            e.currentTarget.style.borderColor = '#9333ea';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                            e.currentTarget.style.borderColor = theme.colors.border;
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }, children: [_jsx(Github, { size: 16 }), _jsx("span", { children: "GitHub Repo" }), _jsx(ExternalLink, { size: 12, style: { opacity: 0.5 } })] }), _jsxs("a", { href: "https://marketplace.visualstudio.com/items?itemName=principlemd.memory-palace-vscode-extension", target: "_blank", rel: "noopener noreferrer", style: {
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundTertiary,
                                            border: `1px solid ${theme.colors.border}`,
                                            color: theme.colors.text,
                                            textDecoration: 'none',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            e.currentTarget.style.borderColor = '#0078d4';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                            e.currentTarget.style.borderColor = theme.colors.border;
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }, children: [_jsx(Code, { size: 16 }), _jsx("span", { children: "Memory Palace Extension" }), _jsx(ExternalLink, { size: 12, style: { opacity: 0.5 } })] })] }), _jsx("button", { onClick: onClose, style: {
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#9333ea',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = `0 4px 12px #9333ea40`;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }, children: "Got it!" })] })] }), _jsx("style", { children: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      ` })] }));
};
// Helper component for feature boxes
const FeatureBox = ({ icon, title, description, color, theme }) => (_jsxs("div", { style: {
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: theme.colors.backgroundTertiary,
        border: `1px solid ${theme.colors.border}`,
    }, children: [_jsxs("div", { style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                color,
            }, children: [icon, _jsx("span", { style: {
                        fontSize: '13px',
                        fontWeight: 600,
                        color: theme.colors.text,
                    }, children: title })] }), _jsx("p", { style: {
                fontSize: '12px',
                color: theme.colors.textSecondary,
                margin: 0,
                lineHeight: 1.4,
            }, children: description })] }));

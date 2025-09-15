import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { X, GitBranch, Circle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
export const GitChangesHelpModal = ({ isOpen, onClose }) => {
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
                            background: `linear-gradient(135deg, ${theme.colors.primary}15, #10b98115)`,
                            position: 'relative',
                            overflow: 'hidden',
                            borderBottom: `1px solid ${theme.colors.border}`,
                        }, children: _jsxs("svg", { viewBox: "0 0 400 180", style: {
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                                bottom: 0,
                            }, children: [_jsx("rect", { x: "20", y: "80", width: "160", height: "100", fill: "none", stroke: `${theme.colors.border}`, strokeWidth: "2", strokeDasharray: "5,5", opacity: "0.5" }), _jsx("rect", { x: "200", y: "60", width: "180", height: "120", fill: "none", stroke: `${theme.colors.border}`, strokeWidth: "2", strokeDasharray: "5,5", opacity: "0.5" }), _jsx("rect", { x: "40", y: "140", width: "25", height: "40", fill: theme.colors.textSecondary, opacity: "0.3", rx: "2" }), _jsx("rect", { x: "145", y: "120", width: "25", height: "60", fill: theme.colors.textSecondary, opacity: "0.3", rx: "2" }), _jsx("rect", { x: "75", y: "130", width: "25", height: "50", fill: "#f59e0b", opacity: "0.7", rx: "2" }), _jsx("rect", { x: "265", y: "110", width: "35", height: "70", fill: "#f59e0b", opacity: "0.7", rx: "2" }), _jsx("rect", { x: "110", y: "150", width: "25", height: "30", fill: "#10b981", opacity: "0.7", rx: "2" }), _jsx("rect", { x: "220", y: "100", width: "35", height: "80", fill: "#10b981", opacity: "0.7", rx: "2" }), _jsx("rect", { x: "310", y: "90", width: "35", height: "90", fill: "#ef4444", opacity: "0.5", rx: "2", strokeDasharray: "3,3", stroke: "#ef4444" }), _jsx("text", { x: "100", y: "70", fill: theme.colors.textSecondary, fontSize: "11", textAnchor: "middle", fontFamily: "system-ui", children: "Working Tree" }), _jsx("text", { x: "290", y: "50", fill: theme.colors.textSecondary, fontSize: "11", textAnchor: "middle", fontFamily: "system-ui", children: "HEAD Commit" })] }) }), _jsxs("div", { style: {
                            padding: '24px',
                        }, children: [_jsx("h2", { style: {
                                    color: theme.colors.text,
                                    margin: '0 0 20px 0',
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                }, children: "Understanding Git Changes" }), _jsxs("div", { style: {
                                    marginBottom: '24px',
                                }, children: [_jsxs("h3", { style: {
                                            color: theme.colors.text,
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            marginBottom: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }, children: [_jsx(GitBranch, { size: 16 }), "Project Folder Sources"] }), _jsxs("div", { style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundSecondary,
                                            border: `1px solid ${theme.colors.border}`,
                                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '3px 10px',
                                                            borderRadius: '6px',
                                                            backgroundColor: '#64748b22',
                                                            color: '#64748b',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            whiteSpace: 'nowrap',
                                                        }, children: [_jsx(GitBranch, { size: 12 }), "my-project (HEAD)"] }), _jsx("span", { style: { color: theme.colors.textSecondary, fontSize: '13px' }, children: "The last committed state of your files" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '3px 10px',
                                                            borderRadius: '6px',
                                                            backgroundColor: theme.colors.primary + '22',
                                                            color: theme.colors.primary,
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            whiteSpace: 'nowrap',
                                                        }, children: [_jsx(GitBranch, { size: 12 }), "my-project (main)"] }), _jsx("span", { style: { color: theme.colors.textSecondary, fontSize: '13px' }, children: "Your current working tree with uncommitted changes" })] })] })] }), _jsxs("div", { style: {
                                    marginBottom: '24px',
                                }, children: [_jsx("h3", { style: {
                                            color: theme.colors.text,
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            marginBottom: '12px',
                                        }, children: "Change Colors" }), _jsxs("div", { style: {
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '12px',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: theme.colors.backgroundSecondary,
                                            border: `1px solid ${theme.colors.border}`,
                                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Circle, { size: 12, fill: "#10b981", color: "#10b981" }), _jsxs("span", { style: { color: theme.colors.text, fontSize: '13px' }, children: [_jsx("strong", { children: "Green:" }), " New files"] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Circle, { size: 12, fill: "#f59e0b", color: "#f59e0b" }), _jsxs("span", { style: { color: theme.colors.text, fontSize: '13px' }, children: [_jsx("strong", { children: "Orange:" }), " Modified"] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Circle, { size: 12, fill: "#ef4444", color: "#ef4444" }), _jsxs("span", { style: { color: theme.colors.text, fontSize: '13px' }, children: [_jsx("strong", { children: "Red:" }), " Deleted"] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Circle, { size: 12, fill: "#8b5cf6", color: "#8b5cf6" }), _jsxs("span", { style: { color: theme.colors.text, fontSize: '13px' }, children: [_jsx("strong", { children: "Purple:" }), " Renamed"] })] })] })] }), _jsx("div", { style: {
                                    padding: '16px',
                                    borderRadius: '12px',
                                    backgroundColor: `${theme.colors.primary}10`,
                                    border: `1px solid ${theme.colors.primary}30`,
                                    marginBottom: '20px',
                                }, children: _jsxs("p", { style: {
                                        color: theme.colors.text,
                                        fontSize: '14px',
                                        margin: 0,
                                        lineHeight: 1.6,
                                    }, children: ["When you enable git changes, the visualization shows both your ", _jsx("strong", { children: "working tree" }), " (current files) and the ", _jsx("strong", { children: "HEAD commit" }), " (last committed state). Files are colored based on their git status, making it easy to see what has changed since your last commit."] }) }), _jsx("div", { style: { textAlign: 'center' }, children: _jsx("button", { onClick: onClose, style: {
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: theme.colors.primary,
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}40`;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }, children: "Got it!" }) })] })] }), _jsx("style", { children: `
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

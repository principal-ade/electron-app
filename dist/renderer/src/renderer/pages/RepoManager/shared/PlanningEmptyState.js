import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FileSearch, Bot, FilePlus, Sparkles } from 'lucide-react';
import { AGENT_INFO } from "@principal-ai/agent-monitoring";
export const PlanningEmptyState = ({ theme, agentsWithMCP = [], onStartWithAgent, onCreateNew }) => {
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto'
        }, children: [_jsx("div", { style: {
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: `${theme.colors.primary}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px'
                }, children: _jsx(FileSearch, { size: 36, style: { color: theme.colors.primary } }) }), _jsx("div", { style: {
                    fontSize: '28px',
                    fontWeight: 700,
                    color: theme.colors.text,
                    marginBottom: '12px'
                }, children: "Start Planning Your Project" }), _jsxs("div", { style: {
                    fontSize: '15px',
                    color: theme.colors.textSecondary,
                    marginBottom: '32px',
                    lineHeight: '1.5'
                }, children: ["Choose an existing document from the panels on the left,", _jsx("br", {}), "or create a new one to begin planning"] }), onCreateNew && (_jsxs("button", { onClick: onCreateNew, style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '24px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.filter = 'brightness(1.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.filter = 'brightness(1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }, children: [_jsx(FilePlus, { size: 18 }), "Create New Document"] })), agentsWithMCP.length > 0 && (_jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundLight,
                    borderRadius: '12px',
                    padding: '24px',
                    border: `1px solid ${theme.colors.border}`,
                    width: '100%',
                    marginTop: '12px'
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            marginBottom: '20px',
                            color: theme.colors.text
                        }, children: [_jsx(Sparkles, { size: 20, style: { color: theme.colors.primary } }), _jsx("span", { style: { fontSize: '16px', fontWeight: 600 }, children: "Or start with an AI Assistant" })] }), _jsxs("p", { style: {
                            fontSize: '14px',
                            color: theme.colors.textSecondary,
                            marginBottom: '20px',
                            lineHeight: '1.5'
                        }, children: ["These AI assistants are configured with planning tools", _jsx("br", {}), "to help you create and organize your documents"] }), _jsx("div", { style: {
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                        }, children: agentsWithMCP.map(agent => (_jsxs("button", { onClick: () => onStartWithAgent?.(agent), style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                backgroundColor: theme.colors.backgroundSecondary,
                                color: theme.colors.text,
                                border: `2px solid ${AGENT_INFO[agent].ui.color}`,
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = AGENT_INFO[agent].ui.color;
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                e.currentTarget.style.color = theme.colors.text;
                                e.currentTarget.style.transform = 'translateY(0)';
                            }, children: [_jsx(Bot, { size: 16 }), AGENT_INFO[agent].displayName] }, agent))) })] }))] }));
};

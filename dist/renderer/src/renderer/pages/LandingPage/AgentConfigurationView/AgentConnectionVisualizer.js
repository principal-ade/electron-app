import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { Bot, Database, Brain } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { getAgentInfo } from "@principal-ai/agent-monitoring";
import { WindowService } from '../../../main-process-api/WindowService';
export const AgentConnectionVisualizer = ({ agentType, isInstalled, hasHooks, hasMCP = false, className = '' }) => {
    const { theme } = useTheme();
    const agentConfig = getAgentInfo(agentType);
    const [isHoveringSpecktor, setIsHoveringSpecktor] = React.useState(false);
    const [selectedComponent, setSelectedComponent] = React.useState(null);
    const AgentIcon = Bot;
    // Always show MCP server circle so users can click on it
    const showMCPServer = true;
    return (_jsx("div", { className: `relative ${className}`, style: { height: '100%', width: '100%' }, children: _jsxs("svg", { width: "100%", height: "100%", viewBox: "0 0 450 260", preserveAspectRatio: "xMidYMid meet", className: "w-full h-full", children: [_jsxs("g", { transform: "translate(70, 160)", onClick: () => setSelectedComponent('agent'), style: { cursor: 'pointer' }, children: [_jsx("circle", { cx: "0", cy: "0", r: "40", fill: isInstalled ? agentConfig.ui.color : theme.colors.border, fillOpacity: isInstalled ? 0.2 : 0.1, stroke: isInstalled ? agentConfig.ui.color : theme.colors.border, strokeWidth: "2", className: "transition-all duration-500" }), _jsx("foreignObject", { x: "-20", y: "-20", width: "40", height: "40", children: _jsx("div", { className: "flex items-center justify-center w-full h-full", children: _jsx(AgentIcon, { size: 24, className: "transition-all duration-500", style: {
                                        color: isInstalled
                                            ? theme.colors.text
                                            : theme.colors.textSecondary,
                                    } }) }) })] }), hasHooks && isInstalled && (_jsxs("g", { children: [_jsx("line", { x1: "103", y1: "135", x2: "185", y2: "70", stroke: agentConfig.ui.color, strokeWidth: "2", strokeDasharray: "5,5", opacity: "0.6" }), [0, 1, 2].map((index) => (_jsx("circle", { r: "3", fill: agentConfig.ui.color, opacity: "0.8", children: _jsx("animateMotion", { dur: "3s", repeatCount: "indefinite", begin: `${index * 1}s`, children: _jsx("mpath", { href: "#agentToSpektorPath" }) }) }, index))), _jsx("path", { id: "agentToSpektorPath", d: "M 103 135 L 185 70", stroke: "none", fill: "none" })] })), _jsxs("g", { transform: "translate(225, 60)", onMouseEnter: () => setIsHoveringSpecktor(true), onMouseLeave: () => setIsHoveringSpecktor(false), onClick: () => setSelectedComponent('specktor'), style: { cursor: 'pointer' }, children: [_jsx("circle", { cx: "0", cy: "0", r: "40", fill: isHoveringSpecktor && hasHooks && isInstalled
                                ? `${theme.colors.primary}20`
                                : theme.colors.backgroundSecondary, stroke: hasHooks && isInstalled ? theme.colors.primary : theme.colors.border, strokeWidth: isHoveringSpecktor && hasHooks && isInstalled ? "3" : "2", style: { transition: 'all 0.2s' } }), _jsx("foreignObject", { x: "-30", y: "-28", width: "60", height: "50", style: { pointerEvents: 'none' }, children: _jsxs("div", { className: "flex flex-col items-center justify-center w-full h-full", style: { paddingTop: '4px' }, children: [_jsx(Database, { size: isHoveringSpecktor && hasHooks && isInstalled ? 22 : 20, className: "transition-all duration-200", style: {
                                            color: hasHooks && isInstalled
                                                ? theme.colors.primary
                                                : theme.colors.textSecondary,
                                            transform: isHoveringSpecktor && hasHooks && isInstalled ? 'translateY(-1px)' : 'translateY(0)',
                                        } }), _jsx("span", { className: "text-xs font-medium", style: {
                                            marginTop: '2px',
                                            color: hasHooks && isInstalled
                                                ? theme.colors.primary
                                                : theme.colors.textSecondary,
                                            fontWeight: isHoveringSpecktor && hasHooks && isInstalled ? 600 : 500,
                                        }, children: "Specktor" })] }) }), hasHooks && isInstalled && (_jsxs("circle", { cx: "0", cy: "0", r: "45", fill: "none", stroke: theme.colors.primary, strokeWidth: "1", opacity: "0", children: [_jsx("animate", { attributeName: "r", from: "45", to: "60", dur: "3s", repeatCount: "indefinite" }), _jsx("animate", { attributeName: "opacity", from: "0.6", to: "0", dur: "3s", repeatCount: "indefinite" })] }))] }), showMCPServer && hasMCP && (_jsxs("g", { children: [_jsx("line", { x1: "110", y1: "155", x2: "340", y2: "155", stroke: "#ef4444", strokeWidth: "2", strokeDasharray: "5,5", opacity: "0.6" }), _jsx("line", { x1: "340", y1: "165", x2: "110", y2: "165", stroke: theme.colors.primary, strokeWidth: "2", strokeDasharray: "5,5", opacity: "0.6" }), [0, 1, 2].map((index) => (_jsx("circle", { r: "3", fill: "#ef4444", opacity: "0.8", children: _jsx("animateMotion", { dur: "4s", repeatCount: "indefinite", begin: `${index * 1.3}s`, children: _jsx("mpath", { href: "#agentToMcpPath" }) }) }, `agent-to-mcp-${index}`))), [0, 1, 2].map((index) => (_jsx("circle", { r: "3", fill: theme.colors.primary, opacity: "0.8", children: _jsx("animateMotion", { dur: "4s", repeatCount: "indefinite", begin: `${index * 1.3 + 0.65}s`, children: _jsx("mpath", { href: "#mcpToAgentPath" }) }) }, `mcp-to-agent-${index}`))), _jsx("path", { id: "agentToMcpPath", d: "M 110 155 L 340 155", stroke: "none", fill: "none" }), _jsx("path", { id: "mcpToAgentPath", d: "M 340 165 L 110 165", stroke: "none", fill: "none" })] })), showMCPServer && (_jsxs("g", { transform: "translate(380, 160)", onClick: () => setSelectedComponent('mcp'), style: { cursor: 'pointer' }, children: [_jsx("circle", { cx: "0", cy: "0", r: "40", fill: theme.colors.backgroundSecondary, fillOpacity: hasMCP ? 0.8 : 0.5, stroke: theme.colors.border, strokeWidth: "2", strokeDasharray: hasMCP ? '0' : '5,5', className: "transition-all duration-500" }), _jsx("foreignObject", { x: "-30", y: "-22", width: "60", height: "50", children: _jsxs("div", { className: "flex flex-col items-center justify-center w-full h-full", children: [_jsx(Brain, { size: 18, style: {
                                            color: theme.colors.textSecondary,
                                            marginBottom: '2px'
                                        } }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-xs font-medium", style: {
                                                    color: theme.colors.textSecondary,
                                                }, children: "Principal" }), _jsx("div", { className: "text-[10px] font-medium", style: {
                                                    color: theme.colors.textSecondary,
                                                }, children: "MCP" })] })] }) })] })), _jsxs("g", { transform: "translate(225, 215)", children: [!selectedComponent && (_jsx("text", { textAnchor: "middle", className: "text-xs italic", style: { fill: theme.colors.textSecondary }, children: "Click on a component to learn more" })), selectedComponent === 'agent' && (_jsxs(_Fragment, { children: [_jsx("text", { textAnchor: "middle", className: "text-xs font-semibold", y: "-5", style: { fill: theme.colors.text }, children: "Agent" }), _jsxs("text", { textAnchor: "middle", className: "text-xs", y: "10", style: { fill: theme.colors.textSecondary }, children: ["The ", agentConfig.name, " agent that processes and responds to your requests"] })] })), selectedComponent === 'specktor' && (_jsxs(_Fragment, { children: [_jsx("text", { textAnchor: "middle", className: "text-xs font-semibold", y: "-5", style: { fill: theme.colors.text }, children: "Specktor" }), _jsx("text", { textAnchor: "middle", className: "text-xs", y: "10", style: { fill: theme.colors.textSecondary }, children: "Event monitoring and debugging tool" }), hasHooks && isInstalled && (_jsx("foreignObject", { x: "-50", y: "20", width: "100", height: "35", children: _jsx("button", { className: "px-3 py-1 text-xs rounded", style: {
                                            backgroundColor: theme.colors.primary,
                                            color: theme.colors.background
                                        }, onClick: async () => {
                                            try {
                                                await WindowService.openStoreViewer({
                                                    agent: agentType,
                                                    namespace: 'events'
                                                });
                                            }
                                            catch (error) {
                                                console.error('Failed to open store viewer:', error);
                                            }
                                        }, children: "Open Store Viewer" }) }))] })), selectedComponent === 'mcp' && (_jsxs(_Fragment, { children: [_jsx("text", { textAnchor: "middle", className: "text-xs font-semibold", y: "-5", style: { fill: theme.colors.text }, children: "Principle MCP" }), _jsx("text", { textAnchor: "middle", className: "text-xs", y: "10", style: { fill: theme.colors.textSecondary }, children: "Model Context Protocol server for custom tools" })] }))] })] }) }));
};

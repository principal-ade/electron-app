import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Terminal, FileText, PenTool } from 'lucide-react';
import { AGENT_INFO } from "@principal-ai/agent-monitoring";
export const PlanningAgentGuide = ({ theme, selectedAgent, onCreateDocument }) => {
    const agentInfo = AGENT_INFO[selectedAgent];
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center'
        }, children: [_jsxs("div", { style: {
                    marginBottom: '48px'
                }, children: [_jsxs("div", { style: {
                            fontSize: '28px',
                            fontWeight: 600,
                            color: agentInfo.ui.color || theme.colors.primary,
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px'
                        }, children: [_jsx(Terminal, { size: 28 }), agentInfo.displayName, " is Ready"] }), _jsxs("p", { style: {
                            fontSize: '16px',
                            color: theme.colors.text,
                            maxWidth: '500px',
                            margin: '0 auto',
                            lineHeight: 1.5
                        }, children: ["Type ", _jsx("code", { style: {
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: agentInfo.ui.color
                                }, children: "start planning" }), " in the terminal to begin"] })] }), _jsxs("div", { style: {
                    display: 'flex',
                    gap: '20px',
                    maxWidth: '700px',
                    width: '100%',
                    marginBottom: '32px'
                }, children: [_jsxs("div", { style: {
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '12px',
                            padding: '20px',
                            flex: 1,
                            border: `1px solid ${theme.colors.border}`
                        }, children: [_jsxs("div", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }, children: [_jsx(FileText, { size: 16 }), "Planning Tool Features"] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    textAlign: 'left'
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: theme.colors.primary }, children: "\u2022" }), _jsx("span", { children: "Slide-based documents for organized planning" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: theme.colors.primary }, children: "\u2022" }), _jsx("span", { children: "Markdown with live preview" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: theme.colors.primary }, children: "\u2022" }), _jsx("span", { children: "Excalidraw for visual diagrams" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: theme.colors.primary }, children: "\u2022" }), _jsx("span", { children: "Auto-saves your work" })] })] })] }), _jsxs("div", { style: {
                            backgroundColor: theme.colors.backgroundLight,
                            borderRadius: '12px',
                            padding: '20px',
                            flex: 1,
                            border: `1px solid ${theme.colors.border}`
                        }, children: [_jsxs("div", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }, children: [_jsx(Terminal, { size: 16 }), "How It Works"] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    textAlign: 'left'
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: agentInfo.ui.color }, children: "1." }), _jsx("span", { children: "Tell the agent what you want to plan" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: agentInfo.ui.color }, children: "2." }), _jsx("span", { children: "AI helps structure your ideas" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: agentInfo.ui.color }, children: "3." }), _jsx("span", { children: "Navigate and edit slides as you go" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '6px' }, children: [_jsx("span", { style: { color: agentInfo.ui.color }, children: "4." }), _jsx("span", { children: "Export or continue working anytime" })] })] })] })] }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: theme.colors.textTertiary
                }, children: [_jsx("span", { children: "Or create blank:" }), _jsxs("button", { onClick: () => onCreateDocument('markdown'), style: {
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            color: theme.colors.textSecondary,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.borderColor = agentInfo.ui.color;
                            e.currentTarget.style.color = agentInfo.ui.color;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.borderColor = theme.colors.border;
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }, children: [_jsx(FileText, { size: 14, style: { display: 'inline', verticalAlign: 'middle', marginRight: '4px' } }), "Markdown"] }), _jsxs("button", { onClick: () => onCreateDocument('excalidraw'), style: {
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            color: theme.colors.textSecondary,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.borderColor = agentInfo.ui.color;
                            e.currentTarget.style.color = agentInfo.ui.color;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.borderColor = theme.colors.border;
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }, children: [_jsx(PenTool, { size: 14, style: { display: 'inline', verticalAlign: 'middle', marginRight: '4px' } }), "Excalidraw"] })] })] }));
};

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { ToolUsageCard, RecentToolCallsCard, } from './SessionDetailCards';
export const ToolUseView = ({ session }) => {
    const { theme } = useTheme();
    if (!session.toolCalls || session.toolCalls.length === 0) {
        return (_jsx("div", { style: {
                textAlign: 'center',
                padding: '32px 0',
                color: theme.colors.textSecondary,
            }, children: _jsx("p", { children: "No tool calls recorded for this session" }) }));
    }
    const toolCounts = session.toolCalls.reduce((acc, tc) => {
        acc[tc.toolName] = (acc[tc.toolName] || 0) + 1;
        return acc;
    }, {});
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsx(ToolUsageCard, { toolCounts: toolCounts }), _jsx(RecentToolCallsCard, { toolCalls: session.toolCalls })] }));
};

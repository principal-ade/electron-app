import { useTheme } from '@principal-ade/industry-theme';
import {
  ToolStatsCards,
  ToolUsageCard,
  RecentToolCallsCard,
} from './SessionDetailCards';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';

interface ToolUseViewProps {
  session: AgentSessionRecord;
}

export const ToolUseView: React.FC<ToolUseViewProps> = ({ session }) => {
  const { theme } = useTheme();

  if (!session.toolCalls || session.toolCalls.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '32px 0',
          color: theme.colors.textSecondary,
        }}
      >
        <p>No tool calls recorded for this session</p>
      </div>
    );
  }

  const toolCounts = session.toolCalls.reduce(
    (acc, tc) => {
      acc[tc.toolName] = (acc[tc.toolName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Tool Usage by Frequency */}
      <ToolUsageCard toolCounts={toolCounts} />

      {/* Recent Tool Calls */}
      <RecentToolCallsCard toolCalls={session.toolCalls} />
    </div>
  );
};

import React from 'react';
import { Terminal, FileText, PenTool } from 'lucide-react';
import { SupportedAgent, AGENT_INFO } from '@principal-ai/agent-monitoring';

interface PlanningAgentGuideProps {
  theme: any;
  selectedAgent: SupportedAgent;
  onCreateDocument: (type: 'markdown' | 'excalidraw') => void;
}

export const PlanningAgentGuide: React.FC<PlanningAgentGuideProps> = ({
  theme,
  selectedAgent,
  onCreateDocument,
}) => {
  const agentInfo = AGENT_INFO[selectedAgent];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      {/* Agent Header */}
      <div
        style={{
          marginBottom: '48px',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: agentInfo.ui.color || theme.colors.primary,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <Terminal size={28} />
          {agentInfo.displayName} is Ready
        </div>
        <p
          style={{
            fontSize: '16px',
            color: theme.colors.text,
            maxWidth: '500px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Type{' '}
          <code
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              color: agentInfo.ui.color,
            }}
          >
            start planning
          </code>{' '}
          in the terminal to begin
        </p>
      </div>

      {/* Two info boxes side by side */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          maxWidth: '700px',
          width: '100%',
          marginBottom: '32px',
        }}
      >
        {/* What the planning tool does */}
        <div
          style={{
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={16} />
            Planning Tool Features
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
              textAlign: 'left',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: theme.colors.primary }}>•</span>
              <span>Slide-based documents for organized planning</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: theme.colors.primary }}>•</span>
              <span>Markdown with live preview</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: theme.colors.primary }}>•</span>
              <span>Excalidraw for visual diagrams</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: theme.colors.primary }}>•</span>
              <span>Auto-saves your work</span>
            </div>
          </div>
        </div>

        {/* What happens when you start */}
        <div
          style={{
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '12px',
            padding: '20px',
            flex: 1,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Terminal size={16} />
            How It Works
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
              textAlign: 'left',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: agentInfo.ui.color }}>1.</span>
              <span>Tell the agent what you want to plan</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: agentInfo.ui.color }}>2.</span>
              <span>AI helps structure your ideas</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: agentInfo.ui.color }}>3.</span>
              <span>Navigate and edit slides as you go</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <span style={{ color: agentInfo.ui.color }}>4.</span>
              <span>Export or continue working anytime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick create buttons - smaller and simpler */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: theme.colors.textTertiary,
        }}
      >
        <span>Or create blank:</span>
        <button
          onClick={() => onCreateDocument('markdown')}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = agentInfo.ui.color;
            e.currentTarget.style.color = agentInfo.ui.color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <FileText
            size={14}
            style={{
              display: 'inline',
              verticalAlign: 'middle',
              marginRight: '4px',
            }}
          />
          Markdown
        </button>
        <button
          onClick={() => onCreateDocument('excalidraw')}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = agentInfo.ui.color;
            e.currentTarget.style.color = agentInfo.ui.color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <PenTool
            size={14}
            style={{
              display: 'inline',
              verticalAlign: 'middle',
              marginRight: '4px',
            }}
          />
          Excalidraw
        </button>
      </div>
    </div>
  );
};

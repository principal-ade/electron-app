import React from 'react';
import { FileSearch, Bot, FilePlus, Sparkles } from 'lucide-react';
import { SupportedAgent, AGENT_INFO } from "@principal-ai/agent-monitoring";

interface PlanningEmptyStateProps {
  theme: any;
  agentsWithMCP?: SupportedAgent[];
  onStartWithAgent?: (agent: SupportedAgent) => void;
  onCreateNew?: () => void;
}

export const PlanningEmptyState: React.FC<PlanningEmptyStateProps> = ({
  theme,
  agentsWithMCP = [],
  onStartWithAgent,
  onCreateNew
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '40px',
      textAlign: 'center',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Empty State Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: `${theme.colors.primary}10`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        <FileSearch size={36} style={{ color: theme.colors.primary }} />
      </div>
      
      <div style={{
        fontSize: '28px',
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: '12px'
      }}>
        Start Planning Your Project
      </div>
      
      <div style={{
        fontSize: '15px',
        color: theme.colors.textSecondary,
        marginBottom: '32px',
        lineHeight: '1.5'
      }}>
        Choose an existing document from the panels on the left,<br />
        or create a new one to begin planning
      </div>
      
      {/* Create New Document Button */}
      {onCreateNew && (
        <button
          onClick={onCreateNew}
          style={{
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
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
          }}
        >
          <FilePlus size={18} />
          Create New Document
        </button>
      )}
      
      {/* AI Assistant Options */}
      {agentsWithMCP.length > 0 && (
        <div style={{
          backgroundColor: theme.colors.backgroundLight,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${theme.colors.border}`,
          width: '100%',
          marginTop: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '20px',
            color: theme.colors.text
          }}>
            <Sparkles size={20} style={{ color: theme.colors.primary }} />
            <span style={{ fontSize: '16px', fontWeight: 600 }}>
              Or start with an AI Assistant
            </span>
          </div>
          <p style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            These AI assistants are configured with planning tools<br />
            to help you create and organize your documents
          </p>
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {agentsWithMCP.map(agent => (
              <button
                key={agent}
                onClick={() => onStartWithAgent?.(agent)}
                style={{
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = AGENT_INFO[agent].ui.color;
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  e.currentTarget.style.color = theme.colors.text;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Bot size={16} />
                {AGENT_INFO[agent].displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
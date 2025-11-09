import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Globe,
  Bot,
  RefreshCw,
  Settings as SettingsIcon,
  Activity,
  FolderOpen,
} from 'lucide-react';
import { GeneralSettings } from './components/GeneralSettings';
import { AIAssistantsSettings } from './components/AIAssistantsSettings';
import { UpdatesSettings } from './components/UpdatesSettings';
import { ObservabilitySettings } from './components/ObservabilitySettings';
import { WorkspaceSettings } from './components/WorkspaceSettings';

type SettingsCategory =
  | 'general'
  | 'workspaces'
  | 'ai-assistants'
  | 'updates'
  | 'observability';

export const Settings: React.FC = () => {
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>('general');
  const [updateAvailable] = useState(false); // This will be connected to UpdatesSettings state later if needed

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <SettingsIcon size={20} color={theme.colors.text} />
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
          Settings
        </h2>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div
          style={{
            width: '240px',
            borderRight: `1px solid ${theme.colors.border}`,
            padding: '20px',
            flexShrink: 0,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveCategory('general')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'general'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'general'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'general' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'general') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'general') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Globe size={18} />
              General
            </button>

            <button
              onClick={() => setActiveCategory('workspaces')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'workspaces'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'workspaces'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'workspaces' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'workspaces') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'workspaces') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <FolderOpen size={18} />
              Workspaces
            </button>

            <button
              onClick={() => setActiveCategory('ai-assistants')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'ai-assistants'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'ai-assistants'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'ai-assistants' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'ai-assistants') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'ai-assistants') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Bot size={18} />
              AI Assistants
            </button>

            <button
              onClick={() => setActiveCategory('updates')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'updates'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'updates'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'updates' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'updates') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'updates') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <RefreshCw size={18} />
              Updates
              {updateAvailable && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: theme.colors.warning,
                    boxShadow: `0 0 8px ${theme.colors.warning}80`,
                  }}
                />
              )}
            </button>

            <button
              onClick={() => setActiveCategory('observability')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'observability'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'observability'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'observability' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'observability') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'observability') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Activity size={18} />
              Observability
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            padding: '32px',
            overflowY: 'auto',
          }}
        >
          {activeCategory === 'general' && <GeneralSettings />}
          {activeCategory === 'workspaces' && <WorkspaceSettings />}
          {activeCategory === 'ai-assistants' && <AIAssistantsSettings />}
          {activeCategory === 'updates' && <UpdatesSettings />}
          {activeCategory === 'observability' && <ObservabilitySettings />}
        </div>
      </div>
    </div>
  );
};

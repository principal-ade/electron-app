import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Globe,
  Bot,
  RefreshCw,
  Settings as SettingsIcon,
  Puzzle,
  Sparkles,
  Shield,
} from 'lucide-react';
import { GeneralSettings } from './components/GeneralSettings';
import { AIAssistantsSettings } from './components/AIAssistantsSettings';
import { UpdatesSettings } from './components/UpdatesSettings';
import { GeminiSettings } from './components/GeminiSettings';
import { SecuritySettings } from './components/SecuritySettings';
import { WindowService } from '../../../main-process-api/WindowService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';

export type SettingsCategory =
  | 'general'
  | 'security'
  | 'ai-assistants'
  | 'gemini'
  | 'updates';

export interface SettingsProps {
  initialCategory?: SettingsCategory;
}

export const Settings: React.FC<SettingsProps> = ({ initialCategory }) => {
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>(initialCategory ?? 'general');
  const [updateAvailable] = useState(false); // This will be connected to UpdatesSettings state later if needed
  const [showExtensionsButton, setShowExtensionsButton] = useState(false);

  // Update category when initialCategory prop changes
  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    // Load user preferences for showing buttons
    UserPreferencesService.getPreferences().then((prefs) => {
      setShowExtensionsButton(prefs.showExtensionsButton ?? false);
    });

    // Listen for preference changes
    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) {
        if ('showExtensionsButton' in detail) {
          setShowExtensionsButton(detail.showExtensionsButton ?? false);
        }
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

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
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        <SettingsIcon size={20} color={theme.colors.primary} />
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
              onClick={() => setActiveCategory('security')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'security'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'security'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'security' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'security') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'security') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Shield size={18} />
              Security
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
              onClick={() => setActiveCategory('gemini')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeCategory === 'gemini'
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color:
                  activeCategory === 'gemini'
                    ? theme.colors.primary
                    : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: activeCategory === 'gemini' ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== 'gemini') {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== 'gemini') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Sparkles size={18} />
              Gemini AI
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

            {showExtensionsButton && (
              <>
                {/* Divider */}
                <div
                  style={{
                    height: '1px',
                    backgroundColor: theme.colors.border,
                    margin: '12px 0',
                  }}
                />

                {/* Extensions - Opens separate window */}
                <button
                  onClick={() => WindowService.openExtensionWindow()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    fontWeight: 500,
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Puzzle size={18} />
                  Extensions
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    ↗
                  </span>
                </button>
              </>
            )}
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
          {activeCategory === 'security' && <SecuritySettings />}
          {activeCategory === 'ai-assistants' && <AIAssistantsSettings />}
          {activeCategory === 'gemini' && <GeminiSettings />}
          {activeCategory === 'updates' && <UpdatesSettings />}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, FolderOpen, Calendar, Star } from 'lucide-react';
import { IndustryMarkdownSlide } from 'themed-markdown';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import type { Topic } from '../../tipc/topicClient';
import { predefinedThemes, getThemeNames } from '../../themes/predefinedThemes';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { TopicService } from '../../main-process-api/TopicService';

export interface WorkspaceInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
}

const formatDate = (ts?: number) => {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

export const WorkspaceInfoModal: React.FC<WorkspaceInfoModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const { theme } = useTheme();
  const availableThemes = getThemeNames();
  const selectedTheme = workspace.theme || 'principalAI';
  const topicId = workspace.topicIds?.[0];
  const [topic, setTopic] = useState<Topic | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Load the workspace's topic only while the modal is open. The topic
  // description can be large markdown; keeping the load gated on `isOpen`
  // avoids paying for it on every workspace render. Subscribes to topic
  // change broadcasts so an in-flight description edit reflects live.
  useEffect(() => {
    if (!isOpen || !topicId) {
      setTopic(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      TopicService.getTopic(topicId)
        .then((t) => {
          if (cancelled) return;
          setTopic(t);
        })
        .catch((err) => {
          console.error('[WorkspaceInfoModal] failed to load topic', err);
        });
    };
    load();
    const off = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [isOpen, topicId]);

  if (!isOpen) return null;

  const handleThemeChange = async (themeName: string) => {
    if (themeName === selectedTheme) return;
    try {
      await WorkspaceService.updateWorkspace(workspace.id, {
        theme: themeName,
      });
    } catch (err) {
      console.error('[WorkspaceInfoModal] Failed to set theme:', err);
    }
  };

  const createdLabel = formatDate(workspace.createdAt);
  const updatedLabel = formatDate(workspace.updatedAt);

  const content = (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '12px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 20px 12px 20px',
            gap: '12px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspace.name}
              </span>
              {workspace.isDefault && (
                <span
                  title="Default workspace"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: `${theme.fontSizes[0]}px`,
                    color: theme.colors.accent,
                  }}
                >
                  <Star size={12} fill="currentColor" />
                  Default
                </span>
              )}
            </div>
            {workspace.description && (
              <span
                style={{
                  fontSize: `${theme.fontSizes[1]}px`,
                  color: theme.colors.textSecondary,
                }}
              >
                {workspace.description}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Topic description — rendered as markdown so headings, lists, and
            code blocks from the topic's `description` (e.g. a design doc
            appended via `/api/topics/:id/description/append`) read as authored.
            Sits above the Details block so it reads as the main body
            content; hidden when there's no topic or it has no description. */}
        {topic?.description && topic.description.trim().length > 0 && (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <IndustryMarkdownSlide
              content={topic.description}
              slideIdPrefix={`workspace-info-topic-${topic.id}`}
              slideIndex={0}
              isVisible={isOpen}
              theme={theme}
              transparentBackground
              disableScroll
              enableKeyboardScrolling={false}
            />
          </div>
        )}

        {/* Details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary,
          }}
        >
          {workspace.suggestedClonePath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={14} />
              <span
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: `${theme.fontSizes[0]}px`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: theme.colors.text,
                }}
                title={workspace.suggestedClonePath}
              >
                {workspace.suggestedClonePath}
              </span>
            </div>
          )}
          {(createdLabel || updatedLabel) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} />
              <span>
                {createdLabel && <>Created {createdLabel}</>}
                {createdLabel && updatedLabel && <> · </>}
                {updatedLabel && <>Updated {updatedLabel}</>}
              </span>
            </div>
          )}
        </div>


        {/* Theme picker — native <select> for a compact dropdown. The
            selected theme's description (when present) renders below as a
            small caption so the per-theme blurbs aren't lost in the
            collapse from list to dropdown. */}
        <div style={{ padding: '16px 20px 20px 20px' }}>
          <div
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              marginBottom: '10px',
            }}
          >
            Theme
          </div>
          <select
            value={selectedTheme}
            onChange={(e) => handleThemeChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              cursor: 'pointer',
            }}
          >
            {availableThemes.map((themeName) => {
              const info = predefinedThemes[themeName];
              return (
                <option key={themeName} value={themeName}>
                  {info?.name || themeName}
                </option>
              );
            })}
          </select>
          {predefinedThemes[selectedTheme]?.description && (
            <div
              style={{
                marginTop: '8px',
                fontSize: `${theme.fontSizes[0]}px`,
                color: theme.colors.textSecondary,
                lineHeight: 1.4,
              }}
            >
              {predefinedThemes[selectedTheme].description}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

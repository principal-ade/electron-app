import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Check, FolderOpen, Calendar, Star } from 'lucide-react';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { predefinedThemes, getThemeNames } from '../../themes/predefinedThemes';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';

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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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

        {/* Theme picker */}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {availableThemes.map((themeName) => {
              const info = predefinedThemes[themeName];
              const isSelected = themeName === selectedTheme;
              return (
                <button
                  key={themeName}
                  onClick={() => handleThemeChange(themeName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    backgroundColor: isSelected
                      ? theme.colors.backgroundTertiary
                      : 'transparent',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: theme.fonts.body,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: `${theme.fontSizes[1]}px`,
                        fontWeight: isSelected
                          ? theme.fontWeights.semibold
                          : theme.fontWeights.medium,
                      }}
                    >
                      {info?.name || themeName}
                    </span>
                    {info?.description && (
                      <span
                        style={{
                          fontSize: `${theme.fontSizes[0]}px`,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {info.description}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={16} color={theme.colors.accent} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

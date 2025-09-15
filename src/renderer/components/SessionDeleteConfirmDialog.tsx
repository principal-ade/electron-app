import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import { CustomLayersStorageService } from '../services/storage/CustomLayersStorageService';

interface SessionDeleteConfirmDialogProps {
  session: AgentSessionRecord;
  directory: string;
  onConfirm: (persistLayers: boolean) => void;
  onCancel: () => void;
}

export const SessionDeleteConfirmDialog: React.FC<
  SessionDeleteConfirmDialogProps
> = ({ session, directory, onConfirm, onCancel }) => {
  const { theme } = useTheme();
  const [persistLayers, setPersistLayers] = useState(true); // Default to yes

  // Check if session has file activity that would create layers
  const hasFileActivity =
    Object.keys(session.fileAccesses || {}).length > 0 ||
    Object.keys(session.fileWrites || {}).length > 0;

  const handleDelete = async () => {
    if (persistLayers && hasFileActivity) {
      // Convert session layer to custom layer for persistence
      const layerItems: any[] = [];

      // Add accessed files
      Object.keys(session.fileAccesses || {}).forEach((filePath) => {
        layerItems.push({
          path: filePath.startsWith('/') ? filePath : `/${filePath}`,
          type: 'file' as const,
          renderStrategy: 'border' as const,
        });
      });

      // Add written files with different style
      if (session.fileWrites) {
        Object.keys(session.fileWrites).forEach((filePath) => {
          layerItems.push({
            path: filePath.startsWith('/') ? filePath : `/${filePath}`,
            type: 'file' as const,
            renderStrategy: 'fill' as const,
          });
        });
      }

      if (layerItems.length > 0) {
        const sessionName =
          session.metadata?.customName ||
          `Session ${session.sessionId.substring(0, 8)}`;
        const customLayer = {
          id: `custom-session-${session.sessionId}`,
          name: `${sessionName} Files`,
          enabled: true,
          color: '#3b82f6',
          opacity: 0.5,
          borderWidth: 2,
          priority: 40,
          dynamic: false,
          items: layerItems,
        };

        try {
          await CustomLayersStorageService.addOrUpdateLayer(
            directory,
            customLayer,
          );
        } catch (error) {
          console.error('Failed to save session layer:', error);
        }
      }
    }

    onConfirm(persistLayers);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '20px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          Delete Agent Session?
        </h3>

        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: '1.5',
          }}
        >
          This will permanently delete session{' '}
          <strong>{session.sessionId.substring(0, 8)}</strong>.
        </p>

        {/* Session Summary */}
        {hasFileActivity && (
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '13px',
            }}
          >
            <div style={{ marginBottom: '8px', color: theme.colors.text }}>
              <strong>Session file activity:</strong>
            </div>
            <div
              style={{ color: theme.colors.textSecondary, marginBottom: '4px' }}
            >
              • {Object.keys(session.fileAccesses || {}).length} files accessed
            </div>
            {Object.keys(session.fileWrites || {}).length > 0 && (
              <div style={{ color: theme.colors.textSecondary }}>
                • {Object.keys(session.fileWrites || {}).length} files modified
              </div>
            )}
          </div>
        )}

        {/* Layer Persistence Option */}
        {hasFileActivity && (
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                color: theme.colors.text,
              }}
            >
              <input
                type="checkbox"
                checked={persistLayers}
                onChange={(e) => setPersistLayers(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              Save session layer before deleting
            </label>
            <p
              style={{
                margin: '8px 0 0 24px',
                fontSize: '12px',
                color: theme.colors.textSecondary,
                lineHeight: '1.4',
              }}
            >
              This will save the files accessed and modified in this session as
              a persistent layer that you can toggle on/off in the Layers tab.
            </p>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.error || '#ef4444',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.error || '#ef4444';
            }}
          >
            Delete Session
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Plus, Folder, Search } from 'lucide-react';

interface AddProjectMenuProps {
  onAddProject: () => void;
  onSearchHome: () => void;
  scanningHome: boolean;
}

export const AddProjectMenu: React.FC<AddProjectMenuProps> = ({
  onAddProject,
  onSearchHome,
  scanningHome,
}) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Add a project to the registry"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 999,
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights.semibold,
          cursor: 'pointer',
          transition: 'color 120ms ease, border-color 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme.colors.text;
          e.currentTarget.style.borderColor = theme.colors.textSecondary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = theme.colors.textSecondary;
          e.currentTarget.style.borderColor = theme.colors.border;
        }}
      >
        <Plus size={14} />
        Add Project
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 20,
              background: 'transparent',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              minWidth: 240,
              borderRadius: 10,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              zIndex: 21,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddProject();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary ?? theme.colors.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Folder
                size={16}
                color={theme.colors.primary}
                style={{ flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: theme.fontWeights.semibold }}>
                  Add a single project
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                  }}
                >
                  Pick a folder on your computer
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSearchHome();
              }}
              disabled={scanningHome}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                borderTop: `1px solid ${theme.colors.border}`,
                background: 'transparent',
                color: theme.colors.text,
                cursor: scanningHome ? 'default' : 'pointer',
                opacity: scanningHome ? 0.7 : 1,
                textAlign: 'left',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
              onMouseEnter={(e) => {
                if (scanningHome) return;
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary ?? theme.colors.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Search
                size={16}
                color={theme.colors.primary}
                style={{ flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: theme.fontWeights.semibold }}>
                  {scanningHome ? 'Scanning…' : 'Add all from home'}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                  }}
                >
                  Scan ~ for git repositories
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

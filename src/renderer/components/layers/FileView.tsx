import React from 'react';
import { useTheme } from 'themed-markdown';

interface FileTypeInfo {
  extension: string;
  count: number;
  color: string;
  icon: string;
  name: string;
  category?: string;
}

interface FileViewProps {
  fileTypeStats: FileTypeInfo[];
  enabledLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
}

export const FileView: React.FC<FileViewProps> = ({
  fileTypeStats,
  enabledLayers,
  onToggleLayer,
}) => {
  const { theme } = useTheme();

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          File Types
        </h3>
        <span
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          {fileTypeStats.reduce((sum, stat) => sum + stat.count, 0)} files
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {fileTypeStats.map((stat) => {
          const layerId = `tech-layer-${stat.extension}`;
          const isEnabled = enabledLayers.has(layerId);

          return (
            <div
              key={stat.extension}
              onClick={() => onToggleLayer(layerId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: theme.colors.backgroundLight,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isEnabled ? 1 : 0.6,
                border: `2px solid ${isEnabled ? stat.color : 'transparent'}`,
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: stat.color,
                  marginRight: '12px',
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}
                >
                  {stat.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  {stat.extension} • {stat.count} file
                  {stat.count !== 1 ? 's' : ''}
                </div>
              </div>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${isEnabled ? stat.color : theme.colors.border}`,
                  backgroundColor: isEnabled ? stat.color : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isEnabled && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path
                      d="M1 5L4 8L11 1"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

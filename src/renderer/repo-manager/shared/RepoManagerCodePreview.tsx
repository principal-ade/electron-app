import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ThemedMonacoWithProvider } from '@principal-ade/industry-themed-monaco-editor';
import { FileText, X } from 'lucide-react';

interface RepoManagerCodePreviewProps {
  filePath: string;
  absolutePath?: string | null;
  content: string | null;
  loading?: boolean;
  onClose?: () => void;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    kt: 'kotlin',
    swift: 'swift',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    md: 'markdown',
    mdx: 'markdown',
  };
  return languageMap[ext] || 'plaintext';
}

export const RepoManagerCodePreview: React.FC<RepoManagerCodePreviewProps> = ({
  filePath,
  absolutePath,
  content,
  loading = false,
  onClose,
}) => {
  const { theme } = useTheme();
  const fileName = filePath.split('/').pop() || filePath;
  const language = getLanguageFromPath(filePath);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.backgroundSecondary,
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <FileText size={16} style={{ color: theme.colors.primary, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                color: theme.colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fileName}
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={absolutePath || filePath}
            >
              {absolutePath || filePath}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              color: theme.colors.textSecondary,
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Close preview"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[2],
            }}
          >
            Loading file...
          </div>
        ) : content == null ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: theme.colors.textSecondary,
              textAlign: 'center',
              padding: '24px',
            }}
          >
            <FileText size={40} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: theme.fontSizes[2], fontWeight: 500 }}>
              Unable to load file contents
            </div>
            <div style={{ fontSize: theme.fontSizes[1] }}>
              Try selecting a different file from the map or search results.
            </div>
          </div>
        ) : (
          <ThemedMonacoWithProvider
            value={content}
            language={language}
            options={{
              readOnly: true,
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
            height="100%"
            width="100%"
          />
        )}
      </div>
    </div>
  );
};

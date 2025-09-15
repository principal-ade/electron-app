import React from 'react';
import { FileText } from 'lucide-react';

interface MarkdownEmptyOverlayProps {
  theme: any;
}

export const MarkdownEmptyOverlay: React.FC<MarkdownEmptyOverlayProps> = ({ theme }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      pointerEvents: 'none',
      zIndex: 10
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        maxWidth: '500px'
      }}>
        <FileText 
          size={64} 
          color={theme.colors.textSecondary} 
          style={{ 
            opacity: 0.2, 
            marginBottom: '24px'
          }}
        />
        <h2 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: theme.colors.textSecondary,
          marginBottom: '16px',
          opacity: 0.6
        }}>
          Your markdown content will appear here
        </h2>
        <p style={{
          fontSize: '14px',
          color: theme.colors.textSecondary,
          opacity: 0.5,
          lineHeight: 1.6
        }}>
          Start typing in the editor to begin creating your planning document
        </p>
      </div>
    </div>
  );
};
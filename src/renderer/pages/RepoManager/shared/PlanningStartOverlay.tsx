import React, { useState } from 'react';
import { FileText, PenTool, FolderOpen, Plus, Database, HardDrive, BookOpen } from 'lucide-react';
import type { Theme } from 'themed-markdown';

interface PlanningStartOverlayProps {
  theme: Theme;
  onStart: (options: {
    documentType: 'new' | 'existing';
    format?: 'markdown' | 'excalidraw';
    storageLocation?: 'repository' | 'app-data' | 'alexandria';
  }) => void;
  initialStep?: 'document' | 'format' | 'storage';
}

export const PlanningStartOverlay: React.FC<PlanningStartOverlayProps> = ({
  theme,
  onStart,
  initialStep = 'document',
}) => {
  const [step, setStep] = useState<'document' | 'format' | 'storage'>(initialStep || 'document');
  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'excalidraw' | null>(null);

  const handleDocumentChoice = (type: 'new' | 'existing') => {
    if (type === 'existing') {
      // For existing documents, directly start
      onStart({ documentType: 'existing' });
    } else {
      // For new documents, ask about format
      setStep('format');
    }
  };

  const handleFormatChoice = (format: 'markdown' | 'excalidraw') => {
    setSelectedFormat(format);
    if (format === 'excalidraw') {
      // For Excalidraw, ask about storage location
      setStep('storage');
    } else {
      // Markdown always goes to repository
      onStart({
        documentType: 'new',
        format,
        storageLocation: 'repository',
      });
    }
  };

  const handleStorageChoice = (storageLocation: 'repository' | 'app-data' | 'alexandria') => {
    if (selectedFormat) {
      onStart({
        documentType: 'new',
        format: selectedFormat,
        storageLocation,
      });
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '12px',
          }}
        >
          {step === 'document' && 'What would you like to work on?'}
          {step === 'format' && 'Choose Document Format'}
          {step === 'storage' && 'Choose Storage Location'}
        </h2>
      </div>

      {/* Step 1: Document Choice */}
      {step === 'document' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'stretch',
            padding: '0 40px 40px 40px',
            gap: '40px',
          }}
        >
          {/* New Document - Left */}
          <button
            onClick={() => handleDocumentChoice('new')}
            style={{
              flex: 1,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `2px solid ${theme.colors.border}`,
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              transition: 'all 0.2s',
              padding: '40px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundLight;
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Plus size={64} style={{ color: theme.colors.primary }} />
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                New Document
              </div>
              <div
                style={{ fontSize: '16px', color: theme.colors.textSecondary }}
              >
                Start Fresh with a Blank Document
              </div>
            </div>
          </button>

          {/* Existing Document - Right */}
          <button
            onClick={() => handleDocumentChoice('existing')}
            style={{
              flex: 1,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `2px solid ${theme.colors.border}`,
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              transition: 'all 0.2s',
              padding: '40px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundLight;
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FolderOpen size={64} style={{ color: theme.colors.primary }} />
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                Existing Document
              </div>
              <div
                style={{ fontSize: '16px', color: theme.colors.textSecondary }}
              >
                Continue Working on a Saved Plan
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Step 2: Format Choice (for new documents) */}
      {step === 'format' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'stretch',
              gap: '40px',
              marginBottom: '40px',
            }}
          >
            {/* Excalidraw - Left */}
            <button
              onClick={() => handleFormatChoice('excalidraw')}
              style={{
                flex: 1,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                transition: 'all 0.2s',
                padding: '40px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundLight;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <PenTool size={64} style={{ color: theme.colors.primary }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  Excalidraw
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Visual planning with drawings and diagrams
                </div>
              </div>
            </button>

            {/* Markdown - Right */}
            <button
              onClick={() => handleFormatChoice('markdown')}
              style={{
                flex: 1,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                transition: 'all 0.2s',
                padding: '40px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundLight;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <FileText size={64} style={{ color: theme.colors.primary }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  Markdown
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Text-based planning with slides and formatting
                </div>
              </div>
            </button>
          </div>

          {/* Back button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setStep('document')}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Storage Choice (for Excalidraw) */}
      {step === 'storage' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'stretch',
              gap: '20px',
              marginBottom: '40px',
            }}
          >
            {/* Alexandria Storage */}
            <button
              onClick={() => handleStorageChoice('alexandria')}
              style={{
                flex: 1,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                transition: 'all 0.2s',
                padding: '40px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundLight;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <BookOpen size={48} style={{ color: theme.colors.primary }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  Alexandria
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Store in .alexandria/drawings
                  <br />
                  Versioned with repository
                </div>
              </div>
            </button>

            {/* App Data Storage */}
            <button
              onClick={() => handleStorageChoice('app-data')}
              style={{
                flex: 1,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                transition: 'all 0.2s',
                padding: '40px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundLight;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Database size={48} style={{ color: theme.colors.primary }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  App Data
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Private app storage
                  <br />
                  Not versioned
                </div>
              </div>
            </button>

            {/* Repository Storage */}
            <button
              onClick={() => handleStorageChoice('repository')}
              style={{
                flex: 1,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `2px solid ${theme.colors.border}`,
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                transition: 'all 0.2s',
                padding: '40px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundLight;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <HardDrive size={48} style={{ color: theme.colors.primary }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  Repository
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Direct file in repository
                  <br />
                  Versioned with git
                </div>
              </div>
            </button>
          </div>

          {/* Back button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setStep('format')}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

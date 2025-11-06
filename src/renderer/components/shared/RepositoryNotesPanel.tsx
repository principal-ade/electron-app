import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  BookOpen,
  MessageSquare,
  Clock,
  FolderTree,
  MapPin,
  Brain,
  Sparkles,
  AlertTriangle,
  Code,
  Lightbulb,
  Save,
  Users,
  ChevronRight,
  GitBranch,
  FolderOpen,
} from 'lucide-react';
import { RepositoryNotesService } from '../../main-process-api/RepositoryNotesService';
import type { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';

interface RepositoryNotesPanelProps {
  remoteUrl?: string;
  directoryPath?: string;
  title?: string;
  showAddButton?: boolean;
  selectedNoteIds?: Set<string>;
  onNoteToggle?: (noteId: string) => void;
  viewMode?: 'explore' | 'dev'; // Add view mode to determine empty state
}

// Simple markdown renderer for notes
const renderMarkdownContent = (content: string): React.ReactNode => {
  // Basic markdown parsing - you could replace with a proper markdown library
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLanguage = '';

  lines.forEach((line, index) => {
    // Code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <pre
            key={`code-${index}`}
            style={{
              backgroundColor: '#1e1e1e',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              margin: '8px 0',
            }}
          >
            <code>{codeLines.join('\n')}</code>
          </pre>,
        );
        codeLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Headers
    if (line.startsWith('## ')) {
      elements.push(
        <h3
          key={index}
          style={{ fontSize: '16px', fontWeight: 600, margin: '12px 0 8px' }}
        >
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h2
          key={index}
          style={{ fontSize: '18px', fontWeight: 600, margin: '12px 0 8px' }}
        >
          {line.slice(2)}
        </h2>,
      );
    } else {
      // Process inline elements
      let processedLine = line;

      // Bold text
      processedLine = processedLine.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>',
      );

      // Inline code
      processedLine = processedLine.replace(
        /`([^`]+)`/g,
        '<code style="background: #2d2d2d; padding: 2px 4px; border-radius: 3px;">$1</code>',
      );

      // Links (basic support)
      processedLine = processedLine.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<span style="color: #58a6ff; text-decoration: underline;">$1</span>',
      );

      if (processedLine.trim()) {
        elements.push(
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: processedLine }}
            style={{ marginBottom: '4px' }}
          />,
        );
      } else {
        elements.push(<br key={index} />);
      }
    }
  });

  return <>{elements}</>;
};

export const RepositoryNotesPanel: React.FC<RepositoryNotesPanelProps> = ({
  remoteUrl,
  directoryPath,
  title = 'Repository Notes',
  showAddButton = true,
  selectedNoteIds = new Set(),
  onNoteToggle,
  viewMode = 'explore',
}) => {
  const { theme } = useTheme();
  const [notes, setNotes] = useState<RepositoryNote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canAddNotes = Boolean(directoryPath) && showAddButton;

  const loadNotes = async () => {
    if (!remoteUrl && !directoryPath) return;
    try {
      setLoading(true);
      setError(null);
      if (remoteUrl) {
        const repoNotes =
          await RepositoryNotesService.getNotesForRepository(remoteUrl);
        setNotes(repoNotes);
      } else if (directoryPath) {
        const result = await RepositoryNotesService.getNotesForPath(
          directoryPath,
          true,
        );
        setNotes(result.notes || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUrl, directoryPath]);

  const handleAddNote = async () => {
    if (!directoryPath) return;
    const note = prompt('Add a note about this repository:');
    if (!note) return;
    const result = await RepositoryNotesService.storeNote({
      note,
      directoryPath,
      metadata: { type: 'manual', source: 'RepositoryNotesPanel' },
    });
    if (result.success) {
      await loadNotes();
    } else {
      alert('Failed to store note: ' + (result.error || 'Unknown error'));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px 0',
        height: '100%',
      }}
    >
      {notes.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <h4
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            {title} ({notes.length})
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onNoteToggle && (
              <button
                onClick={() => {
                  // Toggle between all selected and none selected
                  if (selectedNoteIds.size === notes.length) {
                    // Clear all selections
                    notes.forEach((note) => onNoteToggle(note.id));
                  } else {
                    // Select all notes
                    notes.forEach((note) => {
                      if (!selectedNoteIds.has(note.id)) {
                        onNoteToggle(note.id);
                      }
                    });
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor:
                    selectedNoteIds.size === notes.length
                      ? theme.colors.primary
                      : theme.colors.backgroundTertiary,
                  color:
                    selectedNoteIds.size === notes.length
                      ? 'white'
                      : theme.colors.text,
                  border: `1px solid ${
                    selectedNoteIds.size === notes.length
                      ? theme.colors.primary
                      : theme.colors.border
                  }`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                title={
                  selectedNoteIds.size === notes.length
                    ? 'Hide coverage'
                    : 'Show coverage'
                }
              >
                <MapPin size={12} />
                {selectedNoteIds.size === notes.length ? 'Hide' : 'Show'}{' '}
                Coverage
                {selectedNoteIds.size > 0 &&
                  selectedNoteIds.size < notes.length &&
                  ` (${selectedNoteIds.size}/${notes.length})`}
              </button>
            )}
            {/* Hide Add Note button for now */}
            {false && canAddNotes && (
              <button
                onClick={handleAddNote}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <MessageSquare size={14} />
                Add Note
              </button>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div
          style={{
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            fontSize: '14px',
          }}
        >
          Loading notes...
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.error || '#ff6b6b',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && notes.length === 0 && (
        <div
          style={{
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '16px',
            padding: '24px 16px',
            border: `1px solid ${theme.colors.border}`,
            background: `linear-gradient(135deg, ${theme.colors.backgroundLight}, ${theme.colors.background})`,
            position: 'relative',
            overflow: 'auto',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
          }}
        >
          {/* Decorative gradient orbs */}
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${theme.colors.primary}12, transparent)`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-40px',
              left: '-40px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${theme.colors.accent}10, transparent)`,
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: `0 12px 32px ${theme.colors.primary}30`,
            }}
          >
            <Sparkles size={28} color="white" />
          </div>

          <h2
            style={{
              fontSize: 'clamp(20px, 5vw, 24px)',
              fontWeight: 700,
              color: theme.colors.text,
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            AI-Native Knowledge Base
          </h2>

          <p
            style={{
              fontSize: 'clamp(14px, 3vw, 16px)',
              color: theme.colors.textSecondary,
              lineHeight: 1.6,
              maxWidth: '450px',
              margin: '0 auto 24px',
              textAlign: 'center',
              padding: '0 8px',
            }}
          >
            Your AI agents automatically capture and share context about your
            codebase—the "why" behind decisions that usually gets lost
          </p>

          {/* Main value prop cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                padding: '20px 16px',
                borderRadius: '14px',
                backgroundColor: theme.colors.background,
                border: `2px solid ${theme.colors.border}`,
                textAlign: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(16, 185, 129, 0.15)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card accent line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                }}
              />

              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#10b98120',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <FolderOpen size={24} color="#10b981" />
              </div>

              <h3
                style={{
                  fontSize: 'clamp(16px, 4vw, 18px)',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                RAG-Free Context
              </h3>

              <p
                style={{
                  fontSize: 'clamp(13px, 2.5vw, 14px)',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                  marginBottom: '12px',
                }}
              >
                No vector databases or embedding complexity. Knowledge is stored
                as simple YAML files directly in your repository's{' '}
                <code
                  style={{
                    backgroundColor: theme.colors.backgroundSecondary,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                  }}
                >
                  .principle/
                </code>{' '}
                directory.
              </p>

              <div
                style={{
                  fontSize: 'clamp(11px, 2vw, 12px)',
                  color: '#10b981',
                  fontWeight: 600,
                  backgroundColor: '#10b98115',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'inline-block',
                }}
              >
                ✓ Works offline • No vendor lock-in
              </div>
            </div>

            <div
              style={{
                padding: '20px 16px',
                borderRadius: '14px',
                backgroundColor: theme.colors.background,
                border: `2px solid ${theme.colors.border}`,
                textAlign: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(139, 92, 246, 0.15)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card accent line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
                }}
              />

              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#8b5cf620',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Brain size={24} color="#8b5cf6" />
              </div>

              <h3
                style={{
                  fontSize: 'clamp(16px, 4vw, 18px)',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                No Black Box Memories
              </h3>

              <p
                style={{
                  fontSize: 'clamp(13px, 2.5vw, 14px)',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                  marginBottom: '12px',
                }}
              >
                Complete transparency and control. Every piece of knowledge is
                human-readable, searchable, and can be version controlled
                through pull requests.
              </p>

              <div
                style={{
                  fontSize: 'clamp(11px, 2vw, 12px)',
                  color: '#8b5cf6',
                  fontWeight: 600,
                  backgroundColor: '#8b5cf615',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'inline-block',
                }}
              >
                ✓ Full visibility • Git-based workflow
              </div>
            </div>

            <div
              style={{
                padding: '20px 16px',
                borderRadius: '14px',
                backgroundColor: theme.colors.background,
                border: `2px solid ${theme.colors.border}`,
                textAlign: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#f59e0b';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(245, 158, 11, 0.15)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card accent line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                }}
              />

              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#f59e0b20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Sparkles size={24} color="#f59e0b" />
              </div>

              <h3
                style={{
                  fontSize: 'clamp(16px, 4vw, 18px)',
                  fontWeight: 700,
                  color: theme.colors.text,
                  marginBottom: '8px',
                }}
              >
                Self-Maintaining
              </h3>

              <p
                style={{
                  fontSize: 'clamp(13px, 2.5vw, 14px)',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                  marginBottom: '12px',
                }}
              >
                Context is tied to files and directories. When code is deleted
                or refactored, associated knowledge naturally disappears—no
                stale documentation to manually clean up.
              </p>

              <div
                style={{
                  fontSize: 'clamp(11px, 2vw, 12px)',
                  color: '#f59e0b',
                  fontWeight: 600,
                  backgroundColor: '#f59e0b15',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'inline-block',
                }}
              >
                ✓ Zero maintenance • Always relevant
              </div>
            </div>
          </div>

          {/* Bottom differentiator */}
          <div
            style={{
              padding: '20px',
              borderRadius: '14px',
              background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.accent}12)`,
              border: `2px solid ${theme.colors.primary}40`,
              textAlign: 'center',
              position: 'relative',
              boxShadow: `0 8px 24px ${theme.colors.primary}15`,
            }}
          >
            {/* Pulse animation */}
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80px',
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${theme.colors.primary}, ${theme.colors.accent}, transparent)`,
                borderRadius: '2px',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />

            <div
              style={{
                fontSize: 'clamp(15px, 3vw, 17px)',
                fontWeight: 800,
                marginBottom: '8px',
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              ⚡ Why choose our approach?
            </div>

            <p
              style={{
                fontSize: 'clamp(14px, 2.8vw, 15px)',
                color: theme.colors.text,
                margin: 0,
                lineHeight: 1.7,
                fontWeight: 500,
              }}
            >
              Unlike external wikis or proprietary databases, your knowledge
              lives{' '}
              <span
                style={{
                  fontWeight: 700,
                  color: theme.colors.primary,
                  textDecoration: 'underline',
                  textDecorationColor: `${theme.colors.primary}40`,
                  textDecorationThickness: '2px',
                  textUnderlineOffset: '2px',
                }}
              >
                where it belongs
              </span>
              —alongside your code, completely{' '}
              <span
                style={{
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.accent}20)`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                transparent
              </span>{' '}
              and under{' '}
              <span
                style={{
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.colors.accent}20, ${theme.colors.primary}20)`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                your control
              </span>
              .
            </p>

            <style>{`
              @keyframes shimmer {
                0%, 100% { 
                  opacity: 0.3;
                  transform: translateX(-50%) scaleX(0.8);
                }
                50% { 
                  opacity: 1;
                  transform: translateX(-50%) scaleX(1);
                }
              }
            `}</style>
          </div>
        </div>
      )}

      {!loading && !error && notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notes.map((note) => {
            const isSelected = selectedNoteIds.has(note.id);
            return (
              <div
                key={note.id}
                style={{
                  backgroundColor: isSelected
                    ? theme.colors.primary + '11'
                    : theme.colors.backgroundLight,
                  borderRadius: '8px',
                  padding: '16px',
                  border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                  transition: 'all 0.2s',
                  cursor: onNoteToggle ? 'pointer' : 'default',
                  position: 'relative',
                }}
                onClick={() => onNoteToggle?.(note.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor =
                      theme.colors.primary + '66';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.primary,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <FolderTree size={14} color={theme.colors.primary} />
                    <span
                      style={{
                        fontSize: '12px',
                        color: theme.colors.primary,
                        fontFamily: 'monospace',
                      }}
                    >
                      {note.relativePath || '/'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <Clock size={12} />
                    {new Date(note.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.text,
                    margin: 0,
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {renderMarkdownContent(note.note)}
                </div>
                {note.metadata && (
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: `1px solid ${theme.colors.border}`,
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {Object.entries(note.metadata).map(([key, value]) => (
                      <span key={key} style={{ marginRight: '12px' }}>
                        <strong>{key}:</strong> {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

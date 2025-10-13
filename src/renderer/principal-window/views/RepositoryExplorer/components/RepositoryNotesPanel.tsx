import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, Plus, FileText } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { RepositoryNotesService } from '../../../../main-process-api/RepositoryNotesService';
import type { RepositoryNote } from '../../../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { AddNoteModal } from './AddNoteModal';

interface RepositoryNotesPanelProps {
  repositoryPath: string;
  isLoading?: boolean;
}

type ExtendedRepositoryNote = RepositoryNote & {
  isParentDirectory?: boolean;
  pathDistance?: number;
};

export const RepositoryNotesPanel: React.FC<RepositoryNotesPanelProps> = ({
  repositoryPath,
  isLoading: externalLoading = false,
}) => {
  const { theme } = useTheme();
  const [notes, setNotes] = useState<ExtendedRepositoryNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response =
        await RepositoryNotesService.getNotesForPath(repositoryPath);

      if (response && Array.isArray(response.notes)) {
        const processedNotes = response.notes.map((note) => ({
          ...note,
          gitInfo: note.gitInfo,
        }));
        setNotes(processedNotes);
      } else {
        console.error('Invalid notes response:', response);
        setNotes([]);
        setError('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      setError('Failed to load notes');
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryPath) {
      loadNotes();
    }
  }, [repositoryPath]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadNotes is not memoized, adding it would cause infinite re-renders

  const handleDeleteNote = async (noteId: string, remoteUrl: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      setDeletingNoteId(noteId);
      const success = await RepositoryNotesService.deleteNote(
        remoteUrl,
        noteId,
      );
      if (success) {
        setNotes((prev) => prev.filter((note) => note.id !== noteId));
      } else {
        alert('Failed to delete note');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const getRelativeTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  // Reload notes when modal closes after adding a note
  useEffect(() => {
    if (!showAddNoteModal && repositoryPath) {
      // Reload notes after modal closes
      loadNotes();
    }
  }, [showAddNoteModal]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadNotes is not memoized and repositoryPath doesn't change during modal lifecycle

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          marginBottom: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Notes</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(isLoading || notes.length > 0) && (
            <span
              style={{ fontSize: theme.fontSizes[1], fontWeight: 'normal' }}
            >
              {isLoading ? 'Loading...' : `${notes.length} notes`}
            </span>
          )}
          <button
            onClick={() => setShowAddNoteModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              color: theme.colors.primary,
              border: `1px solid ${theme.colors.primary}`,
              borderRadius: '4px',
              fontSize: theme.fontSizes[0],
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Add a note to this repository"
          >
            <Plus size={14} />
            Note
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          maxHeight: '400px',
        }}
      >
        {isLoading || externalLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}
          >
            Loading notes...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.error || '#ef4444',
              fontSize: theme.fontSizes[1],
            }}
          >
            {error}
          </div>
        ) : !Array.isArray(notes) ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.error || '#ef4444',
              fontSize: theme.fontSizes[1],
            }}
          >
            Error: Invalid notes data
          </div>
        ) : notes.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}
          >
            <div
              style={{
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <FileText size={32} style={{ opacity: 0.5 }} />
            </div>
            <div>No notes yet</div>
            <div style={{ fontSize: theme.fontSizes[0], marginTop: '4px' }}>
              Click "Add Note" to create your first note
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: '12px',
                  backgroundColor: theme.colors.background,
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  position: 'relative',
                }}
              >
                {/* Delete button */}
                <button
                  onClick={() =>
                    handleDeleteNote(note.id, note.gitInfo.remoteUrl || '')
                  }
                  disabled={deletingNoteId === note.id}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor:
                      deletingNoteId === note.id ? 'not-allowed' : 'pointer',
                    color: theme.colors.error || '#ef4444',
                    opacity: 0.7,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (deletingNoteId !== note.id) {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = `${theme.colors.error || '#ef4444'}15`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (deletingNoteId !== note.id) {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  title="Delete note"
                >
                  {deletingNoteId === note.id ? (
                    <div style={{ width: '12px', height: '12px' }}>⋯</div>
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>

                {/* Note content */}
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    lineHeight: '1.4',
                    marginBottom: '8px',
                    paddingRight: '32px', // Make room for delete button
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {note.note}
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      marginBottom: '8px',
                    }}
                  >
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: `${theme.colors.primary}15`,
                          color: theme.colors.primary,
                          borderRadius: '10px',
                          fontSize: theme.fontSizes[0],
                          fontWeight: 500,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <div
                  style={{
                    fontSize: '10px',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Calendar size={10} />
                    {getRelativeTime(note.timestamp)}
                  </span>
                  {note.confidence && (
                    <span
                      style={{
                        padding: '1px 6px',
                        backgroundColor: `${theme.colors.success}15`,
                        color: theme.colors.success,
                        borderRadius: '8px',
                        fontSize: theme.fontSizes[0],
                        fontWeight: 500,
                      }}
                    >
                      {note.confidence}
                    </span>
                  )}
                  {note.type && (
                    <span
                      style={{
                        padding: '1px 6px',
                        backgroundColor: `${theme.colors.warning}15`,
                        color: theme.colors.warning,
                        borderRadius: '8px',
                        fontSize: theme.fontSizes[0],
                        fontWeight: 500,
                      }}
                    >
                      {note.type}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <AddNoteModal
          isOpen={showAddNoteModal}
          onClose={() => setShowAddNoteModal(false)}
          onNoteAdded={() => {
            // Notes will be refreshed when modal closes due to the useEffect above
          }}
          repositoryPath={repositoryPath}
        />
      )}
    </div>
  );
};

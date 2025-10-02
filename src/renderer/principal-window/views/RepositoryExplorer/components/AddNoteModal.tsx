import React, { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { RepositoryNotesService } from '../../../../main-process-api/RepositoryNotesService';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded: () => void;
  repositoryPath: string;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  onNoteAdded,
  repositoryPath,
}) => {
  const { theme } = useTheme();
  const [noteContent, setNoteContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load available tags when modal opens
  useEffect(() => {
    if (isOpen && repositoryPath) {
      loadAvailableTags();
    }
  }, [isOpen, repositoryPath]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadAvailableTags is not memoized, adding it would cause infinite re-renders

  // Auto-focus the textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const loadAvailableTags = async () => {
    try {
      setIsLoadingTags(true);
      // Get all notes for the repository to extract available tags
      const { notes } = await RepositoryNotesService.getNotesForPath(repositoryPath);
      // Extract unique tags from all notes
      const tagSet = new Set<string>();
      notes.forEach(note => {
        note.tags?.forEach(tag => tagSet.add(tag));
      });
      setAvailableTags(Array.from(tagSet).sort());
    } catch (err) {
      console.error('Failed to load available tags:', err);
      setAvailableTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!noteContent.trim()) {
      setError('Note content is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await RepositoryNotesService.storeNote({
        note: noteContent.trim(),
        directoryPath: repositoryPath,
        tags: selectedTags.length > 0 ? selectedTags : ['general'],
      });

      // Reset form and close modal
      setNoteContent('');
      setSelectedTags([]);
      onNoteAdded();
      onClose();
    } catch (err) {
      console.error('Failed to create note:', err);
      setError('Failed to create note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleClose = () => {
    setNoteContent('');
    setSelectedTags([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
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
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: theme.colors.textSecondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Add Note
          </h3>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            Add a note to this repository
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Note Content */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
                marginBottom: '8px',
              }}
            >
              Note Content *
            </label>
            <textarea
              ref={textareaRef}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note here..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
                marginBottom: '8px',
              }}
            >
              Tags {isLoadingTags && '(Loading...)'}
            </label>
            {availableTags.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  maxHeight: '120px',
                  overflow: 'auto',
                }}
              >
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    style={{
                      padding: '6px 12px',
                      border: `1px solid ${selectedTags.includes(tag) ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '16px',
                      backgroundColor: selectedTags.includes(tag)
                        ? `${theme.colors.primary}15`
                        : theme.colors.background,
                      color: selectedTags.includes(tag)
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                      fontSize: theme.fontSizes[0],
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedTags.includes(tag)) {
                        e.currentTarget.style.borderColor = theme.colors.primary;
                        e.currentTarget.style.color = theme.colors.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedTags.includes(tag)) {
                        e.currentTarget.style.borderColor = theme.colors.border;
                        e.currentTarget.style.color = theme.colors.textSecondary;
                      }
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : !isLoadingTags ? (
              <p
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                No tags available in this repository
              </p>
            ) : null}
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: `${theme.colors.error || '#ef4444'}15`,
                border: `1px solid ${theme.colors.error || '#ef4444'}`,
                borderRadius: '8px',
                marginBottom: '20px',
                color: theme.colors.error || '#ef4444',
                fontSize: theme.fontSizes[1],
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: theme.colors.text,
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !noteContent.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: (isSubmitting || !noteContent.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !noteContent.trim()) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && noteContent.trim()) {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting && noteContent.trim()) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {isSubmitting ? (
                'Creating...'
              ) : (
                <>
                  <Plus size={14} />
                  Add Note
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
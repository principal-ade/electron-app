import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Trash2, Clock, HardDrive, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { StaleRepoInfo } from '../../../contexts/ProjectsPanelContext';

interface StaleRepoReviewModalProps {
  isOpen: boolean;
  staleRepos: StaleRepoInfo[];
  onClose: () => void;
  onDelete: (repoName: string) => Promise<void>;
  onKeep: (repoName: string) => Promise<void>;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const StaleRepoReviewModal: React.FC<StaleRepoReviewModalProps> = ({
  isOpen,
  staleRepos,
  onClose,
  onDelete,
  onKeep,
}) => {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  const currentRepo = staleRepos[currentIndex];
  const hasMultiple = staleRepos.length > 1;

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowDeleteConfirm(false);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < staleRepos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowDeleteConfirm(false);
    }
  }, [currentIndex, staleRepos.length]);

  const handleKeep = async () => {
    if (!currentRepo || isProcessing) return;
    try {
      setIsProcessing(true);
      await onKeep(currentRepo.entry.name);
      // If there are more repos, move to next; otherwise close
      if (currentIndex < staleRepos.length - 1) {
        // Stay at same index since this one was removed
      } else if (staleRepos.length <= 1) {
        onClose();
      } else {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    } catch (error) {
      console.error('Error keeping repo:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!currentRepo || isProcessing) return;
    try {
      setIsProcessing(true);
      await onDelete(currentRepo.entry.name);
      setShowDeleteConfirm(false);
      // If there are more repos, stay at same index; otherwise close
      if (staleRepos.length <= 1) {
        onClose();
      } else if (currentIndex >= staleRepos.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    } catch (error) {
      console.error('Error deleting repo:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      onClose();
    }
  }, [isProcessing, onClose]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        handleClose();
      } else if (e.key === 'ArrowLeft' && hasMultiple && !isProcessing) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && hasMultiple && !isProcessing) {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, handleClose, hasMultiple, handlePrevious, handleNext]);

  if (!isOpen || !currentRepo || staleRepos.length === 0) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
          width: '90%',
          maxWidth: '500px',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} style={{ color: theme.colors.warning || '#f59e0b' }} />
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                }}
              >
                Stale Project Review
              </h3>
              {hasMultiple && (
                <span
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  {currentIndex + 1} of {staleRepos.length}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            style={{
              background: 'none',
              border: 'none',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              padding: '4px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Repo Info Card */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              marginBottom: '20px',
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
              }}
            >
              {currentRepo.entry.name}
            </h4>

            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.monospace,
                marginBottom: '16px',
                wordBreak: 'break-all',
              }}
            >
              {currentRepo.entry.path}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} style={{ color: theme.colors.warning || '#f59e0b' }} />
                <span
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  <strong>{currentRepo.daysSinceModified}</strong> days since modified
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardDrive size={14} style={{ color: theme.colors.textSecondary }} />
                <span
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  {formatBytes(currentRepo.sizeBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {currentRepo.entry.github?.description && (
            <p
              style={{
                margin: '0 0 20px 0',
                fontSize: theme.fontSizes[2],
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                lineHeight: 1.5,
              }}
            >
              {currentRepo.entry.github.description}
            </p>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: `${theme.colors.error || '#ef4444'}15`,
                border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.error || '#ef4444',
                  marginBottom: '8px',
                }}
              >
                Delete permanently?
              </div>
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                }}
              >
                This will delete the project folder from disk. You can clone from the remote to recover if needed.
              </div>
            </div>
          )}

          {/* Navigation (for multiple repos) */}
          {hasMultiple && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0 || isProcessing}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: currentIndex === 0 ? theme.colors.textSecondary : theme.colors.text,
                  cursor: currentIndex === 0 || isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  opacity: currentIndex === 0 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === staleRepos.length - 1 || isProcessing}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: currentIndex === staleRepos.length - 1 ? theme.colors.textSecondary : theme.colors.text,
                  cursor: currentIndex === staleRepos.length - 1 || isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  opacity: currentIndex === staleRepos.length - 1 ? 0.5 : 1,
                }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          {showDeleteConfirm ? (
            <>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: theme.colors.error || '#ef4444',
                  color: theme.colors.background,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                <Trash2 size={16} />
                {isProcessing ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleKeep}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.primary}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.primary,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                <Check size={16} />
                {isProcessing ? 'Processing...' : 'Keep'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: theme.colors.error || '#ef4444',
                  color: theme.colors.background,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.medium,
                  fontFamily: theme.fonts.body,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

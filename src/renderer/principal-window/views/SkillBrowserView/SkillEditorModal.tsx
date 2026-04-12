/**
 * Skill Editor Modal
 *
 * Modal for editing skill files with simple textarea editor and GitHub commit functionality.
 * TODO: Integrate MDXEditorPanel/FileEditorPanel when panel framework types are resolved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SkillLockService } from '../../../main-process-api/SkillLockService';

interface SkillEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName: string;
  skillSource: { owner: string; repo: string; branch: string };
  repositoryPath?: string;
}

export const SkillEditorModal: React.FC<SkillEditorModalProps> = ({
  isOpen,
  onClose,
  skillName,
  skillSource,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      const fileList = await SkillLockService.getSkillFiles(skillName);
      setFiles(fileList);
    } catch (err) {
      console.error('[SkillEditorModal] Error loading files:', err);
      setError('Failed to load skill files');
    }
  }, [skillName]);

  // Load files on mount
  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, loadFiles]);

  const handleFileSelect = async (filePath: string) => {
    try {
      setError(null);
      const result = await SkillLockService.getSkillFileContent(skillName, filePath);
      setFileContent(result.content);
      setSelectedFile(filePath);
      setIsDirty(false);
    } catch (err) {
      console.error('[SkillEditorModal] Error loading file:', err);
      setError('Failed to load file content');
    }
  };

  const handleContentChange = (newContent: string) => {
    setFileContent(newContent);
    setIsDirty(true);
  };

  const handleCommit = async () => {
    if (!selectedFile || !commitMessage.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await SkillLockService.commitSkillFile({
        skillName,
        filePath: selectedFile,
        content: fileContent,
        message: commitMessage,
      });

      if (result.success) {
        setIsDirty(false);
        setCommitMessage('');
        // Show success feedback
      } else {
        setError(result.error || 'Commit failed');
      }
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="skill-editor-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="skill-editor-modal"
        style={{
          display: 'flex',
          height: '80vh',
          width: '90vw',
          backgroundColor: '#1e1e1e',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* File tree */}
        <div
          className="file-tree"
          style={{
            width: '250px',
            borderRight: '1px solid #333',
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#252526',
          }}
        >
          <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600, color: '#ccc' }}>
            Files
          </h3>
          {files.map((file) => (
            <div
              key={file}
              onClick={() => handleFileSelect(file)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: selectedFile === file ? '#37373d' : 'transparent',
                borderRadius: '4px',
                marginBottom: '4px',
                fontSize: '13px',
                color: selectedFile === file ? '#fff' : '#ccc',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedFile !== file) {
                  e.currentTarget.style.backgroundColor = '#2a2d2e';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFile !== file) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {file}
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedFile ? (
            <textarea
              value={fileContent}
              onChange={(e) => handleContentChange(e.target.value)}
              style={{
                width: '100%',
                height: '100%',
                padding: '20px',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                border: 'none',
                fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
              }}
            />
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
              Select a file to edit
            </div>
          )}
        </div>

        {/* Commit panel */}
        <div
          className="commit-panel"
          style={{
            width: '300px',
            borderLeft: '1px solid #333',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#252526',
          }}
        >
          <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600, color: '#ccc' }}>
            Commit Changes
          </h3>

          {error && (
            <div
              style={{
                color: '#f48771',
                backgroundColor: '#5a1d1d',
                padding: '8px 12px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '13px',
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          <textarea
            placeholder="Commit message (required)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={!isDirty}
            style={{
              width: '100%',
              height: '100px',
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: isDirty ? '#2d2d2d' : '#1a1a1a',
              color: '#ccc',
              border: '1px solid #3c3c3c',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
            }}
          />

          <button
            onClick={handleCommit}
            disabled={!isDirty || !commitMessage.trim() || isSaving}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isDirty && commitMessage.trim() ? '#0e639c' : '#2d2d2d',
              color: isDirty && commitMessage.trim() ? 'white' : '#666',
              border: 'none',
              borderRadius: '4px',
              cursor: isDirty && commitMessage.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '14px',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isSaving ? 'Committing...' : 'Commit to GitHub'}
          </button>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #333' }}>
            <h4 style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
              Repository
            </h4>
            <p style={{ fontSize: '13px', marginBottom: '4px', color: '#ccc' }}>
              {skillSource.owner}/{skillSource.repo}
            </p>
            <p style={{ fontSize: '12px', color: '#888' }}>
              Branch: {skillSource.branch || 'main'}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '8px',
              backgroundColor: '#2d2d2d',
              color: '#ccc',
              border: '1px solid #3c3c3c',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#37373d';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2d2d2d';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

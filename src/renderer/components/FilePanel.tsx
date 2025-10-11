import React, { useState, useEffect } from 'react';
import { GitService } from '../main-process-api/GitService';
import { WatchingFileViewer } from '../pages/LandingPage/AgentConfigurationView/WatchingFileViewer';
import { DiffViewer } from './DiffViewer';

interface FilePanelProps {
  filePath: string;
  repositoryPath?: string;
  displayPath?: string;
  onClose?: () => void;
  className?: string;
  enableVimMode?: boolean;
  editable?: boolean;
  onSave?: (content: string) => Promise<void>;
  onModifiedChange?: (isModified: boolean) => void;
  hideInternalSaveButton?: boolean;
  onContentChange?: (content: string) => void;
  initialContent?: string;
  contentLoader?: () => Promise<string | null>;
}

/**
 * FilePanel orchestrates between FileViewer and DiffViewer
 * It determines when to show diffs and manages the git status checking
 */
export const FilePanel: React.FC<FilePanelProps> = ({
  filePath,
  repositoryPath,
  displayPath,
  onClose,
  className = '',
  enableVimMode = false,
  editable: initialEditable = false,
  onSave,
  onModifiedChange,
  hideInternalSaveButton = false,
  onContentChange,
  initialContent,
  contentLoader,
}) => {
  const [showDiff, setShowDiff] = useState(false);
  const [gitStatus, setGitStatus] = useState<
    'modified' | 'added' | 'deleted' | 'untracked' | null
  >(null);
  const [hasGitChanges, setHasGitChanges] = useState(false);
  const [isCheckingGit, setIsCheckingGit] = useState(false);
  const [editable, setEditable] = useState(initialEditable);

  // Calculate relative path for git operations
  const relativeFilePath = React.useMemo(() => {
    if (!repositoryPath || !filePath.startsWith(repositoryPath)) {
      return filePath;
    }
    // Remove repository path and leading slash
    return filePath.substring(repositoryPath.length).replace(/^\//, '');
  }, [filePath, repositoryPath]);

  // Check git status for the file
  useEffect(() => {
    let isFirstCheck = true;

    const checkGitStatus = async () => {
      // Skip if no repository path
      if (!repositoryPath) {
        setHasGitChanges(false);
        setGitStatus(null);
        return;
      }

      // Only show checking indicator on first load
      if (isFirstCheck) {
        setIsCheckingGit(true);
        isFirstCheck = false;
      }

      try {
        // Get git status for all files in the repository
        const result = await GitService.getDetailedChanges(repositoryPath);

        // Check if this file has changes
        const isModified = result.modified.includes(relativeFilePath);
        const isAdded = result.created.includes(relativeFilePath);
        const isDeleted = result.deleted.includes(relativeFilePath);

        if (isModified) {
          setGitStatus('modified');
          setHasGitChanges(true);
        } else if (isAdded) {
          setGitStatus('added');
          setHasGitChanges(true);
        } else if (isDeleted) {
          setGitStatus('deleted');
          setHasGitChanges(true);
        } else {
          // Check if it's an untracked file
          try {
            const untrackedResult = await GitService.execCommand(
              repositoryPath,
              ['ls-files', '--others', '--exclude-standard', relativeFilePath],
            );

            if (untrackedResult.stdout?.trim()) {
              setGitStatus('untracked');
              setHasGitChanges(true);
            } else {
              setGitStatus(null);
              setHasGitChanges(false);
            }
          } catch {
            // File is tracked but has no changes
            setGitStatus(null);
            setHasGitChanges(false);
          }
        }
      } catch (error) {
        console.error('Error checking git status:', error);
        setHasGitChanges(false);
        setGitStatus(null);
      } finally {
        setIsCheckingGit(false);
      }
    };

    checkGitStatus();

    // Re-check periodically but less frequently
    const interval = setInterval(checkGitStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [filePath, repositoryPath, relativeFilePath]);

  // If showing diff view, render DiffViewer
  if (showDiff && repositoryPath && hasGitChanges) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <DiffViewer
          filePath={relativeFilePath}
          repositoryPath={repositoryPath}
          gitStatus={gitStatus || undefined}
        />
        {/* Add a button to go back to normal view */}
        <div className="absolute top-2 right-12 z-10">
          <button
            onClick={() => setShowDiff(false)}
            className="px-3 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
            title="Exit diff view"
          >
            Exit Diff
          </button>
        </div>
      </div>
    );
  }

  // Otherwise, render WatchingFileViewer with additional git status info
  // Note: WatchingFileViewer wraps FileViewer, so we pass through all the same props
  return (
    <WatchingFileViewer
      filePath={filePath}
      displayPath={displayPath}
      onClose={onClose}
      className={className}
      enableVimMode={enableVimMode}
      editable={editable}
      onSave={async (content: string) => {
        // Call the original onSave if provided
        if (onSave) {
          await onSave(content);
        } else if (repositoryPath) {
          // If no custom save handler, try to save to the file system
          const { FileSystemService } = await import(
            '../main-process-api/FileSystemService'
          );
          await FileSystemService.writeFile(filePath, content);
        }
      }}
      onModifiedChange={onModifiedChange}
      hideInternalSaveButton={hideInternalSaveButton}
      onContentChange={onContentChange}
      initialContent={initialContent}
      contentLoader={contentLoader}
      // Pass git-related props
      hasGitChanges={hasGitChanges}
      gitStatus={gitStatus}
      isCheckingGit={isCheckingGit}
      onShowDiff={() => setShowDiff(true)}
      allowEditToggle={true}
      onEditableChange={setEditable}
    />
  );
};

import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  FolderOpen,
  GitBranch,
  ChevronDown,
  Check,
  HelpCircle,
  Key,
} from 'lucide-react';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import { SourceSelectionService } from '../../services/SourceSelectionService';
import { RepositoryAvatar } from '../repository-maps/RepositoryAvatar';
import { RepositoryService } from '../../main-process-api/RepositoryService';

interface TitlebarSourceSelectorProps {
  position?: 'left' | 'right';
  repository: Repository;
  selectedSource?: FileTreeSource | null;
  onSourceSelect?: (source: FileTreeSource) => void;
  onSecretsClick?: () => void;
  onHelpClick?: () => void;
}

export const TitlebarSourceSelector: React.FC<TitlebarSourceSelectorProps> = ({
  position = 'right',
  repository,
  selectedSource,
  onSourceSelect,
  onSecretsClick,
  onHelpClick,
}) => {
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [availableSources, setAvailableSources] = useState<FileTreeSource[]>([]);
  const [customAvatarUrls, setCustomAvatarUrls] = useState<Record<string, string>>({});

  // Initialize available sources
  useEffect(() => {
    const sources = SourceSelectionService.getAvailableSources(repository);
    setAvailableSources(sources);
  }, [repository]);

  // Load custom avatar URLs
  useEffect(() => {
    const loadAvatarUrls = async () => {
      const urls: Record<string, string> = {};
      if (repository?.localClones) {
        for (const clone of repository.localClones) {
          if (clone.customAvatarPath) {
            const url = await RepositoryService.getAvatarUrl(clone.customAvatarPath);
            if (url) urls[clone.path] = url;
          }
        }
      }
      setCustomAvatarUrls(urls);
    };
    loadAvatarUrls();
  }, [repository]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDropdown) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  if (!selectedSource) return null;

  const sourceName = SourceSelectionService.getSourceDisplayName(selectedSource);
  const sourceType = SourceSelectionService.getSourceTypeDisplayName(selectedSource);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        WebkitAppRegion: 'no-drag' as any,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Source Selector Dropdown */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: theme.colors.backgroundTertiary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s',
            height: '26px',
          }}
          title={`${sourceName} (${sourceType}) - Click to switch sources`}
        >
          {selectedSource.type === 'local' ? (
            customAvatarUrls[selectedSource.location] ? (
              <RepositoryAvatar
                repository={repository}
                localClone={repository.localClones?.find(
                  (c) => c.path === selectedSource.location
                )}
                customAvatarUrl={customAvatarUrls[selectedSource.location]}
                size={12}
                type="clone"
              />
            ) : (
              <FolderOpen size={12} />
            )
          ) : (
            <GitBranch size={12} />
          )}
          <span>{sourceName}</span>
          {availableSources.length > 1 && (
            <ChevronDown size={12} style={{ opacity: 0.7 }} />
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && availableSources.length > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '200px',
              maxWidth: '400px',
              overflow: 'hidden',
            }}
          >
            {availableSources.map((source) => {
              const displayName = SourceSelectionService.getSourceDisplayName(source);
              const sourceTypeName = SourceSelectionService.getSourceTypeDisplayName(source);
              const isCurrentSource = selectedSource?.id === source.id;

              return (
                <button
                  key={source.id}
                  onClick={() => {
                    if (!isCurrentSource) {
                      SourceSelectionService.setSelectedSource(
                        repository.remoteUrl,
                        source.id
                      );
                      onSourceSelect?.(source);
                    }
                    setShowDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: isCurrentSource
                      ? theme.colors.backgroundSecondary
                      : 'transparent',
                    border: 'none',
                    cursor: isCurrentSource ? 'default' : 'pointer',
                    fontSize: '12px',
                    color: theme.colors.text,
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentSource) {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentSource) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {source.type === 'local' ? (
                      customAvatarUrls[source.location] ? (
                        <RepositoryAvatar
                          repository={repository}
                          localClone={repository.localClones?.find(
                            (c) => c.path === source.location
                          )}
                          customAvatarUrl={customAvatarUrls[source.location]}
                          size={14}
                          type="clone"
                        />
                      ) : (
                        <FolderOpen size={14} />
                      )
                    ) : (
                      <GitBranch size={14} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span>{displayName}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          opacity: 0.6,
                          color: theme.colors.textTertiary,
                        }}
                      >
                        {sourceTypeName}
                      </span>
                    </div>
                  </div>
                  {isCurrentSource && <Check size={12} color={theme.colors.primary} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Secrets button - only show for local sources */}
      {selectedSource?.type === 'local' && onSecretsClick && (
        <button
          onClick={onSecretsClick}
          style={{
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Manage environment secrets"
        >
          <Key size={14} color={theme.colors.textSecondary} />
        </button>
      )}

      {/* Help button */}
      {onHelpClick && (
        <button
          onClick={onHelpClick}
          style={{
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="What do these indicators mean?"
        >
          <HelpCircle size={14} color={theme.colors.textSecondary} />
        </button>
      )}
    </div>
  );
};
import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X, FolderPlus, Check, Trash2 } from 'lucide-react';

interface AgentOption {
  id: string;
  name: string;
  description: string;
  path: string;
}

const AGENT_OPTIONS: AgentOption[] = [
  {
    id: 'claude-specific',
    name: 'Claude',
    description: 'Claude-specific skills for Anthropic\'s Claude',
    path: '~/.claude/skills',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Skills for OpenCode AI assistant',
    path: '~/.config/opencode/skill',
  },
  {
    id: 'cursor-ide',
    name: 'Cursor',
    description: 'Skills for Cursor IDE AI assistant',
    path: '~/.cursor/skills',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    description: 'Skills for Windsurf AI assistant',
    path: '~/.windsurf/skills',
  },
];

interface DetectedDirectory {
  id: string;
  path: string;
  displayName: string;
  icon: string;
  skillCount: number;
  skills: string[];
}

interface AgentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetup: (selectedAgents: string[]) => Promise<void>;
  existingDirectoryIds?: string[]; // IDs of directories that already exist
  detectedDirectories?: DetectedDirectory[]; // Full directory info including skill count
  onRemove?: (agentId: string) => Promise<void>; // Callback for removing empty directories
}

export const AgentSetupModal: React.FC<AgentSetupModalProps> = ({
  isOpen,
  onClose,
  onSetup,
  existingDirectoryIds = [],
  detectedDirectories = [],
  onRemove,
}) => {
  const { theme } = useTheme();
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const handleSetup = async () => {
    if (selectedAgents.size === 0) {
      setError('Please select at least one agent');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(false);

    try {
      console.info('[AgentSetupModal] Creating directories for:', Array.from(selectedAgents));
      await onSetup(Array.from(selectedAgents));
      console.info('[AgentSetupModal] Directories created successfully');

      // Show success state
      setSuccess(true);
      setIsCreating(false);

      // Close after a brief delay to show success
      setTimeout(() => {
        onClose();
        setSelectedAgents(new Set());
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('[AgentSetupModal] Failed to create directories:', err);
      setError(err instanceof Error ? err.message : 'Failed to create directories');
      setIsCreating(false);
    }
  };

  const handleRemove = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent button's toggle

    if (!onRemove) return;

    setIsRemoving(agentId);
    setError(null);

    try {
      console.info('[AgentSetupModal] Removing directory for:', agentId);
      await onRemove(agentId);
      console.info('[AgentSetupModal] Directory removed successfully');
    } catch (err) {
      console.error('[AgentSetupModal] Failed to remove directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove directory');
    } finally {
      setIsRemoving(null);
    }
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
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                margin: 0,
                marginBottom: '4px',
                color: theme.colors.text,
              }}
            >
              Set Up Agent Skills
            </h2>
            <p
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                margin: 0,
              }}
            >
              {existingDirectoryIds.length > 0
                ? 'Select additional AI agent directories to create'
                : 'Select which AI agents you use to create their skill directories'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              color: theme.colors.textSecondary,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Agent Selection */}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {AGENT_OPTIONS.map((agent) => {
              const isExisting = existingDirectoryIds.includes(agent.id);
              const isSelected = selectedAgents.has(agent.id);
              const detectedDir = detectedDirectories.find(d => d.id === agent.id);
              const isEmpty = detectedDir && detectedDir.skillCount <= 1; // Only placeholder or empty

              return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                style={{
                  padding: '16px',
                  border: `2px solid ${
                    isSelected
                      ? theme.colors.primary
                      : isExisting
                        ? theme.colors.success
                        : theme.colors.border
                  }`,
                  borderRadius: '8px',
                  backgroundColor: isSelected
                    ? `${theme.colors.primary}10`
                    : isExisting
                      ? `${theme.colors.success}05`
                      : theme.colors.background,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  position: 'relative',
                  opacity: isExisting && !isSelected ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = isExisting ? `${theme.colors.success}05` : theme.colors.background;
                  }
                }}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: theme.colors.primary,
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.colors.background,
                    }}
                  >
                    <Check size={14} />
                  </div>
                )}

                {/* Remove button for empty directories or "Created" badge */}
                {isExisting && !isSelected && (
                  isEmpty && onRemove ? (
                    <button
                      onClick={(e) => handleRemove(agent.id, e)}
                      disabled={isRemoving === agent.id}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        padding: '6px 10px',
                        backgroundColor: theme.colors.error,
                        borderRadius: '4px',
                        fontSize: theme.fontSizes[0],
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.background,
                        border: 'none',
                        cursor: isRemoving === agent.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s',
                        opacity: isRemoving === agent.id ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (isRemoving !== agent.id) {
                          e.currentTarget.style.opacity = '0.85';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isRemoving !== agent.id) {
                          e.currentTarget.style.opacity = '1';
                        }
                      }}
                    >
                      <Trash2 size={12} />
                      {isRemoving === agent.id ? 'Removing...' : 'Remove'}
                    </button>
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        padding: '4px 8px',
                        backgroundColor: theme.colors.success,
                        borderRadius: '4px',
                        fontSize: theme.fontSizes[0],
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.background,
                      }}
                    >
                      Created
                    </div>
                  )
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: theme.fontSizes[2],
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.text,
                        marginBottom: '4px',
                      }}
                    >
                      {agent.name}
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {agent.description}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts.monospace,
                    color: theme.colors.textSecondary,
                    marginTop: '8px',
                  }}
                >
                  {agent.path}
                </div>
              </button>
            );
            })}
          </div>

          {success && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: `${theme.colors.success}20`,
                color: theme.colors.success,
                fontSize: theme.fontSizes[1],
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={16} />
              <span>Directories created successfully!</span>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: `${theme.colors.error}20`,
                color: theme.colors.error,
                fontSize: theme.fontSizes[1],
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '24px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            disabled={isCreating || success}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              cursor: isCreating || success ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              transition: 'all 0.2s',
              opacity: isCreating || success ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isCreating && !success) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating && !success) {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSetup}
            disabled={isCreating || success || selectedAgents.size === 0}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: success ? theme.colors.success : theme.colors.primary,
              color: theme.colors.background,
              cursor: isCreating || success || selectedAgents.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              transition: 'all 0.2s',
              opacity: isCreating || success || selectedAgents.size === 0 ? (success ? 1 : 0.5) : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isCreating && !success && selectedAgents.size > 0) {
                e.currentTarget.style.opacity = '0.85';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating && !success && selectedAgents.size > 0) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {success ? (
              <>
                <Check size={16} />
                Created!
              </>
            ) : isCreating ? (
              <>
                <FolderPlus size={16} />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus size={16} />
                {`Create ${selectedAgents.size} Director${selectedAgents.size === 1 ? 'y' : 'ies'}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

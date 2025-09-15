import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { 
  Terminal, 
  Play, 
  Package, 
  TestTube, 
  Hammer, 
  Search,
  X,
  ChevronDown,
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { PackageLayer, PackageCommand } from "@principal-ai/codebase-composition";
import { TouchedProject } from '../../utils/sessionProjectMapping';

interface PackageCommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
  package: PackageLayer | null;
  touchedProject?: TouchedProject;
  sessionCount: number;
  onRunCommand: (command: PackageCommand) => Promise<void>;
  repositoryPath?: string; // Add repository/clone path
}

interface CommandExecution {
  commandName: string;
  status: 'running' | 'success' | 'error';
  output?: string;
}

interface CommandConfirmation {
  command: PackageCommand;
  isOpen: boolean;
}

export const PackageCommandPanel: React.FC<PackageCommandPanelProps> = ({
  isOpen,
  onClose,
  package: pkg,
  touchedProject,
  sessionCount,
  onRunCommand,
  repositoryPath
}) => {
  const { theme } = useTheme();
  const [selectedCommand, setSelectedCommand] = useState<PackageCommand | null>(null);
  const [commandExecution, setCommandExecution] = useState<CommandExecution | null>(null);
  const [filter, setFilter] = useState<'all' | 'script' | 'standard'>('all');
  const [commandConfirmation, setCommandConfirmation] = useState<CommandConfirmation>({
    command: null as any,
    isOpen: false
  });

  // Reset when panel opens with new package
  useEffect(() => {
    if (isOpen && pkg) {
      setSelectedCommand(null);
      setCommandExecution(null);
      setFilter('all');
    }
  }, [isOpen, pkg]);

  if (!isOpen || !pkg) return null;

  const availableCommands = pkg.packageData.availableCommands || [];
  const filteredCommands = availableCommands.filter(cmd => 
    filter === 'all' || cmd.type === filter
  );

  // Group commands by type for better organization
  const scriptCommands = availableCommands.filter(cmd => cmd.type === 'script');
  const standardCommands = availableCommands.filter(cmd => cmd.type === 'standard');

  const getCommandIcon = (commandName: string) => {
    if (commandName.includes('test')) return <TestTube size={14} />;
    if (commandName.includes('build')) return <Hammer size={14} />;
    if (commandName.includes('run')) return <Play size={14} />;
    if (commandName.includes('lint') || commandName.includes('check')) return <Search size={14} />;
    if (commandName.includes('install')) return <Package size={14} />;
    return <Terminal size={14} />;
  };

  const handleCommandClick = (command: PackageCommand) => {
    setCommandConfirmation({
      command,
      isOpen: true
    });
  };

  const handleConfirmCommand = async () => {
    const command = commandConfirmation.command;
    setCommandConfirmation({ command: null as any, isOpen: false });
    
    setSelectedCommand(command);
    setCommandExecution({
      commandName: command.name,
      status: 'running'
    });

    try {
      await onRunCommand(command);
      setCommandExecution({
        commandName: command.name,
        status: 'success',
        output: `Successfully executed: ${command.command}`
      });
    } catch (error) {
      setCommandExecution({
        commandName: command.name,
        status: 'error',
        output: error instanceof Error ? error.message : 'Command failed'
      });
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease'
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '400px',
        backgroundColor: theme.colors.background,
        borderTop: `2px solid ${theme.colors.border}`,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.backgroundSecondary
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Package size={20} color={theme.colors.primary} />
            <div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: 600, 
                color: theme.colors.text,
                marginBottom: '2px'
              }}>
                {pkg.packageData.name}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} />
                  {sessionCount} session{sessionCount !== 1 ? 's' : ''} affected
                </span>
                {touchedProject && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} />
                    {touchedProject.fileCount} file{touchedProject.fileCount !== 1 ? 's' : ''} modified
                  </span>
                )}
                <span style={{
                  padding: '2px 6px',
                  backgroundColor: theme.colors.primary + '22',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 500
                }}>
                  {pkg.packageData.packageManager || pkg.type}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background
        }}>
          {[
            { value: 'all', label: `All (${availableCommands.length})` },
            { value: 'script', label: `Scripts (${scriptCommands.length})` },
            { value: 'standard', label: `Standard (${standardCommands.length})` }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filter === tab.value 
                  ? theme.colors.primary + '22'
                  : theme.colors.backgroundSecondary,
                color: filter === tab.value 
                  ? theme.colors.primary
                  : theme.colors.text,
                fontSize: '12px',
                fontWeight: filter === tab.value ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Commands List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px'
        }}>
          {filteredCommands.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              fontSize: '13px'
            }}>
              No commands available
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '8px'
            }}>
              {filteredCommands.map((command) => {
                const isRunning = commandExecution?.commandName === command.name && 
                                 commandExecution.status === 'running';
                const isSuccess = commandExecution?.commandName === command.name && 
                                 commandExecution.status === 'success';
                const isError = commandExecution?.commandName === command.name && 
                               commandExecution.status === 'error';

                return (
                  <button
                    key={command.name}
                    onClick={() => handleCommandClick(command)}
                    disabled={isRunning}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      backgroundColor: isSuccess 
                        ? theme.colors.success + '11'
                        : isError
                        ? theme.colors.error + '11'
                        : theme.colors.backgroundSecondary,
                      border: `1px solid ${
                        isSuccess 
                          ? theme.colors.success + '44'
                          : isError
                          ? theme.colors.error + '44'
                          : theme.colors.border
                      }`,
                      borderRadius: '8px',
                      cursor: isRunning ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      opacity: isRunning ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isRunning && !isSuccess && !isError) {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                        e.currentTarget.style.borderColor = theme.colors.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isRunning && !isSuccess && !isError) {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: command.type === 'script' 
                        ? theme.colors.primary + '22'
                        : theme.colors.backgroundTertiary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isRunning ? (
                        <Loader size={14} className="animate-spin" />
                      ) : isSuccess ? (
                        <CheckCircle size={14} color={theme.colors.success} />
                      ) : isError ? (
                        <XCircle size={14} color={theme.colors.error} />
                      ) : (
                        getCommandIcon(command.name)
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: theme.colors.text,
                        marginBottom: '2px'
                      }}>
                        {command.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {command.description || command.command}
                      </div>
                    </div>
                    {command.type === 'script' && (
                      <div style={{
                        padding: '2px 6px',
                        backgroundColor: theme.colors.primary + '22',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 500,
                        color: theme.colors.primary,
                        flexShrink: 0
                      }}>
                        script
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Execution Output (optional, for showing results) */}
        {commandExecution && commandExecution.output && (
          <div style={{
            padding: '12px 20px',
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: commandExecution.status === 'error' 
              ? theme.colors.error + '11'
              : theme.colors.success + '11',
            fontSize: '12px',
            color: commandExecution.status === 'error' 
              ? theme.colors.error
              : theme.colors.success,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {commandExecution.status === 'error' ? (
              <XCircle size={14} />
            ) : (
              <CheckCircle size={14} />
            )}
            {commandExecution.output}
          </div>
        )}
      </div>

      {/* Command Confirmation Modal */}
      {commandConfirmation.isOpen && commandConfirmation.command && (
        <>
          {/* Modal Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={() => setCommandConfirmation({ command: null as any, isOpen: false })}
          >
            {/* Modal Content */}
            <div 
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                animation: 'slideUp 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: theme.colors.primary + '22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Terminal size={20} color={theme.colors.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    margin: 0,
                    marginBottom: '4px'
                  }}>
                    Run Command
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    margin: 0
                  }}>
                    Confirm the command you want to execute
                  </p>
                </div>
              </div>

              {/* Command Details */}
              <div style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    Command Name
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: theme.colors.text,
                    fontWeight: 500
                  }}>
                    {commandConfirmation.command.name}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    Full Command
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: theme.colors.primary,
                    backgroundColor: theme.colors.background,
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: `1px solid ${theme.colors.border}`
                  }}>
                    {commandConfirmation.command.command}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    Execution Directory
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: theme.colors.text,
                    backgroundColor: theme.colors.background,
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: `1px solid ${theme.colors.border}`,
                    wordBreak: 'break-all'
                  }}>
                    {(() => {
                      const packagePath = commandConfirmation.command.workingDirectory || pkg?.packageData.path || '.';
                      if (repositoryPath) {
                        // Combine repository path with package path
                        if (packagePath === '.' || packagePath === '') {
                          return repositoryPath;
                        }
                        // Ensure proper path joining
                        return `${repositoryPath}${repositoryPath.endsWith('/') ? '' : '/'}${packagePath}`;
                      }
                      return packagePath;
                    })()}
                  </div>
                </div>

                {commandConfirmation.command.description && (
                  <div>
                    <div style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      Description
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary
                    }}>
                      {commandConfirmation.command.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Package Context */}
              <div style={{
                padding: '12px',
                backgroundColor: theme.colors.primary + '11',
                borderRadius: '6px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: theme.colors.primary
              }}>
                <Package size={14} />
                <span>
                  This command will run in the <strong>{pkg?.packageData.name}</strong> package
                  {sessionCount > 0 && ` (affected by ${sessionCount} session${sessionCount !== 1 ? 's' : ''})`}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setCommandConfirmation({ command: null as any, isOpen: false })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCommand}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Play size={14} />
                  Run Command
                </button>
              </div>
            </div>
          </div>

          {/* Add animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
};
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Terminal, Play, Package, TestTube, Hammer, Search, X, Users, FileText, CheckCircle, XCircle, Loader } from 'lucide-react';
export const PackageCommandPanel = ({ isOpen, onClose, package: pkg, touchedProject, sessionCount, onRunCommand, repositoryPath }) => {
    const { theme } = useTheme();
    const [selectedCommand, setSelectedCommand] = useState(null);
    const [commandExecution, setCommandExecution] = useState(null);
    const [filter, setFilter] = useState('all');
    const [commandConfirmation, setCommandConfirmation] = useState({
        command: null,
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
    if (!isOpen || !pkg)
        return null;
    const availableCommands = pkg.packageData.availableCommands || [];
    const filteredCommands = availableCommands.filter(cmd => filter === 'all' || cmd.type === filter);
    // Group commands by type for better organization
    const scriptCommands = availableCommands.filter(cmd => cmd.type === 'script');
    const standardCommands = availableCommands.filter(cmd => cmd.type === 'standard');
    const getCommandIcon = (commandName) => {
        if (commandName.includes('test'))
            return _jsx(TestTube, { size: 14 });
        if (commandName.includes('build'))
            return _jsx(Hammer, { size: 14 });
        if (commandName.includes('run'))
            return _jsx(Play, { size: 14 });
        if (commandName.includes('lint') || commandName.includes('check'))
            return _jsx(Search, { size: 14 });
        if (commandName.includes('install'))
            return _jsx(Package, { size: 14 });
        return _jsx(Terminal, { size: 14 });
    };
    const handleCommandClick = (command) => {
        setCommandConfirmation({
            command,
            isOpen: true
        });
    };
    const handleConfirmCommand = async () => {
        const command = commandConfirmation.command;
        setCommandConfirmation({ command: null, isOpen: false });
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
        }
        catch (error) {
            setCommandExecution({
                commandName: command.name,
                status: 'error',
                output: error instanceof Error ? error.message : 'Command failed'
            });
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: {
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
                }, onClick: onClose }), _jsxs("div", { style: {
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
                }, children: [_jsxs("div", { style: {
                            padding: '16px 20px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: theme.colors.backgroundSecondary
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Package, { size: 20, color: theme.colors.primary }), _jsxs("div", { children: [_jsx("div", { style: {
                                                    fontSize: '16px',
                                                    fontWeight: 600,
                                                    color: theme.colors.text,
                                                    marginBottom: '2px'
                                                }, children: pkg.packageData.name }), _jsxs("div", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Users, { size: 12 }), sessionCount, " session", sessionCount !== 1 ? 's' : '', " affected"] }), touchedProject && (_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(FileText, { size: 12 }), touchedProject.fileCount, " file", touchedProject.fileCount !== 1 ? 's' : '', " modified"] })), _jsx("span", { style: {
                                                            padding: '2px 6px',
                                                            backgroundColor: theme.colors.primary + '22',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 500
                                                        }, children: pkg.packageData.packageManager || pkg.type })] })] })] }), _jsx("button", { onClick: onClose, style: {
                                    background: 'none',
                                    border: 'none',
                                    color: theme.colors.textSecondary,
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }, children: _jsx(X, { size: 20 }) })] }), _jsx("div", { style: {
                            display: 'flex',
                            gap: '8px',
                            padding: '12px 20px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background
                        }, children: [
                            { value: 'all', label: `All (${availableCommands.length})` },
                            { value: 'script', label: `Scripts (${scriptCommands.length})` },
                            { value: 'standard', label: `Standard (${standardCommands.length})` }
                        ].map(tab => (_jsx("button", { onClick: () => setFilter(tab.value), style: {
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
                            }, children: tab.label }, tab.value))) }), _jsx("div", { style: {
                            flex: 1,
                            overflow: 'auto',
                            padding: '12px'
                        }, children: filteredCommands.length === 0 ? (_jsx("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: theme.colors.textSecondary,
                                fontSize: '13px'
                            }, children: "No commands available" })) : (_jsx("div", { style: {
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '8px'
                            }, children: filteredCommands.map((command) => {
                                const isRunning = commandExecution?.commandName === command.name &&
                                    commandExecution.status === 'running';
                                const isSuccess = commandExecution?.commandName === command.name &&
                                    commandExecution.status === 'success';
                                const isError = commandExecution?.commandName === command.name &&
                                    commandExecution.status === 'error';
                                return (_jsxs("button", { onClick: () => handleCommandClick(command), disabled: isRunning, style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px',
                                        backgroundColor: isSuccess
                                            ? theme.colors.success + '11'
                                            : isError
                                                ? theme.colors.error + '11'
                                                : theme.colors.backgroundSecondary,
                                        border: `1px solid ${isSuccess
                                            ? theme.colors.success + '44'
                                            : isError
                                                ? theme.colors.error + '44'
                                                : theme.colors.border}`,
                                        borderRadius: '8px',
                                        cursor: isRunning ? 'wait' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'left',
                                        opacity: isRunning ? 0.7 : 1
                                    }, onMouseEnter: (e) => {
                                        if (!isRunning && !isSuccess && !isError) {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                            e.currentTarget.style.borderColor = theme.colors.primary;
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (!isRunning && !isSuccess && !isError) {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            e.currentTarget.style.borderColor = theme.colors.border;
                                        }
                                    }, children: [_jsx("div", { style: {
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
                                            }, children: isRunning ? (_jsx(Loader, { size: 14, className: "animate-spin" })) : isSuccess ? (_jsx(CheckCircle, { size: 14, color: theme.colors.success })) : isError ? (_jsx(XCircle, { size: 14, color: theme.colors.error })) : (getCommandIcon(command.name)) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: {
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        color: theme.colors.text,
                                                        marginBottom: '2px'
                                                    }, children: command.name }), _jsx("div", { style: {
                                                        fontSize: '11px',
                                                        color: theme.colors.textSecondary,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }, children: command.description || command.command })] }), command.type === 'script' && (_jsx("div", { style: {
                                                padding: '2px 6px',
                                                backgroundColor: theme.colors.primary + '22',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: 500,
                                                color: theme.colors.primary,
                                                flexShrink: 0
                                            }, children: "script" }))] }, command.name));
                            }) })) }), commandExecution && commandExecution.output && (_jsxs("div", { style: {
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
                        }, children: [commandExecution.status === 'error' ? (_jsx(XCircle, { size: 14 })) : (_jsx(CheckCircle, { size: 14 })), commandExecution.output] }))] }), commandConfirmation.isOpen && commandConfirmation.command && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
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
                        }, onClick: () => setCommandConfirmation({ command: null, isOpen: false }), children: _jsxs("div", { style: {
                                backgroundColor: theme.colors.background,
                                borderRadius: '12px',
                                border: `1px solid ${theme.colors.border}`,
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                                padding: '24px',
                                maxWidth: '500px',
                                width: '90%',
                                animation: 'slideUp 0.3s ease-out'
                            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '20px'
                                    }, children: [_jsx("div", { style: {
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '8px',
                                                backgroundColor: theme.colors.primary + '22',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }, children: _jsx(Terminal, { size: 20, color: theme.colors.primary }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("h3", { style: {
                                                        fontSize: '16px',
                                                        fontWeight: 600,
                                                        color: theme.colors.text,
                                                        margin: 0,
                                                        marginBottom: '4px'
                                                    }, children: "Run Command" }), _jsx("p", { style: {
                                                        fontSize: '13px',
                                                        color: theme.colors.textSecondary,
                                                        margin: 0
                                                    }, children: "Confirm the command you want to execute" })] })] }), _jsxs("div", { style: {
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '16px'
                                    }, children: [_jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        color: theme.colors.textSecondary,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '4px'
                                                    }, children: "Command Name" }), _jsx("div", { style: {
                                                        fontSize: '14px',
                                                        color: theme.colors.text,
                                                        fontWeight: 500
                                                    }, children: commandConfirmation.command.name })] }), _jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        color: theme.colors.textSecondary,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '4px'
                                                    }, children: "Full Command" }), _jsx("div", { style: {
                                                        fontFamily: 'monospace',
                                                        fontSize: '13px',
                                                        color: theme.colors.primary,
                                                        backgroundColor: theme.colors.background,
                                                        padding: '8px 12px',
                                                        borderRadius: '4px',
                                                        border: `1px solid ${theme.colors.border}`
                                                    }, children: commandConfirmation.command.command })] }), _jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        color: theme.colors.textSecondary,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '4px'
                                                    }, children: "Execution Directory" }), _jsx("div", { style: {
                                                        fontFamily: 'monospace',
                                                        fontSize: '12px',
                                                        color: theme.colors.text,
                                                        backgroundColor: theme.colors.background,
                                                        padding: '6px 10px',
                                                        borderRadius: '4px',
                                                        border: `1px solid ${theme.colors.border}`,
                                                        wordBreak: 'break-all'
                                                    }, children: (() => {
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
                                                    })() })] }), commandConfirmation.command.description && (_jsxs("div", { children: [_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        color: theme.colors.textSecondary,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        marginBottom: '4px'
                                                    }, children: "Description" }), _jsx("div", { style: {
                                                        fontSize: '12px',
                                                        color: theme.colors.textSecondary
                                                    }, children: commandConfirmation.command.description })] }))] }), _jsxs("div", { style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.primary + '11',
                                        borderRadius: '6px',
                                        marginBottom: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '12px',
                                        color: theme.colors.primary
                                    }, children: [_jsx(Package, { size: 14 }), _jsxs("span", { children: ["This command will run in the ", _jsx("strong", { children: pkg?.packageData.name }), " package", sessionCount > 0 && ` (affected by ${sessionCount} session${sessionCount !== 1 ? 's' : ''})`] })] }), _jsxs("div", { style: {
                                        display: 'flex',
                                        gap: '12px',
                                        justifyContent: 'flex-end'
                                    }, children: [_jsx("button", { onClick: () => setCommandConfirmation({ command: null, isOpen: false }), style: {
                                                padding: '8px 16px',
                                                borderRadius: '6px',
                                                border: `1px solid ${theme.colors.border}`,
                                                backgroundColor: theme.colors.background,
                                                color: theme.colors.text,
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.background;
                                            }, children: "Cancel" }), _jsxs("button", { onClick: handleConfirmCommand, style: {
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
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }, children: [_jsx(Play, { size: 14 }), "Run Command"] })] })] }) }), _jsx("style", { children: `
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
          ` })] }))] }));
};

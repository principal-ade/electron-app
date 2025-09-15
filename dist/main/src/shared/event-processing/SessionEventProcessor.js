/**
 * Centralized Event Processing System
 *
 * This module defines how events update session state.
 * Used by both backend (for storage) and frontend (for real-time updates).
 */
import { EventActivityType } from '../sessionEnums';
/**
 * Default processors for standard tool events
 */
export class FileReadProcessor {
    canProcess(event) {
        return event.toolName === 'Read';
    }
    process(event, currentState) {
        if (!event.files || event.files.length === 0) {
            return { session: {} };
        }
        // Initialize fileAccesses and filesRead if needed
        const fileAccesses = currentState.fileAccesses || {};
        const filesRead = currentState.filesRead || [];
        // Process all files in the array
        event.files.forEach(file => {
            const filePath = file.absolutePath;
            if (!filePath)
                return;
            if (!fileAccesses[filePath]) {
                fileAccesses[filePath] = [];
            }
            fileAccesses[filePath].push({
                timestamp: event.timestamp,
                normalizedPath: file.repository?.relativePath
            });
            // Add to filesRead array if not already present
            // Use relative path if available, otherwise use absolute path
            const pathToAdd = file.repository?.relativePath || filePath;
            if (!filesRead.includes(pathToAdd)) {
                filesRead.push(pathToAdd);
            }
        });
        const firstFile = event.files[0];
        return {
            session: {
                fileAccesses,
                filesRead,
                fileAccessCount: Object.keys(fileAccesses).length,
                lastActivity: event.timestamp,
                eventCount: (currentState.eventCount || 0) + 1,
                lastEvent: {
                    type: EventActivityType.READ,
                    fileName: firstFile?.displayPath?.split('/').pop(),
                    timestamp: event.timestamp
                }
            }
        };
    }
}
export class FileWriteProcessor {
    canProcess(event) {
        return ['Write', 'Edit', 'MultiEdit'].includes(event.toolName || '');
    }
    process(event, currentState) {
        if (!event.files || event.files.length === 0) {
            return { session: {} };
        }
        // Initialize fileWrites and filesWritten if needed
        const fileWrites = currentState.fileWrites || {};
        const filesWritten = currentState.filesWritten || [];
        const affectedFiles = [];
        // Process all files in the array
        event.files.forEach(file => {
            const filePath = file.absolutePath;
            if (!filePath)
                return;
            if (!fileWrites[filePath]) {
                fileWrites[filePath] = [];
            }
            fileWrites[filePath].push({
                timestamp: event.timestamp,
                operation: event.toolName || 'write',
                normalizedPath: file.repository?.relativePath
            });
            affectedFiles.push(filePath);
            // Add to filesWritten array if not already present
            // Use relative path if available, otherwise use absolute path
            const pathToAdd = file.repository?.relativePath || filePath;
            if (!filesWritten.includes(pathToAdd)) {
                filesWritten.push(pathToAdd);
            }
        });
        const firstFile = event.files[0];
        return {
            session: {
                fileWrites,
                filesWritten,
                fileWriteCount: Object.keys(fileWrites).length,
                lastActivity: event.timestamp,
                eventCount: (currentState.eventCount || 0) + 1,
                lastEvent: {
                    type: EventActivityType.WRITE,
                    fileName: firstFile?.displayPath?.split('/').pop(),
                    timestamp: event.timestamp
                }
            },
            sideEffects: {
                checkGitStatus: affectedFiles
            }
        };
    }
}
export class BashProcessor {
    canProcess(event) {
        return event.toolName === 'Bash';
    }
    process(event, currentState) {
        const command = event.toolInput?.command;
        if (!command) {
            return { session: {} };
        }
        // Basic command analysis (can be extended)
        const filesAccessed = [];
        const filesModified = [];
        // Simple heuristics - can be made more sophisticated
        if (command.includes('cat ') || command.includes('grep ') || command.includes('ls ')) {
            // Read operations
            const matches = command.match(/(?:cat|grep|ls)\s+([^\s;|&]+)/g);
            if (matches) {
                filesAccessed.push(...matches.map((m) => m.split(' ')[1]));
            }
        }
        if (command.includes('echo ') && command.includes('>')) {
            // Write operations
            const matches = command.match(/>\s*([^\s;|&]+)/g);
            if (matches) {
                filesModified.push(...matches.map((m) => m.replace('>', '').trim()));
            }
        }
        const bashCommands = currentState.bashCommands || [];
        bashCommands.push({
            command,
            timestamp: event.timestamp,
            filesAccessed: filesAccessed.length > 0 ? filesAccessed : undefined,
            filesModified: filesModified.length > 0 ? filesModified : undefined
        });
        // Update file counts if we detected file operations
        let fileAccesses = currentState.fileAccesses || {};
        let fileWrites = currentState.fileWrites || {};
        filesAccessed.forEach(file => {
            if (!fileAccesses[file])
                fileAccesses[file] = [];
            fileAccesses[file].push({
                timestamp: event.timestamp,
                metadata: { source: 'bash', command }
            });
        });
        filesModified.forEach(file => {
            if (!fileWrites[file])
                fileWrites[file] = [];
            fileWrites[file].push({
                timestamp: event.timestamp,
                operation: 'bash',
                metadata: { command }
            });
        });
        return {
            session: {
                bashCommands,
                fileAccesses: Object.keys(fileAccesses).length > 0 ? fileAccesses : currentState.fileAccesses,
                fileWrites: Object.keys(fileWrites).length > 0 ? fileWrites : currentState.fileWrites,
                fileAccessCount: Object.keys(fileAccesses).length,
                fileWriteCount: Object.keys(fileWrites).length,
                toolCallCount: (currentState.toolCallCount || 0) + 1,
                lastActivity: event.timestamp,
                eventCount: (currentState.eventCount || 0) + 1
            },
            sideEffects: {
                analyzeBashCommand: command,
                checkGitStatus: filesModified
            }
        };
    }
}
export class TodoWriteProcessor {
    canProcess(event) {
        return event.toolName === 'TodoWrite';
    }
    process(event, currentState) {
        const todoData = event.toolInput;
        if (!todoData?.todos) {
            return { session: {} };
        }
        const todoStats = todoData.todos.reduce((acc, todo) => {
            if (todo.status === 'completed')
                acc.completed++;
            else if (todo.status === 'in_progress')
                acc.inProgress++;
            else
                acc.pending++;
            return acc;
        }, { completed: 0, inProgress: 0, pending: 0 });
        return {
            session: {
                lastActivity: event.timestamp,
                eventCount: (currentState.eventCount || 0) + 1,
                toolCallCount: (currentState.toolCallCount || 0) + 1,
                lastEvent: {
                    type: EventActivityType.TODO_WRITE,
                    fileName: `Todos: ${todoStats.inProgress} active, ${todoStats.completed} done`,
                    timestamp: event.timestamp
                },
                // Store the actual todos in metadata
                metadata: {
                    ...currentState.metadata,
                    lastTodos: todoData.todos
                }
            }
        };
    }
}
/**
 * Main session event processor
 */
export class SessionEventProcessor {
    processors = [
        new FileReadProcessor(),
        new FileWriteProcessor(),
        new BashProcessor(),
        new TodoWriteProcessor()
    ];
    /**
     * Register a custom processor
     */
    registerProcessor(processor) {
        this.processors.push(processor);
    }
    /**
     * Process an event and return session updates
     */
    processEvent(event, currentState) {
        // Find matching processor
        for (const processor of this.processors) {
            if (processor.canProcess(event)) {
                return processor.process(event, currentState);
            }
        }
        // Default processing for unknown events
        return {
            session: {
                lastActivity: event.timestamp,
                eventCount: (currentState.eventCount || 0) + 1,
                toolCallCount: event.toolName ? (currentState.toolCallCount || 0) + 1 : currentState.toolCallCount
            }
        };
    }
    /**
     * Initialize a new session state
     */
    initializeSession(sessionId, workingDirectory) {
        return {
            sessionId,
            workingDirectory,
            firstAccess: Date.now(),
            lastActivity: Date.now(),
            eventCount: 0,
            isActive: true,
            fileAccessCount: 0,
            fileWriteCount: 0,
            fileAccesses: {},
            fileWrites: {},
            filesRead: [],
            filesWritten: [],
            toolCallCount: 0,
            toolCalls: [],
            webAccessCount: 0,
            webAccesses: [],
            bashCommands: []
        };
    }
    /**
     * Merge partial updates into current state
     */
    mergeState(current, updates) {
        return {
            ...current,
            ...updates,
            // Ensure objects are properly merged, not replaced
            fileAccesses: updates.fileAccesses || current.fileAccesses,
            fileWrites: updates.fileWrites || current.fileWrites,
            metadata: { ...current.metadata, ...updates.metadata }
        };
    }
}
// Export singleton instance
export const sessionEventProcessor = new SessionEventProcessor();

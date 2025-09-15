/**
 * Centralized types for session visualization
 */
// Removed import from main. Define AgentSessionRecord locally to avoid cross-process dependency
// import type { AgentSessionRecord } from '../main/agent-session-events/types/session.types';
import { SessionEventType, ToolType, FileOperation, ToolName, getToolType, getToolColor, getToolIcon, } from './sessionEnums';
// Function to create events from session
export function createSessionEvents(session, options) {
    const events = [];
    // Add file accesses
    Object.entries(session.fileAccesses || {}).forEach(([file, accesses]) => {
        accesses.forEach((access, idx) => {
            events.push({
                id: `file-read-${file}-${access.timestamp}-${idx}`,
                type: SessionEventType.FILE_READ,
                timestamp: access.timestamp,
                filePath: file,
                normalizedPath: access.normalizedPath,
                fileName: file.split('/').pop(),
                toolName: ToolName.READ,
                toolType: ToolType.READ,
                metadata: access.metadata,
                color: '#4CAF50',
                icon: 'file-read',
                description: `Read ${file.split('/').pop()}`,
            });
        });
    });
    // Add file writes
    Object.entries(session.fileWrites || {}).forEach(([file, writes]) => {
        writes.forEach((write, idx) => {
            events.push({
                id: `file-write-${file}-${write.timestamp}-${idx}`,
                type: SessionEventType.FILE_WRITE,
                timestamp: write.timestamp,
                filePath: file,
                normalizedPath: write.normalizedPath,
                fileName: file.split('/').pop(),
                operation: write.operation,
                toolName: write.operation === FileOperation.CREATE
                    ? ToolName.WRITE
                    : ToolName.WRITE,
                toolType: ToolType.WRITE,
                metadata: write.metadata,
                color: write.operation === FileOperation.CREATE ? '#FF9800' : '#2196F3',
                icon: write.operation === FileOperation.CREATE ? 'file-plus' : 'file-edit',
                description: `${write.operation === FileOperation.CREATE ? 'Created' : 'Modified'} ${file.split('/').pop()}`,
            });
        });
    });
    // Add tool calls
    if (session.toolCalls) {
        session.toolCalls.forEach((toolCall, idx) => {
            const toolType = getToolType(toolCall.toolName);
            events.push({
                id: `tool-${toolCall.toolName}-${toolCall.timestamp}-${idx}`,
                type: SessionEventType.TOOL,
                timestamp: toolCall.timestamp,
                toolName: toolCall.toolName,
                toolType,
                filePath: (toolCall.parameters?.file_path || toolCall.parameters?.path),
                normalizedPath: toolCall.normalizedPath,
                fileName: toolCall.normalizedPath?.split('/').pop(),
                metadata: {
                    ...toolCall.metadata,
                    parameters: toolCall.parameters,
                    toolInput: toolCall.toolInput,
                    toolResponse: toolCall.toolResponse,
                    duration: toolCall.duration,
                    resultSize: toolCall.resultSize,
                    error: toolCall.error,
                },
                color: getToolColor(toolCall.toolName),
                icon: getToolIcon(toolCall.toolName),
                description: getToolDescription(toolCall),
            });
        });
    }
    // Add stop events if requested
    if (options?.includeStops && session.stopEvents) {
        session.stopEvents.forEach((stopEvent, idx) => {
            events.push({
                id: `stop-${stopEvent.timestamp}-${idx}`,
                type: SessionEventType.STOP,
                timestamp: stopEvent.timestamp,
                metadata: stopEvent,
                color: '#F44336',
                icon: 'stop',
                description: `Session stopped (${stopEvent.trigger || 'manual'})`,
            });
        });
    }
    // Sort by timestamp
    events.sort((a, b) => b.timestamp - a.timestamp);
    // Apply limit if specified
    if (options?.limit) {
        return events.slice(0, options.limit);
    }
    return events;
}
// Group related events that happen close together
export function groupRelatedEvents(events, options) {
    const timeWindow = options?.timeWindow ?? 1000;
    const groupFileOps = options?.groupFileOperations ?? true;
    if (!groupFileOps) {
        return events;
    }
    const groupedEvents = [];
    const usedIds = new Set();
    for (let i = 0; i < events.length; i++) {
        if (usedIds.has(events[i].id))
            continue;
        const currentEvent = events[i];
        // Check if this is a tool event that works on files
        if (currentEvent.type === SessionEventType.TOOL &&
            currentEvent.toolType &&
            [ToolType.READ, ToolType.WRITE, ToolType.EDIT].includes(currentEvent.toolType) &&
            currentEvent.normalizedPath) {
            const relatedEvents = [currentEvent];
            usedIds.add(currentEvent.id);
            // Look for file events within time window that match this file
            for (let j = 0; j < events.length; j++) {
                if (i === j || usedIds.has(events[j].id))
                    continue;
                const otherEvent = events[j];
                const timeDiff = Math.abs(currentEvent.timestamp - otherEvent.timestamp);
                if (timeDiff <= timeWindow &&
                    (otherEvent.type === SessionEventType.FILE_READ ||
                        otherEvent.type === SessionEventType.FILE_WRITE) &&
                    otherEvent.normalizedPath === currentEvent.normalizedPath) {
                    relatedEvents.push(otherEvent);
                    usedIds.add(otherEvent.id);
                }
            }
            if (relatedEvents.length > 1) {
                // Create a grouped event
                groupedEvents.push({
                    id: `grouped-${currentEvent.id}`,
                    type: SessionEventType.GROUPED,
                    timestamp: Math.max(...relatedEvents.map((e) => e.timestamp)),
                    filePath: currentEvent.filePath,
                    normalizedPath: currentEvent.normalizedPath,
                    fileName: currentEvent.fileName,
                    toolName: relatedEvents.find((e) => e.toolName)?.toolName,
                    toolType: relatedEvents.find((e) => e.toolType)?.toolType,
                    color: currentEvent.color,
                    icon: 'folder-group',
                    description: `Multiple operations on ${currentEvent.fileName}`,
                    metadata: {
                        events: relatedEvents,
                        operations: relatedEvents
                            .map((e) => e.operation || e.toolName)
                            .filter(Boolean),
                    },
                });
            }
            else {
                groupedEvents.push(currentEvent);
            }
        }
        else if (!usedIds.has(currentEvent.id)) {
            // Check if this is a file event that might have a related tool
            if ((currentEvent.type === SessionEventType.FILE_READ ||
                currentEvent.type === SessionEventType.FILE_WRITE) &&
                currentEvent.normalizedPath) {
                const relatedEvents = [currentEvent];
                usedIds.add(currentEvent.id);
                // Look for tool events within time window that match this file
                for (let j = 0; j < events.length; j++) {
                    if (i === j || usedIds.has(events[j].id))
                        continue;
                    const otherEvent = events[j];
                    const timeDiff = Math.abs(currentEvent.timestamp - otherEvent.timestamp);
                    if (timeDiff <= timeWindow &&
                        otherEvent.type === SessionEventType.TOOL &&
                        otherEvent.toolType &&
                        [ToolType.READ, ToolType.WRITE, ToolType.EDIT].includes(otherEvent.toolType) &&
                        otherEvent.normalizedPath === currentEvent.normalizedPath) {
                        relatedEvents.push(otherEvent);
                        usedIds.add(otherEvent.id);
                    }
                }
                if (relatedEvents.length > 1) {
                    // Create a grouped event with the tool event's info taking precedence
                    const toolEvent = relatedEvents.find((e) => e.type === SessionEventType.TOOL);
                    groupedEvents.push({
                        id: `grouped-${currentEvent.id}`,
                        type: SessionEventType.GROUPED,
                        timestamp: Math.max(...relatedEvents.map((e) => e.timestamp)),
                        filePath: currentEvent.filePath,
                        normalizedPath: currentEvent.normalizedPath,
                        fileName: currentEvent.fileName,
                        toolName: toolEvent?.toolName || currentEvent.toolName,
                        toolType: toolEvent?.toolType || currentEvent.toolType,
                        color: toolEvent?.color || currentEvent.color,
                        icon: 'folder-group',
                        description: `Multiple operations on ${currentEvent.fileName}`,
                        metadata: {
                            events: relatedEvents,
                            operations: relatedEvents
                                .map((e) => e.operation || e.toolName)
                                .filter(Boolean),
                        },
                    });
                }
                else {
                    groupedEvents.push(currentEvent);
                }
            }
            else {
                // Add non-file events as-is
                groupedEvents.push(currentEvent);
            }
        }
    }
    return groupedEvents;
}
// Helper function for tool descriptions
function getToolDescription(toolCall) {
    const fileName = toolCall.normalizedPath?.split('/').pop() || 'file';
    switch (toolCall.toolName) {
        case ToolName.READ:
            return `Read ${fileName}`;
        case ToolName.WRITE:
            return `Wrote to ${fileName}`;
        case ToolName.EDIT:
        case ToolName.MULTI_EDIT:
            return `Edited ${fileName}`;
        case ToolName.GREP:
            return `Searched for "${toolCall.parameters?.pattern || 'pattern'}"`;
        case ToolName.GLOB:
            return `Found files matching "${toolCall.parameters?.pattern || 'pattern'}"`;
        case ToolName.BASH:
            return `Ran command: ${toolCall.parameters?.command?.substring(0, 50) || 'bash'}...`;
        default:
            return `Used ${toolCall.toolName}`;
    }
}

import { SessionEventType } from '../../../shared/sessionEnums';
import { createSessionEvents, groupRelatedEvents, } from '../../../shared/sessionTypes';
// Configuration for event processing
const EVENT_BATCH_SIZE = 50; // Process events in batches
const INITIAL_EVENTS_COUNT = 100; // Number of recent events to process immediately
// Helper function to create timeline events with grouping
export const createTimelineEvents = (session, options) => {
    // Use centralized function to create events
    const sessionEvents = createSessionEvents(session, {
        includeStops: true,
        limit: options?.limit,
    });
    // Group related events
    const groupedEvents = groupRelatedEvents(sessionEvents, {
        groupFileOperations: !options?.skipNormalization,
    });
    // Convert to timeline format (most recent first)
    const timelineEvents = groupedEvents.map((event) => {
        // For grouped events, extract the nested events
        if (event.type === SessionEventType.GROUPED && event.metadata?.events) {
            return {
                id: event.id,
                type: event.type,
                timestamp: event.timestamp,
                data: {
                    events: event.metadata.events.map((e) => ({
                        id: e.id,
                        type: e.type,
                        timestamp: e.timestamp,
                        data: {
                            file: e.normalizedPath || e.filePath,
                            // Never expose absolute paths in UI
                            // originalPath field removed for security
                            normalizedPath: e.normalizedPath,
                            toolName: e.toolName,
                            write: e.operation ? { operation: e.operation } : undefined,
                            metadata: e.metadata,
                            parameters: e.metadata?.parameters,
                        },
                    })),
                    filePath: event.filePath || event.normalizedPath,
                },
            };
        }
        // For regular events, convert to timeline format
        return {
            id: event.id,
            type: event.type,
            timestamp: event.timestamp,
            data: {
                file: event.normalizedPath || event.filePath,
                // Never expose absolute paths in UI
                // originalPath field removed for security
                normalizedPath: event.normalizedPath,
                toolName: event.toolName,
                write: event.operation ? { operation: event.operation } : undefined,
                metadata: event.metadata,
                parameters: event.type === SessionEventType.TOOL
                    ? event.metadata?.parameters
                    : undefined,
                ...(event.type === SessionEventType.STOP ? event.metadata : {}),
            },
        };
    });
    // Sort by timestamp (most recent first)
    timelineEvents.sort((a, b) => b.timestamp - a.timestamp);
    return timelineEvents;
};
// Helper function to segment events by stop times
export const segmentEventsByStops = (session) => {
    const allEvents = createTimelineEvents(session);
    const segments = [];
    // Get all stop times from stop events
    const stopTimes = [];
    // Extract stop times
    allEvents.forEach((event) => {
        if (event.type === SessionEventType.STOP ||
            event.trigger === 'stop-hook' ||
            event.metadata?.trigger === 'stop-hook') {
            stopTimes.push(event.timestamp);
        }
    });
    // Sort stop times in ascending order (oldest first)
    stopTimes.sort((a, b) => a - b);
    // If no stop events, create one segment with all events
    if (stopTimes.length === 0) {
        if (allEvents.length > 0) {
            segments.push({
                startTime: allEvents[allEvents.length - 1].timestamp, // Oldest event
                endTime: null,
                events: allEvents,
                isReviewed: false,
                segmentNumber: 1,
            });
        }
        return segments;
    }
    // Get reviewed stops from session data
    const reviewedStops = new Set();
    if (session.stopEvents) {
        session.stopEvents.forEach((stopEvent) => {
            if (session.reviewedLastStop &&
                stopEvent.timestamp === session.lastStopTime) {
                reviewedStops.add(stopEvent.timestamp);
            }
        });
    }
    // Create segments based on stop times (now in chronological order)
    stopTimes.forEach((stopTime, index) => {
        // Get events for this segment
        const prevStopTime = index > 0 ? stopTimes[index - 1] : null;
        const segmentEvents = allEvents.filter((event) => {
            if (prevStopTime) {
                return event.timestamp <= stopTime && event.timestamp > prevStopTime;
            }
            // First segment includes all events up to first stop
            return event.timestamp <= stopTime;
        });
        if (segmentEvents.length > 0) {
            segments.push({
                startTime: prevStopTime || segmentEvents[segmentEvents.length - 1].timestamp,
                endTime: stopTime,
                events: segmentEvents,
                isReviewed: reviewedStops.has(stopTime),
                segmentNumber: index + 1, // Chronological numbering: 1, 2, 3...
            });
        }
    });
    // Check if there are any events after the most recent stop (current active segment)
    const mostRecentStop = stopTimes[stopTimes.length - 1]; // Now the last element after sorting ascending
    const eventsAfterLastStop = allEvents.filter((event) => event.timestamp > mostRecentStop);
    if (eventsAfterLastStop.length > 0) {
        segments.push({
            startTime: mostRecentStop,
            endTime: null, // No end time for active segment
            events: eventsAfterLastStop,
            isReviewed: false,
            segmentNumber: stopTimes.length + 1,
        });
    }
    return segments;
};
// Shared function to get correct agent colors
export const getAgentColorBySessionId = (sessionId) => {
    const colors = [
        { primary: '#F02C0380', secondary: '#F02C03' }, // Red
        { primary: '#FF950C80', secondary: '#FF950C' }, // Orange
        { primary: '#FEDC0380', secondary: '#FEDC03' }, // Yellow
        { primary: '#7CDA0180', secondary: '#7CDA01' }, // Green
        { primary: '#0D8DFF80', secondary: '#0D8DFF' }, // Blue
        { primary: '#B02FF780', secondary: '#B02FF7' }, // Purple
    ];
    // Use session ID hash for consistent colors
    const hash = sessionId.split('').reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
    }, 0);
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
};
// Process events to add agent colors
export const processEventsWithAgentColors = (events, agentSessionId) => {
    const agentColor = getAgentColorBySessionId(agentSessionId).secondary;
    return events.map((eventData) => ({
        ...eventData,
        event: {
            ...eventData.event,
            agentColor,
        },
    }));
};

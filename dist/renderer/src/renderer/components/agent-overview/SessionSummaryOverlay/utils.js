/**
 * Utility functions for Session Summary components
 */
/**
 * Format duration between two timestamps
 * @param start Start timestamp in milliseconds
 * @param end End timestamp in milliseconds (null means current time)
 * @returns Formatted duration string
 */
export const formatDuration = (start, end) => {
    const duration = (end || Date.now()) - start;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

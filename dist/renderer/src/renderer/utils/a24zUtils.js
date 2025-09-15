/**
 * Utilities for working with a24z memory
 */
import { A24zService } from '../main-process-api/A24zService';
/**
 * Check if a directory contains a .alexandria subdirectory
 */
export async function hasA24zDirectory(path) {
    try {
        return await A24zService.hasA24zDirectory(path);
    }
    catch (error) {
        // If we get an error, it likely means the directory doesn't exist
        return false;
    }
}
/**
 * Check if a repository has any alexandria notes
 */
export async function hasA24zNotes(path) {
    try {
        const noteCount = await A24zService.getNoteCount(path);
        return noteCount > 0;
    }
    catch (error) {
        // If we get an error, it likely means the file doesn't exist
        return false;
    }
}
/**
 * Get count of a24z notes for a repository
 */
export async function getA24zNoteCount(path) {
    try {
        return await A24zService.getNoteCount(path);
    }
    catch (error) {
        // If we get an error, it likely means the file doesn't exist
        return 0;
    }
}

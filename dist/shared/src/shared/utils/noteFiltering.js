/**
 * Calculate the relevance of a note to a given path
 */
export function calculateNoteRelevance(note, targetRelativePath, includeParentNotes = true) {
    // Normalize paths to always use forward slashes for comparison
    const normalizedNotePath = note.relativePath.replace(/\\/g, '/');
    const normalizedTargetPath = targetRelativePath.replace(/\\/g, '/');
    // Exact match - the note is directly on this file/directory
    if (normalizedNotePath === normalizedTargetPath) {
        return {
            isRelevant: true,
            isParentDirectory: false,
            pathDistance: 0
        };
    }
    // If we're including parent notes, check if this note is on a parent directory
    if (includeParentNotes) {
        // Check if the target is under the note's directory
        if (normalizedTargetPath.startsWith(normalizedNotePath + '/') ||
            (normalizedNotePath === '.' && normalizedTargetPath !== '.')) {
            // Calculate how many levels deep using forward slashes
            const noteDepth = normalizedNotePath === '.' ? 0 : normalizedNotePath.split('/').length;
            const targetDepth = normalizedTargetPath.split('/').length;
            const distance = targetDepth - noteDepth;
            return {
                isRelevant: true,
                isParentDirectory: true,
                pathDistance: distance
            };
        }
    }
    return {
        isRelevant: false,
        isParentDirectory: false,
        pathDistance: -1
    };
}
/**
 * Filter notes by a single path
 */
export function filterNotesByPath(notes, targetRelativePath, includeParentNotes = true) {
    const relevantNotes = [];
    for (const note of notes) {
        const relevance = calculateNoteRelevance(note, targetRelativePath, includeParentNotes);
        if (relevance.isRelevant) {
            relevantNotes.push({
                ...note,
                isParentDirectory: relevance.isParentDirectory,
                pathDistance: relevance.pathDistance,
                relevance: relevance.pathDistance === 0 ? 'exact' : 'parent'
            });
        }
    }
    return relevantNotes;
}
/**
 * Filter notes by multiple paths (e.g., from a session)
 */
export function filterNotesByPaths(notes, targetPaths, includeParentNotes = true) {
    const relevantNotesMap = new Map();
    for (const targetPath of targetPaths) {
        const filtered = filterNotesByPath(notes, targetPath, includeParentNotes);
        // Merge results, keeping the best relevance for each note
        for (const filteredNote of filtered) {
            const existing = relevantNotesMap.get(filteredNote.id);
            if (!existing || (filteredNote.pathDistance || 0) < (existing.pathDistance || 0)) {
                relevantNotesMap.set(filteredNote.id, filteredNote);
            }
        }
    }
    return Array.from(relevantNotesMap.values());
}
/**
 * Sort filtered notes by relevance
 */
export function sortNotesByRelevance(notes) {
    return notes.sort((a, b) => {
        // Exact matches first
        if (a.pathDistance === 0 && b.pathDistance !== 0)
            return -1;
        if (b.pathDistance === 0 && a.pathDistance !== 0)
            return 1;
        // Then by path distance (closer is better)
        if (a.pathDistance !== b.pathDistance) {
            return (a.pathDistance || 0) - (b.pathDistance || 0);
        }
        // Finally by timestamp (newer first)
        return b.timestamp - a.timestamp;
    });
}
/**
 * Calculate coverage statistics for filtered notes
 */
export function calculateNoteCoverage(filteredNotes, totalNotes, sessionFilePaths) {
    const exactMatches = filteredNotes.filter(n => n.pathDistance === 0).length;
    const parentMatches = filteredNotes.filter(n => n.pathDistance && n.pathDistance > 0).length;
    let filesCovered = 0;
    let totalFiles = sessionFilePaths?.length || 0;
    if (sessionFilePaths) {
        // Count how many session files have at least one note
        filesCovered = sessionFilePaths.filter(fp => {
            const normalizedFp = fp.replace(/\\/g, '/');
            // Check if this file has an exact note or is under a parent note
            return filteredNotes.some(note => {
                const normalizedNotePath = note.relativePath.replace(/\\/g, '/');
                if (normalizedNotePath === normalizedFp)
                    return true;
                if (note.isParentDirectory && normalizedFp.startsWith(normalizedNotePath + '/'))
                    return true;
                return false;
            });
        }).length;
    }
    return {
        totalNotes: totalNotes.length,
        relevantNotes: filteredNotes.length,
        exactMatches,
        parentMatches,
        coveragePercent: totalNotes.length > 0
            ? Math.round((filteredNotes.length / totalNotes.length) * 100)
            : 0,
        filesCovered,
        totalFiles
    };
}
/**
 * Filter notes by session activity
 */
export function filterNotesBySession(notes, sessionFilePaths, includeParentNotes = true) {
    const filteredNotes = filterNotesByPaths(notes, sessionFilePaths, includeParentNotes);
    const sortedNotes = sortNotesByRelevance(filteredNotes);
    const coverage = calculateNoteCoverage(sortedNotes, notes, sessionFilePaths);
    return {
        filteredNotes: sortedNotes,
        coverage
    };
}

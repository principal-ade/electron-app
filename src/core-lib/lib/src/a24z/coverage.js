/**
 * A24z coverage calculation implementation
 */
import * as path from 'path';
/**
 * Build a reverse index from a24z notes to files
 */
export function buildA24zIndex(notes) {
    const fileToNotes = new Map();
    const noteToFiles = new Map();
    const tagToFiles = new Map();
    for (const note of notes) {
        // Map note to files
        const filePaths = new Set();
        // Process anchors (file paths)
        for (const anchor of note.anchors || []) {
            const normalizedPath = normalizePath(anchor);
            filePaths.add(normalizedPath);
            // Add to file -> notes mapping
            if (!fileToNotes.has(normalizedPath)) {
                fileToNotes.set(normalizedPath, new Set());
            }
            fileToNotes.get(normalizedPath).add(note.id);
        }
        // Store note -> files mapping
        noteToFiles.set(note.id, filePaths);
        // Process tags
        for (const tag of note.tags || []) {
            if (!tagToFiles.has(tag)) {
                tagToFiles.set(tag, new Set());
            }
            for (const filePath of filePaths) {
                tagToFiles.get(tag).add(filePath);
            }
        }
    }
    return {
        fileToNotes,
        noteToFiles,
        tagToFiles,
    };
}
/**
 * Calculate coverage for a single file
 */
function calculateFileCoverage(filePath, notes, index, _options = {}) {
    const normalizedPath = normalizePath(filePath);
    const noteIds = index.fileToNotes.get(normalizedPath) || new Set();
    const covered = noteIds.size > 0;
    const tags = new Set();
    // Analyze notes covering this file
    for (const noteId of noteIds) {
        const note = notes.find((n) => n.id === noteId);
        if (!note)
            continue;
        // Collect tags
        for (const tag of note.tags || []) {
            tags.add(tag);
        }
    }
    return {
        path: normalizedPath,
        covered,
        noteIds: Array.from(noteIds),
        noteCount: noteIds.size,
        tags: Array.from(tags),
    };
}
/**
 * Calculate directory coverage recursively
 */
function calculateDirectoryCoverage(dirPath, fileTree, notes, index, options = {}) {
    const normalizedPath = normalizePath(dirPath);
    const fileCoverage = new Map();
    const childCoverage = new Map();
    let totalFiles = 0;
    let coveredFiles = 0;
    let totalNotes = 0;
    // Process files in this directory
    for (const file of fileTree.allFiles) {
        const fileDir = path.dirname(file.relativePath);
        if (fileDir === normalizedPath || (normalizedPath === '.' && fileDir === '')) {
            if (shouldIncludeFile(file.relativePath, options)) {
                const coverage = calculateFileCoverage(file.relativePath, notes, index, options);
                fileCoverage.set(file.name, coverage);
                totalFiles++;
                if (coverage.covered) {
                    coveredFiles++;
                }
                totalNotes += coverage.noteCount;
            }
        }
    }
    // Process subdirectories
    for (const dir of fileTree.allDirectories) {
        const parentDir = path.dirname(dir.relativePath);
        if (parentDir === normalizedPath || (normalizedPath === '.' && parentDir === '')) {
            const subCoverage = calculateDirectoryCoverage(dir.relativePath, fileTree, notes, index, options);
            childCoverage.set(dir.name, subCoverage);
            totalFiles += subCoverage.totalFiles;
            coveredFiles += subCoverage.coveredFiles;
            totalNotes += subCoverage.noteCount;
        }
    }
    const coveragePercentage = totalFiles > 0 ? (coveredFiles / totalFiles) * 100 : 0;
    return {
        path: normalizedPath,
        totalFiles,
        coveredFiles,
        coveragePercentage,
        noteCount: totalNotes,
        childCoverage,
        fileCoverage,
    };
}
/**
 * Calculate overall coverage statistics
 */
export function calculateA24zCoverage(fileTree, notes, options = {}) {
    const index = buildA24zIndex(notes);
    let totalFiles = 0;
    let coveredFiles = 0;
    const byFileType = new Map();
    const tagCount = new Map();
    const fileNoteCount = new Map();
    const gaps = [];
    // Process all files
    for (const file of fileTree.allFiles) {
        if (!shouldIncludeFile(file.relativePath, options))
            continue;
        totalFiles++;
        const coverage = calculateFileCoverage(file.relativePath, notes, index, options);
        if (coverage.covered) {
            coveredFiles++;
            fileNoteCount.set(file.relativePath, coverage.noteCount);
            // Count tags
            for (const tag of coverage.tags) {
                tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
            }
        }
        else {
            gaps.push(file.relativePath);
        }
        // Track by file type
        const ext = path.extname(file.name).toLowerCase();
        if (ext) {
            if (!byFileType.has(ext)) {
                byFileType.set(ext, {
                    extension: ext,
                    totalFiles: 0,
                    coveredFiles: 0,
                    coveragePercentage: 0,
                    noteCount: 0,
                });
            }
            const typeCoverage = byFileType.get(ext);
            typeCoverage.totalFiles++;
            if (coverage.covered) {
                typeCoverage.coveredFiles++;
                typeCoverage.noteCount += coverage.noteCount;
            }
        }
    }
    // Calculate percentages for file types
    for (const typeCoverage of byFileType.values()) {
        typeCoverage.coveragePercentage =
            typeCoverage.totalFiles > 0 ? (typeCoverage.coveredFiles / typeCoverage.totalFiles) * 100 : 0;
    }
    // Sort gaps by priority
    gaps.sort((a, b) => {
        const extA = path.extname(a).toLowerCase();
        const extB = path.extname(b).toLowerCase();
        const priorityA = options.priorityExtensions?.indexOf(extA) ?? -1;
        const priorityB = options.priorityExtensions?.indexOf(extB) ?? -1;
        if (priorityA >= 0 && priorityB >= 0) {
            return priorityA - priorityB;
        }
        if (priorityA >= 0)
            return -1;
        if (priorityB >= 0)
            return 1;
        return a.localeCompare(b);
    });
    // Get top tags
    const topTags = Array.from(tagCount.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    // Get hotspots (most documented files)
    const hotspots = Array.from(fileNoteCount.entries())
        .map(([path, noteCount]) => ({ path, noteCount }))
        .sort((a, b) => b.noteCount - a.noteCount)
        .slice(0, 10);
    const uncoveredFiles = totalFiles - coveredFiles;
    const coveragePercentage = totalFiles > 0 ? (coveredFiles / totalFiles) * 100 : 0;
    const averageNotesPerFile = coveredFiles > 0 ? notes.length / coveredFiles : 0;
    return {
        totalFiles,
        coveredFiles,
        uncoveredFiles,
        coveragePercentage,
        totalNotes: notes.length,
        averageNotesPerFile,
        byFileType,
        topTags,
        hotspots,
        gaps,
    };
}
/**
 * Generate a complete coverage report
 */
export function generateA24zCoverageReport(fileTree, notes, repositoryPath, options = {}) {
    const stats = calculateA24zCoverage(fileTree, notes, options);
    const index = buildA24zIndex(notes);
    const directoryTree = calculateDirectoryCoverage('.', fileTree, notes, index, options);
    // Analyze uncovered files
    const uncoveredFiles = stats.gaps
        .map(filePath => {
        const file = fileTree.allFiles.find(f => f.relativePath === filePath);
        const ext = path.extname(filePath).toLowerCase();
        const priorityIndex = options.priorityExtensions?.indexOf(ext) ?? -1;
        return {
            path: filePath,
            extension: ext,
            size: file?.size || 0,
            priority: priorityIndex >= 0 && priorityIndex < 3
                ? 'high'
                : priorityIndex >= 3 && priorityIndex < 6
                    ? 'medium'
                    : 'low',
        };
    })
        .slice(0, 50); // Top 50 gaps
    // Generate recommendations
    const recommendations = [];
    if (stats.coveragePercentage < 20) {
        recommendations.push('Coverage is very low. Consider documenting core modules first.');
    }
    if (stats.averageNotesPerFile < 1) {
        recommendations.push('Most documented files have only one note. Consider adding more context.');
    }
    const criticalExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of criticalExtensions) {
        const typeCoverage = stats.byFileType.get(ext);
        if (typeCoverage && typeCoverage.coveragePercentage < 30) {
            recommendations.push(`${ext} files have low coverage (${typeCoverage.coveragePercentage.toFixed(1)}%). These are likely important.`);
        }
    }
    if (stats.hotspots.length > 0 && stats.hotspots[0].noteCount > 10) {
        recommendations.push(`${stats.hotspots[0].path} has ${stats.hotspots[0].noteCount} notes. Consider consolidating.`);
    }
    return {
        timestamp: new Date(),
        repositoryPath,
        stats,
        directoryTree,
        uncoveredFiles,
        recommendations,
    };
}
// Helper functions
function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}
function shouldIncludeFile(filePath, options) {
    // Check exclude patterns
    if (options.excludePatterns) {
        for (const pattern of options.excludePatterns) {
            if (matchesPattern(filePath, pattern)) {
                return false;
            }
        }
    }
    // Check include patterns
    if (options.includePatterns) {
        for (const pattern of options.includePatterns) {
            if (matchesPattern(filePath, pattern)) {
                return true;
            }
        }
        return false; // If include patterns specified, only include matching files
    }
    return true;
}
function matchesPattern(filePath, pattern) {
    // Simple glob pattern matching (can be enhanced with a proper glob library)
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\//g, '\\/');
    return new RegExp(`^${regex}$`).test(filePath);
}
//# sourceMappingURL=coverage.js.map
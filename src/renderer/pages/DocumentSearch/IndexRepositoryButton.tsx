import React, { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { documentSearchService } from '../../services/DocumentSearchService';

interface IndexRepositoryButtonProps {
  onIndexed?: () => void;
}

export const IndexRepositoryButton: React.FC<IndexRepositoryButtonProps> = ({
  onIndexed,
}) => {
  const { theme } = useTheme();
  const [isIndexing, setIsIndexing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleIndexRepository = async () => {
    console.log('[IndexRepositoryButton] Starting re-index process...');
    try {
      setIsIndexing(true);
      setLastResult(null);

      // Clear the existing index first to avoid stale data
      console.log('[IndexRepositoryButton] Clearing existing index...');
      await documentSearchService.clearIndex();

      // Get all Alexandria repositories and re-index them
      const { AlexandriaService } = await import(
        '../../main-process-api/AlexandriaService'
      );
      const repositories = await AlexandriaService.getRepositories();

      console.log(
        `[IndexRepositoryButton] Found ${repositories.length} Alexandria repositories to index`,
      );
      console.log(
        '[IndexRepositoryButton] Repositories:',
        repositories.map((r) => ({ name: r.name, path: r.path })),
      );

      // Prepare repositories for batch indexing
      const reposToIndex = repositories
        .filter((r) => r.path) // Only repos with valid paths
        .map((r) => ({ path: r.path, name: r.name }));

      if (reposToIndex.length === 0) {
        console.log(
          '[IndexRepositoryButton] No valid repositories found to index',
        );
        setLastResult('No repositories configured');
        return;
      }

      // Use the new batch indexing method
      console.log(
        `[IndexRepositoryButton] Starting batch indexing of ${reposToIndex.length} repositories`,
      );
      const startTime = Date.now();

      try {
        const result =
          await documentSearchService.indexMultipleRepositories(reposToIndex);
        const duration = Date.now() - startTime;

        console.log(`[IndexRepositoryButton] Batch indexing complete:`, result);

        if (result.totalFailed === 0) {
          setLastResult(
            `Indexed ${result.totalIndexed} documents from ${reposToIndex.length} repos in ${(duration / 1000).toFixed(1)}s`,
          );
        } else {
          const failedNames = result.results
            .filter((r) => !r.success)
            .map((r) => r.name)
            .join(', ');
          setLastResult(
            `Indexed ${result.totalIndexed} docs. Failed: ${failedNames}`,
          );
        }

        onIndexed?.();
      } catch (error) {
        console.error('[IndexRepositoryButton] Batch indexing failed:', error);
        setLastResult(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      console.error('Failed to index repository:', error);
      setLastResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleIndexRepository}
        disabled={isIndexing}
        className="px-3 py-2 rounded border transition-colors flex items-center gap-2"
        style={{
          backgroundColor: isIndexing
            ? theme.colors.backgroundSecondary
            : theme.colors.primary,
          borderColor: theme.colors.border,
          color: isIndexing
            ? theme.colors.textSecondary
            : theme.colors.background,
          opacity: isIndexing ? 0.6 : 1,
          cursor: isIndexing ? 'not-allowed' : 'pointer',
        }}
      >
        {isIndexing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <FolderPlus size={16} />
        )}
        <span>{isIndexing ? 'Indexing...' : 'Re-index All Repos'}</span>
      </button>

      {lastResult && (
        <span
          className="text-sm"
          style={{
            color:
              lastResult.startsWith('Error') || lastResult.startsWith('Failed')
                ? theme.colors.danger
                : theme.colors.success,
          }}
        >
          {lastResult}
        </span>
      )}
    </div>
  );
};

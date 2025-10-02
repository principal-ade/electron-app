import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { documentSearchService } from '../../../../services/DocumentSearchService';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';

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
    try {
      setIsIndexing(true);
      setLastResult(null);

      // Clear the existing index first to avoid stale data
      await documentSearchService.clearIndex();

      // Get all Alexandria repositories and re-index them
      const repositories = await AlexandriaService.getRepositories();

      // Prepare repositories for batch indexing
      const reposToIndex = repositories
        .filter((r) => r.path) // Only repos with valid paths
        .map((r) => ({ path: r.path, name: r.name }));

      if (reposToIndex.length === 0) {
        setLastResult('No repositories configured');
        return;
      }

      // Use the new batch indexing method
      const startTime = Date.now();

      try {
        const result =
          await documentSearchService.indexMultipleRepositories(reposToIndex);
        const duration = Date.now() - startTime;

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
        setLastResult(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      setLastResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleIndexRepository}
        disabled={isIndexing}
        className="p-2 rounded-full border transition-all hover:scale-110 group"
        style={{
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          color: theme.colors.textSecondary,
          opacity: isIndexing ? 0.6 : 1,
          cursor: isIndexing ? 'not-allowed' : 'pointer',
        }}
        title={isIndexing ? 'Indexing repositories...' : 'Re-index all repositories'}
      >
        {isIndexing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <RefreshCw size={16} />
        )}
      </button>

      {/* Tooltip */}
      <div
        className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          zIndex: 1000,
        }}
      >
        {lastResult || (isIndexing ? 'Indexing repositories...' : 'Re-index all repositories')}
      </div>
    </div>
  );
};

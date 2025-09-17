import React, { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { documentSearchService } from '../../services/DocumentSearchService';

interface IndexRepositoryButtonProps {
  onIndexed?: () => void;
}

export const IndexRepositoryButton: React.FC<IndexRepositoryButtonProps> = ({ onIndexed }) => {
  const { theme } = useTheme();
  const [isIndexing, setIsIndexing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleIndexRepository = async () => {
    console.log('[IndexRepositoryButton] Starting re-index process...');
    try {
      setIsIndexing(true);
      setLastResult(null);

      // Get all Alexandria repositories and re-index them
      const { AlexandriaService } = await import('../../main-process-api/AlexandriaService');
      const repositories = await AlexandriaService.getRepositories();

      console.log(`[IndexRepositoryButton] Found ${repositories.length} Alexandria repositories to index`);

      let totalIndexed = 0;
      let totalDuration = 0;
      let failedRepos: string[] = [];

      for (const repo of repositories) {
        if (repo.path) {
          console.log(`[IndexRepositoryButton] Indexing ${repo.name} at ${repo.path}`);
          try {
            const result = await documentSearchService.indexRepository(repo.path, repo.name);
            if (result.success) {
              totalIndexed += result.documentsIndexed || 0;
              totalDuration += result.duration || 0;
            } else {
              failedRepos.push(repo.name);
            }
          } catch (error) {
            console.error(`[IndexRepositoryButton] Failed to index ${repo.name}:`, error);
            failedRepos.push(repo.name);
          }
        }
      }

      console.log(`[IndexRepositoryButton] Indexing complete. Total documents: ${totalIndexed}`);

      if (failedRepos.length === 0) {
        setLastResult(`Indexed ${totalIndexed} documents from ${repositories.length} repos in ${(totalDuration / 1000).toFixed(1)}s`);
        onIndexed?.();
      } else {
        setLastResult(`Indexed ${totalIndexed} docs. Failed: ${failedRepos.join(', ')}`);
        onIndexed?.();
      }
    } catch (error) {
      console.error('Failed to index repository:', error);
      setLastResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          backgroundColor: isIndexing ? theme.colors.backgroundSecondary : theme.colors.primary,
          borderColor: theme.colors.border,
          color: isIndexing ? theme.colors.textSecondary : theme.colors.background,
          opacity: isIndexing ? 0.6 : 1,
          cursor: isIndexing ? 'not-allowed' : 'pointer'
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
            color: lastResult.startsWith('Error') || lastResult.startsWith('Failed')
              ? theme.colors.danger
              : theme.colors.success
          }}
        >
          {lastResult}
        </span>
      )}
    </div>
  );
};
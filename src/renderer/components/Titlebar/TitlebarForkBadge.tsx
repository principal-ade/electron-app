import React from 'react';
import { GitFork } from 'lucide-react';
import type { Repository } from '../../../shared/types/repository.types';

interface TitlebarForkBadgeProps {
  repository: Repository;
  position?: 'left' | 'right';
  onClick?: () => void;
}

export const TitlebarForkBadge: React.FC<TitlebarForkBadgeProps> = ({
  repository,
  position = 'left',
  onClick,
}) => {
  if (!repository?.metadata?.isFork || !repository?.metadata?.parentRepo) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        backgroundColor: '#f59e0b15',
        border: '1px solid #f59e0b40',
        borderRadius: '5px',
        fontSize: '11px',
        fontWeight: 500,
        color: '#f59e0b',
        cursor: 'pointer',
        transition: 'all 0.2s',
        height: '22px',
        WebkitAppRegion: 'no-drag' as any,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f59e0b25';
        e.currentTarget.style.borderColor = '#f59e0b60';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#f59e0b15';
        e.currentTarget.style.borderColor = '#f59e0b40';
      }}
      title="Click to see fork sync status"
    >
      <GitFork size={10} />
      <span>
        Fork of {repository.metadata.parentRepo.owner}/{repository.metadata.parentRepo.name}
      </span>
    </button>
  );
};
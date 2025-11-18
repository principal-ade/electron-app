import React from 'react';
import type { SearchResult } from '@a24z/callimachus';
import { Code2, Star, Tag, ChevronRight, Loader2 } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface ResultsDisplayProps {
  results: SearchResult[];
  isLoading: boolean;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  isLoading,
}) => {
  const { theme } = useTheme();
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2
          className="animate-spin"
          size={32}
          style={{ color: theme.colors.primary }}
        />
        <div className="text-sm opacity-70">Searching patterns...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Code2 size={48} style={{ color: theme.colors.textSecondary }} />
        <h3 className="text-lg font-medium">No patterns found</h3>
        <p className="text-sm opacity-70">
          Try a different search query or check your connection
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium opacity-70">
        Found {results.length} pattern{results.length !== 1 ? 's' : ''}
      </div>

      <div className="space-y-3">
        {results.map((result, index) => (
          <PatternCard key={index} result={result} theme={theme} />
        ))}
      </div>
    </div>
  );
};

interface PatternCardProps {
  result: SearchResult;
  theme: any;
}

const PatternCard: React.FC<PatternCardProps> = ({ result, theme }) => {
  const { layout, relevance, snippet } = result;
  const metadata = layout.metadata;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#10b981';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      className="rounded-lg border p-4 space-y-3 transition-colors hover:shadow-md"
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderColor: theme.colors.border,
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <Code2 size={16} style={{ color: theme.colors.primary }} />
          <span className="font-medium">{metadata.teaches}</span>
        </div>
        <div className="text-sm px-2 py-1 rounded bg-green-500/10 text-green-500">
          {Math.round(relevance * 100)}% match
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
          }}
        >
          {metadata.language}
        </span>
        {metadata.framework && (
          <span
            className="px-2 py-1 text-xs rounded"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
            }}
          >
            {metadata.framework}
          </span>
        )}
        <span
          className="px-2 py-1 text-xs rounded text-white"
          style={{ backgroundColor: getDifficultyColor(metadata.difficulty) }}
        >
          {metadata.difficulty}
        </span>
        <span
          className="flex items-center gap-1 px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
          }}
        >
          <Star size={12} />
          {metadata.qualityScore.toFixed(1)}
        </span>
      </div>

      {snippet && <div className="text-sm opacity-70 italic">{snippet}</div>}

      <div className="flex flex-wrap gap-1">
        {metadata.tags.slice(0, 5).map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.textSecondary,
            }}
          >
            <Tag size={10} />
            {tag}
          </span>
        ))}
      </div>

      <button
        className="w-full mt-3 px-3 py-2 rounded flex items-center justify-center gap-2 font-medium transition-colors"
        style={{
          backgroundColor: theme.colors.primary,
          color: theme.colors.background,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        View Details
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

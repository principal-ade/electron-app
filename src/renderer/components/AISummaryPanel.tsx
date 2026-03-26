/**
 * AISummaryPanel
 *
 * Panel for AI-powered commit summarization using Gemini.
 * Displays selected commits and allows users to generate summaries
 * with optional custom prompts.
 */

import React, { useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Sparkles, Loader2, X, Send, AlertCircle, Settings } from 'lucide-react';
import { geminiClient } from '../tipc/geminiClient';
import { SecretsService } from '../main-process-api/SecretsService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

const GEMINI_SECRETS_ID = 'app-gemini';

interface CommitData {
  repoName: string;
  sha: string;
  message: string;
  author: string;
}

interface AISummaryPanelProps {
  selectedCommits: CommitData[];
  selectedCount: number;
  onClearSelection: () => void;
  onOpenSettings?: () => void;
}

export const AISummaryPanel: React.FC<AISummaryPanelProps> = ({
  selectedCommits,
  selectedCount,
  onClearSelection,
  onOpenSettings,
}) => {
  const { theme } = useTheme();

  const [userPrompt, setUserPrompt] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSummary('');

    try {
      // Get API key from secrets
      const apiKey = await SecretsService.getSingle(GEMINI_SECRETS_ID, 'apiKey');
      if (!apiKey) {
        setError('No API key configured. Please add your Gemini API key in Settings.');
        setLoading(false);
        return;
      }

      // Get model from preferences
      const prefs = await UserPreferencesService.getPreferences();
      const model = prefs?.gemini?.selectedModel || 'gemini-2.5-flash-lite';

      // Call Gemini API
      const result = await geminiClient.summarizeCommits({
        apiKey,
        model,
        commits: selectedCommits,
        userPrompt: userPrompt.trim() || undefined,
      });

      if (result.success && result.summary) {
        setSummary(result.summary);
      } else {
        setError(result.error || 'Failed to generate summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }, [selectedCommits, userPrompt]);

  // Group commits by repo for display
  const commitsByRepo = selectedCommits.reduce(
    (acc, commit) => {
      if (!acc[commit.repoName]) {
        acc[commit.repoName] = [];
      }
      acc[commit.repoName].push(commit);
      return acc;
    },
    {} as Record<string, CommitData[]>
  );

  const repoCount = Object.keys(commitsByRepo).length;

  if (selectedCount === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.textSecondary,
          textAlign: 'center',
          padding: spacing.md,
        }}
      >
        <Sparkles size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
        <span style={{ fontSize: theme.fontSizes[1] }}>
          Select cards to summarize
        </span>
        <span style={{ fontSize: theme.fontSizes[0], marginTop: spacing.xs }}>
          Click "AI Summary" above to start
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Sparkles size={16} color={theme.colors.primary} />
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            AI Summary
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: theme.colors.textSecondary,
              }}
              title="Settings"
            >
              <Settings size={14} />
            </button>
          )}
          <button
            onClick={onClearSelection}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: theme.colors.textSecondary,
            }}
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Selection summary */}
      <div
        style={{
          padding: spacing.md,
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          {repoCount} repo{repoCount !== 1 ? 's' : ''} · {selectedCommits.length}{' '}
          commit{selectedCommits.length !== 1 ? 's' : ''}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          {Object.entries(commitsByRepo).slice(0, 3).map(([repoName, commits]) => (
            <span
              key={repoName}
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                borderRadius: 4,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              {repoName} ({commits.length})
            </span>
          ))}
          {repoCount > 3 && (
            <span
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              +{repoCount - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Prompt input */}
      <div style={{ padding: spacing.md }}>
        <div
          style={{
            display: 'flex',
            gap: spacing.sm,
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: 'block',
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              Ask a question (optional)
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleGenerate();
                }
              }}
              placeholder="What patterns do you see?"
              style={{
                width: '100%',
                padding: `${spacing.sm}px`,
                fontSize: theme.fontSizes[1],
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 4,
                color: theme.colors.text,
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              padding: `${spacing.sm}px ${spacing.md}px`,
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              backgroundColor: theme.colors.primary,
              border: 'none',
              borderRadius: 4,
              color: theme.colors.textOnPrimary,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <Send size={14} />
            )}
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: `0 ${spacing.md}px`,
            padding: spacing.sm,
            backgroundColor: `${theme.colors.error}15`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <AlertCircle size={14} color={theme.colors.error} />
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.error,
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* Summary result */}
      {summary && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: spacing.md,
          }}
        >
          <div
            style={{
              fontSize: theme.fontSizes[1],
              lineHeight: 1.6,
              color: theme.colors.text,
              whiteSpace: 'pre-wrap',
            }}
          >
            {summary}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

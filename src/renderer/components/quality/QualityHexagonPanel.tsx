import React, { useState, useEffect, useCallback } from 'react';
import {
  QualityHexagon,
  QualityHexagonCompact,
  QualityHexagonDetailed,
  type QualityMetrics,
} from '@a24z/alexandria-ui';
import { useTheme } from '@a24z/industry-theme';
import { MockQualityMetricsService } from '../../services/MockQualityMetricsService';
import type {
  ExtendedQualityMetrics,
  QualityTier,
} from '../../services/MockQualityMetricsService';

interface QualityHexagonPanelProps {
  directory: string;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

export const QualityHexagonPanel: React.FC<QualityHexagonPanelProps> = ({
  directory,
  size = 'md',
  compact = false,
}) => {
  const { theme } = useTheme();
  const [metrics, setMetrics] = useState<ExtendedQualityMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeQuality = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[QualityHexagon] Starting analysis for ${directory}`);
      const result =
        await MockQualityMetricsService.analyzeDirectory(directory);
      console.log('[QualityHexagon] Analysis complete:', result);
      setMetrics(result);
    } catch (err) {
      console.error('[QualityHexagon] Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [directory]);

  useEffect(() => {
    if (directory) {
      setMetrics(null);
      setError(null);
      analyzeQuality();
    }
  }, [directory, analyzeQuality]);

  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              border: `3px solid ${theme.colors.border}`,
              borderTopColor: theme.colors.primary,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ marginTop: '16px' }}>Analyzing code quality...</p>
          <div style={{ marginTop: '16px', fontSize: '12px' }}>
            <div style={{ opacity: 1 }}>🔍 Discovering tools...</div>
            <div style={{ opacity: 0.5 }}>📊 Running analysis...</div>
            <div style={{ opacity: 0.5 }}>📈 Calculating metrics...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: theme.colors.error,
          }}
        >
          <p>❌ {error}</p>
          <button
            onClick={analyzeQuality}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    if (!metrics) {
      return (
        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: theme.colors.textSecondary,
          }}
        >
          <p>No quality metrics available</p>
          <button
            onClick={analyzeQuality}
            style={{
              marginTop: '16px',
              padding: '8px 24px',
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Analyze Quality
          </button>
        </div>
      );
    }

    // For compact mode, just show the hexagon with proper SVG styling
    if (compact) {
      return (
        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.text, // Set text color for SVG
          }}
        >
          <QualityHexagonCompact
            metrics={metrics.hexagon}
            tier={metrics.tier}
            className="w-full h-full"
          />
        </div>
      );
    }

    // Non-compact mode - show detailed view with bars
    return (
      <div style={{ color: theme.colors.text }}>
        <QualityHexagonDetailed
          metrics={metrics.hexagon}
          tier={metrics.tier}
          className="w-full"
        />

        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <h4 style={{ color: theme.colors.text, marginBottom: '8px' }}>
            Available Tools:
          </h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {metrics.availableTools.map((tool) => (
              <span
                key={tool}
                style={{
                  padding: '4px 12px',
                  background: theme.colors.backgroundSecondary,
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: theme.colors.textSecondary,
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {metrics.suggestions.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ color: theme.colors.text, marginBottom: '8px' }}>
              Suggestions:
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {metrics.suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  style={{
                    padding: '8px 0',
                    color: theme.colors.textSecondary,
                    borderLeft: `3px solid ${
                      suggestion.priority === 'high'
                        ? theme.colors.error
                        : suggestion.priority === 'medium'
                          ? theme.colors.warning
                          : theme.colors.border
                    }`,
                    paddingLeft: '12px',
                    marginLeft: '-20px',
                    marginBottom: '4px',
                  }}
                >
                  {suggestion.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={analyzeQuality}
          disabled={loading}
          style={{
            marginTop: '16px',
            padding: '6px 16px',
            background: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            color: theme.colors.text,
          }}
        >
          🔄 Refresh Analysis
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: 'fit-content',
      }}
    >
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          marginBottom: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Code Quality</span>
      </div>
      {renderContent()}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

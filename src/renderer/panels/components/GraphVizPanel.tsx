import React, { useRef, useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Graphviz } from 'graphviz-react';
import { Network } from 'lucide-react';

interface GraphVizPanelProps {
  // DOT format graph data
  dot: string;

  // Loading state
  loading?: boolean;
  loadingMessage?: string;

  // Empty state
  emptyMessage?: string;

  // Error handling
  error?: string | null;

  // Optional header
  title?: string;
  showHeader?: boolean;

  // Graphviz options
  options?: {
    fit?: boolean;
    height?: number | string;
    width?: number | string;
    zoom?: boolean;
    scale?: number;
    tweenPaths?: boolean;
    tweenShapes?: boolean;
    convertEqualSidedPolygons?: boolean;
    tweenPrecision?: number;
    growEnteringEdges?: boolean;
    engine?: 'dot' | 'circo' | 'fdp' | 'neato' | 'osage' | 'patchwork' | 'twopi';
  };

  // Event handlers
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

export const GraphVizPanel: React.FC<GraphVizPanelProps> = ({
  dot,
  loading = false,
  loadingMessage = 'Loading graph...',
  emptyMessage = 'No graph data available',
  error = null,
  title = 'Graph Visualization',
  showHeader = true,
  options = {},
  onNodeClick,
  onEdgeClick,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  // Use ResizeObserver to track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Default options
  // Use measured dimensions from ResizeObserver
  const defaultOptions = {
    fit: true,
    zoom: true,
    engine: 'dot' as const,
    height: dimensions.height,
    width: dimensions.width,
    ...options,
  };

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textSecondary,
          }}
        >
          {loadingMessage}
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.error || '#ef4444',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
            Error loading graph
          </div>
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
            {error}
          </div>
        </div>
      );
    }

    if (!dot || dot.trim().length === 0) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textSecondary,
            gap: '12px',
          }}
        >
          <Network size={48} style={{ opacity: 0.5 }} />
          <div>{emptyMessage}</div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'auto',
          backgroundColor: theme.colors.background,
        }}
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Graphviz
            dot={dot}
            options={defaultOptions}
            className="graphviz-panel"
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      {showHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundLight,
          }}
        >
          <Network size={16} color={theme.colors.primary} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{title}</span>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {renderContent()}
      </div>
    </div>
  );
};

export const GraphVizPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        height: '80px',
      }}
    >
      <Network size={32} style={{ color: theme.colors.primary }} />
      <span
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}
      >
        GraphViz Visualization
      </span>
    </div>
  );
};

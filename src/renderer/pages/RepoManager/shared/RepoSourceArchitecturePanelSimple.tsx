import React, { useState, useEffect, useMemo } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import type { FileSystemTree } from '@principal-ai/codebase-composition';
import {
  PackageLayerModule,
  PackageLayer,
} from '@principal-ai/codebase-composition';

import { MonitoredFileTreeService } from '../../../services/MonitoredFileTreeService';
import { GitHubWebAdapters } from '../../../adapters/GitHubWebAdapters';
import { ElectronPlatformAdapters } from '../../../adapters';
import { loadManifestContents } from '../../../utils/loadManifestContents';
import { FileTreeSource } from '../../../types/file-tree-source';
import { DependenciesPanel } from '../../../components/repository-maps/DependenciesPanel';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';

interface RepoSourceArchitecturePanelSimpleProps {
  source: FileTreeSource;
  cacheService: MonitoredFileTreeService;
  packageLayers?: PackageLayer[] | null;
  onError?: (error: string) => void;
  onPackageLayersChanged?: (packageLayers: PackageLayer[] | null) => void;
  onPackageAnalysisStart?: (packagePath: string, packageName: string) => void;
  onPackageAnalysisEnd?: () => void;
  onPackageSelected?: (packagePath: string, packageName: string) => void;
  onPackageDeselected?: () => void;
}

/**
 * Dependencies panel for repository source
 * Analyzes package dependencies for updates, vulnerabilities, and license compliance
 * Used in Explore view to help maintain healthy dependencies
 */
export const RepoSourceArchitecturePanelSimple: React.FC<
  RepoSourceArchitecturePanelSimpleProps
> = ({
  source,
  cacheService,
  packageLayers: packageLayersProp,
  onError,
  onPackageLayersChanged,
  onPackageAnalysisStart,
  onPackageAnalysisEnd,
  onPackageSelected,
  onPackageDeselected,
}) => {
  const { theme } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [analyzingLayers, setAnalyzingLayers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSystemTree, setFileSystemTree] = useState<FileSystemTree | null>(
    null,
  );
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // Analysis results - use prop if provided, otherwise maintain local state
  const [localPackageLayers, setLocalPackageLayers] = useState<
    PackageLayer[] | null
  >(null);
  const packageLayers = packageLayersProp ?? localPackageLayers;

  // Create adapters based on source type
  const adapters = useMemo(() => {
    if (source.type === 'remote') {
      const ref =
        source.metadata?.currentBranch ||
        source.metadata?.commitSha ||
        source.location;
      return new GitHubWebAdapters(source.owner, source.name, ref);
    } else if (source.type === 'local') {
      return new ElectronPlatformAdapters();
    }
    return null;
  }, [source]);

  // Load filesystem tree for the source
  useEffect(() => {
    const loadTree = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load tree from cache or fetch with strong typing
        const result = await cacheService.loadFileTree(source);

        setFileSystemTree(result.tree);
        setLastRefresh(Date.now());
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Failed to load architecture data';
        setError(errorMsg);
        if (onError) onError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadTree();
  }, [source, cacheService]);

  // Only analyze layers if not provided as prop
  useEffect(() => {
    if (!fileSystemTree || !adapters || packageLayersProp) return;

    const analyzeLayers = async () => {
      try {
        setAnalyzingLayers(true);
        // Check cache first
        const cached = cacheService.getAnalysis(source.id);
        if (cached) {
          setLocalPackageLayers(cached.packageLayers);
          setAnalyzingLayers(false);
          if (!packageLayersProp) {
            onPackageLayersChanged?.(cached.packageLayers);
          }
          return;
        }

        // Use RepositoryMonitoringService for local sources (it's much faster and more accurate)
        if (source.type === 'local' && source.location) {
          console.debug('[ArchitecturePanel] Using RepositoryMonitoringService for packages...');
          const result = await RepositoryMonitoringService.getPackages(source.location);
          if (!result) {
            throw new Error('Failed to get packages from repository monitoring service');
          }

          const packageResult = result.packages;
          console.debug('[ArchitecturePanel] Got packages from monitoring service:', {
            count: packageResult.length,
            isMonorepo: result.summary.isMonorepo,
          });

          setLocalPackageLayers(packageResult);
          if (!packageLayersProp) {
            onPackageLayersChanged?.(packageResult);
          }

          // Save to cache
          cacheService.setAnalysis(source.id, {
            packageLayers: packageResult,
          });

          return;
        }

        // For remote sources, we don't support package analysis yet
        throw new Error('Package analysis is only supported for local repositories');
      } catch (err) {
        console.error('Error analyzing layers:', err);
      } finally {
        setAnalyzingLayers(false);
      }
    };

    analyzeLayers();
  }, [fileSystemTree, adapters, packageLayersProp]);

  // Handle refresh
  const handleRefresh = async () => {
    // Clear caches for this source
    cacheService.removeTree(source.id);
    cacheService.removeAnalysis(source.id);
    // Trigger reload
    setLastRefresh(Date.now());
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: `${theme.colors.primary}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          animation: 'gentlePulse 2s ease-in-out infinite',
        }}
      >
        <FolderOpen size={24} color={theme.colors.primary} />
      </div>

      <h3
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: '8px',
        }}
      >
        Analyzing architecture
      </h3>

      <p
        style={{
          fontSize: '13px',
          color: theme.colors.textSecondary,
          marginBottom: '20px',
        }}
      >
        Discovering packages and frameworks...
      </p>

      <div
        style={{
          display: 'flex',
          gap: '6px',
        }}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.colors.primary,
              opacity: 0.3,
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes gentlePulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          40% {
            transform: scale(1.3);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );

  // Loading state - show loading if either fetching tree or analyzing layers
  if (loading || analyzingLayers) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error || !fileSystemTree) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
            padding: '20px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <AlertCircle
              size={24}
              color={theme.colors.error || '#ff6b6b'}
              style={{ marginBottom: '8px' }}
            />
            <div style={{ fontSize: '13px', marginBottom: '12px' }}>
              {error || 'Failed to load architecture data'}
            </div>
            <button
              onClick={handleRefresh}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: theme.colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Dependencies Panel */}
      <DependenciesPanel
        packageLayers={packageLayers}
        onAnalysisComplete={(results) => {
          console.log('Dependency analysis complete:', results);
        }}
        onPackageAnalysisStart={onPackageAnalysisStart}
        onPackageAnalysisEnd={onPackageAnalysisEnd}
        onPackageSelected={onPackageSelected}
        onPackageDeselected={onPackageDeselected}
      />
    </div>
  );
};

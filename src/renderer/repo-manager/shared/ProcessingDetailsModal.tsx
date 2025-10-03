import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  X,
  FolderOpen,
  Package,
  FileText,
  HardDrive,
  Database,
  Filter,
} from 'lucide-react';
import type {
  FileTreeSource,
  FileTreeStats,
} from '../../types/file-tree-source';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { FileSystemService } from '../../main-process-api/FileSystemService';

interface ProcessingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSource?: FileTreeSource | null;
  fileTreeStats?: FileTreeStats | null;
  packageLayers?: PackageLayer[] | null;
  filterLayers?: any[] | null;
}

interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number; // in bytes
}

export const ProcessingDetailsModal: React.FC<ProcessingDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedSource,
  fileTreeStats,
  packageLayers,
  filterLayers,
}) => {
  const { theme } = useTheme();
  const [directoryStats, setDirectoryStats] = useState<DirectoryStats | null>(
    null,
  );
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('[ProcessingDetailsModal] Modal opened with:', {
        selectedSource: selectedSource?.id,
        fileTreeStats,
        packageLayersCount: packageLayers?.length || 0,
        filterLayersCount: filterLayers?.length || 0,
        filterLayers,
      });
    }
  }, [isOpen, filterLayers]);

  // Load directory statistics when modal opens for local sources
  useEffect(() => {
    if (!isOpen || !selectedSource || selectedSource.type !== 'local') {
      setDirectoryStats(null);
      return;
    }

    const loadDirectoryStats = async () => {
      setLoadingStats(true);
      setStatsError(null);

      try {
        // Get directory statistics from the file system
        const stats = await FileSystemService.getDirectoryStats(
          selectedSource.location,
        );
        setDirectoryStats(stats);
      } catch (error) {
        console.error('Failed to load directory stats:', error);
        setStatsError(
          error instanceof Error
            ? error.message
            : 'Failed to load directory statistics',
        );
      } finally {
        setLoadingStats(false);
      }
    };

    loadDirectoryStats();
  }, [isOpen, selectedSource]);

  if (!isOpen) return null;

  // Format file size in human readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Group packages by type for better display
  const packagesByType = packageLayers?.reduce(
    (acc, pkg) => {
      const type = pkg.type || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(pkg);
      return acc;
    },
    {} as Record<string, PackageLayer[]>,
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            paddingBottom: '16px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Repository Processing Details
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Source Information */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FolderOpen size={18} />
            Source Information
          </h3>

          {selectedSource ? (
            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Source Type
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: theme.colors.text,
                    }}
                  >
                    {selectedSource.type === 'local'
                      ? 'Local Clone'
                      : 'Remote Source'}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Location
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: theme.colors.text,
                      fontFamily: 'monospace',
                    }}
                  >
                    {selectedSource.location}
                  </div>
                </div>
                {selectedSource.metadata?.currentBranch && (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        marginBottom: '4px',
                      }}
                    >
                      Branch
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: theme.colors.text,
                      }}
                    >
                      {selectedSource.metadata.currentBranch}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                color: theme.colors.textSecondary,
                fontSize: '14px',
                fontStyle: 'italic',
              }}
            >
              No source selected
            </div>
          )}
        </div>

        {/* Horizontal layout for file system and package stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px',
          }}
        >
          {/* File System Statistics */}
          <div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <HardDrive size={18} />
              File System
            </h3>

            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              {selectedSource?.type === 'local' ? (
                loadingStats ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: `2px solid ${theme.colors.border}`,
                        borderTop: `2px solid ${theme.colors.primary}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    Loading directory statistics...
                  </div>
                ) : statsError ? (
                  <div style={{ color: theme.colors.error, fontSize: '14px' }}>
                    Error: {statsError}
                  </div>
                ) : directoryStats ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Total Files:
                      </span>
                      <span
                        style={{ fontWeight: 500, color: theme.colors.text }}
                      >
                        {directoryStats.totalFiles.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Total Directories:
                      </span>
                      <span
                        style={{ fontWeight: 500, color: theme.colors.text }}
                      >
                        {directoryStats.totalDirectories.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Total Size:
                      </span>
                      <span
                        style={{ fontWeight: 500, color: theme.colors.text }}
                      >
                        {formatFileSize(directoryStats.totalSize)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: '14px',
                    }}
                  >
                    No directory statistics available
                  </div>
                )
              ) : (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: '14px',
                  }}
                >
                  Directory statistics only available for local sources
                </div>
              )}

              {/* File Tree Statistics */}
              {fileTreeStats && (
                <>
                  <div
                    style={{
                      height: '1px',
                      backgroundColor: theme.colors.border,
                      margin: '16px 0',
                    }}
                  />
                  <div
                    style={{
                      marginBottom: '8px',
                      fontWeight: 500,
                      color: theme.colors.text,
                    }}
                  >
                    File Tree (Processed):
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Files:
                      </span>
                      <span
                        style={{ fontWeight: 500, color: theme.colors.text }}
                      >
                        {fileTreeStats.fileCount.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Directories:
                      </span>
                      <span
                        style={{ fontWeight: 500, color: theme.colors.text }}
                      >
                        {fileTreeStats.directoryCount.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        Loaded At:
                      </span>
                      <span
                        style={{ fontWeight: 500, color: theme.colors.text }}
                      >
                        {new Date(fileTreeStats.loadedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Filter Information */}
              {filterLayers && filterLayers.length > 0 && (
                <>
                  <div
                    style={{
                      height: '1px',
                      backgroundColor: theme.colors.border,
                      margin: '16px 0',
                    }}
                  />
                  <div
                    style={{
                      marginBottom: '8px',
                      fontWeight: 500,
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Filter size={14} />
                    Applied Filters ({filterLayers.length}):
                  </div>
                  <div
                    style={{
                      maxHeight: '150px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {filterLayers.map((filter, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '6px 8px',
                          backgroundColor: theme.colors.background,
                          borderRadius: '4px',
                          border: `1px solid ${theme.colors.border}`,
                          fontSize: '11px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 500,
                            color: filter.enabled
                              ? theme.colors.text
                              : theme.colors.textTertiary,
                            marginBottom: '2px',
                          }}
                        >
                          {filter.name || `Filter ${index + 1}`}
                        </div>
                        {filter.filterData && (
                          <>
                            {filter.filterData.purpose && (
                              <div
                                style={{
                                  color: theme.colors.textSecondary,
                                  fontSize: '10px',
                                }}
                              >
                                Purpose: {filter.filterData.purpose}
                              </div>
                            )}
                            {filter.filterData.excludedPatterns &&
                              filter.filterData.excludedPatterns.length > 0 && (
                                <div
                                  style={{
                                    color: theme.colors.textSecondary,
                                    fontSize: '10px',
                                    marginTop: '2px',
                                  }}
                                >
                                  Patterns:{' '}
                                  {filter.filterData.excludedPatterns.length}{' '}
                                  excluded
                                </div>
                              )}
                          </>
                        )}
                        {filter.derivedFrom?.description && (
                          <div
                            style={{
                              color: theme.colors.textTertiary,
                              fontSize: '10px',
                              marginTop: '2px',
                              fontStyle: 'italic',
                            }}
                          >
                            {filter.derivedFrom.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Filter impact summary */}
                  {directoryStats && fileTreeStats && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          color: theme.colors.textSecondary,
                          marginBottom: '4px',
                        }}
                      >
                        Filter Impact:
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Files filtered out:</span>
                        <span
                          style={{ fontWeight: 500, color: theme.colors.error }}
                        >
                          {(
                            directoryStats.totalFiles - fileTreeStats.fileCount
                          ).toLocaleString()}{' '}
                          (
                          {Math.round(
                            ((directoryStats.totalFiles -
                              fileTreeStats.fileCount) /
                              directoryStats.totalFiles) *
                              100,
                          )}
                          %)
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Directories filtered out:</span>
                        <span
                          style={{ fontWeight: 500, color: theme.colors.error }}
                        >
                          {(
                            directoryStats.totalDirectories -
                            fileTreeStats.directoryCount
                          ).toLocaleString()}{' '}
                          (
                          {Math.round(
                            ((directoryStats.totalDirectories -
                              fileTreeStats.directoryCount) /
                              directoryStats.totalDirectories) *
                              100,
                          )}
                          %)
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Package Analysis */}
          <div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Package size={18} />
              Package Analysis
            </h3>

            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                height: 'fit-content',
              }}
            >
              {packageLayers && packageLayers.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ color: theme.colors.textSecondary }}>
                      Total Packages:
                    </span>
                    <span style={{ fontWeight: 500, color: theme.colors.text }}>
                      {packageLayers.length}
                    </span>
                  </div>

                  {/* Package types breakdown */}
                  {packagesByType && Object.keys(packagesByType).length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: theme.colors.text,
                          marginBottom: '8px',
                        }}
                      >
                        By Type:
                      </div>
                      {Object.entries(packagesByType).map(
                        ([type, packages]) => (
                          <div
                            key={type}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              marginBottom: '4px',
                            }}
                          >
                            <span
                              style={{
                                color: theme.colors.textSecondary,
                                textTransform: 'capitalize',
                              }}
                            >
                              {type}:
                            </span>
                            <span
                              style={{
                                fontWeight: 500,
                                color: theme.colors.text,
                              }}
                            >
                              {packages.length}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {/* Package list */}
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: theme.colors.text,
                        marginBottom: '8px',
                      }}
                    >
                      Packages:
                    </div>
                    <div
                      style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {packageLayers.map((pkg, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '8px',
                            backgroundColor: theme.colors.background,
                            borderRadius: '4px',
                            border: `1px solid ${theme.colors.border}`,
                            fontSize: '12px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 500,
                              color: theme.colors.text,
                              marginBottom: '2px',
                            }}
                          >
                            {pkg.packageData?.name || 'Unknown Package'}
                          </div>
                          {pkg.packageData?.path && (
                            <div
                              style={{
                                color: theme.colors.textSecondary,
                                fontFamily: 'monospace',
                                fontSize: '11px',
                              }}
                            >
                              {pkg.packageData.path}
                            </div>
                          )}
                          {pkg.type && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: theme.colors.textTertiary,
                                textTransform: 'capitalize',
                                marginTop: '2px',
                              }}
                            >
                              Type: {pkg.type}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: '14px',
                  }}
                >
                  No packages detected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

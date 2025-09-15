import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { X, FolderOpen, Package, Filter, ArrowRight, ChevronDown, ChevronRight, AlertCircle, CheckCircle, XCircle, FileText, Folder, TestTube, Eye } from 'lucide-react';
import type { FileTreeSource, FileTreeStats } from '../../../types/file-tree-source';
import type { PackageLayer } from "@principal-ai/codebase-composition";
import { FileSystemService } from '../../../main-process-api/FileSystemService';

interface ProcessingPipelineModalProps {
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
  totalSize: number;
}

interface PipelineStage {
  name: string;
  icon: React.ReactNode;
  inputFiles: number;
  outputFiles: number;
  inputDirs: number;
  outputDirs: number;
  description?: string;
  filters?: any[];
  status: 'success' | 'warning' | 'error';
}

export const ProcessingPipelineModal: React.FC<ProcessingPipelineModalProps> = ({
  isOpen,
  onClose,
  selectedSource,
  fileTreeStats,
  packageLayers,
  filterLayers,
}) => {
  const { theme } = useTheme();
  const [directoryStats, setDirectoryStats] = useState<DirectoryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<number, { 
    matchedFiles: string[], 
    totalFiles: number, 
    loading: boolean,
    error?: string 
  }>>(new Map());
  const [showingResults, setShowingResults] = useState<Set<number>>(new Set());

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('[ProcessingPipelineModal] Modal opened with:', {
        selectedSource: selectedSource?.id,
        fileTreeStats,
        packageLayersCount: packageLayers?.length || 0,
        filterLayersCount: filterLayers?.length || 0,
        hasFilterLayers: !!filterLayers,
        filterLayersType: typeof filterLayers,
        filterLayers: filterLayers
      });
      
      // Log all filter patterns for debugging
      if (filterLayers && filterLayers.length > 0) {
        console.log('[ProcessingPipelineModal] Active filters:');
        filterLayers.forEach((filter, index) => {
          console.log(`  Filter ${index + 1}: ${filter.name || 'Unnamed'}`);
          console.log(`    Enabled: ${filter.enabled}`);
          if (filter.filterData?.excludedPatterns) {
            console.log(`    Patterns (${filter.filterData.excludedPatterns.length}):`);
            filter.filterData.excludedPatterns.forEach((p: any) => {
              console.log(`      - ${p.pattern}`);
            });
          }
        });
      }
    }
  }, [isOpen, filterLayers, fileTreeStats]);

  // Load directory statistics when modal opens for local sources
  useEffect(() => {
    if (!isOpen || !selectedSource || selectedSource.type !== 'local') {
      setDirectoryStats(null);
      return;
    }

    const loadDirectoryStats = async () => {
      setLoadingStats(true);
      try {
        const stats = await FileSystemService.getDirectoryStats(selectedSource.location);
        setDirectoryStats(stats);
      } catch (error) {
        console.error('Failed to load directory stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    loadDirectoryStats();
  }, [isOpen, selectedSource]);

  if (!isOpen) return null;

  const formatNumber = (num: number): string => num.toLocaleString();
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleStageExpanded = (index: number) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedStages(newExpanded);
  };

  const toggleFilterExpanded = (filterId: string) => {
    const newExpanded = new Set(expandedFilters);
    if (newExpanded.has(filterId)) {
      newExpanded.delete(filterId);
    } else {
      newExpanded.add(filterId);
    }
    setExpandedFilters(newExpanded);
  };

  const testFilterPatterns = async (filterIndex: number, filter: any) => {
    if (!selectedSource || !filter.filterData?.excludedPatterns) {
      return;
    }

    // Set loading state
    const newResults = new Map(testResults);
    newResults.set(filterIndex, {
      matchedFiles: [],
      totalFiles: 0,
      loading: true
    });
    setTestResults(newResults);

    try {
      // Get the directory path to test against
      const directoryPath = selectedSource.type === 'local' 
        ? selectedSource.location 
        : '';

      if (!directoryPath && selectedSource.type === 'local') {
        throw new Error('No directory path available for local source');
      }

      // For GitHub sources, we can't really test against the file system
      if (selectedSource.type !== 'local') {
        throw new Error('Pattern testing is only available for local repositories');
      }

      // Get all files in the directory using our buildFilteredFileTree method
      // but without any filters to get the complete list
      const allFilesResult = await FileSystemService.buildFilteredFileTree(directoryPath, []);
      const allFiles = allFilesResult.paths.filter(path => !path.endsWith('/')); // Only files, not directories

      // Test each file against the filter patterns
      const patterns = filter.filterData.excludedPatterns.map((p: any) => p.pattern);
      
      // Import ignore library to test patterns
      const ignore = (await import('ignore')).default;
      const ig = ignore();
      ig.add(patterns);

      const matchedFiles: string[] = [];
      
      allFiles.forEach(filePath => {
        if (ig.ignores(filePath)) {
          matchedFiles.push(filePath);
        }
      });

      // Update results
      const updatedResults = new Map(testResults);
      updatedResults.set(filterIndex, {
        matchedFiles,
        totalFiles: allFiles.length,
        loading: false
      });
      setTestResults(updatedResults);

      // Show results
      const newShowing = new Set(showingResults);
      newShowing.add(filterIndex);
      setShowingResults(newShowing);

    } catch (error) {
      const updatedResults = new Map(testResults);
      updatedResults.set(filterIndex, {
        matchedFiles: [],
        totalFiles: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      setTestResults(updatedResults);
    }
  };

  const toggleTestResults = (filterIndex: number) => {
    const newShowing = new Set(showingResults);
    if (newShowing.has(filterIndex)) {
      newShowing.delete(filterIndex);
    } else {
      newShowing.add(filterIndex);
    }
    setShowingResults(newShowing);
  };

  // Build pipeline stages
  const pipelineStages: PipelineStage[] = [];

  // Stage 1: File System Scan
  if (directoryStats) {
    pipelineStages.push({
      name: 'File System Scan',
      icon: <FolderOpen size={16} />,
      inputFiles: 0,
      outputFiles: directoryStats.totalFiles,
      inputDirs: 0,
      outputDirs: directoryStats.totalDirectories,
      description: `Scanned ${selectedSource?.location || 'directory'} (${formatFileSize(directoryStats.totalSize)})`,
      status: 'success'
    });
  }

  // Stage 2: Filter Application
  // Show this stage if there's any difference between scan and tree, or if we have filters
  if (directoryStats && fileTreeStats) {
    const filesRemoved = directoryStats.totalFiles - fileTreeStats.fileCount;
    const dirsRemoved = directoryStats.totalDirectories - fileTreeStats.directoryCount;
    const hasFilters = filterLayers && filterLayers.length > 0;
    
    // Always show filter stage if files were removed OR if we have filters
    if (filesRemoved > 0 || dirsRemoved > 0 || hasFilters) {
      pipelineStages.push({
        name: 'Apply Filters',
        icon: <Filter size={16} />,
        inputFiles: directoryStats.totalFiles,
        outputFiles: fileTreeStats.fileCount,
        inputDirs: directoryStats.totalDirectories,
        outputDirs: fileTreeStats.directoryCount,
        description: hasFilters 
          ? `Applied ${filterLayers.length} filter${filterLayers.length > 1 ? 's' : ''}`
          : `Filtered ${filesRemoved} files and ${dirsRemoved} directories (filters may be built-in or from config)`,
        filters: filterLayers || undefined,
        status: filesRemoved > directoryStats.totalFiles * 0.9 ? 'warning' : 'success'
      });
    }
  }

  // Stage 3: Tree Building
  if (fileTreeStats) {
    pipelineStages.push({
      name: 'Build File Tree',
      icon: <Folder size={16} />,
      inputFiles: fileTreeStats.fileCount,
      outputFiles: fileTreeStats.fileCount,
      inputDirs: fileTreeStats.directoryCount,
      outputDirs: fileTreeStats.directoryCount,
      description: 'Constructed hierarchical tree structure',
      status: fileTreeStats.fileCount > 0 ? 'success' : 'error'
    });
  }

  // Stage 4: Package Discovery
  if (packageLayers) {
    pipelineStages.push({
      name: 'Package Discovery',
      icon: <Package size={16} />,
      inputFiles: fileTreeStats?.fileCount || 0,
      outputFiles: fileTreeStats?.fileCount || 0,
      inputDirs: fileTreeStats?.directoryCount || 0,
      outputDirs: fileTreeStats?.directoryCount || 0,
      description: `Found ${packageLayers.length} package${packageLayers.length !== 1 ? 's' : ''}`,
      status: packageLayers.length > 0 ? 'success' : 'warning'
    });
  }

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} color={theme.colors.success} />;
      case 'warning':
        return <AlertCircle size={14} color={theme.colors.warning} />;
      case 'error':
        return <XCircle size={14} color={theme.colors.error} />;
      default:
        return null;
    }
  };

  const getPercentageChange = (input: number, output: number): string => {
    if (input === 0) return '+100%';
    const change = ((output - input) / input) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  };

  return (
    <div style={{
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
    }}>
      <div style={{
        backgroundColor: theme.colors.background,
        borderRadius: '12px',
        width: '90%',
        maxWidth: '1000px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '20px', 
              fontWeight: 600, 
              color: theme.colors.text,
              marginBottom: '4px'
            }}>
              Repository Processing Pipeline
            </h2>
            {selectedSource && (
              <div style={{ 
                fontSize: '13px', 
                color: theme.colors.textSecondary,
                fontFamily: 'monospace'
              }}>
                {selectedSource.label} • {selectedSource.location}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}>
          {/* Filter Summary Section */}
          {filterLayers && filterLayers.length > 0 && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: theme.colors.text,
              }}>
                Active Filters ({filterLayers.filter(f => f.enabled).length} of {filterLayers.length} enabled)
              </h3>
              
              {filterLayers.map((filter, index) => (
                <div key={index} style={{
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: theme.colors.background,
                  borderRadius: '6px',
                  border: `1px solid ${filter.enabled ? theme.colors.primary : theme.colors.border}`,
                  opacity: filter.enabled ? 1 : 0.6,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: filter.enabled ? theme.colors.success : theme.colors.textTertiary,
                      }} />
                      <strong style={{ color: theme.colors.text }}>
                        {filter.name || `Filter ${index + 1}`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {filter.filterData?.excludedPatterns && (
                        <span style={{
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                          backgroundColor: theme.colors.backgroundTertiary,
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          {filter.filterData.excludedPatterns.length} patterns
                        </span>
                      )}
                      
                      {/* Test Filter Button */}
                      {filter.enabled && filter.filterData?.excludedPatterns && selectedSource?.type === 'local' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            testFilterPatterns(index, filter);
                          }}
                          style={{
                            backgroundColor: theme.colors.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Test this filter to see which files it matches"
                        >
                          <TestTube size={12} />
                          Test
                        </button>
                      )}
                      
                      {/* Show Results Button */}
                      {testResults.has(index) && !testResults.get(index)?.loading && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTestResults(index);
                          }}
                          style={{
                            backgroundColor: 'transparent',
                            color: theme.colors.primary,
                            border: `1px solid ${theme.colors.primary}`,
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="View test results"
                        >
                          <Eye size={12} />
                          {showingResults.has(index) ? 'Hide' : 'Results'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {filter.filterData?.purpose && (
                    <div style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}>
                      {filter.filterData.purpose}
                    </div>
                  )}
                  
                  {filter.filterData?.excludedPatterns && filter.filterData.excludedPatterns.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: theme.colors.primary,
                        marginBottom: '4px',
                      }}>
                        Show patterns
                      </summary>
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        maxHeight: '150px',
                        overflowY: 'auto',
                      }}>
                        {filter.filterData.excludedPatterns.map((pattern: any, pIndex: number) => (
                          <div key={pIndex} style={{
                            marginBottom: '2px',
                            color: theme.colors.text,
                          }}>
                            {pattern.pattern}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  {/* Test Results Display */}
                  {showingResults.has(index) && testResults.has(index) && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                    }}>
                      {(() => {
                        const result = testResults.get(index);
                        if (!result) return null;
                        
                        if (result.loading) {
                          return (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: theme.colors.textSecondary,
                              fontSize: '12px',
                            }}>
                              <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                border: `2px solid ${theme.colors.textSecondary}`,
                                borderTop: `2px solid ${theme.colors.primary}`,
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                              }} />
                              Testing filter patterns...
                            </div>
                          );
                        }
                        
                        if (result.error) {
                          return (
                            <div style={{
                              color: theme.colors.error,
                              fontSize: '12px',
                            }}>
                              <strong>Error:</strong> {result.error}
                            </div>
                          );
                        }
                        
                        return (
                          <div>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: theme.colors.text,
                              marginBottom: '8px',
                            }}>
                              Test Results: {result.matchedFiles.length} files would be excluded 
                              {result.totalFiles > 0 && ` (out of ${result.totalFiles} total files)`}
                            </div>
                            
                            {result.matchedFiles.length > 0 && (
                              <div style={{
                                maxHeight: '200px',
                                overflowY: 'auto',
                                backgroundColor: theme.colors.background,
                                borderRadius: '4px',
                                padding: '8px',
                              }}>
                                <div style={{
                                  fontSize: '12px',
                                  color: theme.colors.textSecondary,
                                  marginBottom: '6px',
                                }}>
                                  Files that would be excluded by this filter:
                                </div>
                                {result.matchedFiles.map((filePath, fileIndex) => (
                                  <div key={fileIndex} style={{
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: theme.colors.text,
                                    marginBottom: '2px',
                                    padding: '2px 4px',
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '2px',
                                  }}>
                                    {filePath}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {result.matchedFiles.length === 0 && (
                              <div style={{
                                fontSize: '12px',
                                color: theme.colors.success,
                                fontStyle: 'italic',
                              }}>
                                No files would be excluded by this filter
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Debug info */}
              {fileTreeStats && (
                <div style={{
                  marginTop: '16px',
                  padding: '8px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}>
                  <strong>Result:</strong> {fileTreeStats.fileCount} files, {fileTreeStats.directoryCount} directories
                  {directoryStats && (
                    <span> (filtered from {directoryStats.totalFiles} files, {directoryStats.totalDirectories} directories)</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pipeline Visualization */}
          <div style={{ marginBottom: '32px' }}>
            {pipelineStages.map((stage, index) => (
              <React.Fragment key={index}>
                {/* Stage Box */}
                <div style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  {/* Stage Header */}
                  <div 
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: stage.filters ? 'pointer' : 'default',
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => stage.filters && toggleStageExpanded(index)}
                    onMouseEnter={(e) => {
                      if (stage.filters) {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {stage.filters && (
                        expandedStages.has(index) ? 
                        <ChevronDown size={16} color={theme.colors.textSecondary} /> : 
                        <ChevronRight size={16} color={theme.colors.textSecondary} />
                      )}
                      <div style={{ color: theme.colors.primary }}>
                        {stage.icon}
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 600, 
                          color: theme.colors.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {stage.name}
                          {getStageStatusIcon(stage.status)}
                        </div>
                        {stage.description && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: theme.colors.textSecondary,
                            marginTop: '2px'
                          }}>
                            {stage.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                          Files
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 500, 
                          color: theme.colors.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {stage.inputFiles > 0 && (
                            <>
                              <span>{formatNumber(stage.inputFiles)}</span>
                              <ArrowRight size={14} color={theme.colors.textSecondary} />
                            </>
                          )}
                          <span>{formatNumber(stage.outputFiles)}</span>
                          {stage.inputFiles !== stage.outputFiles && stage.inputFiles > 0 && (
                            <span style={{ 
                              fontSize: '11px', 
                              color: stage.outputFiles < stage.inputFiles ? theme.colors.error : theme.colors.success 
                            }}>
                              ({getPercentageChange(stage.inputFiles, stage.outputFiles)})
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                          Directories
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 500, 
                          color: theme.colors.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {stage.inputDirs > 0 && (
                            <>
                              <span>{formatNumber(stage.inputDirs)}</span>
                              <ArrowRight size={14} color={theme.colors.textSecondary} />
                            </>
                          )}
                          <span>{formatNumber(stage.outputDirs)}</span>
                          {stage.inputDirs !== stage.outputDirs && stage.inputDirs > 0 && (
                            <span style={{ 
                              fontSize: '11px', 
                              color: stage.outputDirs < stage.inputDirs ? theme.colors.error : theme.colors.success
                            }}>
                              ({getPercentageChange(stage.inputDirs, stage.outputDirs)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Filter Details */}
                  {stage.filters && expandedStages.has(index) && (
                    <div style={{
                      borderTop: `1px solid ${theme.colors.border}`,
                      padding: '16px',
                      backgroundColor: theme.colors.background,
                    }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: 500, 
                        color: theme.colors.text,
                        marginBottom: '12px'
                      }}>
                        Active Filters:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stage.filters.map((filter, filterIndex) => {
                          const filterId = `${index}-${filterIndex}`;
                          const isExpanded = expandedFilters.has(filterId);
                          
                          return (
                            <div key={filterIndex} style={{
                              backgroundColor: theme.colors.backgroundSecondary,
                              borderRadius: '6px',
                              border: `1px solid ${theme.colors.border}`,
                              overflow: 'hidden',
                            }}>
                              <div 
                                style={{
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                                onClick={() => toggleFilterExpanded(filterId)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isExpanded ? 
                                    <ChevronDown size={14} color={theme.colors.textSecondary} /> : 
                                    <ChevronRight size={14} color={theme.colors.textSecondary} />
                                  }
                                  <div style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%',
                                    backgroundColor: filter.enabled ? theme.colors.success : theme.colors.textTertiary 
                                  }} />
                                  <div style={{ 
                                    fontSize: '13px', 
                                    fontWeight: 500,
                                    color: filter.enabled ? theme.colors.text : theme.colors.textTertiary
                                  }}>
                                    {filter.name || `Filter ${filterIndex + 1}`}
                                  </div>
                                </div>
                                
                                {filter.filterData?.excludedPatterns && (
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: theme.colors.textSecondary,
                                    backgroundColor: theme.colors.backgroundTertiary,
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    {filter.filterData.excludedPatterns.length} patterns
                                  </div>
                                )}
                              </div>
                              
                              {isExpanded && (
                                <div style={{
                                  padding: '12px',
                                  borderTop: `1px solid ${theme.colors.border}`,
                                  backgroundColor: theme.colors.background,
                                  fontSize: '12px',
                                }}>
                                  {filter.filterData?.purpose && (
                                    <div style={{ marginBottom: '8px' }}>
                                      <span style={{ color: theme.colors.textSecondary }}>Purpose: </span>
                                      <span style={{ color: theme.colors.text }}>{filter.filterData.purpose}</span>
                                    </div>
                                  )}
                                  
                                  {filter.filterData?.scope && (
                                    <div style={{ marginBottom: '8px' }}>
                                      <span style={{ color: theme.colors.textSecondary }}>Scope: </span>
                                      <span style={{ color: theme.colors.text }}>{filter.filterData.scope}</span>
                                    </div>
                                  )}
                                  
                                  {filter.derivedFrom?.description && (
                                    <div style={{ 
                                      marginBottom: '8px',
                                      fontStyle: 'italic',
                                      color: theme.colors.textTertiary
                                    }}>
                                      {filter.derivedFrom.description}
                                    </div>
                                  )}
                                  
                                  {filter.filterData?.excludedPatterns && filter.filterData.excludedPatterns.length > 0 && (
                                    <div>
                                      <div style={{ 
                                        color: theme.colors.textSecondary,
                                        marginBottom: '6px'
                                      }}>
                                        Excluded patterns:
                                      </div>
                                      <div style={{ 
                                        maxHeight: '120px',
                                        overflowY: 'auto',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '4px',
                                        padding: '8px',
                                        fontFamily: 'monospace',
                                        fontSize: '11px'
                                      }}>
                                        {filter.filterData.excludedPatterns.slice(0, 10).map((pattern: any, i: number) => (
                                          <div key={i} style={{ 
                                            color: theme.colors.text,
                                            marginBottom: '2px'
                                          }}>
                                            {pattern.pattern}
                                            {pattern.description && (
                                              <span style={{ 
                                                color: theme.colors.textTertiary,
                                                marginLeft: '8px'
                                              }}>
                                                // {pattern.description}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                        {filter.filterData.excludedPatterns.length > 10 && (
                                          <div style={{ 
                                            color: theme.colors.textTertiary,
                                            marginTop: '4px'
                                          }}>
                                            ... and {filter.filterData.excludedPatterns.length - 10} more
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector Arrow */}
                {index < pipelineStages.length - 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '16px 0',
                  }}>
                    <div style={{
                      width: '2px',
                      height: '32px',
                      backgroundColor: theme.colors.border,
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: `6px solid ${theme.colors.border}`,
                      }} />
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Summary Section */}
          {directoryStats && fileTreeStats && (
            <div style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '16px',
              border: `1px solid ${theme.colors.border}`,
            }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: theme.colors.text,
                marginTop: 0,
                marginBottom: '12px'
              }}>
                Processing Summary
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                    Total Processed
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: theme.colors.text }}>
                    {fileTreeStats.fileCount === 0 ? (
                      <span style={{ color: theme.colors.error }}>No files</span>
                    ) : (
                      <>
                        {formatNumber(fileTreeStats.fileCount)} 
                        <span style={{ fontSize: '14px', fontWeight: 400, color: theme.colors.textSecondary }}> files</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                    Filter Efficiency
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: theme.colors.text }}>
                    {Math.round(((directoryStats.totalFiles - fileTreeStats.fileCount) / directoryStats.totalFiles) * 100)}%
                    <span style={{ fontSize: '14px', fontWeight: 400, color: theme.colors.textSecondary }}> removed</span>
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                    Packages Found
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: theme.colors.text }}>
                    {packageLayers?.length || 0}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: theme.colors.textSecondary }}> packages</span>
                  </div>
                </div>
              </div>
              
              {fileTreeStats.fileCount === 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.warning}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} color={theme.colors.warning} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text, marginBottom: '4px' }}>
                      All files were filtered out
                    </div>
                    <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '12px' }}>
                      Your filters are excluding all files from the repository. Consider adjusting your filter configuration to include the files you want to visualize.
                    </div>
                    
                    {/* Show active filters */}
                    {filterLayers && filterLayers.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '4px',
                        border: `1px solid ${theme.colors.border}`
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: theme.colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase' }}>
                          Active Filters ({filterLayers.length})
                        </div>
                        {filterLayers.map((filter, index) => (
                          <div key={index} style={{
                            marginBottom: index < filterLayers.length - 1 ? '10px' : 0,
                            padding: '8px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 500, color: theme.colors.text }}>
                                {filter.name || `Filter ${index + 1}`}
                              </span>
                              {filter.enabled !== false && (
                                <button
                                  onClick={() => testFilterPatterns(index, filter)}
                                  disabled={testResults.get(index)?.loading}
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    backgroundColor: theme.colors.primary,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: testResults.get(index)?.loading ? 'not-allowed' : 'pointer',
                                    opacity: testResults.get(index)?.loading ? 0.6 : 1
                                  }}
                                >
                                  {testResults.get(index)?.loading ? 'Testing...' : 'Test'}
                                </button>
                              )}
                            </div>
                            <div style={{ color: theme.colors.textSecondary }}>
                              {filter.patterns && filter.patterns.length > 0 ? (
                                <div>
                                  <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                                    Patterns ({filter.patterns.length}):
                                  </div>
                                  <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '11px',
                                    backgroundColor: theme.colors.background,
                                    padding: '4px 6px',
                                    borderRadius: '3px',
                                    maxHeight: '60px',
                                    overflowY: 'auto'
                                  }}>
                                    {filter.patterns.slice(0, 5).map((pattern: string, pIndex: number) => (
                                      <div key={pIndex}>{pattern}</div>
                                    ))}
                                    {filter.patterns.length > 5 && (
                                      <div style={{ color: theme.colors.textTertiary }}>
                                        ...and {filter.patterns.length - 5} more
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', fontStyle: 'italic' }}>No patterns defined</span>
                              )}
                            </div>
                            
                            {/* Show test results if available */}
                            {testResults.has(index) && showingResults.has(index) && (
                              <div style={{
                                marginTop: '8px',
                                padding: '6px',
                                backgroundColor: theme.colors.background,
                                borderRadius: '3px',
                                fontSize: '11px'
                              }}>
                                {testResults.get(index)?.error ? (
                                  <div style={{ color: theme.colors.error }}>
                                    Error: {testResults.get(index)?.error}
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ marginBottom: '4px', color: theme.colors.warning }}>
                                      {testResults.get(index)?.matchedFiles.length} files would be excluded
                                    </div>
                                    {testResults.get(index)?.matchedFiles.length > 0 && (
                                      <div style={{
                                        maxHeight: '100px',
                                        overflowY: 'auto',
                                        padding: '4px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        borderRadius: '2px'
                                      }}>
                                        {testResults.get(index)?.matchedFiles.slice(0, 10).map((file: string, fIndex: number) => (
                                          <div key={fIndex} style={{ color: theme.colors.textSecondary }}>
                                            {file}
                                          </div>
                                        ))}
                                        {testResults.get(index)?.matchedFiles.length > 10 && (
                                          <div style={{ color: theme.colors.textTertiary, marginTop: '4px' }}>
                                            ...and {testResults.get(index)?.matchedFiles.length - 10} more
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
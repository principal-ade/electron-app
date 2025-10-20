import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Activity,
  HardDrive,
  Folder,
  Power,
  AlertCircle,
  Plus,
  X,
  FileSearch,
  GitBranch,
  Eye,
  EyeOff,
} from 'lucide-react';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import type {
  MonitoringStatus,
  GitStatus,
} from '../../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

interface SystemMonitorProps {
  sidebarCollapsed?: boolean;
}

export const SystemMonitor: React.FC<SystemMonitorProps> = ({
  sidebarCollapsed,
}) => {
  const { theme } = useTheme();
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<
    Array<{ name: string; path: string }>
  >([]);
  const [fileTreeData, setFileTreeData] = useState<
    Map<string, { files: number; directories: number; loading: boolean }>
  >(new Map());
  const [gitStatusData, setGitStatusData] = useState<
    Map<string, GitStatus | null>
  >(new Map());
  const [gitWatchingState, setGitWatchingState] = useState<
    Map<string, 'enabling' | 'disabling' | null>
  >(new Map());
  const [packageData, setPackageData] = useState<
    Map<string, { packages: number; monorepo: boolean; loading: boolean }>
  >(new Map());

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const data = await RepositoryMonitoringService.getMonitoringStatus();
        setStatus(data);
        setLoading(false);
        // Check if running based on whether we have data
        setIsRunning(data.currentMemory > 0 || data.repositories.length > 0);
      } catch (error) {
        console.error('Failed to fetch monitoring status:', error);
        // Use fallback data if service is not available
        setStatus({
          repositories: [],
          currentMemory: 0,
          currentCpu: 0,
          history: [],
        });
        setLoading(false);
        setIsRunning(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling every 2 seconds
    interval = setInterval(fetchStatus, 2000);

    // Cleanup on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Load available repositories from Alexandria
  useEffect(() => {
    const loadAvailableRepos = async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        setAvailableRepos(repos.map((r) => ({ name: r.name, path: r.path })));
      } catch (error) {
        console.error('Failed to load available repositories:', error);
      }
    };
    loadAvailableRepos();
  }, []);

  // Listen for git status changes from the monitoring server
  useEffect(() => {
    const unsubscribe =
      window.mainProcess.repositoryMonitoring.onGitStatusChanged(
        (gitStatus: GitStatus) => {
          if (gitStatus && gitStatus.repoPath) {
            setGitStatusData((prev) =>
              new Map(prev).set(gitStatus.repoPath, gitStatus),
            );
          }
        },
      );

    return unsubscribe;
  }, []);

  // Simple sparkline component
  const Sparkline: React.FC<{
    data: number[];
    max?: number;
    color?: string;
  }> = ({ data, max = 100, color = theme.colors.primary }) => {
    const width = 120;
    const height = 30;

    if (data.length < 2) {
      return <div style={{ width, height }} />;
    }

    const points = data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - Math.max(0, Math.min(1, val / max)) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
        />
      </svg>
    );
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb < 1000 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
  };

  const handleRegisterRepository = async (path: string) => {
    try {
      await RepositoryMonitoringService.registerRepository(path);
      // Refresh status to see the new repo
      const data = await RepositoryMonitoringService.getMonitoringStatus();
      setStatus(data);
      setShowAddRepo(false);
    } catch (error) {
      console.error('Failed to register repository:', error);
    }
  };

  const handleUnregisterRepository = async (path: string) => {
    try {
      await RepositoryMonitoringService.unregisterRepository(path);
      // Refresh status to remove the repo
      const data = await RepositoryMonitoringService.getMonitoringStatus();
      setStatus(data);
      // Remove from fileTreeData
      setFileTreeData((prev) => {
        const newMap = new Map(prev);
        newMap.delete(path);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to unregister repository:', error);
    }
  };

  const handleBuildFileTree = async (path: string) => {
    // Set loading state
    setFileTreeData((prev) =>
      new Map(prev).set(path, {
        files: prev.get(path)?.files || 0,
        directories: prev.get(path)?.directories || 0,
        loading: true,
      }),
    );

    try {
      const fileTree = await RepositoryMonitoringService.getFileTree(path);

      if (fileTree) {
        // FileTree has allFiles and allDirectories arrays
        const fileCount = fileTree.allFiles?.length || 0;
        const dirCount = fileTree.allDirectories?.length || 0;

        // Update state with counts
        setFileTreeData((prev) =>
          new Map(prev).set(path, {
            files: fileCount,
            directories: dirCount,
            loading: false,
          }),
        );

        // Refresh monitoring status to see updated memory
        setTimeout(async () => {
          const data = await RepositoryMonitoringService.getMonitoringStatus();
          setStatus(data);
        }, 500);
      }
    } catch (error) {
      console.error('Failed to build file tree:', error);
      setFileTreeData((prev) =>
        new Map(prev).set(path, {
          files: 0,
          directories: 0,
          loading: false,
        }),
      );
    }
  };

  const handleToggleGitWatching = async (repoPath: string) => {
    const currentStatus = gitStatusData.get(repoPath);
    const isWatching = currentStatus?.watchingEnabled || false;

    // Set loading state
    setGitWatchingState((prev) =>
      new Map(prev).set(repoPath, isWatching ? 'disabling' : 'enabling'),
    );

    try {
      let result;
      if (isWatching) {
        // Disable watching
        result = await RepositoryMonitoringService.disableGitWatching(repoPath);
      } else {
        // Enable watching
        result = await RepositoryMonitoringService.enableGitWatching(repoPath);
      }

      if (result.success) {
        // Fetch updated status
        const newStatus =
          await RepositoryMonitoringService.getGitStatus(repoPath);
        setGitStatusData((prev) => new Map(prev).set(repoPath, newStatus));
      } else {
        console.error('Failed to toggle git watching:', result.error);
      }
    } catch (error) {
      console.error('Failed to toggle git watching:', error);
    } finally {
      setGitWatchingState((prev) => new Map(prev).set(repoPath, null));
    }
  };

  const fetchGitStatus = async (repoPath: string) => {
    try {
      const status = await RepositoryMonitoringService.getGitStatus(repoPath);
      setGitStatusData((prev) => new Map(prev).set(repoPath, status));
    } catch (error) {
      console.error('Failed to fetch git status:', error);
    }
  };

  const fetchPackages = async (path: string) => {
    // Set loading state
    setPackageData((prev) =>
      new Map(prev).set(path, {
        packages: prev.get(path)?.packages || 0,
        monorepo: prev.get(path)?.monorepo || false,
        loading: true,
      }),
    );

    try {
      const result = await RepositoryMonitoringService.getPackages(path);

      if (result) {
        // Update state with package counts
        setPackageData((prev) =>
          new Map(prev).set(path, {
            packages: result.packages.length,
            monorepo: result.summary.isMonorepo,
            loading: false,
          }),
        );

        // Log the results for debugging
        console.info(`Found ${result.packages.length} packages in ${path}`);
        console.info('Package Summary:', result.summary);
        console.info('Packages:', result.packages);
      } else {
        setPackageData((prev) =>
          new Map(prev).set(path, {
            packages: 0,
            monorepo: false,
            loading: false,
          }),
        );
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
      setPackageData((prev) =>
        new Map(prev).set(path, {
          packages: 0,
          monorepo: false,
          loading: false,
        }),
      );
    }
  };

  const handleToggleMonitoring = async () => {
    setIsToggling(true);
    try {
      if (isRunning) {
        // Stop monitoring
        await RepositoryMonitoringService.stopMonitoring();
        setIsRunning(false);
        setStatus({
          repositories: [],
          currentMemory: 0,
          currentCpu: 0,
          history: [],
        });
      } else {
        // Start monitoring
        await RepositoryMonitoringService.startMonitoring();
        setIsRunning(true);
        // Fetch status immediately after starting
        setTimeout(async () => {
          const data = await RepositoryMonitoringService.getMonitoringStatus();
          setStatus(data);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
        }}
      >
        Loading monitoring data...
      </div>
    );
  }

  if (!status) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.error,
        }}
      >
        Failed to load monitoring data
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      {/* Header */}
      <div
        style={{
          padding: '20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 600,
                margin: 0,
                fontFamily: theme.fonts.heading,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Activity size={24} style={{ color: theme.colors.primary }} />
              Repository Monitoring
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: '4px 0 0 32px',
                fontFamily: theme.fonts.body,
              }}
            >
              Resource usage and status for background processes
            </p>
          </div>

          {/* Power Control */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {/* Status indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: isRunning
                  ? `${theme.colors.success}15`
                  : `${theme.colors.textSecondary}15`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: isRunning
                  ? theme.colors.success
                  : theme.colors.textSecondary,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isRunning
                    ? theme.colors.success
                    : theme.colors.textSecondary,
                  animation: isRunning ? 'pulse 2s infinite' : 'none',
                }}
              />
              {isRunning ? 'Running' : 'Stopped'}
            </div>

            {/* Power button */}
            <button
              onClick={handleToggleMonitoring}
              disabled={isToggling}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                border: `1px solid ${isRunning ? theme.colors.error : theme.colors.success}`,
                backgroundColor: isRunning
                  ? `${theme.colors.error}10`
                  : `${theme.colors.success}10`,
                color: isRunning ? theme.colors.error : theme.colors.success,
                cursor: isToggling ? 'not-allowed' : 'pointer',
                opacity: isToggling ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
              title={isRunning ? 'Stop monitoring' : 'Start monitoring'}
            >
              <Power size={20} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Memory Warning */}
        {status && status.currentMemory > 500 * 1024 * 1024 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              backgroundColor:
                status.currentMemory > 800 * 1024 * 1024
                  ? `${theme.colors.error}15`
                  : `${theme.colors.warning}15`,
              border: `1px solid ${
                status.currentMemory > 800 * 1024 * 1024
                  ? theme.colors.error
                  : theme.colors.warning
              }`,
              borderRadius: '8px',
              fontSize: '14px',
              color:
                status.currentMemory > 800 * 1024 * 1024
                  ? theme.colors.error
                  : theme.colors.warning,
            }}
          >
            <AlertCircle size={18} />
            <span>
              High memory usage detected ({formatBytes(status.currentMemory)}).
              {isRunning &&
                ' Consider stopping and restarting the monitoring process to free up memory.'}
            </span>
          </div>
        )}

        {/* Resource Metrics Section */}
        <section style={{ marginBottom: '32px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.textSecondary,
              marginBottom: '16px',
              fontFamily: theme.fonts.heading,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            RESOURCE USAGE
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: sidebarCollapsed ? '1fr 1fr' : '1fr 1fr',
              gap: '16px',
              marginBottom: '8px',
            }}
          >
            {/* Memory Card */}
            <div
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '12px',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <HardDrive size={16} style={{ color: theme.colors.info }} />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    MEMORY
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  marginBottom: '16px',
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.text,
                }}
              >
                {formatBytes(status.currentMemory)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Sparkline
                  data={status.history.map((h) => h.memory / 1024 / 1024)}
                  max={
                    Math.max(
                      ...status.history.map((h) => h.memory / 1024 / 1024),
                    ) * 1.1
                  }
                  color={theme.colors.info}
                />
              </div>
            </div>

            {/* CPU Card */}
            <div
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '12px',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Activity size={16} style={{ color: theme.colors.success }} />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    CPU
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  marginBottom: '16px',
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.text,
                }}
              >
                {status.currentCpu.toFixed(1)}%
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Sparkline
                  data={status.history.map((h) => h.cpu)}
                  max={100}
                  color={theme.colors.success}
                />
              </div>
            </div>
          </div>

          {/* History note */}
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              textAlign: 'center',
              marginTop: '8px',
              fontStyle: 'italic',
            }}
          >
            Showing last {status.history.length} data points (1 minute history)
          </div>
        </section>

        {/* Registered Repositories Section */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.textSecondary,
                margin: 0,
                fontFamily: theme.fonts.heading,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              REGISTERED DIRECTORIES ({status.repositories.length})
            </h3>

            {/* Add repository button */}
            {isRunning && (
              <button
                onClick={() => setShowAddRepo(!showAddRepo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  backgroundColor: theme.colors.background,
                  color: theme.colors.primary,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.background;
                }}
              >
                <Plus size={14} />
                Add Repository
              </button>
            )}
          </div>

          {/* Repository selector dropdown */}
          {showAddRepo && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.primary}`,
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  marginBottom: '8px',
                  color: theme.colors.textSecondary,
                }}
              >
                Select a repository to monitor:
              </div>
              <div
                style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {availableRepos
                  .filter(
                    (repo) =>
                      !status.repositories.some((r) => r.path === repo.path),
                  )
                  .map((repo) => (
                    <button
                      key={repo.path}
                      onClick={() => handleRegisterRepository(repo.path)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px',
                        marginBottom: '4px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        fontSize: '13px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                        e.currentTarget.style.borderColor =
                          theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.background;
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      <Plus size={14} style={{ color: theme.colors.success }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{repo.name}</div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            fontFamily: theme.fonts.monospace,
                          }}
                        >
                          {repo.path}
                        </div>
                      </div>
                    </button>
                  ))}
                {availableRepos.filter(
                  (repo) =>
                    !status.repositories.some((r) => r.path === repo.path),
                ).length === 0 && (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: theme.colors.textSecondary,
                      fontSize: '13px',
                    }}
                  >
                    All available repositories are already being monitored
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '12px',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            {status.repositories.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                No repositories currently being monitored
              </div>
            ) : (
              status.repositories.map((repo, index) => {
                const treeData = fileTreeData.get(repo.path);
                const gitStatus = gitStatusData.get(repo.path);
                const gitToggling = gitWatchingState.get(repo.path);
                const repoPackageData = packageData.get(repo.path);
                return (
                  <div
                    key={repo.path}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      borderBottom:
                        index < status.repositories.length - 1
                          ? `1px solid ${theme.colors.border}`
                          : 'none',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(0, 0, 0, 0.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <Folder
                          size={18}
                          style={{
                            marginRight: '12px',
                            color: theme.colors.primary,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontFamily: theme.fonts.monospace,
                              fontSize: '14px',
                              color: theme.colors.text,
                              wordBreak: 'break-all',
                            }}
                          >
                            {repo.path}
                          </div>
                          {treeData &&
                            !treeData.loading &&
                            (treeData.files > 0 ||
                              treeData.directories > 0) && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: theme.colors.textSecondary,
                                  marginTop: '4px',
                                }}
                              >
                                📁 {treeData.directories.toLocaleString()}{' '}
                                directories, 📄{' '}
                                {treeData.files.toLocaleString()} files
                              </div>
                            )}
                          {gitStatus && (
                            <div
                              style={{
                                fontSize: '12px',
                                color: gitStatus.isDirty
                                  ? theme.colors.warning
                                  : theme.colors.textSecondary,
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <GitBranch size={12} />
                              <span>{gitStatus.branch}</span>
                              {gitStatus.isDirty && (
                                <span style={{ color: theme.colors.warning }}>
                                  ●
                                </span>
                              )}
                              {gitStatus.ahead > 0 && (
                                <span>↑{gitStatus.ahead}</span>
                              )}
                              {gitStatus.behind > 0 && (
                                <span>↓{gitStatus.behind}</span>
                              )}
                              {repo.gitWatchingEnabled && (
                                <span
                                  style={{
                                    color: theme.colors.success,
                                    fontSize: '10px',
                                  }}
                                >
                                  {repo.watchingMode === 'minimal' &&
                                  repo.fsMonitorEnabled
                                    ? 'WATCHING (FSMonitor)'
                                    : repo.watchingMode === 'fallback'
                                      ? 'WATCHING (Fallback)'
                                      : 'WATCHING'}
                                </span>
                              )}
                            </div>
                          )}
                          {repoPackageData &&
                            !repoPackageData.loading &&
                            (repoPackageData.packages ?? 0) > 0 && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: theme.colors.textSecondary,
                                  marginTop: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}
                              >
                                <span>📦</span>
                                <span>{repoPackageData.packages} packages</span>
                                {repoPackageData.monorepo && (
                                  <span
                                    style={{
                                      color: theme.colors.info,
                                      backgroundColor: `${theme.colors.info}15`,
                                      padding: '2px 6px',
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                    }}
                                  >
                                    MONOREPO
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      {isRunning && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                          }}
                        >
                          {/* Get Git Status button */}
                          <button
                            onClick={() => {
                              fetchGitStatus(repo.path);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: '4px',
                              backgroundColor: theme.colors.background,
                              color: theme.colors.primary,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`;
                              e.currentTarget.style.borderColor =
                                theme.colors.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.background;
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                            }}
                            title="Get git status"
                          >
                            <GitBranch size={14} />
                            Status
                          </button>

                          {/* Toggle Git Watching button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggleGitWatching(repo.path);
                            }}
                            disabled={!!gitToggling}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: '4px',
                              backgroundColor: theme.colors.background,
                              color: gitStatus?.watchingEnabled
                                ? theme.colors.success
                                : theme.colors.textSecondary,
                              cursor: gitToggling ? 'not-allowed' : 'pointer',
                              opacity: gitToggling ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!gitToggling) {
                                e.currentTarget.style.backgroundColor =
                                  gitStatus?.watchingEnabled
                                    ? `${theme.colors.error}10`
                                    : `${theme.colors.success}10`;
                                e.currentTarget.style.borderColor =
                                  gitStatus?.watchingEnabled
                                    ? theme.colors.error
                                    : theme.colors.success;
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.background;
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                            }}
                            title={
                              gitStatus?.watchingEnabled
                                ? 'Disable git watching'
                                : 'Enable git watching'
                            }
                          >
                            {gitStatus?.watchingEnabled ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                            {gitToggling === 'enabling'
                              ? 'Enabling...'
                              : gitToggling === 'disabling'
                                ? 'Disabling...'
                                : gitStatus?.watchingEnabled
                                  ? 'Watching'
                                  : 'Watch'}
                          </button>

                          {/* Build FileTree button */}
                          <button
                            onClick={() => handleBuildFileTree(repo.path)}
                            disabled={treeData?.loading}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: '4px',
                              backgroundColor: theme.colors.background,
                              color: treeData?.loading
                                ? theme.colors.textSecondary
                                : theme.colors.info,
                              cursor: treeData?.loading
                                ? 'not-allowed'
                                : 'pointer',
                              opacity: treeData?.loading ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!treeData?.loading) {
                                e.currentTarget.style.backgroundColor = `${theme.colors.info}10`;
                                e.currentTarget.style.borderColor =
                                  theme.colors.info;
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.background;
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                            }}
                            title="Build FileTree to see memory impact"
                          >
                            <FileSearch size={14} />
                            {treeData?.loading ? 'Building...' : 'Build Tree'}
                          </button>

                          {/* Get Packages button */}
                          <button
                            onClick={() => fetchPackages(repo.path)}
                            disabled={repoPackageData?.loading}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: '4px',
                              backgroundColor: theme.colors.background,
                              color: repoPackageData?.loading
                                ? theme.colors.textSecondary
                                : theme.colors.success,
                              cursor: repoPackageData?.loading
                                ? 'not-allowed'
                                : 'pointer',
                              opacity: repoPackageData?.loading ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!repoPackageData?.loading) {
                                e.currentTarget.style.backgroundColor = `${theme.colors.success}10`;
                                e.currentTarget.style.borderColor =
                                  theme.colors.success;
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.background;
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                            }}
                            title="Extract package information"
                          >
                            📦
                            {repoPackageData?.loading
                              ? 'Loading...'
                              : 'Get Packages'}
                          </button>

                          {/* Remove button */}
                          <button
                            onClick={() =>
                              handleUnregisterRepository(repo.path)
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              border: 'none',
                              borderRadius: '4px',
                              backgroundColor: 'transparent',
                              color: theme.colors.textSecondary,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = `${theme.colors.error}15`;
                              e.currentTarget.style.color = theme.colors.error;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                              e.currentTarget.style.color =
                                theme.colors.textSecondary;
                            }}
                            title="Remove from monitoring"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

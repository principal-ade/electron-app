import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Layers,
  GitFork,
  GitBranch,
  Github,
  Code2,
  ArrowUp,
  ArrowDown,
  GitMerge,
  RefreshCw,
  HardDrive,
  Cloud,
} from 'lucide-react';
import type { Repository } from '../../../shared/types/repository.types';
import type { GitBranchStatus } from '../../main-process-api/GitService';
import { GitService } from '../../main-process-api/GitService';

type HookComparisonStatus = {
  ahead: number;
  behind: number;
  canFastForward?: boolean;
};

type ComparisonTuple = [
  leftLabel: string,
  leftName: string,
  leftIcon: React.ReactNode,
  leftColor: string,
  rightLabel: string,
  rightName: string,
  rightIcon: React.ReactNode,
  rightColor: string,
  status: HookComparisonStatus | null,
  title: string,
  description?: string,
  onSync?: () => void | Promise<void>,
  syncLabel?: string,
];

interface BadgeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: Repository;
  selectedClonePath?: string;
  cloneBranchStatuses: Record<string, GitBranchStatus>;
  setCloneBranchStatuses: React.Dispatch<
    React.SetStateAction<Record<string, GitBranchStatus>>
  >;
}

export const BadgeInfoModal: React.FC<BadgeInfoModalProps> = ({
  isOpen,
  onClose,
  repository,
  selectedClonePath,
  cloneBranchStatuses,
  setCloneBranchStatuses,
}) => {
  const { theme } = useTheme();
  const [isSyncingFork, setIsSyncingFork] = React.useState(false);

  if (!isOpen) return null;

  // Helper function to render a vertical comparison card
  const renderVerticalComparison = (
    leftLabel: string,
    leftName: string,
    leftIcon: React.ReactNode,
    leftColor: string,
    rightLabel: string,
    rightName: string,
    rightIcon: React.ReactNode,
    rightColor: string,
    status: { ahead: number; behind: number; canFastForward?: boolean } | null,
    title: string,
    description?: string,
    onSync?: () => void,
    syncLabel?: string,
    isLast?: boolean,
  ) => (
    <div
      style={{
        flex: '1 1 0',
        minWidth: '160px',
        marginRight: isLast ? '0' : '12px',
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '8px',
          padding: '12px',
          border: `1px solid ${theme.colors.border}`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: '10px',
              color: theme.colors.textSecondary,
              marginBottom: '8px',
              opacity: 0.8,
              textAlign: 'center',
            }}
          >
            {description}
          </div>
        )}

        {/* Vertical comparison */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '8px',
            flex: 1,
          }}
        >
          {/* Top side (source) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 8px',
              backgroundColor: theme.colors.background,
              borderRadius: '6px',
              border: `1px solid ${leftColor}30`,
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: `${leftColor}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {leftIcon}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{ fontSize: '10px', color: theme.colors.textSecondary }}
              >
                {leftLabel}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginTop: '2px',
                }}
              >
                {leftName}
              </div>
            </div>
          </div>

          {/* Status arrow/indicator */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              minHeight: '60px',
              position: 'relative',
            }}
          >
            {/* Vertical connector line */}
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                bottom: '-8px',
                width: '2px',
                backgroundColor: theme.colors.border,
                opacity: 0.3,
                zIndex: 0,
              }}
            />

            {status ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  alignItems: 'center',
                  zIndex: 1,
                  backgroundColor: theme.colors.backgroundTertiary,
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                {status.behind > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      backgroundColor: '#ffc10715',
                      border: '1px solid #ffc10740',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: '#ffc107',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <ArrowDown size={10} />
                    {status.behind} behind
                  </div>
                )}
                {status.ahead > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      backgroundColor: `${theme.colors.success || '#4caf50'}15`,
                      border: `1px solid ${theme.colors.success || '#4caf50'}40`,
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: theme.colors.success || '#4caf50',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <ArrowUp size={10} />
                    {status.ahead} ahead
                  </div>
                )}
                {status.ahead === 0 && status.behind === 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      backgroundColor: '#10b98115',
                      border: '1px solid #10b98140',
                      borderRadius: '4px',
                      fontSize: '10px',
                      color: '#10b981',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✓ In sync
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  zIndex: 1,
                  backgroundColor: theme.colors.backgroundTertiary,
                  padding: '4px',
                  borderRadius: '50%',
                }}
              >
                <ArrowDown size={16} color={theme.colors.textSecondary} />
              </div>
            )}
          </div>

          {/* Bottom side (target) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 8px',
              backgroundColor: theme.colors.background,
              borderRadius: '6px',
              border: `1px solid ${rightColor}30`,
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: `${rightColor}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {rightIcon}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{ fontSize: '10px', color: theme.colors.textSecondary }}
              >
                {rightLabel}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginTop: '2px',
                }}
              >
                {rightName}
              </div>
            </div>
          </div>
        </div>

        {/* Sync button if applicable */}
        {onSync &&
          status &&
          (status.behind > 0 ||
            (status.canFastForward && status.ahead === 0)) && (
            <button
              onClick={onSync}
              disabled={isSyncingFork}
              style={{
                marginTop: '8px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: status.canFastForward
                  ? theme.colors.success || '#4caf50'
                  : '#ffc107',
                color: 'white',
                border: 'none',
                fontSize: '11px',
                fontWeight: 500,
                cursor: isSyncingFork ? 'not-allowed' : 'pointer',
                opacity: isSyncingFork ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {isSyncingFork ? (
                <>
                  <RefreshCw
                    size={12}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                  Syncing...
                </>
              ) : (
                <>
                  {status.canFastForward ? (
                    <GitMerge size={12} />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {syncLabel ||
                    (status.canFastForward ? 'Fast-forward' : 'Sync')}
                </>
              )}
            </button>
          )}
      </div>
    </div>
  );

  // Helper function to render the standard fork comparison diagram
  const _renderForkComparisonDiagram = (
    currentBranch: string,
    forkDefault: string,
    upstreamDefault: string,
    isOnDefaultBranch: boolean,
  ) => (
    <>
      {/* Upstream Repository */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#f59e0b20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Github size={20} color="#f59e0b" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
            Upstream
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {repository.metadata?.parentRepo?.owner}/
            {repository.metadata?.parentRepo?.name}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px',
              padding: '2px 6px',
              backgroundColor: '#f59e0b10',
              border: '1px solid #f59e0b20',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#f59e0b',
            }}
          >
            <GitBranch size={10} />
            {upstreamDefault} (default)
          </div>
        </div>
      </div>

      {/* Visual Connection with Status */}
      {selectedClonePath && cloneBranchStatuses[selectedClonePath] && (
        <div
          style={{
            position: 'relative',
            marginLeft: '20px',
            paddingLeft: '20px',
            borderLeft: '2px solid #f59e0b40',
            minHeight: '80px',
            marginBottom: '20px',
          }}
        >
          {/* Behind indicator */}
          {cloneBranchStatuses[selectedClonePath].behind > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '-8px',
                top: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: '#ffc107',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowDown size={8} color="white" />
              </div>
              <div
                style={{
                  backgroundColor: '#ffc10715',
                  border: '1px solid #ffc10740',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  color: '#ffc107',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {cloneBranchStatuses[selectedClonePath].behind} commits behind
              </div>
            </div>
          )}

          {/* Ahead indicator */}
          {cloneBranchStatuses[selectedClonePath].ahead > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '-8px',
                top:
                  cloneBranchStatuses[selectedClonePath].behind > 0
                    ? '40px'
                    : '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.success || '#4caf50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowUp size={8} color="white" />
              </div>
              <div
                style={{
                  backgroundColor: `${theme.colors.success || '#4caf50'}15`,
                  border: `1px solid ${theme.colors.success || '#4caf50'}40`,
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  color: theme.colors.success || '#4caf50',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {cloneBranchStatuses[selectedClonePath].ahead} commits ahead
              </div>
            </div>
          )}

          {/* Up to date indicator */}
          {cloneBranchStatuses[selectedClonePath].ahead === 0 &&
            cloneBranchStatuses[selectedClonePath].behind === 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: '-8px',
                  top: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    backgroundColor: '#10b98115',
                    border: '1px solid #10b98140',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    color: '#10b981',
                    fontWeight: 600,
                  }}
                >
                  Up to date
                </div>
              </div>
            )}
        </div>
      )}

      {/* Your Fork */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: theme.colors.primary + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GitFork size={20} color={theme.colors.primary} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
            Your Fork
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {repository.owner}/{repository.name}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px',
              padding: '2px 6px',
              backgroundColor: theme.colors.primary + '10',
              border: `1px solid ${theme.colors.primary}20`,
              borderRadius: '4px',
              fontSize: '11px',
              color: theme.colors.primary,
            }}
          >
            <GitBranch size={10} />
            {isOnDefaultBranch ? currentBranch : forkDefault} (default)
          </div>
        </div>
      </div>
    </>
  );

  const currentBranch = selectedClonePath
    ? cloneBranchStatuses[selectedClonePath]?.branch || 'main'
    : 'main';
  const forkDefault = repository.metadata?.defaultBranch || 'main';
  const upstreamDefault = forkDefault; // Upstream typically uses same default branch name
  const isOnDefaultBranch = currentBranch === forkDefault;

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
        zIndex: 3000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: theme.shadows?.[1] || '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {repository.metadata?.isFork ? (
            <GitFork size={20} color="#f59e0b" />
          ) : (
            <Layers size={20} color={theme.colors.primary} />
          )}
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {repository.metadata?.isFork
              ? 'Fork Information & Badges'
              : 'Repository Badge System'}
          </h3>
        </div>

        <div
          style={{
            fontSize: '14px',
            lineHeight: '1.5',
            color: theme.colors.textSecondary,
            marginBottom: '20px',
          }}
        >
          {/* Fork-specific information */}
          {repository.metadata?.isFork && repository.metadata?.parentRepo && (
            <>
              <div
                style={{
                  backgroundColor: '#f59e0b10',
                  border: '1px solid #f59e0b30',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <p style={{ margin: '0 0 12px 0' }}>
                  <strong style={{ color: '#f59e0b', fontSize: '15px' }}>
                    Fork Relationship
                  </strong>
                </p>

                {/* Branch Comparisons */}
                {selectedClonePath &&
                  cloneBranchStatuses[selectedClonePath] &&
                  (() => {
                    const branchStatus = cloneBranchStatuses[selectedClonePath];

                    // Determine what comparisons to show
                    const comparisons: ComparisonTuple[] = [];

                    // 1. Local vs Remote (current branch)
                    if (branchStatus.hasUpstream) {
                      comparisons.push([
                        'Local',
                        `${currentBranch}${branchStatus.hasUncommittedChanges ? ' ●' : ''}`,
                        <HardDrive
                          key="local-icon"
                          size={16}
                          color={theme.colors.primary}
                        />,
                        theme.colors.primary,
                        'Remote',
                        `origin/${currentBranch}`,
                        <Cloud
                          key="remote-icon"
                          size={16}
                          color={theme.colors.primary}
                        />,
                        theme.colors.primary,
                        {
                          ahead: branchStatus.ahead,
                          behind: branchStatus.behind,
                          canFastForward:
                            branchStatus.behind > 0 && branchStatus.ahead === 0,
                        },
                        'Local ↔ Remote',
                        'Your local branch compared to its remote tracking branch',
                        async () => {
                          if (
                            branchStatus.behind > 0 &&
                            branchStatus.ahead === 0
                          ) {
                            // Can fast-forward
                            setIsSyncingFork(true);
                            try {
                              await GitService.fastForwardMerge(
                                selectedClonePath,
                              );
                              const newStatus =
                                await GitService.getBranchStatus(
                                  selectedClonePath,
                                );
                              setCloneBranchStatuses((prev) => ({
                                ...prev,
                                [selectedClonePath]: newStatus,
                              }));
                            } catch (error) {
                              console.error('Fast-forward failed:', error);
                              alert('Failed to fast-forward merge');
                            } finally {
                              setIsSyncingFork(false);
                            }
                          } else if (branchStatus.behind > 0) {
                            alert(
                              'Cannot fast-forward: Your branch has diverged from remote. Manual merge required.',
                            );
                          }
                        },
                        branchStatus.behind > 0 && branchStatus.ahead === 0
                          ? 'Pull (Fast-forward)'
                          : 'Pull',
                      ]);
                    }

                    // 2. Feature branch vs Fork default (if not on default)
                    if (!isOnDefaultBranch) {
                      comparisons.push([
                        'Feature Branch',
                        currentBranch,
                        <Code2
                          key="feature-icon"
                          size={16}
                          color={theme.colors.primary}
                        />,
                        theme.colors.primary,
                        'Base Branch',
                        forkDefault,
                        <GitBranch
                          key="base-icon"
                          size={16}
                          color={theme.colors.text}
                        />,
                        theme.colors.text,
                        null, // We'd need to fetch this comparison
                        'Feature → Base',
                        'Your feature branch compared to the repository default branch',
                      ]);
                    }

                    // 3. Fork default vs Upstream default (if it's a fork)
                    if (repository.metadata?.parentRepo) {
                      comparisons.push([
                        'Fork',
                        `${repository.owner}/${forkDefault}`,
                        <GitFork
                          key="fork-icon"
                          size={16}
                          color={theme.colors.primary}
                        />,
                        theme.colors.primary,
                        'Upstream',
                        `${repository.metadata.parentRepo.owner}/${upstreamDefault}`,
                        <Github
                          key="upstream-icon"
                          size={16}
                          color="#f59e0b"
                        />,
                        '#f59e0b',
                        isOnDefaultBranch
                          ? {
                              ahead: branchStatus.ahead,
                              behind: branchStatus.behind,
                              canFastForward:
                                branchStatus.behind > 0 &&
                                branchStatus.ahead === 0,
                            }
                          : null, // Only show status if we're on default branch
                        'Fork ↔ Upstream',
                        "Your fork's default branch compared to the upstream repository",
                        isOnDefaultBranch && branchStatus.behind > 0
                          ? async () => {
                              setIsSyncingFork(true);
                              try {
                                await GitService.fetchUpstream(
                                  selectedClonePath,
                                );
                                const status =
                                  await GitService.getBranchStatus(
                                    selectedClonePath,
                                  );
                                if (status.canFastForward) {
                                  await GitService.fastForwardMerge(
                                    selectedClonePath,
                                  );
                                  alert(
                                    'Successfully synchronized with upstream!',
                                  );
                                } else {
                                  alert(
                                    'Cannot fast-forward. Manual merge may be required.',
                                  );
                                }
                                const newStatus =
                                  await GitService.getBranchStatus(
                                    selectedClonePath,
                                  );
                                setCloneBranchStatuses((prev) => ({
                                  ...prev,
                                  [selectedClonePath]: newStatus,
                                }));
                              } catch (error) {
                                console.error('Sync failed:', error);
                                alert(
                                  'Failed to sync with upstream. Please check your git configuration.',
                                );
                              } finally {
                                setIsSyncingFork(false);
                              }
                            }
                          : undefined,
                        'Sync with Upstream',
                      ]);
                    }

                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          justifyContent: 'center',
                          alignItems: 'stretch',
                          width: '100%',
                          overflowX: 'auto',
                          padding: '12px 0',
                        }}
                      >
                        {comparisons.length > 0 ? (
                          comparisons.map((args, index) => {
                            const isLast = index === comparisons.length - 1;
                            const [
                              leftLabel,
                              leftName,
                              leftIcon,
                              leftColor,
                              rightLabel,
                              rightName,
                              rightIcon,
                              rightColor,
                              status,
                              title,
                              description,
                              onSync,
                              syncLabel,
                            ] = args;
                            return (
                              <React.Fragment
                                key={`comparison-${leftLabel}-${rightLabel}-${index}`}
                              >
                                {renderVerticalComparison(
                                  leftLabel,
                                  leftName,
                                  leftIcon,
                                  leftColor,
                                  rightLabel,
                                  rightName,
                                  rightIcon,
                                  rightColor,
                                  status,
                                  title,
                                  description,
                                  onSync,
                                  syncLabel,
                                  isLast,
                                )}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <div
                            style={{
                              padding: '20px',
                              textAlign: 'center',
                              color: theme.colors.textSecondary,
                              fontSize: '13px',
                              width: '100%',
                            }}
                          >
                            No branch comparisons available
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* View Upstream Button - always available for forks */}
                {repository.metadata?.parentRepo && (
                  <button
                    onClick={() => {
                      window.open(
                        repository.metadata?.parentRepo?.url,
                        '_blank',
                      );
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      marginTop: '12px',
                      width: '100%',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    <Github size={14} />
                    View Upstream on GitHub
                  </button>
                )}

                <p
                  style={{
                    margin: '12px 0 0 0',
                    fontSize: '12px',
                    fontStyle: 'italic',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Tip: Regular syncing helps avoid merge conflicts and keeps
                  your fork up to date with the latest changes.
                </p>
              </div>

              {/* Add animation styles */}
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </>
          )}

          {/* General badge information */}
          <p style={{ margin: '0 0 12px 0' }}>
            <strong style={{ color: theme.colors.text }}>
              Local Clone Badges
            </strong>{' '}
            - Click these to switch between your local clones. The selected
            clone's file tree and agent sessions will be shown in the
            development workspace below.
          </p>
          <p style={{ margin: '0 0 12px 0' }}>
            <strong style={{ color: theme.colors.text }}>
              Remote Branch Badges
            </strong>{' '}
            - Shows the default branch of the remote repository. These badges
            help you track which branch you're working with.
          </p>
          <p style={{ margin: '0' }}>
            Badge colors indicate sync status:{' '}
            <span style={{ color: '#ffc107' }}>yellow (behind)</span>,{' '}
            <span style={{ color: '#ff9800' }}>orange (diverged)</span>,{' '}
            <span style={{ color: theme.colors.success || '#4caf50' }}>
              green (ahead)
            </span>
            .
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

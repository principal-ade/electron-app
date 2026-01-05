/**
 * PullMailbox - Titlebar button with dropdown for webhook notifications
 *
 * Shows all webhook notifications and pending pulls that couldn't be auto-pulled.
 * - All webhook events are displayed as notifications
 * - Push events that need manual pull show a "Pull Now" button
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  GitPullRequest,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Inbox,
  Trash2,
  GitBranch,
  Tag,
  CircleDot,
  Zap,
  Package,
  ExternalLink,
  Bell,
} from 'lucide-react';
import { FastForwardService } from '../../../main-process-api/FastForwardService';
import type {
  PendingPull,
  WebhookNotification,
} from '../../../../shared/main-process-api-interfaces/FastForwardAPI';

export const PullMailbox: React.FC = () => {
  const { theme, mode } = useTheme();
  const [notifications, setNotifications] = useState<WebhookNotification[]>([]);
  const [pendingPulls, setPendingPulls] = useState<PendingPull[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const textColor = mode === 'dark' ? theme.colors.text : theme.colors.text;
  const textSecondary = theme.colors.textSecondary;
  const borderColor =
    mode === 'dark' && theme.modes?.dark?.border
      ? theme.modes.dark.border
      : theme.colors.border;
  const bgColor =
    mode === 'dark' && theme.modes?.dark?.background
      ? theme.modes.dark.background
      : theme.colors.background;

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [notifs, pulls] = await Promise.all([
        FastForwardService.getWebhookNotifications(),
        FastForwardService.getPendingPulls(),
      ]);
      setNotifications(notifs);
      setPendingPulls(pulls);
    } catch (error) {
      console.error('[PullMailbox] Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to events
  useEffect(() => {
    const unsubNotification = FastForwardService.onWebhookNotification(
      (notification) => {
        setNotifications((prev) => [notification, ...prev.slice(0, 99)]);
      },
    );

    const unsubPending = FastForwardService.onPendingPull((pull) => {
      setPendingPulls((prev) => {
        const existing = prev.findIndex(
          (p) => p.repoPath === pull.repoPath && p.branch === pull.branch,
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = pull;
          return updated;
        }
        return [pull, ...prev];
      });
    });

    const unsubComplete = FastForwardService.onPullComplete((result) => {
      setPendingPulls((prev) =>
        prev.filter(
          (p) => p.repoPath !== result.repoPath || p.branch !== result.branch,
        ),
      );
    });

    return () => {
      unsubNotification();
      unsubPending();
      unsubComplete();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePullNow = async (id: string) => {
    setIsPulling(id);
    try {
      const result = await FastForwardService.pullNow(id);
      if (!result.success) {
        console.error('[PullMailbox] Pull failed:', result.error);
      }
    } catch (error) {
      console.error('[PullMailbox] Pull error:', error);
    } finally {
      setIsPulling(null);
    }
  };

  const handleDismissNotification = async (id: string) => {
    await FastForwardService.dismissNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAll = async () => {
    // Dismiss all notifications
    for (const n of notifications) {
      await FastForwardService.dismissNotification(n.id);
    }
    setNotifications([]);
    // Also dismiss pending pulls
    await FastForwardService.dismissAll();
    setPendingPulls([]);
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'push':
        return <GitPullRequest size={14} color={theme.colors.primary} />;
      case 'pull_request':
        return <GitPullRequest size={14} color={theme.colors.secondary || '#8b5cf6'} />;
      case 'issues':
        return <CircleDot size={14} color={theme.colors.success || '#22c55e'} />;
      case 'create':
        return <GitBranch size={14} color={theme.colors.success || '#22c55e'} />;
      case 'delete':
        return <GitBranch size={14} color={theme.colors.error || '#ef4444'} />;
      case 'release':
        return <Tag size={14} color={theme.colors.warning || '#f59e0b'} />;
      case 'workflow_run':
      case 'check_run':
      case 'check_suite':
        return <Zap size={14} color={theme.colors.primary} />;
      case 'installation':
      case 'installation_repositories':
        return <Package size={14} color={theme.colors.secondary || '#8b5cf6'} />;
      default:
        return <Bell size={14} color={textSecondary} />;
    }
  };

  const getReasonIcon = (reason: PendingPull['reason']) => {
    switch (reason) {
      case 'dirty':
        return <AlertTriangle size={12} color={theme.colors.warning || '#f59e0b'} />;
      case 'ahead':
        return <GitPullRequest size={12} color={theme.colors.primary} />;
      case 'fetch_failed':
        return <XCircle size={12} color={theme.colors.error || '#ef4444'} />;
      default:
        return <AlertTriangle size={12} color={textSecondary} />;
    }
  };

  const getReasonLabel = (reason: PendingPull['reason']) => {
    switch (reason) {
      case 'dirty':
        return 'Uncommitted changes';
      case 'ahead':
        return 'Local commits ahead';
      case 'fetch_failed':
        return 'Fetch failed';
      case 'different_branch':
        return 'Different branch';
      default:
        return 'Cannot auto-pull';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get pending pull for a notification (if it exists)
  const getPendingPullForNotification = (
    notification: WebhookNotification,
  ): PendingPull | undefined => {
    if (notification.pendingPullId) {
      return pendingPulls.find((p) => p.id === notification.pendingPullId);
    }
    return undefined;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingCount = pendingPulls.length;
  const totalCount = unreadCount + pendingCount;

  return (
    <div style={{ position: 'relative' }}>
      {/* Titlebar Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          background: isOpen ? theme.colors.border : 'transparent',
          color: totalCount > 0 ? theme.colors.primary : textSecondary,
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = theme.colors.border;
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
        title="Webhook notifications"
      >
        <Inbox size={18} />
        {/* Badge */}
        {totalCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              background:
                pendingCount > 0
                  ? theme.colors.warning || '#f59e0b'
                  : theme.colors.primary,
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            width: '360px',
            maxHeight: '480px',
            borderRadius: '10px',
            border: `1px solid ${borderColor}`,
            background: bgColor,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: `1px solid ${borderColor}`,
              background:
                mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.03)'
                  : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{ fontWeight: 600, fontSize: '12px', color: textColor }}
              >
                Webhook Events
              </span>
              {totalCount > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    background: theme.colors.primary,
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {totalCount}
                </span>
              )}
            </div>
            {(notifications.length > 0 || pendingPulls.length > 0) && (
              <button
                onClick={handleClearAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: textSecondary,
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
                title="Clear all"
              >
                <Trash2 size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '8px',
            }}
          >
            {/* Pending pulls section (needs action) */}
            {pendingPulls.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: theme.colors.warning || '#f59e0b',
                    marginBottom: '6px',
                    paddingLeft: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertTriangle size={10} />
                  Needs Action
                </div>
                {pendingPulls.map((pull) => (
                  <div
                    key={pull.id}
                    style={{
                      padding: '10px',
                      marginBottom: '6px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.colors.warning || '#f59e0b'}33`,
                      background:
                        mode === 'dark'
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'rgba(245, 158, 11, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: textColor,
                            marginBottom: '2px',
                          }}
                        >
                          {pull.repoFullName}
                        </div>
                        <div style={{ fontSize: '10px', color: textSecondary }}>
                          {pull.branch} · {formatTime(pull.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px',
                      }}
                    >
                      {getReasonIcon(pull.reason)}
                      <span style={{ fontSize: '10px', color: textSecondary }}>
                        {getReasonLabel(pull.reason)}
                      </span>
                    </div>

                    <button
                      onClick={() => handlePullNow(pull.id)}
                      disabled={isPulling === pull.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: theme.colors.primary,
                        color: '#fff',
                        cursor: isPulling === pull.id ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 500,
                        opacity: isPulling === pull.id ? 0.7 : 1,
                      }}
                    >
                      {isPulling === pull.id ? (
                        <>
                          <RefreshCw
                            size={12}
                            style={{ animation: 'spin 1s linear infinite' }}
                          />
                          Pulling...
                        </>
                      ) : (
                        <>
                          <GitPullRequest size={12} />
                          Pull Now
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* All notifications */}
            {notifications.length > 0 && (
              <div>
                {pendingPulls.length > 0 && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: textSecondary,
                      marginBottom: '6px',
                      paddingLeft: '4px',
                    }}
                  >
                    Recent Events
                  </div>
                )}
                {notifications.map((notification) => {
                  const pendingPull = getPendingPullForNotification(notification);
                  const hasPendingPull = !!pendingPull;

                  return (
                    <div
                      key={notification.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 10px',
                        marginBottom: '4px',
                        borderRadius: '6px',
                        background: notification.read
                          ? 'transparent'
                          : mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.02)',
                        border: `1px solid ${notification.read ? 'transparent' : borderColor}`,
                        opacity: hasPendingPull ? 0.6 : 1,
                      }}
                    >
                      {/* Icon */}
                      <div style={{ paddingTop: '2px' }}>
                        {getEventIcon(notification.event)}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: notification.read ? 400 : 600,
                            color: textColor,
                            marginBottom: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {notification.title}
                          </span>
                          {hasPendingPull && (
                            <span
                              style={{
                                fontSize: '9px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: theme.colors.warning || '#f59e0b',
                                color: '#fff',
                                fontWeight: 600,
                              }}
                            >
                              ACTION
                            </span>
                          )}
                        </div>
                        {notification.description && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: textSecondary,
                              marginBottom: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {notification.description}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: '10px',
                            color: textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{notification.repository}</span>
                          <span>·</span>
                          <span>{formatTime(notification.timestamp)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {notification.url && (
                          <button
                            onClick={() => window.open(notification.url, '_blank')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px',
                              borderRadius: '4px',
                              border: 'none',
                              background: 'transparent',
                              color: textSecondary,
                              cursor: 'pointer',
                            }}
                            title="Open on GitHub"
                          >
                            <ExternalLink size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDismissNotification(notification.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: textSecondary,
                            cursor: 'pointer',
                          }}
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {notifications.length === 0 && pendingPulls.length === 0 && (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: textSecondary,
                  fontSize: '12px',
                }}
              >
                <Inbox
                  size={28}
                  style={{ marginBottom: '10px', opacity: 0.4 }}
                />
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                  No notifications
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                  Webhook events will appear here
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

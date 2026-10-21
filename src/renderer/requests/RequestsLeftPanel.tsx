import React, { useMemo, useState } from 'react';
import { Pin, RefreshCw, Search, Send, Trash2, X } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { RequestGroupList } from './RequestGroupList';
import { buildRequestGroups } from './requestGroups';
import { savedDefinition } from './requestTabs';
import {
  requestDefinition,
  type SavedRequest,
} from '../../shared/requests/preparedRequest';

function routeSummary(request: SavedRequest['request']): string {
  let endpoint = 'URL template';
  try {
    const url = new URL(request.http.url);
    // Never put URL credentials, query values, headers, or environment values
    // into the catalog preview.
    endpoint = url.origin + url.pathname;
  } catch {
    // Unresolved URLs remain editable in the request tab.
  }
  return `${request.http.method.toUpperCase()} ${endpoint}`;
}

/** A workspace sidebar, not a separate owner of request tabs or the catalog. */
export const RequestsLeftPanel: React.FC = () => {
  const { theme } = useTheme();
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    openHttpRequest,
    catalogRequests,
    forgetRequest,
    saveRequest,
    unpinRequest,
    requestPinBusy,
    requestPinError,
    refreshSavedRequests,
  } = useWorkspaceTabs();
  const [filterText, setFilterText] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const groups = useMemo(
    () => buildRequestGroups(tabs, catalogRequests),
    [tabs, catalogRequests],
  );
  const catalogById = useMemo(
    () => new Map(catalogRequests.map((request) => [request.id, request])),
    [catalogRequests],
  );
  const tabsById = useMemo(
    () => new Map(tabs.map((tab) => [tab.id, tab])),
    [tabs],
  );
  const visibleGroups = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        identifiers: group.identifiers
          .map((identifier) => ({
            ...identifier,
            requests: identifier.requests.filter((request) => {
              const tab = tabsById.get(request.id);
              const definition =
                tab?.contentType === 'http-request'
                  ? tab.panelState.request
                  : catalogById.get(request.savedRequestId)?.request;
              return [
                request.label,
                group.purl ?? 'Ungrouped',
                identifier.identifier,
                definition && routeSummary(definition),
              ].some((text) => text?.toLowerCase().includes(query));
            }),
          }))
          .filter((identifier) => identifier.requests.length > 0),
      }))
      .filter((group) => group.identifiers.length > 0);
  }, [filterText, groups, tabsById, catalogById]);

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };
  const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  };
  const refreshDisabled = refreshing || requestPinBusy;
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshSavedRequests();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: theme.colors.text,
        backgroundColor: theme.colors.background,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          height: 40,
          boxSizing: 'border-box',
          padding: `0 ${spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <Send size={16} color={theme.colors.text} style={{ marginLeft: 4 }} />
        <span
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Requests
        </span>
        <button
          type="button"
          title="Refresh"
          aria-label="Refresh requests"
          disabled={refreshDisabled}
          onClick={() => void refresh()}
          style={{
            ...iconButtonStyle,
            cursor: refreshDisabled ? 'default' : 'pointer',
          }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: refreshing ? 'spin 0.8s linear infinite' : undefined,
            }}
          />
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          height: 30,
          boxSizing: 'border-box',
          padding: `0 ${spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        <Search size={14} color={theme.colors.textSecondary} />
        <input
          type="text"
          placeholder="Filter requests"
          aria-label="Filter requests"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
          }}
        />
        {filterText && (
          <button
            type="button"
            title="Clear filter"
            aria-label="Clear filter"
            onClick={() => setFilterText('')}
            style={{ ...iconButtonStyle, padding: 0 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {requestPinError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
            backgroundColor: theme.colors.error + '20',
            borderBottom: `1px solid ${theme.colors.error}`,
            color: theme.colors.error,
            fontSize: theme.fontSizes[1],
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            {requestPinError}
          </span>
          <button
            type="button"
            disabled={refreshDisabled}
            onClick={() => void refresh()}
            style={{
              ...iconButtonStyle,
              font: 'inherit',
              color: theme.colors.error,
              cursor: refreshDisabled ? 'default' : 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div
        aria-busy={refreshing}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {visibleGroups.length === 0 ? (
          <div
            style={{
              padding: `${spacing.sm * 3}px ${spacing.sm * 2}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              textAlign: 'center',
            }}
          >
            {groups.length === 0
              ? 'No remembered requests. Prepare a request to see it here.'
              : 'No requests match this filter.'}
          </div>
        ) : (
          <RequestGroupList
            groups={visibleGroups}
            variant="sidebar"
            renderRequest={(request) => {
              const remembered = catalogById.get(request.savedRequestId);
              const pinned = remembered?.pinned ?? false;
              const tab = tabsById.get(request.id);
              const definition =
                tab?.contentType === 'http-request'
                  ? tab.panelState.request
                  : remembered?.request;
              const summary = definition ? routeSummary(definition) : undefined;
              const status = request.open
                ? 'Open'
                : pinned
                  ? 'Pinned'
                  : 'Remembered';
              const active = request.open && request.id === activeTabId;
              return (
                <div
                  key={request.id}
                  onMouseEnter={() => setHoveredId(request.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setFocusedId(request.id)}
                  onBlur={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    )
                      setFocusedId(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
                    backgroundColor:
                      active ||
                      hoveredId === request.id ||
                      focusedId === request.id
                        ? theme.colors.backgroundSecondary
                        : 'transparent',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    aria-label={`${request.label} ${status}`}
                    aria-description={summary}
                    onClick={() => {
                      if (request.open) setActiveTabId(request.id);
                      else if (remembered)
                        openHttpRequest(requestDefinition(remembered));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        title={request.label}
                        style={{
                          display: 'block',
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[2],
                          fontWeight: active ? 700 : 500,
                          color: theme.colors.text,
                          marginBottom: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {request.label}
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: spacing.sm,
                          fontFamily: theme.fonts.monospace,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textMuted,
                        }}
                      >
                        <span
                          title={summary}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {summary}
                        </span>
                        <span style={{ flexShrink: 0 }}>{status}</span>
                      </span>
                    </span>
                  </button>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${request.label}`}
                      title={pinned ? 'Unpin request' : 'Pin request'}
                      disabled={requestPinBusy}
                      onClick={() => {
                        if (pinned) void unpinRequest(request.savedRequestId);
                        else if (tab?.contentType === 'http-request')
                          void saveRequest(savedDefinition(tab));
                        else if (remembered)
                          void saveRequest(requestDefinition(remembered));
                      }}
                      style={{
                        ...iconButtonStyle,
                        color: pinned
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                        cursor: requestPinBusy ? 'default' : 'pointer',
                      }}
                    >
                      <Pin size={14} fill={pinned ? 'currentColor' : 'none'} />
                    </button>
                    {remembered && !pinned && (
                      <button
                        type="button"
                        aria-label={`Forget ${request.label}`}
                        title="Forget remembered route (keeps any open tab)"
                        disabled={requestPinBusy}
                        onClick={() =>
                          void forgetRequest(request.savedRequestId)
                        }
                        style={{
                          ...iconButtonStyle,
                          cursor: requestPinBusy ? 'default' : 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

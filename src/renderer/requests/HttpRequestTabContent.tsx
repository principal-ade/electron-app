import React, { useCallback, useMemo } from 'react';
import {
  RequestPanel,
  type BrunoPanelActions,
  type RequestPanelState,
} from '@principal-ade/bruno-panels';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { useTheme } from '@principal-ade/industry-theme';
import type { HttpRequestTab } from '../events/portalTabs';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { BrunoService } from '../main-process-api/BrunoService';
import { savedDefinition } from './requestTabs';
import { RequestTargetEditor } from './RequestTargetEditor';
import type { RequestTarget } from '../../shared/requests/preparedRequest';

const unavailable = async (): Promise<never> => {
  throw new Error(
    'File operations are not available in a prepared request tab.',
  );
};
const actions: BrunoPanelActions = {
  readFile: unavailable,
  writeFile: unavailable,
  deleteFile: unavailable,
  exists: unavailable,
  loadBruRequest: BrunoService.loadBruRequest,
  loadEnvironments: BrunoService.loadEnvironments,
  sendRequest: BrunoService.sendRequest,
};

export const HttpRequestTabContent: React.FC<{ tab: HttpRequestTab }> = ({
  tab,
}) => {
  const { theme } = useTheme();
  const {
    setTabs,
    savedRequests,
    catalogRequests,
    updateRequest,
    saveRequest,
    unpinRequest,
    requestPinError,
    requestPinBusy,
  } = useWorkspaceTabs();
  const events = useMemo(() => new PanelEventBus(), []);
  const saved = savedRequests.find((entry) => entry.id === tab.savedRequestId);
  const remembered = catalogRequests.find(
    (entry) => entry.id === tab.savedRequestId,
  );
  const definition = savedDefinition(tab);
  const dirty =
    remembered &&
    (remembered.title !== definition.title ||
      JSON.stringify(remembered.request) !==
        JSON.stringify(definition.request) ||
      JSON.stringify(remembered.environment) !==
        JSON.stringify(definition.environment) ||
      remembered.repositoryPath !== definition.repositoryPath ||
      remembered.target?.purl !== definition.target?.purl ||
      remembered.target?.identifier !== definition.target?.identifier);
  const onTargetChange = useCallback(
    (target: RequestTarget | undefined) => {
      setTabs((previous) =>
        previous.map((current) =>
          current.id === tab.id &&
          current.contentType === 'http-request' &&
          current.sessionId === tab.sessionId
            ? { ...current, target }
            : current,
        ),
      );
    },
    [setTabs, tab.id, tab.sessionId],
  );
  const onStateChange = useCallback(
    (panelState: RequestPanelState) => {
      setTabs((previous) =>
        previous.map((current) => {
          if (
            current.id !== tab.id ||
            current.contentType !== 'http-request' ||
            current.sessionId !== tab.sessionId
          )
            return current;
          // An unmounted panel may complete a send. Keep it only if the definition
          // hasn't changed since that instance last rendered.
          if (current.panelState.request !== tab.panelState.request)
            return current;
          return { ...current, panelState };
        }),
      );
    },
    [setTabs, tab.id, tab.sessionId, tab.panelState.request],
  );

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          color: theme.colors.text,
          background: theme.colors.backgroundSecondary,
        }}
      >
        <span style={{ flex: 1, fontSize: 12 }}>
          Prepared request. Only Send makes a network request.
        </span>
        <button
          type="button"
          disabled={requestPinBusy}
          onClick={() =>
            void (saved
              ? unpinRequest(tab.savedRequestId)
              : saveRequest(definition))
          }
        >
          {saved ? 'Unpin request' : 'Pin request'}
        </button>
        {remembered && (
          <button
            type="button"
            disabled={requestPinBusy || !dirty}
            onClick={() => void updateRequest(definition)}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        )}
      </div>
      <RequestTargetEditor target={tab.target} onChange={onTargetChange} />
      {requestPinError && (
        <div role="alert" style={{ color: theme.colors.error, padding: 8 }}>
          {requestPinError}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <RequestPanel
          context={{
            currentScope: { type: 'workspace' },
            refresh: async () => {},
          }}
          actions={actions}
          events={events}
          state={tab.panelState}
          onStateChange={onStateChange}
        />
      </div>
    </div>
  );
};

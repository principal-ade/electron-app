import React, { useCallback, useEffect, useState } from 'react';
import { OpenBotChatService } from '../../../main-process-api/OpenBotChatService';
import type {
  OpenBotDeploymentSnapshot,
  OpenBotHealthState,
} from '../../../../shared/main-process-api-interfaces/OpenBotChatAPI';
import { OpenBotDeploymentOverview } from './OpenBotDeploymentOverview';

const initialSnapshot: OpenBotDeploymentSnapshot = {
  state: 'unknown',
  endpoint: 'http://localhost:3010',
  source: 'Not identified by Principal',
  deploymentMode: 'Checking runtime…',
  checkedAt: 'Not checked yet',
  components: [
    {
      id: 'api',
      label: 'OpenBot API',
      detail: 'Checking the local OpenBot endpoint.',
      state: 'unknown',
    },
    {
      id: 'worker',
      label: 'Background worker',
      detail: 'Waiting for deployment status.',
      state: 'unknown',
    },
    {
      id: 'database',
      label: 'Database',
      detail: 'Waiting for deployment status.',
      state: 'unknown',
    },
    {
      id: 'inference',
      label: 'Model inference',
      detail: 'Waiting for deployment status.',
      state: 'unknown',
    },
  ],
  events: [],
  eventsMessage: 'Deployment events are not exposed by the OpenBot API yet.',
};

interface OpenBotDeploymentPanelProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function OpenBotDeploymentPanel({
  onConnectionChange,
}: OpenBotDeploymentPanelProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const nextSnapshot = await OpenBotChatService.getDeploymentSnapshot();
      setSnapshot(nextSnapshot);
      onConnectionChange?.(
        nextSnapshot.components.some(
          ({ id, state }) => id === 'api' && state === 'healthy',
        ),
      );
    } catch {
      const failedSnapshot = unreachableSnapshot();
      setSnapshot(failedSnapshot);
      onConnectionChange?.(false);
    } finally {
      setRefreshing(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <OpenBotDeploymentOverview
      snapshot={snapshot}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    />
  );
}

function unreachableSnapshot(): OpenBotDeploymentSnapshot {
  const state: OpenBotHealthState = 'offline';
  return {
    ...initialSnapshot,
    state,
    checkedAt: new Date().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
    components: initialSnapshot.components.map((component) => ({
      ...component,
      state: component.id === 'api' ? 'offline' : 'unknown',
      detail:
        component.id === 'api'
          ? 'Principal could not read deployment status from OpenBot.'
          : 'Not reported because OpenBot status could not be read.',
    })),
    coverageNote:
      'Principal connects to the local endpoint but does not own or identify the process that started it.',
  };
}

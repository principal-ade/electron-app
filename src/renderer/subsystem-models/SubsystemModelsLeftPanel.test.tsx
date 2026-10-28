import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';
import { SubsystemModelService } from '../main-process-api/SubsystemModelService';
import { SubsystemModelsLeftPanel } from './SubsystemModelsLeftPanel';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));

jest.mock('../main-process-api/SubsystemModelService', () => ({
  SubsystemModelService: { list: jest.fn() },
}));

const model = {
  id: 'sg-1-abc',
  title: 'Request handling',
  componentCount: 3,
  edgeCount: 2,
  updatedAt: '2026-10-27T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (SubsystemModelService.list as jest.Mock).mockResolvedValue([model]);
});

afterEach(() => jest.restoreAllMocks());

function renderPanel(activeTabId: string | null = null) {
  const emit = jest.fn();
  render(
    <SubsystemModelsLeftPanel
      events={{ emit } as unknown as PanelEventEmitter}
      activeTabId={activeTabId}
    />,
  );
  return emit;
}

test.each([null, `subsystem-model-${model.id}`])(
  'drags model context without opening a tab when activeTabId=%s',
  async (activeTabId) => {
    const emit = renderPanel(activeTabId);
    const row = await screen.findByRole('button', {
      name: /Request handling/,
    });
    expect(row.draggable).toBe(true);
    const dataTransfer = { effectAllowed: 'none', setData: jest.fn() };
    fireEvent.dragStart(row, { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      `Use subsystem model "${model.title}" (id: ${model.id}) as context — fetch via:\ncurl -s ${getPrincipalBridgeUrl()}/api/subsystem-models/${model.id}`,
    );
    expect(emit).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subsystem-model:open',
        payload: { modelId: model.id, title: model.title },
      }),
    );
  },
);

test.each([
  ['development', 3054],
  ['production', 3044],
])(
  'uses the %s bridge port and shell-safe model IDs',
  async (environment, port) => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: String(environment),
    });
    (SubsystemModelService.list as jest.Mock).mockResolvedValue([
      { ...model, id: "a/b'$(cmd)?" },
    ]);
    renderPanel();
    const row = await screen.findByRole('button', { name: /Request handling/ });
    const dataTransfer = { setData: jest.fn() };
    fireEvent.dragStart(row, { dataTransfer });
    expect(dataTransfer.setData.mock.calls[0][1].split('\n')[1]).toBe(
      `curl -s 'http://localhost:${port}/api/subsystem-models/a%2Fb'\\''%24(cmd)%3F'`,
    );
  },
);

import {
  buildAcpHighlightLayers,
  callHighlightItems,
  OPERATION_LAYER_STYLES,
} from './acpHighlightLayers';
import type { AcpHighlightItem } from '../../../shared/main-process-api-interfaces/AcpAPI';

function items(count: number, operation: 'list' | 'read' = 'list') {
  return Array.from({ length: count }, (_, index) => ({
    path: `src/renderer/dir-${index}`,
    operation,
    kind: 'directory' as const,
  }));
}

describe('buildAcpHighlightLayers', () => {
  it('buckets directory listings into the Listings border layer', () => {
    const layers = buildAcpHighlightLayers([
      {
        status: 'completed',
        name: 'shell',
        kind: 'execute',
        highlightItems: [
          {
            path: 'src/renderer',
            operation: 'list',
            kind: 'directory',
          },
        ],
      },
    ]);

    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({
      id: 'acp-operation-list',
      name: 'Listings',
      color: OPERATION_LAYER_STYLES.list.color,
      items: [
        {
          path: 'src/renderer',
          type: 'directory',
          renderStrategy: 'border',
        },
      ],
    });
  });

  it('caps each operation bucket to its newest items', () => {
    const layers = buildAcpHighlightLayers([
      { status: 'completed', highlightItems: items(25) },
    ]);

    expect(layers[0].items).toHaveLength(OPERATION_LAYER_STYLES.list.maxItems);
    expect(layers[0].items?.[0].path).toBe('src/renderer/dir-0');
  });

  it('promotes a path to the strongest operation that touched it', () => {
    const layers = buildAcpHighlightLayers([
      {
        status: 'completed',
        highlightItems: [
          { path: 'src/renderer/App.tsx', operation: 'read', kind: 'file' },
        ],
      },
      {
        status: 'completed',
        highlightItems: [
          { path: 'src/renderer/App.tsx', operation: 'edit', kind: 'file' },
        ],
      },
    ]);

    expect(layers.map((layer) => layer.id)).toEqual(['acp-operation-edit']);
    expect(layers[0].items?.[0]).toMatchObject({
      path: 'src/renderer/App.tsx',
      renderStrategy: 'fill',
    });
  });

  it('marks paths from pending calls in the Active tool layer', () => {
    const layers = buildAcpHighlightLayers(
      [
        {
          status: 'in_progress',
          highlightItems: [
            { path: 'src/renderer/App.tsx', operation: 'read', kind: 'file' },
          ],
        },
      ],
      { activeColor: '#ff00aa' },
    );

    expect(
      layers.find((layer) => layer.id === 'acp-active-tool'),
    ).toMatchObject({
      color: '#ff00aa',
      items: [
        {
          path: 'src/renderer/App.tsx',
          type: 'file',
          renderStrategy: 'border',
        },
      ],
    });
  });

  it('falls back to highlightPaths using the call kind', () => {
    expect(
      callHighlightItems({
        kind: 'search',
        highlightPaths: ['src/main/acp', 'src/main/acp'],
      }),
    ).toEqual<AcpHighlightItem[]>([
      { path: 'src/main/acp', operation: 'search' },
    ]);
  });
});

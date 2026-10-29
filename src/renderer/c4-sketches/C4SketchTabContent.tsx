import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { C4SketchView, type C4Sketch } from '@principal-ai/subsystems-react';
import { C4SketchService } from '../main-process-api/C4SketchService';

export const C4SketchTabContent: React.FC<{ sketchId: string }> = ({
  sketchId,
}) => {
  const { theme } = useTheme();
  const [state, setState] = React.useState<{
    id: string;
    sketch: C4Sketch | null;
    loading: boolean;
    error: string | null;
  }>({ id: sketchId, sketch: null, loading: true, error: null });

  React.useEffect(() => {
    let cancelled = false;
    let generation = 0;
    const load = async () => {
      const current = ++generation;
      try {
        const sketch = await C4SketchService.get(sketchId);
        if (!cancelled && current === generation)
          setState({
            id: sketchId,
            sketch,
            loading: false,
            error: sketch
              ? null
              : 'This C4 sketch could not be found or is invalid.',
          });
      } catch {
        if (!cancelled && current === generation)
          setState({
            id: sketchId,
            sketch: null,
            loading: false,
            error: 'Could not load this C4 sketch.',
          });
      }
    };
    void load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, [sketchId]);

  const loading = state.id !== sketchId || state.loading;
  if (loading || !state.sketch || state.error)
    return (
      <div
        role={!loading && state.error ? 'alert' : 'status'}
        style={{
          display: 'grid',
          height: '100%',
          placeItems: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        {loading ? 'Loading C4 sketch…' : state.error}
      </div>
    );
  return (
    <C4SketchView
      key={sketchId}
      sketch={state.sketch}
      persistKey={`c4-sketch-${sketchId}`}
    />
  );
};

import React, { useEffect, useState } from 'react';
import { SubsystemComponentGraph } from '@principal-ai/subsystems-react';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';
import '@xyflow/react/dist/style.css';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export const SubsystemModelGraph: React.FC<{
  model: SubsystemModelHydrated;
}> = ({ model }) => {
  const [layoutDirection, setLayoutDirection] = useState<
    'horizontal' | 'vertical' | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    void UserPreferencesService.getPreferences().then((preferences) => {
      if (!isMounted) return;
      setLayoutDirection(
        preferences.subsystemModelLayoutDirection === 'horizontal'
          ? 'horizontal'
          : 'vertical',
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      {layoutDirection && (
        <SubsystemComponentGraph
          components={model.components}
          trails={model.trails}
          title={model.title}
          description={model.description}
          defaultLayoutDirection={layoutDirection}
          persistKey={model.id ?? model.title}
        />
      )}
    </div>
  );
};

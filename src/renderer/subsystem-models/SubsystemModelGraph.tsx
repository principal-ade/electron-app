import React from 'react';
import { SubsystemComponentGraph } from '@principal-ai/subsystems-react';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';
import '@xyflow/react/dist/style.css';

export const SubsystemModelGraph: React.FC<{
  model: SubsystemModelHydrated;
}> = ({ model }) => (
  <div style={{ height: '100%', minHeight: 0 }}>
    <SubsystemComponentGraph
      components={model.components}
      trails={model.trails}
      title={model.title}
      description={model.description}
      persistKey={model.id ?? model.title}
    />
  </div>
);

import React, { useState, forwardRef } from 'react';
import { TabbedTerminalPanel } from './TabbedTerminalPanel';
import { CarouselTerminalPanel } from './CarouselTerminalPanel';

type TerminalViewMode = 'tabbed' | 'carousel';

interface MultiTerminalPanelProps {
  directory: string;
  repositoryKey: string;
  hideHeader?: boolean;
  isVisible?: boolean;
  showAllTerminals?: boolean;
  onShowAllTerminalsChange?: (showAll: boolean) => void;
  minPanelWidth?: number;
  idealPanelWidth?: number;
}

export const MultiTerminalPanel = forwardRef<any, MultiTerminalPanelProps>(
  (props, ref) => {
    const [viewMode, setViewMode] = useState<TerminalViewMode>('tabbed');

    const handleToggleView = () => {
      setViewMode((prev) => (prev === 'tabbed' ? 'carousel' : 'tabbed'));
    };

    return viewMode === 'tabbed' ? (
      <TabbedTerminalPanel
        {...props}
        ref={ref}
        onToggleView={handleToggleView}
      />
    ) : (
      <CarouselTerminalPanel
        {...props}
        ref={ref}
        onToggleView={handleToggleView}
      />
    );
  },
);

MultiTerminalPanel.displayName = 'MultiTerminalPanel';

import React, { useState, forwardRef } from 'react';
import { TabbedTerminalPanel, TabbedTerminalPanelRef } from './TabbedTerminalPanel';
import { CarouselTerminalPanel, CarouselTerminalPanelRef } from './CarouselTerminalPanel';

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

export const MultiTerminalPanel = forwardRef<TabbedTerminalPanelRef | CarouselTerminalPanelRef, MultiTerminalPanelProps>(
  (props, ref) => {
    const [viewMode, setViewMode] = useState<TerminalViewMode>('tabbed');

    const handleToggleView = () => {
      setViewMode((prev) => (prev === 'tabbed' ? 'carousel' : 'tabbed'));
    };

    return viewMode === 'tabbed' ? (
      <TabbedTerminalPanel
        {...props}
        ref={ref as React.ForwardedRef<TabbedTerminalPanelRef>}
        onToggleView={handleToggleView}
      />
    ) : (
      <CarouselTerminalPanel
        {...props}
        ref={ref as React.ForwardedRef<CarouselTerminalPanelRef>}
        onToggleView={handleToggleView}
      />
    );
  },
);

MultiTerminalPanel.displayName = 'MultiTerminalPanel';

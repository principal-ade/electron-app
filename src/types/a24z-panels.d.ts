import type { CSSProperties, ReactNode } from 'react';

declare module '@a24z/panels' {
  export interface PanelTheme {
    [key: string]: unknown;
  }

  export interface ThreePanelLayoutLegacyProps {
    leftPanel: ReactNode;
    middlePanel: ReactNode;
    rightPanel: ReactNode;
    collapsiblePanels?: { left?: boolean; right?: boolean };
    defaultSizes?: { left?: number; middle?: number; right?: number };
    minSizes?: { left?: number; middle?: number; right?: number };
    collapsed?: { left?: boolean; right?: boolean };
    showCollapseButtons?: boolean;
    onLeftCollapseComplete?: () => void;
    onLeftExpandComplete?: () => void;
    onRightCollapseComplete?: () => void;
    onRightExpandComplete?: () => void;
    style?: CSSProperties;
    theme?: PanelTheme;
  }

  export type PanelIdentifier = 'left' | 'middle' | 'right';

  export interface PanelConfiguration {
    id: PanelIdentifier;
    content: ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    collapsible?: boolean;
    collapsed?: boolean;
    minCollapsedSize?: number;
  }

  export interface ThreePanelLayoutConfiguration {
    orientation?: 'horizontal' | 'vertical';
    gapSize?: number;
    panels: {
      left: PanelConfiguration;
      middle: PanelConfiguration;
      right: PanelConfiguration;
    };
  }

  export interface ConfigurableThreePanelLayoutProps {
    configuration: ThreePanelLayoutConfiguration;
    theme?: PanelTheme;
    showCollapseButtons?: boolean;
    onPanelCollapseChange?: (
      panelId: PanelIdentifier,
      collapsed: boolean,
    ) => void;
    onPanelResize?: (sizes: {
      left: number;
      middle: number;
      right: number;
    }) => void;
    style?: CSSProperties;
  }

  export const ThreePanelLayout: React.FC<ThreePanelLayoutLegacyProps>;
  export const ConfigurableThreePanelLayout: React.FC<ConfigurableThreePanelLayoutProps>;
}

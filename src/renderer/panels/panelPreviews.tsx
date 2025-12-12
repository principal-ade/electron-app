import React from 'react';
import { FileText } from 'lucide-react';
import { MarkdownRenderingPanelPreview } from './components/MarkdownRenderingPanel';

export interface PanelPreviewMetadata {
  icon: React.ReactNode;
  preview: React.ReactNode;
  label?: string;
  description?: string;
}

// Git panel previews moved to @industry-theme/git-panels
export const panelPreviewRegistry: Record<string, PanelPreviewMetadata> = {
  markdownViewer: {
    icon: <FileText size={16} />,
    preview: <MarkdownRenderingPanelPreview />,
  },
};

export type PanelPreviewId = keyof typeof panelPreviewRegistry;

export function getPanelPreviewMetadata(
  id: string,
): PanelPreviewMetadata | null {
  return panelPreviewRegistry[id] ?? null;
}

export function getAllPanelPreviewIds(): PanelPreviewId[] {
  return Object.keys(panelPreviewRegistry) as PanelPreviewId[];
}

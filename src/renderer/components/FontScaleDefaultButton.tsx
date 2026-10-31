/**
 * "Set as default" affordance for a markdown surface whose per-tab font scale
 * has drifted from the shared default. Renders nothing while they match.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  setDefaultFontScale,
  useDefaultFontScale,
} from '../hooks/markdownFontScale';

export const FontScaleDefaultButton: React.FC<{
  scale: number;
  /** Omit the "N%" readout when the host already shows one. */
  showPercent?: boolean;
  style?: React.CSSProperties;
}> = ({ scale, showPercent = true, style }) => {
  const { theme } = useTheme();
  const defaultScale = useDefaultFontScale();
  if (scale === defaultScale) return null;
  const percent = `${Math.round(scale * 100)}%`;
  return (
    <button
      type="button"
      onClick={() => setDefaultFontScale(scale)}
      title={`Use ${percent} as the default font size for new tabs`}
      aria-label={`Set ${percent} as the default font size`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 4,
        background: 'none',
        color: theme.colors.textSecondary,
        cursor: 'pointer',
        fontFamily: theme.fonts.body,
        fontSize: 12,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {showPercent && <span>{percent}</span>}
      <span>Set as default</span>
    </button>
  );
};

export default FontScaleDefaultButton;

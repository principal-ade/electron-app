import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Menu, X } from 'lucide-react';
import React from 'react';

import { Theme } from '../../industryTheme';

export interface SlideNavigationHeaderProps {
  currentSlide: number;
  totalSlides: number;
  showTOC: boolean;
  isFullscreen: boolean;
  showSlideCounter: boolean;
  showFullscreenButton: boolean;
  theme: Theme;
  onPrevious: () => void;
  onNext: () => void;
  onToggleTOC: () => void;
  onToggleFullscreen: () => void;
}

export const SlideNavigationHeader: React.FC<SlideNavigationHeaderProps> = ({
  currentSlide,
  totalSlides,
  showTOC,
  isFullscreen,
  showSlideCounter,
  showFullscreenButton,
  theme,
  onPrevious,
  onNext,
  onToggleTOC,
  onToggleFullscreen,
}) => {
  const navigationHeight = '48px';

  return (
    <div
      style={{
        height: navigationHeight,
        minHeight: navigationHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${theme.space[3]}px`,
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        flexShrink: 0,
      }}
    >
      {/* Left: TOC button and Previous button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.space[2],
        }}
      >
        {/* Table of Contents button */}
        <button
          onClick={onToggleTOC}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            backgroundColor: showTOC ? theme.colors.primary : 'transparent',
            border: `1px solid ${showTOC ? theme.colors.primary : theme.colors.border}`,
            borderRadius: theme.radii[1],
            color: showTOC ? theme.colors.background : theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => {
            if (!showTOC) {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }
          }}
          onMouseOut={e => {
            if (!showTOC) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          title={showTOC ? 'Close table of contents (Esc)' : 'Open table of contents (T)'}
        >
          {showTOC ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button
          onClick={onPrevious}
          disabled={currentSlide === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space[1],
            padding: `0 ${theme.space[2]}px`,
            height: '36px',
            minWidth: '100px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii[1],
            color: currentSlide === 0 ? theme.colors.muted : theme.colors.text,
            cursor: currentSlide === 0 ? 'not-allowed' : 'pointer',
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts.body,
            opacity: currentSlide === 0 ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => {
            if (currentSlide !== 0) {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }
          }}
          onMouseOut={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ChevronLeft size={18} />
          Previous
        </button>
      </div>

      {/* Center: Slide counter */}
      {showSlideCounter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.space[2],
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts.monospace,
          }}
        >
          <span style={{ fontWeight: 600 }}>Slide {currentSlide + 1}</span>
          <span style={{ opacity: 0.7 }}>of {totalSlides}</span>
        </div>
      )}

      {/* Right: Next button and fullscreen */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.space[2],
        }}
      >
        <button
          onClick={onNext}
          disabled={currentSlide === totalSlides - 1}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space[1],
            padding: `0 ${theme.space[2]}px`,
            height: '36px',
            minWidth: '100px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii[1],
            color: currentSlide === totalSlides - 1 ? theme.colors.muted : theme.colors.text,
            cursor: currentSlide === totalSlides - 1 ? 'not-allowed' : 'pointer',
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts.body,
            opacity: currentSlide === totalSlides - 1 ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => {
            if (currentSlide !== totalSlides - 1) {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }
          }}
          onMouseOut={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Next
          <ChevronRight size={18} />
        </button>

        {showFullscreenButton && (
          <button
            onClick={onToggleFullscreen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[1],
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={e => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
            onMouseOut={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};
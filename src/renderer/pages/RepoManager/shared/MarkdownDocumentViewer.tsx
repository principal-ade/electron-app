import React from 'react';
import { ThemedSlidePresentation } from '../../../components/markdown/ThemedSlidePresentation';
import { ThemedDocumentView } from '../../../components/markdown/ThemedDocumentView';
import { ThemedMonaco } from '../../../components/shared/ThemedMonaco';
import { MarkdownEmptyOverlay } from '../../../components/repository-maps/MarkdownEmptyOverlay';
import type { Theme } from 'themed-markdown';

interface MarkdownDocumentViewerProps {
  viewMode: 'slides' | 'document';
  showEditor: boolean;
  content: string;
  slides: string[];
  currentSlide: number;
  theme: Theme;
  showSegmented?: boolean;
  fontSizeScale?: number;
  onContentChange: (content: string) => void;
  onSlideNavigate: (slideNumber: number) => void;
  onCheckboxChange: (
    slideIndex: number,
    lineNumber: number,
    checked: boolean,
  ) => void;
}

export const MarkdownDocumentViewer: React.FC<MarkdownDocumentViewerProps> = ({
  viewMode,
  showEditor,
  content,
  slides,
  currentSlide,
  theme,
  showSegmented = true,
  fontSizeScale = 1.0,
  onContentChange,
  onSlideNavigate,
  onCheckboxChange,
}) => {
  // Editor View - shown when showEditor is true
  if (showEditor) {
    // In editor mode, show either the current slide or full document based on viewMode
    const editorContent =
      viewMode === 'slides' ? slides[currentSlide] : content;

    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.background,
        }}
      >
        <ThemedMonaco
          value={editorContent}
          onChange={(newValue) => {
            if (viewMode === 'slides') {
              // Update just the current slide
              const newSlides = [...slides];
              newSlides[currentSlide] = newValue || '';
              const newContent = newSlides.join('\n\n---\n\n');
              onContentChange(newContent);
            } else {
              // Update the entire document
              onContentChange(newValue || '');
            }
          }}
          language="markdown"
          height="100%"
        />
      </div>
    );
  }

  // Check if content is empty
  const isEmpty = !content || content.trim() === '';

  // Document View - Use the new ThemedDocumentView component
  if (viewMode === 'document') {
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <ThemedDocumentView
          content={slides}
          showSegmented={showSegmented}
          theme={theme}
          fontSizeScale={fontSizeScale}
          onCheckboxChange={onCheckboxChange}
          slideIdPrefix="planning-doc"
          showSectionHeaders={showSegmented}
          showSeparators={showSegmented}
        />
        {isEmpty && <MarkdownEmptyOverlay theme={theme} />}
      </div>
    );
  }

  // Slide View (default) - Use the new ThemedSlidePresentation component
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <ThemedSlidePresentation
        slides={slides}
        initialSlide={currentSlide}
        theme={theme}
        fontSizeScale={fontSizeScale}
        onSlideChange={onSlideNavigate}
        onCheckboxChange={onCheckboxChange}
        showNavigation={true}
        showSlideCounter={true}
        showFullscreenButton={true}
        slideIdPrefix="planning-slide"
        enableHtmlPopout={true}
        enableKeyboardScrolling={true}
      />
      {isEmpty && <MarkdownEmptyOverlay theme={theme} />}
    </div>
  );
};

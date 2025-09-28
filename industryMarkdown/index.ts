// Industry-themed markdown components using Theme UI spec-compliant themes
export { IndustryMarkdownSlide } from './components/IndustryMarkdownSlide'; 
export type { IndustryMarkdownSlideProps } from './components/IndustryMarkdownSlide';

// Slide presentation component with navigation controls
export { SlidePresentation } from './components/SlidePresentation';
export type { SlidePresentationProps } from './components/SlidePresentation';

// Slide presentation with book layout (two slides side-by-side)
export { SlidePresentationBook } from './components/SlidePresentationBook';
export type { SlidePresentationBookProps } from './components/SlidePresentationBook';

// Slide navigation components
export { SlideNavigationHeader } from './components/SlideNavigationHeader';
export type { SlideNavigationHeaderProps } from './components/SlideNavigationHeader';
export { SlideSearchBar } from './components/SlideSearchBar';
export type { SlideSearchBarProps, SearchResult } from './components/SlideSearchBar';

// Document view component for continuous or segmented display
export { DocumentView } from './components/DocumentView';
export type { DocumentViewProps } from './components/DocumentView';

// Industry-themed editable markdown component
export { IndustryEditableMarkdownSlide } from './components/IndustryEditableMarkdownSlide';
export type { IndustryEditableMarkdownSlideProps } from './components/IndustryEditableMarkdownSlide';

// Industry-themed editable mermaid diagram component
export { IndustryEditableMermaidDiagram } from './components/IndustryEditableMermaidDiagram';
export type { IndustryEditableMermaidDiagramProps } from './components/IndustryEditableMermaidDiagram';

// Industry-themed markdown component creators
export { createIndustryMarkdownComponents } from './components/IndustryMarkdownComponents';

// Industry-themed modal components
export { IndustryHtmlModal, useIndustryHtmlModal } from './components/IndustryHtmlModal';
export { IndustryPlaceholderModal } from './components/IndustryPlaceholderModal';
export { IndustryMermaidModal } from './components/IndustryMermaidModal';
export { IndustryLazyMermaidDiagram } from './components/IndustryLazyMermaidDiagram';
export { IndustryZoomableMermaidDiagram } from './components/IndustryZoomableMermaidDiagram';

// Presentation utilities for parsing and serializing markdown presentations
export {
  parseMarkdownIntoPresentation,
  serializePresentationToMarkdown,
  updatePresentationSlide,
  parseMarkdownIntoPresentationFromSource,
  createGithubFileSource,
  extractSlideTitle,
  createPresentationWithErrorMessage,
  reconstructMarkdownContent,
  getAllSlideTitles,
  findSlideByTitle,
  findSlideIndexByTitle,
  updateSlideTitle,
  updateSlideContent,
} from './utils/presentationUtils';

// Markdown chunk utilities
export { parseMarkdownChunks } from './utils/markdownUtils';

// Presentation types
export type {
  MarkdownPresentation,
  MarkdownSlide,
  MarkdownSource,
  MarkdownSourceType,
  RepositoryInfo,
  MarkdownSlideLocation,
} from './types/presentation';

// Theme system exports
export type { Theme } from '../industryTheme';
export { theme as defaultTheme } from '../industryTheme';
export { 
  ThemeProvider, 
  useTheme, 
  withTheme 
} from '../industryTheme/ThemeProvider';
export {
  scaleThemeFonts,
  increaseFontScale,
  decreaseFontScale,
  resetFontScale
} from '../industryTheme';

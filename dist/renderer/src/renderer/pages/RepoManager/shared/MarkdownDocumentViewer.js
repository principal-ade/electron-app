import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SlidePresentation, DocumentView } from 'themed-markdown';
import { ThemedMonaco } from '../../../components/shared/ThemedMonaco';
import { MarkdownEmptyOverlay } from '../../../components/repository-maps/MarkdownEmptyOverlay';
export const MarkdownDocumentViewer = ({ viewMode, showEditor, content, slides, currentSlide, theme, showSegmented = true, onContentChange, onSlideNavigate, onCheckboxChange }) => {
    // Editor View - shown when showEditor is true
    if (showEditor) {
        // In editor mode, show either the current slide or full document based on viewMode
        const editorContent = viewMode === 'slides' ? slides[currentSlide] : content;
        return (_jsx("div", { style: {
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme.colors.background
            }, children: _jsx(ThemedMonaco, { value: editorContent, onChange: (newValue) => {
                    if (viewMode === 'slides') {
                        // Update just the current slide
                        const newSlides = [...slides];
                        newSlides[currentSlide] = newValue || '';
                        const newContent = newSlides.join('\n\n---\n\n');
                        onContentChange(newContent);
                    }
                    else {
                        // Update the entire document
                        onContentChange(newValue || '');
                    }
                }, language: "markdown", height: "100%" }) }));
    }
    // Check if content is empty
    const isEmpty = !content || content.trim() === '';
    // Document View - Use the new DocumentView component
    if (viewMode === 'document') {
        return (_jsxs("div", { style: { position: 'relative', height: '100%' }, children: [_jsx(DocumentView, { content: slides, showSegmented: showSegmented, theme: theme, onCheckboxChange: onCheckboxChange, slideIdPrefix: "planning-doc", showSectionHeaders: showSegmented, showSeparators: showSegmented }), isEmpty && _jsx(MarkdownEmptyOverlay, { theme: theme })] }));
    }
    // Slide View (default) - Use the new SlidePresentation component
    return (_jsxs("div", { style: { position: 'relative', height: '100%' }, children: [_jsx(SlidePresentation, { slides: slides, initialSlide: currentSlide, theme: theme, onSlideChange: onSlideNavigate, onCheckboxChange: onCheckboxChange, showNavigation: true, showSlideCounter: true, showFullscreenButton: true, slideIdPrefix: "planning-slide", enableMermaidPopout: true, enableHtmlPopout: true, enableKeyboardScrolling: true }), isEmpty && _jsx(MarkdownEmptyOverlay, { theme: theme })] }));
};

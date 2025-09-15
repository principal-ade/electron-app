import React from 'react';
import type { Theme } from 'themed-markdown';
interface MarkdownDocumentViewerProps {
    viewMode: 'slides' | 'document';
    showEditor: boolean;
    content: string;
    slides: string[];
    currentSlide: number;
    theme: Theme;
    showSegmented?: boolean;
    onContentChange: (content: string) => void;
    onSlideNavigate: (slideNumber: number) => void;
    onCheckboxChange: (slideIndex: number, lineNumber: number, checked: boolean) => void;
}
export declare const MarkdownDocumentViewer: React.FC<MarkdownDocumentViewerProps>;
export {};
//# sourceMappingURL=MarkdownDocumentViewer.d.ts.map
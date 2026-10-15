/**
 * Stub for `react-pdf`-based `PdfView` (web-ade `components/document/PdfView`).
 * `react-pdf` isn't installed in the desktop app yet; `DocumentPreview` lazy-
 * loads this module, so a light placeholder keeps the bundle intact. Only
 * reached when a PDF is opened in the file source panel.
 */

import React from 'react';

export interface PdfViewProps {
  src: string;
  className?: string;
}

export function PdfView({ src, className }: PdfViewProps) {
  return (
    <div
      className={className}
      style={{ padding: 24, color: '#888', fontFamily: 'system-ui' }}
    >
      PDF preview is not available in this environment yet.
      <br />
      <code>{src}</code>
    </div>
  );
}

export default PdfView;

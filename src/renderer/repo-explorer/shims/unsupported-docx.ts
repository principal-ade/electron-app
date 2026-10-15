/**
 * Stub for the heavy DOCX/PPTX renderers (`pptx-preview`, `mammoth`,
 * `docx-preview`) that web-ade's `DocumentPreview` lazy-loads. Those packages
 * aren't installed in the desktop app yet; these no-op exports keep the dynamic
 * import from breaking the bundle. Only reached when a DOCX/PPTX is opened.
 */

const unavailable = (): never => {
  throw new Error(
    'Document rendering (docx/pptx) is not available in this environment yet.',
  );
};

export const init = unavailable;

export async function convertToHtml(): Promise<{ value: string }> {
  unavailable();
}

export async function renderAsync(): Promise<void> {
  unavailable();
}

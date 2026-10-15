/**
 * Stub for the heavy DOCX/PPTX renderers (`pptx-preview`, `mammoth`,
 * `docx-preview`) that web-ade's `DocumentPreview` lazy-loads. Those packages
 * aren't installed in the desktop app yet; these no-op exports keep the dynamic
 * import from breaking the bundle. Only reached when a DOCX/PPTX is opened.
 */

const unavailable = (..._args: unknown[]): never => {
  throw new Error(
    'Document rendering (docx/pptx) is not available in this environment yet.',
  );
};

export const init = (
  ..._args: unknown[]
): { preview: (data: ArrayBuffer) => Promise<void> } => unavailable();

export async function convertToHtml(
  ..._args: unknown[]
): Promise<{ value: string }> {
  return unavailable();
}

export async function renderAsync(..._args: unknown[]): Promise<void> {
  return unavailable();
}

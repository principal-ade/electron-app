/** A text span. Lines and columns are 1-based; the end is exclusive. */
export interface DocumentRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export function isDocumentRange(value: unknown): value is DocumentRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const range = value as DocumentRange;
  if (
    ![
      range.startLineNumber,
      range.startColumn,
      range.endLineNumber,
      range.endColumn,
    ].every((number) => Number.isSafeInteger(number) && number > 0)
  )
    return false;
  return (
    range.endLineNumber > range.startLineNumber ||
    (range.endLineNumber === range.startLineNumber &&
      range.endColumn >= range.startColumn)
  );
}

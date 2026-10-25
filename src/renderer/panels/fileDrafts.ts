export interface FileDraft {
  originalContent: string;
  content: string;
}

// Keep edits across tab closes without writing source or persisting a second
// copy of potentially sensitive file contents to browser storage.
const drafts = new Map<string, FileDraft>();
const listeners = new Set<() => void>();
const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = '';
};

export function getFileDraft(filePath: string) {
  return drafts.get(filePath);
}

export function subscribeFileDrafts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateFileDraft(
  filePath: string,
  originalContent: string,
  content: string,
) {
  const hadDrafts = drafts.size > 0;
  if (content === originalContent) drafts.delete(filePath);
  else drafts.set(filePath, { originalContent, content });
  if (!hadDrafts && drafts.size)
    window.addEventListener('beforeunload', warnBeforeLeaving);
  if (hadDrafts && !drafts.size)
    window.removeEventListener('beforeunload', warnBeforeLeaving);
  listeners.forEach((listener) => listener());
}

export function clearFileDraft(filePath: string) {
  updateFileDraft(filePath, '', '');
}

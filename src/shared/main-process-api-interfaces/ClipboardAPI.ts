export enum ClipboardAPIEvent {
  WRITE_TEXT = 'clipboard-write',
  READ_TEXT = 'clipboard-read',
  IS_AVAILABLE = 'clipboard-available',
}

export interface ClipboardAPI {
  writeText: (text: string) => Promise<boolean>;
  readText: () => Promise<{ success: boolean; text: string }>;
  isAvailable: () => Promise<boolean>;
  removeFullscreenChangedListener: () => void;
}

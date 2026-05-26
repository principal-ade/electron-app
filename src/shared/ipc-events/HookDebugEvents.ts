/**
 * IPC channel + payload type for the hook-debug panel. Shared between the
 * event-processing worker (which broadcasts every received hook) and the
 * renderer panel that displays them.
 */

export const HOOK_DEBUG_CHANNEL = 'debug:hook-event';

export interface HookDebugEvent {
  /** Agent provider that POSTed the hook (claude-hook, gemini-hook, …). */
  provider: string;
  /** Wall-clock receive time on the event server (ms since epoch). */
  receivedAt: number;
  /** Full raw hook payload as POSTed. Untyped — shape varies per provider. */
  raw: unknown;
}

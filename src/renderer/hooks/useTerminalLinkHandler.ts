import { useEffect } from 'react';
import type {
  PanelEvent,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { TerminalLinkClickEvent } from '@industry-theme/xterm-terminal-panel';
import { useTerminalLinkRouting } from './useTerminalLinkRouting';

/**
 * Routes terminal link clicks according to the user's localhost preference.
 *
 * The xterm panel calls `preventDefault()` on the click and emits
 * `terminal:link-click` on the panel event bus; nothing else listens, so
 * without this hook the click is swallowed and the link never opens. Call it
 * once per component that renders a `TabbedTerminalPanel` / `TerminalSession`,
 * passing the same `events` bus that panel receives.
 *
 * Plain click opens — matching the hover-underline affordance the WebLinks
 * addon already shows. The modifier flags are available on the payload if a
 * call site ever wants to gate on Cmd/Ctrl instead.
 */
export function useTerminalLinkHandler(
  events: PanelEventEmitter | undefined,
): void {
  const openLink = useTerminalLinkRouting();
  useEffect(() => {
    if (!events) return undefined;
    const handler = (event: PanelEvent<TerminalLinkClickEvent>) => {
      const url = event.payload?.url;
      if (url) openLink(url);
    };
    events.on('terminal:link-click', handler);
    return () => {
      events.off('terminal:link-click', handler);
    };
  }, [events, openLink]);
}

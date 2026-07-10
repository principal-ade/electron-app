import { useEffect, useState } from 'react';
import { WindowService } from '../main-process-api/WindowService';
import type { TabTransferData } from '../main-process-api/WindowService';

/**
 * Hook that listens for incoming tab transfers (TAB_RECEIVED) and
 * exposes the latest payload so a parent can react (open a terminal
 * session, activate a tab, etc.).
 */
export function useTabReceiver() {
  const [incomingTab, setIncomingTab] = useState<TabTransferData | null>(null);

  useEffect(() => {
    const off = WindowService.onTabReceived((data) => {
      setIncomingTab(data);
    });
    return off;
  }, []);

  /** Acknowledge — call after handling the incoming tab. */
  const clearIncomingTab = () => setIncomingTab(null);

  return { incomingTab, clearIncomingTab };
}

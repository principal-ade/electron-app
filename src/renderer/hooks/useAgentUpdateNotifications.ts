/**
 * Stub for useAgentUpdateNotifications hook
 * Since agent updates are no longer supported, this returns empty notifications
 */

import { useState, useEffect } from 'react';

export interface UpdateNotification {
  id: string;
  agentType: string;
  message: string;
  version?: string;
}

/**
 * Stub implementation that always returns empty notifications
 */
export function useAgentUpdateNotifications() {
  const [notifications, setNotifications] = useState<UpdateNotification[]>([]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return {
    notifications,
    dismissNotification,
  };
}

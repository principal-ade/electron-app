import { useEffect, useState } from 'react';
import { AgentAutoUpdateService, UpdateCheckResult } from '../main-process-api/AgentAutoUpdateService';
import { getAgentInfo } from "@principal-ai/agent-monitoring";

export interface UpdateNotification {
  id: string;
  agentType: string;
  displayName: string;
  currentVersion?: string;
  latestVersion: string;
  timestamp: number;
}

export function useAgentUpdateNotifications() {
  const [notifications, setNotifications] = useState<UpdateNotification[]>([]);

  useEffect(() => {
    // Listen for update notifications
    const unsubscribe = AgentAutoUpdateService.onUpdateAvailable((update: UpdateCheckResult) => {
      if (update.hasUpdate) {
        const agentInfo = getAgentInfo(update.agentType);
        const notification: UpdateNotification = {
          id: `${update.agentType}-${Date.now()}`,
          agentType: update.agentType,
          displayName: agentInfo.displayName,
          currentVersion: update.currentVersion,
          latestVersion: update.latestVersion,
          timestamp: Date.now(),
        };

        setNotifications(prev => [...prev, notification]);

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          dismissNotification(notification.id);
        }, 10000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const installUpdate = async (agentType: string) => {
    // This would trigger the update installation
    // You might want to emit an event or call a service here
    console.log(`Installing update for ${agentType}`);
    // Clear the notification
    setNotifications(prev => prev.filter(n => n.agentType !== agentType));
  };

  return {
    notifications,
    dismissNotification,
    installUpdate,
  };
}
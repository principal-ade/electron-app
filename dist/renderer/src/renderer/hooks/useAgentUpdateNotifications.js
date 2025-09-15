import { useEffect, useState } from 'react';
import { AgentAutoUpdateService } from '../main-process-api/AgentAutoUpdateService';
import { getAgentInfo } from "@principal-ai/agent-monitoring";
export function useAgentUpdateNotifications() {
    const [notifications, setNotifications] = useState([]);
    useEffect(() => {
        // Listen for update notifications
        const unsubscribe = AgentAutoUpdateService.onUpdateAvailable((update) => {
            if (update.hasUpdate) {
                const agentInfo = getAgentInfo(update.agentType);
                const notification = {
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
    const dismissNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };
    const installUpdate = async (agentType) => {
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

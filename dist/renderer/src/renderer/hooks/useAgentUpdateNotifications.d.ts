export interface UpdateNotification {
    id: string;
    agentType: string;
    displayName: string;
    currentVersion?: string;
    latestVersion: string;
    timestamp: number;
}
export declare function useAgentUpdateNotifications(): {
    notifications: UpdateNotification[];
    dismissNotification: (id: string) => void;
    installUpdate: (agentType: string) => Promise<void>;
};
//# sourceMappingURL=useAgentUpdateNotifications.d.ts.map
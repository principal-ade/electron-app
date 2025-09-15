export declare const orbitAPI: {
    /**
     * Open GitHub OAuth authentication page
     */
    openAuth: () => Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Exchange OAuth code for access token
     */
    authenticate: (code: string) => Promise<{
        success: boolean;
        user?: {
            githubHandle: string;
            email?: string;
            status: "waitlisted" | "approved" | "denied";
            metadata?: any;
        };
        token?: string;
        error?: string;
    }>;
    /**
     * Check user status with token
     */
    checkStatus: (token: string) => Promise<{
        status: string;
        githubHandle?: string;
        email?: string;
        metadata?: any;
    }>;
    /**
     * Join a signaling room for collaboration
     */
    joinRoom: (token: string, repoUrl: string) => Promise<{
        success: boolean;
        peerId?: string;
        githubHandle?: string;
        peers?: Array<{
            peerId: string;
            githubHandle: string;
        }>;
        error?: string;
    }>;
    /**
     * Poll for new signals and peer updates
     */
    pollSignals: (peerId: string, repoUrl: string) => Promise<{
        success: boolean;
        signals?: Array<{
            from: string;
            to?: string;
            type: string;
            data: any;
        }>;
        peers?: Array<{
            peerId: string;
            githubHandle: string;
        }>;
        error?: string;
    }>;
    /**
     * Send a signal to another peer
     */
    sendSignal: (from: string, to: string, type: string, data: any) => Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Leave a signaling room
     */
    leaveRoom: (peerId: string, repoUrl: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
};
//# sourceMappingURL=orbitApi.d.ts.map
/**
 * Service layer for Orbit P2P Collaboration functionality
 * ALL window.mainProcess.orbit calls MUST be encapsulated here
 *
 * This service handles GitHub OAuth and user management for P2P collaboration,
 * including WebRTC signaling for real-time collaboration features.
 */
import type { OrbitAuthResponse, OrbitStatusResponse, OrbitJoinResponse, OrbitPollResponse } from '../../shared/main-process-api-interfaces/OrbitAPI';
export declare class OrbitService {
    /**
     * Open GitHub OAuth authentication page
     */
    static openAuth(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Exchange OAuth code for access token
     */
    static authenticate(code: string): Promise<OrbitAuthResponse>;
    /**
     * Check user status with token
     */
    static checkStatus(token: string): Promise<OrbitStatusResponse>;
    /**
     * Join a signaling room for collaboration
     */
    static joinRoom(token: string, repoUrl: string): Promise<OrbitJoinResponse>;
    /**
     * Poll for new signals and peer updates
     */
    static pollSignals(peerId: string, repoUrl: string): Promise<OrbitPollResponse>;
    /**
     * Send a signal to another peer
     */
    static sendSignal(from: string, to: string, type: string, data: unknown): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Leave a signaling room
     */
    static leaveRoom(peerId: string, repoUrl: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=OrbitService.d.ts.map
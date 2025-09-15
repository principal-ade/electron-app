/**
 * OAuthServerClient - Adapted from dev-collab-cli for Electron use
 *
 * Handles OAuth authentication flow with the server using PKCE
 */
interface TokenResponse {
    access_token: string;
    token_type: string;
    scope?: string;
    user: {
        login: string;
        email: string;
        name: string;
        id: number;
    };
}
export declare class OAuthServerClient {
    private serverUrl;
    private state;
    private codeVerifier;
    private codeChallenge;
    private forceReauth;
    constructor(config?: {
        serverUrl?: string;
        forceReauth?: boolean;
    });
    authenticate(): Promise<{
        token: string;
        user: TokenResponse['user'];
    }>;
    private pollForToken;
}
export {};
//# sourceMappingURL=OAuthServerClient.d.ts.map
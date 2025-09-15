/**
 * GitHub Device Flow Authentication
 * This is how CLI tools like 'gh' authenticate without needing a redirect URL
 */
export declare class GitHubDeviceAuth {
    private static CLIENT_ID;
    /**
     * Step 1: Request device code from GitHub
     */
    static requestDeviceCode(): Promise<any>;
    /**
     * Step 2: Show user the code and URL
     * User goes to github.com/login/device and enters the code
     */
    static getInstructions(deviceData: any): {
        message: string;
        url: any;
        code: any;
    };
    /**
     * Step 3: Poll GitHub for the access token
     * Keep polling until user completes authentication
     */
    static pollForToken(deviceCode: string): Promise<string>;
    /**
     * Complete flow
     */
    static authenticate(): Promise<string>;
}
//# sourceMappingURL=GitHubDeviceAuth.d.ts.map
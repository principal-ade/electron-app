/**
 * GitHub Device Flow Authentication
 * This is how CLI tools like 'gh' authenticate without needing a redirect URL
 */

export class GitHubDeviceAuth {
  private static CLIENT_ID = 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID'; // Register at github.com/settings/developers
  
  /**
   * Step 1: Request device code from GitHub
   */
  static async requestDeviceCode() {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.CLIENT_ID,
        scope: 'repo user',
      }),
    });

    const data = await response.json();
    
    // Returns:
    // {
    //   device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5",
    //   user_code: "WDJB-MJHT",
    //   verification_uri: "https://github.com/login/device",
    //   expires_in: 900,
    //   interval: 5
    // }
    
    return data;
  }

  /**
   * Step 2: Show user the code and URL
   * User goes to github.com/login/device and enters the code
   */
  static getInstructions(deviceData: any) {
    return {
      message: `Please visit ${deviceData.verification_uri} and enter code: ${deviceData.user_code}`,
      url: deviceData.verification_uri,
      code: deviceData.user_code,
    };
  }

  /**
   * Step 3: Poll GitHub for the access token
   * Keep polling until user completes authentication
   */
  static async pollForToken(deviceCode: string): Promise<string> {
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = 60; // 5 minutes total
    
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        // Success! User completed authentication
        return data.access_token;
      }

      if (data.error === 'authorization_pending') {
        // User hasn't completed auth yet, keep waiting
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      if (data.error === 'slow_down') {
        // We're polling too fast
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
        continue;
      }

      // Other errors (expired, access_denied, etc.)
      throw new Error(data.error_description || data.error);
    }

    throw new Error('Authentication timeout');
  }

  /**
   * Complete flow
   */
  static async authenticate(): Promise<string> {
    // 1. Get device code
    const deviceData = await this.requestDeviceCode();
    
    // 2. Show instructions to user
    const instructions = this.getInstructions(deviceData);
    console.log(instructions.message);
    
    // In Electron, you could:
    // - Show a dialog with the code
    // - Open the browser to the verification URL
    // - Copy code to clipboard
    
    // 3. Poll for token
    const token = await this.pollForToken(deviceData.device_code);
    
    return token;
  }
}
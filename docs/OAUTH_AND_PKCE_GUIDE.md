# GitHub OAuth and PKCE Configuration Guide

This document explains where the GitHub OAuth application variables and PKCE (Proof Key for Code Exchange) logic are handled in this project.

## GitHub OAuth App Variables

The configuration for the GitHub OAuth application is managed in two key places:

1.  **Server-Side Environment Variables**: The `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set as environment variables on the server. This is a security best practice to avoid exposing sensitive credentials on the client-side. For detailed setup instructions, refer to the [GitHub OAuth Setup Guide](GITHUB_OAUTH_SETUP.md).

2.  **Client-Side Configuration**: The client-side application uses the `src/renderer/config/orbit.config.ts` file to determine the correct `redirectUri` for the OAuth flow. This configuration dynamically switches between `localhost` for development and the production domain, ensuring the callback URL matches the environment.

## PKCE (Proof Key for Code Exchange)

The application uses the `pkce-challenge` library for implementing the PKCE flow, which adds an extra layer of security to the OAuth process.

Based on an analysis of the codebase, the PKCE implementation is handled **entirely on the server**. While the `pkce-challenge` dependency is listed in `package.json`, there are no instances of it being imported or used within the client-side source code (`src/`).

This indicates that the client's responsibility is to initiate the OAuth flow, and the server manages the creation and verification of the PKCE challenge and verifier, handling the exchange with GitHub securely. This approach aligns with the best practice of keeping the client application as simple as possible and centralizing the security-sensitive logic on the server.
import React from 'react';
interface UserPromptProviderProps {
    children: React.ReactNode;
}
/**
 * UserPromptProvider - Provides global user prompt functionality
 * Add this to your app's root component to enable MCP user prompts
 *
 * Example usage in App.tsx:
 * ```tsx
 * import { UserPromptProvider } from './components/mcp/UserPromptProvider';
 *
 * function App() {
 *   return (
 *     <ChakraProvider>
 *       <UserPromptProvider>
 *       </UserPromptProvider>
 *     </ChakraProvider>
 *   );
 * }
 * ```
 */
export declare const UserPromptProvider: React.FC<UserPromptProviderProps>;
export {};
//# sourceMappingURL=UserPromptProvider.d.ts.map
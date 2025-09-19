import React from 'react';
import { UserPromptModal, useUserPrompts } from './UserPromptModal';

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
export const UserPromptProvider: React.FC<UserPromptProviderProps> = ({
  children,
}) => {
  const { activePrompt, isOpen, handleResponse, handleClose } =
    useUserPrompts();

  return (
    <>
      {children}
      <UserPromptModal
        isOpen={isOpen}
        onClose={handleClose}
        prompt={activePrompt}
        onResponse={handleResponse}
      />
    </>
  );
};

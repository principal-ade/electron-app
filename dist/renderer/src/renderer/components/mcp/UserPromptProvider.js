import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { UserPromptModal, useUserPrompts } from './UserPromptModal';
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
export const UserPromptProvider = ({ children }) => {
    const { activePrompt, isOpen, handleResponse, handleClose } = useUserPrompts();
    return (_jsxs(_Fragment, { children: [children, _jsx(UserPromptModal, { isOpen: isOpen, onClose: handleClose, prompt: activePrompt, onResponse: handleResponse })] }));
};

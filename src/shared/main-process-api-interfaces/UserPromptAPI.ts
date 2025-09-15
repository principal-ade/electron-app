/**
 * User Prompt API - Interface for MCP to request user input
 * Allows MCP tools to show prompts/dialogs and get user responses
 */

export interface UserPromptRequest {
  id: string;
  title: string;
  message: string;
  type: 'text' | 'confirm' | 'select' | 'multiline';
  options?: string[]; // For select type
  defaultValue?: string | boolean;
  placeholder?: string;
  required?: boolean;
  timeout?: number; // Timeout in milliseconds
  filePath?: string; // Optional context path for routing prompts to a repo/project
}

export interface UserPromptResponse {
  id: string;
  success: boolean;
  value?: string | boolean | null;
  error?: string;
  cancelled?: boolean;
}

export enum UserPromptAPIEvents {
  // Request operations
  SHOW_PROMPT = 'user-prompt:show',
  CANCEL_PROMPT = 'user-prompt:cancel',
  
  // Response events
  PROMPT_RESPONSE = 'user-prompt:response',
  PROMPT_CANCELLED = 'user-prompt:cancelled',
  PROMPT_TIMEOUT = 'user-prompt:timeout',
  IS_PROMPT_ACTIVE = 'user-prompt:is-active',
}

export interface UserPromptAPI {
  // Show a prompt to the user and wait for response
  showPrompt: (request: UserPromptRequest) => Promise<UserPromptResponse>;

  // Listen for prompt requests
  onShowPrompt: (callback: (request: UserPromptRequest) => void) => () => void;

  // Send a response to a prompt
  sendResponse: (response: UserPromptResponse) => void;

  // Send a cancelled event to a prompt
  sendCancelled: (promptId: string) => void;

  // Cancel an active prompt
  cancelPrompt: (promptId: string) => Promise<void>;
  
  // Check if a prompt is currently active
  isPromptActive: (promptId: string) => Promise<boolean>;
}
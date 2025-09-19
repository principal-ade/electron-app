import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import {
  UserPromptRequest,
  UserPromptResponse,
} from '../../../shared/main-process-api-interfaces/UserPromptAPI';
import { UserPromptService } from '../../main-process-api/UserPromptService';

interface UserPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: UserPromptRequest | null;
  onResponse: (response: UserPromptResponse) => void;
}

export const UserPromptModal: React.FC<UserPromptModalProps> = ({
  isOpen,
  onClose,
  prompt,
  onResponse,
}) => {
  const { theme } = useTheme();
  const [value, setValue] = useState<string | boolean>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (prompt?.defaultValue !== undefined) {
      setValue(prompt.defaultValue);
    } else {
      setValue('');
    }
  }, [prompt]);

  const handleSubmit = useCallback(() => {
    if (!prompt) return;

    if (prompt.required && !value) {
      // Could add a visual indicator here
      return;
    }

    setIsSubmitting(true);

    const response: UserPromptResponse = {
      id: prompt.id,
      success: true,
      value: value || null,
    };

    onResponse(response);
    setValue('');
    setIsSubmitting(false);
    onClose();
  }, [prompt, value, onResponse, onClose]);

  const handleCancel = useCallback(() => {
    if (!prompt) return;

    const response: UserPromptResponse = {
      id: prompt.id,
      success: false,
      cancelled: true,
    };

    onResponse(response);
    setValue('');
    onClose();
  }, [prompt, onResponse, onClose]);

  const handleIgnore = useCallback(() => {
    // Same as cancel, but explicitly labeled as ignore for UX
    handleCancel();
  }, [handleCancel]);

  const handleSnooze = useCallback(
    (minutes: number = 10) => {
      if (!prompt) return;
      // For now, just cancel and let caller re-issue later; store an FYI in console
      console.log(`[UserPrompt] Snoozed for ${minutes} minutes`, {
        id: prompt.id,
        filePath: prompt.filePath,
      });
      handleCancel();
    },
    [prompt, handleCancel],
  );

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && prompt?.type !== 'multiline') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && !prompt?.required) {
      handleCancel();
    }
  };

  const renderInput = () => {
    if (!prompt) return null;

    const inputStyle = {
      width: '100%',
      padding: '8px 12px',
      backgroundColor: theme.colors.backgroundSecondary,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '4px',
      color: theme.colors.text,
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
    } as React.CSSProperties;

    switch (prompt.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
            placeholder={prompt.placeholder}
            autoFocus
            onKeyPress={handleKeyPress}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
        );

      case 'multiline':
        return (
          <textarea
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
            placeholder={prompt.placeholder}
            rows={5}
            autoFocus
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '100px',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
        );

      case 'confirm':
        return (
          <p
            style={{
              margin: '16px 0',
              fontSize: '14px',
              color: theme.colors.text,
              lineHeight: '1.5',
            }}
          >
            {prompt.message}
          </p>
        );

      case 'select':
        return (
          <select
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <option value="">Select an option</option>
            {prompt.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  if (!prompt || !isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={!prompt.required ? handleCancel : undefined}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: '16px',
          }}
        >
          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{prompt.title || 'Input Required'}</span>
          </h3>
          {/* show path context */}
          {prompt.filePath && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: theme.colors.textSecondary,
                wordBreak: 'break-all',
              }}
            >
              Context: {prompt.filePath}
            </div>
          )}
          {prompt.type !== 'confirm' && (
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '14px',
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
              }}
            >
              {prompt.message}
            </p>
          )}
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          {renderInput()}
          {prompt.required && !value && prompt.type !== 'confirm' && (
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: theme.colors.error || '#ef4444',
              }}
            >
              This field is required
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          {!prompt.required && (
            <>
              <button
                onClick={handleIgnore}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Ignore
              </button>
              <button
                onClick={() => handleSnooze(10)}
                title="Remind me in 10 minutes"
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Snooze 10m
              </button>
            </>
          )}
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (prompt.required && !value && prompt.type !== 'confirm')
            }
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor:
                isSubmitting ||
                (prompt.required && !value && prompt.type !== 'confirm')
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '14px',
              opacity:
                isSubmitting ||
                (prompt.required && !value && prompt.type !== 'confirm')
                  ? 0.6
                  : 1,
            }}
          >
            {prompt.type === 'confirm' ? 'Confirm' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook to manage user prompts globally
export const useUserPrompts = () => {
  const [activePrompt, setActivePrompt] = useState<UserPromptRequest | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen for prompt requests from main process
    const unsubscribe = UserPromptService.onShowPrompt((request) => {
      setActivePrompt(request);
      setIsOpen(true);
    });

    return unsubscribe;
  }, []);

  const handleResponse = useCallback((response: UserPromptResponse) => {
    // Send response back to main process
    UserPromptService.sendResponse(response);
    setIsOpen(false);
    setActivePrompt(null);
  }, []);

  const handleClose = useCallback(() => {
    if (activePrompt && !activePrompt.required) {
      UserPromptService.sendCancelled(activePrompt.id);
      setIsOpen(false);
      setActivePrompt(null);
    }
  }, [activePrompt]);

  return {
    activePrompt,
    isOpen,
    handleResponse,
    handleClose,
  };
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Loader,
  Copy,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { SSHSetupService } from '../../../../main-process-api/SSHSetupService';
import type { SSHKeyInfo } from '../../../../../shared/main-process-api-interfaces/SSHSetupAPI';

interface SSHSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Called when setup completes successfully
  repositoryUrl?: string; // Show which repo they're setting up for
}

type WizardStep =
  | 'intro'
  | 'generating'
  | 'upload'
  | 'testing'
  | 'complete'
  | 'error';

export const SSHSetupWizard: React.FC<SSHSetupWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  repositoryUrl,
}) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [keyInfo, setKeyInfo] = useState<SSHKeyInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [testInProgress, setTestInProgress] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('intro');
      setKeyInfo(null);
      setError('');
      setCopied(false);
      setTestInProgress(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async () => {
    setCurrentStep('generating');
    setError('');

    try {
      // Generate SSH key and configure SSH
      const setupResult = await SSHSetupService.completeSetup();

      if (setupResult.success && setupResult.keyInfo) {
        setKeyInfo(setupResult.keyInfo);
        setCurrentStep('upload');

        // Auto-copy the public key to clipboard
        await handleCopyKey();
      } else {
        setError(setupResult.error || 'Failed to generate SSH key');
        setCurrentStep('error');
      }
    } catch (err) {
      console.error('[SSHSetupWizard] Setup failed:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
      setCurrentStep('error');
    }
  };

  const handleCopyKey = async () => {
    if (!keyInfo) return;

    try {
      await navigator.clipboard.writeText(keyInfo.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('[SSHSetupWizard] Failed to copy:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const handleOpenGitHub = () => {
    window.open('https://github.com/settings/ssh/new', '_blank');
  };

  const handleTestConnection = async () => {
    setTestInProgress(true);
    setCurrentStep('testing');
    setError('');

    try {
      const result = await SSHSetupService.testConnection();

      if (result.success) {
        setCurrentStep('complete');
        // Wait a brief moment before calling onSuccess
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(result.message || 'Connection test failed');
        setCurrentStep('error');
      }
    } catch (err) {
      console.error('[SSHSetupWizard] Test failed:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to test connection',
      );
      setCurrentStep('error');
    } finally {
      setTestInProgress(false);
    }
  };

  const handleRetry = () => {
    if (keyInfo) {
      // If we already have a key, go back to upload step
      setCurrentStep('upload');
      setError('');
    } else {
      // Otherwise, start from beginning
      setCurrentStep('intro');
      setError('');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: theme.colors.text }}
              >
                Set Up SSH Authentication
              </h3>
              <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
                {repositoryUrl
                  ? `To clone this repository, you'll need SSH authentication:`
                  : 'SSH authentication provides secure access to your repositories.'}
              </p>
              {repositoryUrl && (
                <code
                  className="block text-xs p-2 rounded mb-3 break-all"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.primary,
                  }}
                >
                  {repositoryUrl}
                </code>
              )}
              <div className="space-y-2">
                <h4
                  className="font-semibold text-sm"
                  style={{ color: theme.colors.text }}
                >
                  This wizard will:
                </h4>
                <ul className="space-y-1 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Generate a secure SSH key on your computer</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Configure SSH settings automatically</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Guide you through uploading the key to GitHub</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Test the connection to ensure it works</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                className="px-4 py-2 rounded transition-colors flex items-center"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                }}
              >
                <Key size={16} className="mr-2" />
                Start Setup
              </button>
            </div>
          </div>
        );

      case 'generating':
        return (
          <div className="text-center py-8">
            <Loader size={48} className="animate-spin mx-auto mb-4" style={{ color: theme.colors.primary }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
              Generating SSH Key
            </h3>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Creating your secure SSH key pair...
            </p>
          </div>
        );

      case 'upload':
        return (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div className="flex items-start mb-3">
                <CheckCircle size={20} className="mr-2 mt-0.5 flex-shrink-0" style={{ color: theme.colors.primary }} />
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                    SSH Key Generated
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Your SSH key has been created and configured.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                Step 1: Copy your public key
              </h4>
              <div className="relative">
                <textarea
                  readOnly
                  value={keyInfo?.publicKey || ''}
                  className="w-full p-3 rounded font-mono text-xs resize-none"
                  rows={3}
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                />
                <button
                  onClick={handleCopyKey}
                  className="absolute top-2 right-2 px-3 py-1.5 rounded flex items-center text-sm transition-colors"
                  style={{
                    backgroundColor: copied ? theme.colors.primary : theme.colors.backgroundSecondary,
                    color: copied ? theme.colors.background : theme.colors.text,
                  }}
                >
                  {copied ? (
                    <>
                      <CheckCircle size={14} className="mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="mr-1" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                Step 2: Add the key to GitHub
              </h4>
              <button
                onClick={handleOpenGitHub}
                className="w-full px-4 py-3 rounded flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <ExternalLink size={16} className="mr-2" />
                Open GitHub SSH Settings
              </button>
              <p className="text-xs mt-2" style={{ color: theme.colors.textSecondary }}>
                Paste your key in the "Key" field and click "Add SSH key"
              </p>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testInProgress}
                className="px-4 py-2 rounded transition-colors flex items-center"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                  opacity: testInProgress ? 0.5 : 1,
                }}
              >
                Test Connection
                <ArrowRight size={16} className="ml-2" />
              </button>
            </div>
          </div>
        );

      case 'testing':
        return (
          <div className="text-center py-8">
            <Loader size={48} className="animate-spin mx-auto mb-4" style={{ color: theme.colors.primary }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
              Testing Connection
            </h3>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Verifying your SSH connection to GitHub...
            </p>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center py-8">
            <CheckCircle size={64} className="mx-auto mb-4" style={{ color: theme.colors.primary }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text }}>
              SSH Setup Complete!
            </h3>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Your SSH authentication is configured and working.
            </p>
            <p className="text-sm mt-2" style={{ color: theme.colors.textSecondary }}>
              Retrying repository clone...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: `${theme.colors.error}15`,
                border: `1px solid ${theme.colors.error}`,
              }}
            >
              <div className="flex items-start">
                <AlertCircle size={20} className="mr-2 mt-0.5 flex-shrink-0" style={{ color: theme.colors.error }} />
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: theme.colors.error }}>
                    Setup Failed
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.text }}>
                    {error}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && currentStep !== 'generating' && currentStep !== 'testing') {
          onClose();
        }
      }}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-2xl mx-4"
        style={{
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <div className="flex items-center">
            <Key size={20} className="mr-2" style={{ color: theme.colors.primary }} />
            <h2 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
              SSH Setup Wizard
            </h2>
          </div>
          {currentStep !== 'generating' && currentStep !== 'testing' && (
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors"
              style={{ color: theme.colors.textSecondary }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">{renderStepContent()}</div>
      </div>
    </div>
  );
};

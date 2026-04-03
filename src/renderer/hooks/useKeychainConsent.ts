/**
 * useKeychainConsent - Hook for managing keychain consent state
 *
 * Handles the first-run keychain permission flow, tracking whether
 * the user has granted consent for secure credential storage.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { AuthenticationService } from '../main-process-api/AuthenticationService';
import type { KeychainConsentStatus } from '../../shared/types/userPreferences.types';

export interface KeychainConsentState {
  status: KeychainConsentStatus;
  isLoading: boolean;
  showModal: boolean;
  error: string | null;
}

export interface UseKeychainConsentReturn extends KeychainConsentState {
  grantConsent: () => Promise<void>;
  declineConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
  requestConsent: () => void;
  closeModal: () => void;
}

// Context for sharing keychain consent state across components
const KeychainConsentContext = createContext<UseKeychainConsentReturn | null>(null);

export const KeychainConsentProvider = KeychainConsentContext.Provider;

/**
 * Hook to access keychain consent state from context
 * Must be used within a component that provides KeychainConsentContext
 */
export function useKeychainConsentContext(): UseKeychainConsentReturn {
  const context = useContext(KeychainConsentContext);
  if (!context) {
    throw new Error(
      'useKeychainConsentContext must be used within a KeychainConsentProvider',
    );
  }
  return context;
}

/**
 * Main hook for managing keychain consent state
 * This should be used at the app level to initialize the consent flow
 */
export function useKeychainConsent(): UseKeychainConsentReturn {
  const [status, setStatus] = useState<KeychainConsentStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load consent status on mount
  useEffect(() => {
    let mounted = true;

    const loadConsentStatus = async () => {
      try {
        const consent = await AuthenticationService.getKeychainConsent();
        if (!mounted) return;

        setStatus(consent.status);
        setIsLoading(false);

        // Show modal on first run (status is 'pending')
        if (consent.status === 'pending') {
          setShowModal(true);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[useKeychainConsent] Failed to load consent status:', err);
        setError(err instanceof Error ? err.message : 'Failed to load consent status');
        setIsLoading(false);
      }
    };

    loadConsentStatus();

    return () => {
      mounted = false;
    };
  }, []);

  // Grant consent and initialize keychain auth
  const grantConsent = useCallback(async () => {
    try {
      setError(null);

      // Save consent status
      const setResult = await AuthenticationService.setKeychainConsent({
        status: 'granted',
      });

      if (!setResult.success) {
        throw new Error(setResult.error || 'Failed to save consent');
      }

      setStatus('granted');
      setShowModal(false);

      // Initialize keychain auth (this will trigger the macOS keychain prompt)
      console.info('[useKeychainConsent] Initializing keychain auth...');
      const initResult = await AuthenticationService.initializeKeychainAuth();

      if (!initResult.success) {
        console.warn(
          '[useKeychainConsent] Keychain auth initialization failed:',
          initResult.error,
        );
        // Don't throw - consent is still granted, auth just failed to initialize
        setError(initResult.error || 'Failed to initialize keychain auth');
      } else {
        console.info('[useKeychainConsent] Keychain auth initialized successfully');
      }
    } catch (err) {
      console.error('[useKeychainConsent] Grant consent failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to grant consent');
      throw err;
    }
  }, []);

  // Decline consent
  const declineConsent = useCallback(async () => {
    try {
      setError(null);

      const result = await AuthenticationService.setKeychainConsent({
        status: 'declined',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save consent');
      }

      setStatus('declined');
      setShowModal(false);
      console.info('[useKeychainConsent] Consent declined');
    } catch (err) {
      console.error('[useKeychainConsent] Decline consent failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to decline consent');
      throw err;
    }
  }, []);

  // Revoke previously granted consent (keeps stored credentials)
  const revokeConsent = useCallback(async () => {
    try {
      setError(null);

      const result = await AuthenticationService.setKeychainConsent({
        status: 'declined',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to revoke consent');
      }

      setStatus('declined');
      console.info('[useKeychainConsent] Consent revoked (credentials preserved)');
    } catch (err) {
      console.error('[useKeychainConsent] Revoke consent failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke consent');
      throw err;
    }
  }, []);

  // Request consent (show modal)
  const requestConsent = useCallback(() => {
    setShowModal(true);
  }, []);

  // Close modal without changing consent
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    status,
    isLoading,
    showModal,
    error,
    grantConsent,
    declineConsent,
    revokeConsent,
    requestConsent,
    closeModal,
  };
}

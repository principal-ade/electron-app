import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import { PrincipalEventProvider } from './PrincipalEventContext';
import { PortalEventProvider } from './PortalEventContext';
import { PortalTabsProvider } from './PortalTabsContext';
import { PortalIntentBridge } from './components/PortalIntentBridge';
import { IntegratedShell } from './components/IntegratedShell/IntegratedShell';
import { KeychainConsentModal } from '../components/KeychainConsentModal';
import {
  useKeychainConsent,
  KeychainConsentProvider,
} from '../hooks/useKeychainConsent';

/**
 * Inner component that uses the keychain consent hook
 * and renders the modal when needed
 */
const KeychainConsentWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const keychainConsent = useKeychainConsent();

  return (
    <KeychainConsentProvider value={keychainConsent}>
      {children}
      <KeychainConsentModal
        isOpen={keychainConsent.showModal}
        onConsent={keychainConsent.grantConsent}
        onDecline={keychainConsent.declineConsent}
      />
    </KeychainConsentProvider>
  );
};

export const PrincipalApp: React.FC = () => {
  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <KeychainConsentWrapper>
          <MemoryRouter>
            <PrincipalEventProvider>
              <PortalEventProvider>
                <PortalTabsProvider>
                  {/* Always-mounted listener on the portal bus, so the titlebar
                      can open content into a view that isn't mounted yet. */}
                  <PortalIntentBridge />
                  <IntegratedShell />
                </PortalTabsProvider>
              </PortalEventProvider>
            </PrincipalEventProvider>
          </MemoryRouter>
        </KeychainConsentWrapper>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};

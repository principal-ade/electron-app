import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import { PrincipalEventProvider } from './PrincipalEventContext';
import { IntegratedShell } from './components/IntegratedShell/IntegratedShell';

export const PrincipalApp: React.FC = () => {
  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <MemoryRouter>
          <PrincipalEventProvider>
            <IntegratedShell />
          </PrincipalEventProvider>
        </MemoryRouter>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};

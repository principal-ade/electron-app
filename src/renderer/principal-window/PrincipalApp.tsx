import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import { IntegratedShell } from './components/IntegratedShell/IntegratedShell';

export const PrincipalApp: React.FC = () => {
  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <MemoryRouter>
          <IntegratedShell />
        </MemoryRouter>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};

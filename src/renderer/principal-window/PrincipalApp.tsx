import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import { UserPromptProvider } from '../components/mcp/UserPromptProvider';
import { IntegratedShell } from './components/IntegratedShell/IntegratedShell';

export const PrincipalApp: React.FC = () => {
  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <UserPromptProvider>
          <MemoryRouter>
            <IntegratedShell />
          </MemoryRouter>
        </UserPromptProvider>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};
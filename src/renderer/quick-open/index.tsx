import { createRoot } from 'react-dom/client';
import QuickOpenApp from './QuickOpenApp';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

root.render(
  <CustomThemeProvider>
    <QuickOpenApp />
  </CustomThemeProvider>,
);

import { createRoot } from 'react-dom/client';
import QuickOpenApp from './QuickOpenApp';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<QuickOpenApp />);

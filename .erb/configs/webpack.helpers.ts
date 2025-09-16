import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

export { require };

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = fileURLToPath(new URL('.', import.meta.url));
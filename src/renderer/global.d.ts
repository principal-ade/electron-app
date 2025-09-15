import type { MainProcessAPI } from '../shared/main-process-api-interfaces/index';

declare global {
  interface Window {
    mainProcess: MainProcessAPI;
    appName: string;
    __preloadTest?: { test: string };
  }
}

export {};
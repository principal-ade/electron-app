/**
 * Type definitions for Electron utility process globals
 */

import type { MessagePort } from 'worker_threads';

declare global {
  namespace NodeJS {
    interface Process {
      /**
       * Message port for Electron utility process communication with main process
       * Available when running as an Electron utility process
       */
      parentPort?: MessagePort;
    }
  }
}

export {};

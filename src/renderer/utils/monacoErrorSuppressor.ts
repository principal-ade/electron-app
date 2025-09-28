/**
 * Suppress Monaco Editor cancellation errors in development
 * These are harmless errors that occur when Monaco cleans up its internal operations
 */
export function suppressMonacoCancellationErrors() {
  if (typeof window === 'undefined') return;

  // Store original Promise.reject
  const originalReject = Promise.reject;

  // Override Promise.reject to filter out Monaco cancellation errors
  Promise.reject = function(reason: any) {
    // Check if this is a Monaco cancellation error
    if (reason && (
      reason.message === 'Canceled' ||
      reason.toString() === 'Canceled' ||
      reason.toString() === 'Canceled: Canceled' ||
      (reason.stack && (
        reason.stack.includes('Delayer.cancel') ||
        reason.stack.includes('Delayer.dispose') ||
        reason.stack.includes('DisposableStore') ||
        reason.stack.includes('WordHighlighter')
      ))
    )) {
      // Return a resolved promise instead of rejected for Monaco cancellation errors
      // This prevents the error from propagating to React's error overlay
      return Promise.resolve(undefined) as any;
    }

    // For all other errors, use the original reject
    return originalReject.call(this, reason);
  };

  // Also patch the global error event to catch any that slip through
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function(event: string, handler: any, ...args: any[]) {
    if (event === 'error' || event === 'unhandledrejection') {
      const wrappedHandler = function(e: any) {
        const error = e.reason || e.error || e;
        const errorStr = error?.toString() || '';
        const stack = error?.stack || '';
        const message = error?.message || '';

        if (
          errorStr.includes('Canceled') ||
          message.includes('Canceled') ||
          stack.includes('Delayer') ||
          stack.includes('DisposableStore') ||
          stack.includes('WordHighlighter') ||
          stack.includes('monaco-editor')
        ) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        return handler.call(this, e);
      };
      return originalAddEventListener.call(this, event, wrappedHandler, ...args);
    }
    return originalAddEventListener.call(this, event, handler, ...args);
  } as any;

  // Override console.error FIRST before anything else
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  const shouldSuppress = (str: string) => {
    return str.includes('Canceled') ||
           str.includes('Delayer.cancel') ||
           str.includes('Delayer.dispose') ||
           str.includes('DisposableStore') ||
           str.includes('WordHighlighter.dispose') ||
           str.includes('WordHighlighter');
  };

  console.error = function(...args: any[]) {
    const errorStr = args.join(' ');
    if (shouldSuppress(errorStr)) return;
    return originalConsoleError.apply(console, args);
  };

  console.warn = function(...args: any[]) {
    const errorStr = args.join(' ');
    if (shouldSuppress(errorStr)) return;
    return originalConsoleWarn.apply(console, args);
  };

  console.log = function(...args: any[]) {
    const errorStr = args.join(' ');
    if (shouldSuppress(errorStr)) return;
    return originalConsoleLog.apply(console, args);
  };

  // Patch setTimeout/setInterval to catch errors in async callbacks
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback: any, delay?: number, ...args: any[]) {
    if (typeof callback === 'function') {
      const wrappedCallback = function() {
        try {
          return callback.apply(this, arguments);
        } catch (error: any) {
          if (error?.message?.includes('Canceled') || error?.toString()?.includes('Canceled')) {
            // Suppress the error
            return;
          }
          throw error;
        }
      };
      return originalSetTimeout.call(this, wrappedCallback, delay, ...args);
    }
    return originalSetTimeout.call(this, callback, delay, ...args);
  } as any;
}

// Auto-initialize when this module is imported
suppressMonacoCancellationErrors();
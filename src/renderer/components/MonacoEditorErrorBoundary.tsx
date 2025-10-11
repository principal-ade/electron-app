import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error boundary specifically for Monaco Editor to catch and suppress
 * harmless cancellation errors during cleanup
 */
export class MonacoEditorErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Check if this is a Monaco cancellation error
    if (
      error.message?.includes('Canceled') ||
      error.toString().includes('Canceled') ||
      error.stack?.includes('Delayer') ||
      error.stack?.includes('DisposableStore') ||
      error.stack?.includes('WordHighlighter')
    ) {
      // Don't update state for these harmless errors
      console.debug('Suppressed Monaco Editor cleanup error');
      return { hasError: false, error: null };
    }

    // For other errors, show the error boundary
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log non-Monaco errors
    if (
      !error.message?.includes('Canceled') &&
      !error.toString().includes('Canceled') &&
      !error.stack?.includes('Delayer') &&
      !error.stack?.includes('DisposableStore') &&
      !error.stack?.includes('WordHighlighter')
    ) {
      console.error('Monaco Editor error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{ padding: '20px', color: 'red' }}>
            <h3>Editor Error</h3>
            <p>
              {this.state.error?.message || 'An error occurred in the editor'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Retry
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

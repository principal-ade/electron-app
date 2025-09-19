import React, { Component, ReactNode } from 'react';
import { defaultTheme as theme } from 'themed-markdown';
import { SystemService } from './main-process-api/SystemService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="min-h-screen flex items-center justify-center p-8"
          style={{
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
          }}
        >
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details
                className="text-left p-4 rounded-lg"
                style={{ backgroundColor: theme.colors.surface }}
              >
                <summary className="cursor-pointer mb-2">Error details</summary>
                <pre className="text-xs overflow-auto text-red-400">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => SystemService.restartApp()}
              className="mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

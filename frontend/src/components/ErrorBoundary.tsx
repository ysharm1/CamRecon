import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Top-level error boundary that shows a friendly message instead of a white screen.
 * Catches synchronous render errors in child components.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleReport = (): void => {
    const subject = encodeURIComponent('PropDoc error report');
    const body = encodeURIComponent(
      [
        'Please describe what you were doing:',
        '',
        '---',
        `Error: ${this.state.error?.message ?? 'Unknown'}`,
        `URL: ${window.location.href}`,
        `Time: ${new Date().toISOString()}`,
      ].join('\n'),
    );
    window.open(`mailto:support@propdoc.example?subject=${subject}&body=${body}`);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-50 p-2.5">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              We hit an unexpected error. Your data is safe. Try reloading the page, and if the
              issue persists, report it and we'll take a look.
            </p>
            {this.state.error?.message && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <RefreshCcw className="h-4 w-4" />
                Reload page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Home className="h-4 w-4" />
                Go home
              </button>
              <button
                type="button"
                onClick={this.handleReport}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Report this issue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xs sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-1.5 text-xs text-slate-500">
              An unexpected error occurred while rendering the page.
            </p>
            {this.state.error?.message && (
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left font-mono text-xs text-slate-600 break-all">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 transition focus:outline-hidden"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


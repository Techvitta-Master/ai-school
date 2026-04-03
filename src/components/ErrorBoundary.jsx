import { Component } from 'react';
import * as Sentry from '@sentry/browser';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Avoid crashing if Sentry isn't configured.
    try {
      if (Sentry && typeof Sentry.captureException === 'function') {
        Sentry.captureException(error, { extra: info });
      }
    } catch {
      // no-op
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') this.props.onReset();
  };

  render() {
    const { hasError, error } = this.state;
    const message =
      error?.message || (typeof error === 'string' ? error : 'Something went wrong.');

    if (!hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Unexpected error</h2>
          <p className="mt-2 text-sm text-slate-600">
            {message}
          </p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Try again
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Reload page
            </button>
          </div>

          {!import.meta.env.PROD && error && (
            <details className="mt-4">
              <summary className="text-sm text-slate-600 cursor-pointer select-none">Details</summary>
              <pre className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">
                {String(error)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}


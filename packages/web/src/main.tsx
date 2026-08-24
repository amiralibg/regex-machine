import { StrictMode, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

/**
 * Last-resort boundary: a render crash must never blank the page silently —
 * it shows the error so bugs are reportable.
 */
class CrashBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('render crash:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <pre
          style={{
            color: '#ef7f7f',
            background: '#15171e',
            padding: 24,
            margin: 24,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {`render crashed — please report this:\n\n${this.state.error.stack ?? String(this.state.error)}`}
        </pre>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashBoundary>
      <App />
    </CrashBoundary>
  </StrictMode>,
);

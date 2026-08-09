import { Component } from 'react';

/**
 * ErrorBoundary — React runtime xatolarini ushlab, UI'ni crash'dan himoya qiladi.
 *
 * Ishlatish:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * Biror komponentda uncaught exception bo'lsa, fallback UI ko'rsatiladi.
 * Boshqa komponentlar ta'sirlanmaydi.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Keyingi render'da fallback UI ko'rsatiladi
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Xatoni loglash (production'da Sentry yoki boshqa monitoring'ga yuborish mumkin)
    console.error('[ErrorBoundary] Tutilmagan xato:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI — minimal, lekin foydali
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-app, #0f1117)',
            color: 'var(--text-primary, #e2e8f0)',
            fontFamily: '"Space Grotesk", sans-serif',
            padding: '24px',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary, #e2e8f0)',
              margin: 0,
            }}
          >
            Kutilmagan xato yuz berdi
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary, #94a3b8)',
              maxWidth: '420px',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Sahifani yangilang yoki quyidagi tugma bilan qayta urinib ko'ring.
          </p>

          {/* Development'da xato tafsilotlari */}
          {import.meta.env.DEV && this.state.error && (
            <details
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                maxWidth: '560px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#fca5a5',
                wordBreak: 'break-all',
              }}
            >
              <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: 600 }}>
                Xato tafsilotlari (faqat development)
              </summary>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                background: 'var(--accent-primary, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Qayta urinib ko'rish
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                color: 'var(--text-secondary, #94a3b8)',
                border: '1px solid var(--border-default, #334155)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sahifani yangilash
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

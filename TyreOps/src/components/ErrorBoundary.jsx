import { Component } from 'react'

// Catches render crashes anywhere below it in the tree and shows a
// recovery screen instead of a blank white page. Without this, a single
// component error (e.g. a store value referenced in the wrong scope)
// blanks the entire app with no way back except devtools.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text)', padding: '20px',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
          padding: '32px', maxWidth: '440px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
            Something went wrong
          </div>
          <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '20px' }}>
            The page hit an unexpected error. Your data is safe — it lives in the database, not this page.
          </div>
          <details style={{ textAlign: 'left', marginBottom: '20px', fontSize: '11px', color: 'var(--text3)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '6px' }}>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'DM Mono, monospace' }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </details>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/tyreops/dashboard' }}
              style={{
                background: 'var(--accent)', color: 'var(--accent-text)', border: 'none',
                borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }
}

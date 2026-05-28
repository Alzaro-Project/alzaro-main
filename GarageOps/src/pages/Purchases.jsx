// ============================================================
// Purchases — placeholder
// ------------------------------------------------------------
// Full Purchase Recording module is the next phase: supplier,
// date, category, VAT, payment status, receipt upload to
// Supabase Storage. For now this just acknowledges the page
// exists so the sidebar nav works.
// ============================================================

const T = {
  surface: '#14121a', border: 'rgba(255,255,255,0.06)',
  red: '#e53935', text: '#f8f7fa', text2: '#9d99a8', text3: '#5c586a',
}

export default function Purchases() {
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Purchases</div>
        <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
          Record what you buy from suppliers — parts, tyres, oils, tools, consumables
        </div>
      </div>

      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: '12px', padding: '50px 20px', textAlign: 'center',
      }}>
        <i className="ti ti-shopping-cart" style={{ fontSize: '40px', color: T.text3, marginBottom: '14px' }} aria-hidden="true" />
        <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '8px' }}>Purchase recording coming next</div>
        <div style={{ fontSize: '13px', color: T.text2, maxWidth: '420px', margin: '0 auto 16px' }}>
          Snap a supplier invoice or receipt, log the spend with VAT, attach the photo or PDF. Feeds your VAT return automatically.
        </div>
        <div style={{ fontSize: '11px', color: T.text3, fontFamily: 'monospace' }}>
          Phase 2 build
        </div>
      </div>
    </div>
  )
}

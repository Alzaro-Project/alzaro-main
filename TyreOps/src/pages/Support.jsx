import React, { useEffect, useRef, useState } from 'react'
import { createSupportClient, SUPPORT_FLAG } from '../lib/supabase.js'

// ---------------------------------------------------------------------------
// /tyreops/support — the landing an admin's "View client portal" button opens.
//
// It receives a one-time token in the URL FRAGMENT (#tk=…). Fragments are never
// transmitted to a server, so the token stays out of Vercel logs and Referer
// headers. We redeem it against a tab-scoped client, record who is inside the
// account and why, then hard-reload into the dashboard so the app's main client
// rebuilds itself in support mode (see lib/supabase.js).
//
// The URL is scrubbed immediately after reading, so the token isn't left in
// history or recoverable from the address bar.
// ---------------------------------------------------------------------------

function parseFragment() {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return null
  const p = new URLSearchParams(raw)
  const tk = p.get('tk')
  if (!tk) return null
  return {
    tk,
    sid: p.get('sid') || '',
    admin: p.get('admin') || 'an Alzaro admin',
    email: p.get('email') || '',
    exp: Number(p.get('exp')) || Date.now() + 60 * 60 * 1000,
  }
}

export default function Support() {
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in dev. The token is one-time,
    // so a second redeem would fail and show a spurious error.
    if (ran.current) return
    ran.current = true

    const params = parseFragment()

    // Wipe the token from the address bar before anything async happens.
    window.history.replaceState(null, '', window.location.pathname)

    if (!params) {
      setError('This support link is incomplete. Start a new session from the platform admin.')
      return
    }

    ;(async () => {
      try {
        const client = createSupportClient()
        const { data, error: err } = await client.auth.verifyOtp({
          token_hash: params.tk,
          type: 'magiclink',
        })
        if (err || !data?.session) {
          setError(
            'This support link has expired or was already used. Start a new session from the platform admin.'
          )
          return
        }

        // Mark the tab as a support session. lib/supabase.js reads this on the
        // next load and builds the app's client against the same tab-scoped
        // store, so the customer's and the admin's real logins stay untouched.
        window.sessionStorage.setItem(
          SUPPORT_FLAG,
          JSON.stringify({
            sid: params.sid,
            admin: params.admin,
            email: params.email || data.session.user?.email || '',
            exp: params.exp,
          })
        )

        // Full reload, not a router navigate: the Supabase client picks its
        // storage once at construction and can't be re-pointed afterwards.
        window.location.replace('/tyreops/dashboard')
      } catch (e) {
        setError('Could not open the account. Start a new session from the platform admin.')
      }
    })()
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '420px' }}>
        {error ? (
          <>
            <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '10px' }}>
              Support session not started
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.6, opacity: 0.7 }}>{error}</div>
          </>
        ) : (
          <div style={{ fontSize: '15px', opacity: 0.7 }}>Opening the account…</div>
        )}
      </div>
    </div>
  )
}

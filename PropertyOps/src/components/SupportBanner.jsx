import React, { useEffect, useState } from 'react'
import { db as sb, SUPPORT_MODE, supportMeta, SUPPORT_FLAG } from '../lib/supabase.js'

// ---------------------------------------------------------------------------
// Shown across the top of every screen while an admin is inside a customer's
// account. Deliberately loud and impossible to dismiss — the one thing that
// must never happen is an admin forgetting whose data they're editing.
//
// Ending a session signs out with scope:'local'. A default signOut revokes the
// refresh token everywhere, which would kick the CUSTOMER out on their own
// phone and laptop — a support visit must leave no trace on their devices.
// ---------------------------------------------------------------------------

function remaining(exp) {
  return Math.max(0, exp - Date.now())
}

function clock(ms) {
  const total = Math.floor(ms / 1000)
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function SupportBanner() {
  const [left, setLeft] = useState(() => (supportMeta ? remaining(supportMeta.exp) : 0))
  const [ending, setEnding] = useState(false)

  const end = React.useCallback(async () => {
    setEnding(true)
    // Best effort: stamp the audit row. Never block the exit on it.
    try {
      const { data } = await sb.auth.getSession()
      const token = data?.session?.access_token
      if (token && supportMeta?.sid) {
        await fetch('/api/admin-impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'end', session_id: supportMeta.sid }),
        })
      }
    } catch (e) { /* ignore — exiting regardless */ }

    try { await sb.auth.signOut({ scope: 'local' }) } catch (e) { /* ignore */ }
    try { window.sessionStorage.removeItem(SUPPORT_FLAG) } catch (e) { /* ignore */ }

    // Try to close the tab. Browsers refuse this for tabs opened with
    // 'noopener', so fall back to the admin panel a tick later — the admin's
    // own /platform login lives in localStorage and is untouched by all this.
    window.close()
    setTimeout(() => window.location.replace('/platform'), 150)
  }, [])

  useEffect(() => {
    if (!SUPPORT_MODE) return
    const t = setInterval(() => {
      const ms = remaining(supportMeta.exp)
      setLeft(ms)
      if (ms <= 0) end()
    }, 1000)
    return () => clearInterval(t)
  }, [end])

  if (!SUPPORT_MODE) return null

  const low = left < 5 * 60 * 1000

  return (
    <>
      {/* Spacer so the banner never covers the app's own header. */}
      <div style={{ height: '44px' }} aria-hidden="true" />
      <div
        role="status"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '44px',
          zIndex: 9999,
          background: '#b91c1c',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '0 16px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: '0 2px 14px rgba(0,0,0,.4)',
        }}
      >
        <span
          style={{
            flexShrink: 0,
            background: 'rgba(0,0,0,.25)',
            padding: '3px 9px',
            borderRadius: '6px',
            fontSize: '11px',
            letterSpacing: '.6px',
            textTransform: 'uppercase',
          }}
        >
          Support session
        </span>

        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          You are signed in as {supportMeta.email || 'this customer'}. Anything you change is saved
          to their real account.
        </span>

        <span
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '13px',
            opacity: low ? 1 : 0.8,
            background: low ? 'rgba(0,0,0,.3)' : 'transparent',
            padding: low ? '3px 8px' : '3px 0',
            borderRadius: '6px',
          }}
          title="Time left before this session closes itself"
        >
          {clock(left)}
        </span>

        <button
          onClick={end}
          disabled={ending}
          style={{
            flexShrink: 0,
            background: '#fff',
            color: '#b91c1c',
            border: 'none',
            borderRadius: '8px',
            padding: '7px 14px',
            fontSize: '12.5px',
            fontWeight: 800,
            cursor: ending ? 'wait' : 'pointer',
            opacity: ending ? 0.6 : 1,
          }}
        >
          {ending ? 'Ending…' : 'End session'}
        </button>
      </div>
    </>
  )
}

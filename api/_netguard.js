// /api/_netguard.js
// ============================================================================
// Shared hardening helpers for the email endpoints (send-email, test-smtp).
// Underscore-prefixed so Vercel does NOT expose it as a route.
//
//   • resolveSafeAddress(host) — SSRF guard. Resolves a hostname to an IP and
//     refuses private / loopback / link-local / CGNAT / multicast targets, so
//     an authenticated user can't turn the SMTP connector into an internal
//     port-scanner. Returns { ip, servername } to connect by validated IP while
//     still doing TLS cert validation against the original hostname (closes the
//     DNS-rebinding TOCTOU gap).
//   • rateLimit(key, opts) — best-effort in-memory per-user throttle.
//   • isValidEmail / sanitizeHeader — input hygiene for to / fromName.
//
// NOTE (rate limiting): Vercel serverless is multi-instance and stateless, so
// this in-memory limiter is per-instance / best-effort — enough to blunt a
// single abusive session, NOT a hard global cap. For a real global limit put a
// shared store (Upstash Redis / a Supabase table) behind rateLimit(). Flagged
// intentionally rather than pretending it's authoritative.
// ============================================================================

import net from 'node:net'
import { promises as dns } from 'node:dns'

// ---- IP range classification --------------------------------------------------

function ip4ToInt(ip) {
  const p = ip.split('.').map((n) => parseInt(n, 10))
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]
}

function isPrivateIPv4(ip) {
  const n = ip4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  const inRange = (base, bits) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return (n & mask) === (ip4ToInt(base) & mask)
  }
  return (
    inRange('0.0.0.0', 8) ||       // "this" network / unspecified
    inRange('10.0.0.0', 8) ||      // private
    inRange('100.64.0.0', 10) ||   // CGNAT
    inRange('127.0.0.0', 8) ||     // loopback
    inRange('169.254.0.0', 16) ||  // link-local
    inRange('172.16.0.0', 12) ||   // private
    inRange('192.0.0.0', 24) ||    // IETF protocol assignments
    inRange('192.0.2.0', 24) ||    // TEST-NET-1
    inRange('192.168.0.0', 16) ||  // private
    inRange('198.18.0.0', 15) ||   // benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) ||  // TEST-NET-3
    inRange('224.0.0.0', 4) ||     // multicast
    inRange('240.0.0.0', 4)        // reserved / broadcast
  )
}

function isPrivateIPv6(ip) {
  const a = ip.toLowerCase().split('%')[0] // drop zone id
  if (a === '::1' || a === '::') return true                 // loopback / unspecified
  // IPv4-mapped (::ffff:1.2.3.4) or IPv4-compatible — classify the embedded v4.
  const mapped = a.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/) || a.match(/::(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  const first = parseInt(a.split(':')[0] || '0', 16)
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

function isPrivateIP(ip) {
  const fam = net.isIP(ip)
  if (fam === 4) return isPrivateIPv4(ip)
  if (fam === 6) return isPrivateIPv6(ip)
  return true // not a valid IP literal → unsafe
}

// ---- Public API ---------------------------------------------------------------

// Resolve `host` to a single validated PUBLIC IP. Throws a generic Error if the
// host is missing, unresolvable, or points at any non-public address. The
// caller should connect to `ip` and set tls.servername = `servername` so the
// certificate is still verified against the real hostname.
export async function resolveSafeAddress(host) {
  const h = String(host || '').trim()
  if (!h) throw new Error('BLOCKED')

  // Literal IP: validate directly.
  if (net.isIP(h)) {
    if (isPrivateIP(h)) throw new Error('BLOCKED')
    return { ip: h, servername: undefined }
  }

  // Hostname: resolve ALL records. If any resolves to a private address, refuse
  // outright (a host that mixes public + private records is a rebinding smell).
  let records
  try {
    records = await dns.lookup(h, { all: true })
  } catch {
    throw new Error('BLOCKED')
  }
  if (!records || !records.length) throw new Error('BLOCKED')
  for (const r of records) {
    if (isPrivateIP(r.address)) throw new Error('BLOCKED')
  }
  // Prefer an IPv4 record for broad SMTP compatibility; pin to it.
  const chosen = records.find((r) => r.family === 4) || records[0]
  return { ip: chosen.address, servername: h }
}

// Best-effort in-memory sliding-window limiter. Returns { ok, retryAfter }.
const _buckets = new Map()
export function rateLimit(key, { max = 30, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now()
  const k = String(key || 'anon')
  const hits = (_buckets.get(k) || []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000)
    _buckets.set(k, hits)
    return { ok: false, retryAfter }
  }
  hits.push(now)
  _buckets.set(k, hits)
  // Opportunistic cleanup so the Map can't grow unbounded on a long-lived instance.
  if (_buckets.size > 5000) {
    for (const [mk, mv] of _buckets) {
      const live = mv.filter((t) => now - t < windowMs)
      if (live.length) _buckets.set(mk, live)
      else _buckets.delete(mk)
    }
  }
  return { ok: true, retryAfter: 0 }
}

// One syntactically-valid single email address (no lists, no CR/LF injection).
export function isValidEmail(v) {
  const s = String(v || '').trim()
  if (!s || s.length > 254) return false
  if (/[\r\n\t,;]/.test(s)) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s)
}

// Strip anything that could break out of a mail header / From display name.
export function sanitizeHeader(v, max = 120) {
  return String(v || '')
    .replace(/[\r\n]/g, ' ')
    .replace(/["<>]/g, '')
    .trim()
    .slice(0, max)
}

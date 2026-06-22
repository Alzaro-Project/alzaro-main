// ============================================================
// FOLLOW-UP SEND LOG (TyreOps)
// ============================================================
//
// Tracks which follow-ups have been actioned so a customer doesn't keep
// reappearing as "due" after you've contacted them.
//
// STAGE 1 (now): persisted in localStorage, scoped per garage. Good enough
// for a single-operator manual workflow on one device.
//
// STAGE 2 (later): replace the read/write internals below with a Supabase
// table so sends are shared across devices and the automated sender can read
// the same log to avoid double-contacting. The PUBLIC API of this module
// (getSentLog / recordSend / clearSend) is intentionally async and stable, so
// FollowUps.jsx will not need to change when the backend swaps in.
//
// Suggested Stage 2 schema (mirrors the record shape written here):
//
//   create table followup_sends (
//     id          uuid primary key default gen_random_uuid(),
//     account_id  uuid not null references product_members(id),
//     contact_key text not null,           -- the entry.key from followups.js
//     customer_id uuid,                     -- nullable; null for snapshot-only
//     channel     text not null,            -- 'email' | 'whatsapp' | 'sms' | 'skip'
//     fitting_date date,                    -- the fitting this send was for
//     invoice_id  text,
//     sent_at     timestamptz not null default now(),
//     unique (account_id, contact_key)      -- one live record per contact
//   );
//   -- + RLS policy: account_id must match the caller's product_members row.
//
// Then getSentLog() -> select where account_id = garageId, keyed by contact_key;
// recordSend() -> upsert on (account_id, contact_key); clearSend() -> delete.
// ============================================================

const STORAGE_PREFIX = 'tyreops-followup-sends'

function storageKey(garageId) {
  return `${STORAGE_PREFIX}:${garageId || 'local'}`
}

/**
 * Load the send log for a garage as a map of contactKey -> record.
 * Returns {} on any error so the UI degrades gracefully.
 *
 * @returns {Promise<Object<string, SentRecord>>}
 */
export async function getSentLog(garageId) {
  // --- STAGE 2 SEAM: replace this block with a Supabase select. ---
  try {
    const raw = localStorage.getItem(storageKey(garageId))
    return raw ? JSON.parse(raw) : {}
  } catch (err) {
    console.error('Failed to read follow-up send log:', err)
    return {}
  }
  // --- END SEAM ---
}

/**
 * Record that a follow-up was sent (or deliberately skipped) for a contact.
 * One live record per contactKey — re-sending overwrites the previous one.
 *
 * @param {string} garageId
 * @param {Object} entry   - the due-entry from computeDueFollowups()
 * @param {string} channel - 'email' | 'whatsapp' | 'sms' | 'skip'
 * @returns {Promise<SentRecord>}
 */
export async function recordSend(garageId, entry, channel) {
  const record = {
    contactKey: entry.key,
    customerId: entry.customerId || null,
    channel,
    fittingDate: entry.fittingDate || null,
    invoiceId: entry.lastInvoiceId || null,
    sentAt: new Date().toISOString(),
  }

  // --- STAGE 2 SEAM: replace this block with a Supabase upsert. ---
  try {
    const log = await getSentLog(garageId)
    log[entry.key] = record
    localStorage.setItem(storageKey(garageId), JSON.stringify(log))
  } catch (err) {
    console.error('Failed to record follow-up send:', err)
  }
  // --- END SEAM ---

  return record
}

/**
 * Clear a recorded send for a contact (e.g. user wants the reminder back).
 * @returns {Promise<void>}
 */
export async function clearSend(garageId, contactKey) {
  // --- STAGE 2 SEAM: replace with a Supabase delete. ---
  try {
    const log = await getSentLog(garageId)
    delete log[contactKey]
    localStorage.setItem(storageKey(garageId), JSON.stringify(log))
  } catch (err) {
    console.error('Failed to clear follow-up send:', err)
  }
  // --- END SEAM ---
}

/**
 * @typedef {Object} SentRecord
 * @property {string}  contactKey
 * @property {?string} customerId
 * @property {string}  channel
 * @property {?string} fittingDate
 * @property {?string} invoiceId
 * @property {string}  sentAt
 */

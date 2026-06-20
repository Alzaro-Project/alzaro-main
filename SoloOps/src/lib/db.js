import { sb } from './supabase.js'

// ---------- auth / access ----------
export async function getSession() {
  const { data } = await sb.auth.getSession()
  return data.session || null
}
export function onAuthChange(cb) {
  const { data } = sb.auth.onAuthStateChange((_e, s) => cb(_e, s))
  return data.subscription
}
export async function signOut() {
  await sb.auth.signOut()
}
export async function getAccess(uid) {
  const { data } = await sb
    .from('soloops_access').select('user_id, business_name').eq('user_id', uid).maybeSingle()
  return data || null
}
export async function getAccessId(uid) {
  const { data } = await sb
    .from('soloops_access').select('user_id').eq('user_id', uid).maybeSingle()
  return data || null
}
export async function createAccess({ user_id, email, business_name }) {
  return sb.from('soloops_access').insert({ user_id, email, business_name })
}
export async function updateAccessName(uid, business_name) {
  return sb.from('soloops_access').update({ business_name }).eq('user_id', uid)
}
export async function signIn(email, password) {
  return sb.auth.signInWithPassword({ email, password })
}
export async function signUp(email, password, opts) {
  return sb.auth.signUp({ email, password, options: opts })
}
export async function resetPasswordForEmail(email, redirectTo) {
  return sb.auth.resetPasswordForEmail(email, { redirectTo })
}
export async function updateUser(payload) {
  return sb.auth.updateUser(payload)
}

// ---------- core data loads ----------
export async function loadInvoices() {
  const { data } = await sb.from('soloops_invoices').select('*').order('issue_date', { ascending: false })
  return data || []
}
export async function loadExpenses() {
  const { data } = await sb.from('soloops_expenses').select('*').order('spent_on', { ascending: false })
  return data || []
}
export async function loadMileage() {
  const { data } = await sb.from('soloops_mileage').select('*').order('journey_date', { ascending: false })
  return data || []
}
export async function loadClients() {
  const { data } = await sb.from('soloops_clients').select('*').order('name', { ascending: true })
  return data || []
}

// ---------- mileage ----------
export async function insertMileage(row) {
  return sb.from('soloops_mileage').insert(row)
}

// ---------- invoices ----------
export async function insertInvoice(row) {
  return sb.from('soloops_invoices').insert(row)
}
export async function updateInvoice(id, row) {
  return sb.from('soloops_invoices').update(row).eq('id', id)
}
export async function deleteInvoice(id) {
  return sb.from('soloops_invoices').delete().eq('id', id)
}

// ---------- expenses ----------
export async function insertExpense(row) {
  return sb.from('soloops_expenses').insert(row)
}
export async function insertExpenses(rows) {
  return sb.from('soloops_expenses').insert(rows)
}
export async function updateExpenseReceipt(id, receipt_name) {
  return sb.from('soloops_expenses').update({ has_receipt: true, receipt_name }).eq('id', id)
}

// ---------- clients ----------
export async function insertClient(row) {
  return sb.from('soloops_clients').insert(row)
}
// Ensure a client exists by name (case-insensitive). Returns { created, client }.
// kind: 'customer' (from income) or 'supplier' (from expense).
// If an existing client of the opposite kind matches, it's promoted to 'both'.
export async function ensureClient(uid, name, kind, details) {
  const clean = (name||'').trim()
  if (!clean) return { created:false, client:null }
  const { data: existing } = await sb.from('soloops_clients')
    .select('*').ilike('name', clean).limit(1)
  const found = (existing||[])[0]
  if (found) {
    const patch = {}
    if (found.kind && found.kind !== kind && found.kind !== 'both') patch.kind = 'both'
    // fill in contact details only if the existing record is missing them
    if (details?.email && !found.email) patch.email = details.email.trim()
    if (details?.phone && !found.phone) patch.phone = details.phone.trim()
    if (Object.keys(patch).length) {
      await sb.from('soloops_clients').update(patch).eq('id', found.id)
      return { created:false, client:{ ...found, ...patch } }
    }
    return { created:false, client:found }
  }
  const row = { user_id:uid, name:clean, kind }
  if (details?.email) row.email = details.email.trim()
  if (details?.phone) row.phone = details.phone.trim()
  const { data: ins } = await sb.from('soloops_clients')
    .insert(row).select('*').limit(1)
  return { created:true, client:(ins||[])[0]||null }
}
export async function updateClient(id, row) {
  return sb.from('soloops_clients').update(row).eq('id', id)
}
export async function deleteClient(id) {
  return sb.from('soloops_clients').delete().eq('id', id)
}

// ---------- rules (auto-categorisation) ----------
export async function loadRules() {
  return sb.from('soloops_rules').select('*')
}
export async function upsertRule(row) {
  return sb.from('soloops_rules')
    .upsert(row, { onConflict: 'user_id,pattern', ignoreDuplicates: true })
}
export async function upsertRules(rows) {
  return sb.from('soloops_rules')
    .upsert(rows, { onConflict: 'user_id,pattern', ignoreDuplicates: true })
}

// ---------- documents ----------
export async function loadDocuments() {
  return sb.from('soloops_documents').select('*').order('uploaded_at', { ascending: false })
}
export async function insertDocument(row) {
  return sb.from('soloops_documents').insert(row)
}
export async function deleteDocument(id) {
  return sb.from('soloops_documents').delete().eq('id', id)
}

// ---------- storage ----------
export async function uploadFile(path, file, opts) {
  return sb.storage.from('soloops-files').upload(path, file, opts)
}
export async function signedUrl(path, expires) {
  return sb.storage.from('soloops-files').createSignedUrl(path, expires)
}
export async function removeFiles(paths) {
  return sb.storage.from('soloops-files').remove(paths)
}

// ---------- settings (soloops_settings: one row per user) ----------
export async function loadSettings(uid) {
  const { data } = await sb
    .from('soloops_settings').select('*').eq('user_id', uid).maybeSingle()
  return data || null
}
export async function saveSettings(record) {
  return sb.from('soloops_settings').upsert(record, { onConflict: 'user_id' })
}

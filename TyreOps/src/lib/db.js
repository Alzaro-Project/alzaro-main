import { supabase } from './supabase'

const PRODUCT = 'tyreops'

// ============================================================
// HELPERS
// ============================================================
// Merge a product_members row + its product_settings row into a single
// "garage" object, matching the shape the app expects (settings fields like
// vat_scheme / smtp_host / booking_* read straight off this object).
function mergeGarage(member, settings) {
  if (!member) return null
  return {
    // membership (source of truth: product_members)
    id: member.id,
    user_id: member.user_id,
    email: member.email,
    product: member.product,
    name: member.company_name || (settings && settings.name) || '',
    tier: member.tier,
    status: member.status,
    trial_ends: member.trial_ends,
    created_at: member.created_at,
    // settings (product_settings) — spread so the app sees the same fields as before
    ...(settings || {}),
    // membership fields below re-asserted so settings can't shadow them
    id: member.id,
    user_id: member.user_id,
    email: member.email,
    name: member.company_name || (settings && settings.name) || '',
    tier: member.tier,
    status: member.status,
    trial_ends: member.trial_ends,
  }
}

async function fetchSettings(userId) {
  const { data } = await supabase
    .from('product_settings').select('*')
    .eq('user_id', userId).eq('product', PRODUCT).maybeSingle()
  return data || null
}

// ============================================================
// ADMIN FUNCTIONS
// ============================================================
export async function getAllGarages() {
  // Admin panel list — all tyreops members, newest first
  const { data, error } = await supabase
    .from('product_members')
    .select('*')
    .eq('product', PRODUCT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function updateGarageTier(garageId, tier) {
  const { error } = await supabase
    .from('product_members')
    .update({ tier })
    .eq('id', garageId)
  if (error) throw error
}

export async function updateGarageStatus(garageId, status) {
  const { error } = await supabase
    .from('product_members')
    .update({ status })
    .eq('id', garageId)
  if (error) throw error
}

export async function deleteGarage(garageId) {
  // Child rows cascade via FK (account_id -> product_members.id ON DELETE CASCADE)
  const { error } = await supabase.from('product_members').delete().eq('id', garageId)
  if (error) throw error
}

// ============================================================
// GARAGE  (membership + settings, merged)
// ============================================================
export async function getGarageByEmail(email) {
  const { data: member } = await supabase
    .from('product_members').select('*')
    .eq('email', email).eq('product', PRODUCT).maybeSingle()
  if (!member) return null
  const settings = await fetchSettings(member.user_id)
  return mergeGarage(member, settings)
}

// ============================================================
// MULTI-PRODUCT
// ------------------------------------------------------------
// One account can hold one membership per product. Find the tyreops
// membership for the signed-in user and merge in its settings.
// ============================================================
export async function getGarageForProduct(email, product) {
  const prod = product || PRODUCT
  const { data: member, error } = await supabase
    .from('product_members').select('*')
    .eq('email', email).eq('product', prod).maybeSingle()
  if (error) throw error
  if (!member) return null
  const settings = await fetchSettings(member.user_id)
  return mergeGarage(member, settings)
}

// Creates a new trial membership for this product on the signed-in user's
// account (via the join_product RPC). Idempotent: returns existing id if any.
export async function joinProduct(product, garageName) {
  const { data, error } = await supabase.rpc('join_product', {
    p_product: product,
    p_garage_name: garageName || '',
  })
  if (error) throw error
  return data
}

// Update business/settings. Membership fields go to product_members,
// everything else goes to product_settings (upserted).
export async function updateGarage(garageId, updates) {
  const MEMBER_FIELDS = ['tier', 'status', 'trial_ends', 'company_name', 'name']
  const memberPatch = {}
  const settingsPatch = {}

  for (const [k, v] of Object.entries(updates)) {
    if (k === 'name') { memberPatch.company_name = v }      // membership stores it as company_name
    else if (MEMBER_FIELDS.includes(k)) { memberPatch[k] = v }
    else { settingsPatch[k] = v }
  }

  // membership update (by id)
  if (Object.keys(memberPatch).length) {
    const { error } = await supabase.from('product_members').update(memberPatch).eq('id', garageId)
    if (error) throw error
  }

  // settings update — need user_id + product to upsert the right row
  if (Object.keys(settingsPatch).length) {
    const { data: member, error: mErr } = await supabase
      .from('product_members').select('user_id').eq('id', garageId).single()
    if (mErr) throw mErr
    const { error } = await supabase
      .from('product_settings')
      .upsert({ user_id: member.user_id, product: PRODUCT, account_id: garageId, ...settingsPatch }, { onConflict: 'user_id,product' })
    if (error) throw error
  }
}

// ============================================================
// SKUS  (TyreOps)
// ============================================================
export async function getSKUs(garageId) {
  const { data, error } = await supabase.from('skus').select('*').eq('account_id', garageId).is('deleted_at', null).order('brand')
  if (error) throw error
  return data || []
}

export async function insertSKU(garageId, sku) {
  const { data, error } = await supabase.from('skus').insert({
    account_id: garageId, brand: sku.brand, model: sku.model,
    w: sku.w, p: sku.p, r: sku.r, sell: sku.sell, alert: sku.alert, season: sku.season
  }).select().single()
  if (error) throw error
  return data
}

export async function updateSKU(id, updates) {
  const { error } = await supabase.from('skus').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteSKU(id) {
  const { error } = await supabase.from('skus').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ============================================================
// BATCHES  (TyreOps)
// ============================================================
export async function getBatches(garageId) {
  const { data, error } = await supabase.from('batches').select('*').eq('account_id', garageId).is('deleted_at', null).order('date')
  if (error) throw error
  return data || []
}

export async function insertBatch(garageId, batch) {
  const { data, error } = await supabase.from('batches').insert({
    account_id: garageId,
    sku_id: batch.skuId,
    date: batch.date,
    qty: batch.qty,
    remaining: batch.qty,
    cost: batch.cost,
    supplier: batch.supplier,
    ref: batch.ref,
    notes: batch.notes,
    invoice_url: batch.invoiceUrl || null,
    damaged: batch.damaged || 0
  }).select().single()
  if (error) throw error
  return data
}

export async function updateBatch(id, updates) {
  const dbUpdates = { ...updates }
  if (updates.invoiceUrl !== undefined) {
    dbUpdates.invoice_url = updates.invoiceUrl
    delete dbUpdates.invoiceUrl
  }
  const { error } = await supabase.from('batches').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteBatch(id) {
  const { error } = await supabase.from('batches').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// Remove a purchase-invoice file from storage given its stored path
// (e.g. "{garageId}/123.pdf"). Best-effort: failures are logged, not thrown.
// Also tolerates legacy full public URLs by extracting the path.
export async function deletePurchaseInvoice(pathOrUrl) {
  if (!pathOrUrl) return
  try {
    let path = pathOrUrl
    const marker = '/purchase-invoices/'
    const idx = pathOrUrl.indexOf(marker)
    if (idx !== -1) path = pathOrUrl.slice(idx + marker.length)
    const { error } = await supabase.storage.from('purchase-invoices').remove([path])
    if (error) console.error('Failed to delete invoice file:', error)
  } catch (err) {
    console.error('Failed to delete invoice file:', err)
  }
}

// Mint a short-lived signed URL to view a private invoice file.
// `pathOrUrl` is the stored path; legacy full URLs are tolerated.
// Returns a temporary URL (valid ~5 min) or null on failure.
export async function getInvoiceSignedUrl(pathOrUrl) {
  if (!pathOrUrl) return null
  try {
    let path = pathOrUrl
    const marker = '/purchase-invoices/'
    const idx = pathOrUrl.indexOf(marker)
    if (idx !== -1) path = pathOrUrl.slice(idx + marker.length)
    const { data, error } = await supabase.storage
      .from('purchase-invoices')
      .createSignedUrl(path, 300)
    if (error) { console.error('Failed to sign invoice URL:', error); return null }
    return data?.signedUrl || null
  } catch (err) {
    console.error('Failed to sign invoice URL:', err)
    return null
  }
}

// ============================================================
// USED TYRES  (TyreOps)
// ============================================================
export async function getUsedTyres(garageId) {
  const { data, error } = await supabase.from('used_tyres').select('*').eq('account_id', garageId).is('deleted_at', null).order('date', { ascending: false })
  if (error) throw error
  return (data || []).map(u => ({
    ...u, sourceCust: u.source_cust, lineType: 'used'
  }))
}

export async function insertUsedTyre(garageId, tyre) {
  const { data, error } = await supabase.from('used_tyres').insert({
    account_id: garageId, brand: tyre.brand, model: tyre.model,
    w: tyre.w, p: tyre.p, r: tyre.r,
    cost: tyre.cost, sell: tyre.sell, source_cust: tyre.sourceCust,
    date: tyre.date, notes: tyre.notes, sold: false
  }).select().single()
  if (error) throw error
  return { ...data, sourceCust: data.source_cust }
}

export async function updateUsedTyre(id, updates) {
  const dbUpdates = { ...updates }
  if (updates.sourceCust !== undefined) { dbUpdates.source_cust = updates.sourceCust; delete dbUpdates.sourceCust }
  const { error } = await supabase.from('used_tyres').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteUsedTyre(id) {
  const { error } = await supabase.from('used_tyres').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ============================================================
// CUSTOMERS  (shared — TyreOps + GarageOps)
// ============================================================
export async function getCustomers(garageId) {
  const { data, error } = await supabase.from('customers').select('*').eq('account_id', garageId).is('deleted_at', null).order('name')
  if (error) throw error
  return data || []
}

export async function checkDuplicateCustomer(garageId, email, phone, excludeId = null) {
  if (!email && !phone) return null

  let query = supabase.from('customers').select('*').eq('account_id', garageId)

  const conditions = []
  if (email) conditions.push(`email.ilike.${email}`)
  if (phone) conditions.push(`phone.eq.${phone}`)

  if (conditions.length > 0) {
    query = query.or(conditions.join(','))
  }

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.limit(1)
  if (error) {
    console.error('Duplicate check error:', error)
    return null
  }

  return data?.[0] || null
}

export async function insertCustomer(garageId, customer) {
  const existing = await checkDuplicateCustomer(garageId, customer.email, customer.phone)
  if (existing) {
    throw new Error(`Duplicate customer: A customer with this ${existing.email === customer.email ? 'email' : 'phone'} already exists (${existing.name})`)
  }

  const { data, error } = await supabase.from('customers').insert({
    account_id: garageId, name: customer.name, email: customer.email,
    phone: customer.phone, reg: customer.reg, vehicle: customer.vehicle,
    vehicles: customer.vehicles || []
  }).select().single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, updates) {
  const allowed = ['name', 'email', 'phone', 'reg', 'vehicle', 'vehicles']
  const dbUpdates = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) dbUpdates[key] = updates[key]
  }
  if (Object.keys(dbUpdates).length === 0) return

  const { error } = await supabase.from('customers').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ============================================================
// INVOICES  (shared — TyreOps + GarageOps)
// ============================================================
export async function getInvoices(garageId) {
  const { data: invs, error } = await supabase
    .from('invoices').select('*').eq('account_id', garageId).is('deleted_at', null).order('created_at', { ascending: false })
  if (error) throw error
  if (!invs?.length) return []

  const { data: lines } = await supabase
    .from('invoice_lines').select('*').in('invoice_id', invs.map(i => i.id))

  return invs.map(inv => ({
    ...inv,
    custId: inv.cust_id, custName: inv.cust_name, custEmail: inv.cust_email,
    vatScheme: inv.vat_scheme,
    paymentMethod: inv.payment_method,
    paidAt: inv.paid_at,
    lines: (lines || []).filter(l => l.invoice_id === inv.id).map(l => ({
      ...l, desc: l.line_desc, skuId: l.sku_id, batchId: l.batch_id,
      usedId: l.used_id, lineType: l.line_type, marginScheme: l.margin_scheme
    }))
  }))
}

export async function insertInvoice(garageId, inv) {
  const { error: invErr } = await supabase.from('invoices').insert({
    id: inv.id, account_id: garageId, cust_id: inv.custId || null,
    cust_name: inv.custName, cust_email: inv.custEmail, reg: inv.reg,
    date: inv.date, due: inv.due, status: inv.status,
    vat_scheme: inv.vatScheme, notes: inv.notes,
    payment_method: inv.paymentMethod || null,
    paid_at: inv.paidAt || null
  })
  if (invErr) throw invErr

  if (inv.lines?.length) {
    const { error: linesErr } = await supabase.from('invoice_lines').insert(
      inv.lines.map(l => ({
        invoice_id: inv.id, account_id: garageId,
        line_desc: l.desc, qty: l.qty, unit: l.unit, cost: l.cost || 0,
        sku_id: l.skuId || null, batch_id: l.batchId || null, used_id: l.usedId || null,
        line_type: l.lineType || 'service', margin_scheme: l.marginScheme || false
      }))
    )
    if (linesErr) throw linesErr
  }
}

export async function updateInvoice(garageId, id, updates) {
  const dbUpdates = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod
  if (updates.paidAt !== undefined) dbUpdates.paid_at = updates.paidAt
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (Object.keys(dbUpdates).length === 0) return

  const { error } = await supabase.from('invoices').update(dbUpdates)
    .eq('account_id', garageId).eq('id', id)
  if (error) throw error
}

export async function updateInvoiceStatus(garageId, id, status) {
  const { error } = await supabase.from('invoices').update({ status })
    .eq('account_id', garageId).eq('id', id)
  if (error) throw error
}

export async function deleteInvoice(garageId, id) {
  // Soft delete: mark the invoice deleted but keep its lines so it can be
  // restored intact. Lines are loaded only for non-deleted invoices.
  const { error } = await supabase.from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('account_id', garageId).eq('id', id)
  if (error) throw error
}

// ============================================================
// LOAD ALL DATA FOR A GARAGE
// ============================================================
export async function loadAllGarageData(email) {
  try {
    const garage = await getGarageForProduct(email, PRODUCT)
    if (!garage) return null

    const [skus, batches, usedTyres, customers, invoices] = await Promise.all([
      getSKUs(garage.id),
      getBatches(garage.id),
      getUsedTyres(garage.id),
      getCustomers(garage.id),
      getInvoices(garage.id),
    ])

    const normBatches = batches.map(b => ({
      ...b,
      skuId: b.sku_id,
      remaining: b.remaining,
      invoiceUrl: b.invoice_url,
      damaged: b.damaged || 0,
    }))

    return {
      garage,
      skus,
      batches: normBatches,
      usedTyres,
      customers,
      invoices,
    }
  } catch (err) {
    console.error('Error loading garage data:', err)
    return null
  }
}

// ============================================================
// RECYCLE BIN  (soft-delete restore / permanent delete)
// ============================================================

const RECYCLE_DAYS = 30

// Fetch all soft-deleted items across tables for a garage.
// Returns a flat list tagged with `kind` so the UI can show them together.
export async function getDeletedItems(garageId) {
  const [skus, batches, used, customers, invoices] = await Promise.all([
    supabase.from('skus').select('*').eq('account_id', garageId).not('deleted_at', 'is', null),
    supabase.from('batches').select('*').eq('account_id', garageId).not('deleted_at', 'is', null),
    supabase.from('used_tyres').select('*').eq('account_id', garageId).not('deleted_at', 'is', null),
    supabase.from('customers').select('*').eq('account_id', garageId).not('deleted_at', 'is', null),
    supabase.from('invoices').select('*').eq('account_id', garageId).not('deleted_at', 'is', null),
  ])
  const items = []
  for (const r of (skus.data || [])) items.push({ kind: 'sku', id: r.id, deletedAt: r.deleted_at, label: `${r.brand} ${r.model} ${r.w}/${r.p}R${r.r}`, sub: 'New tyre SKU' })
  for (const r of (batches.data || [])) items.push({ kind: 'batch', id: r.id, deletedAt: r.deleted_at, label: `Batch · ${r.date} · £${r.cost} · ${r.remaining}pc`, sub: r.supplier || 'Stock batch' })
  for (const r of (used.data || [])) items.push({ kind: 'used', id: r.id, deletedAt: r.deleted_at, label: `${r.brand} ${r.model} ${r.w}/${r.p}R${r.r}`, sub: 'Used / part-ex tyre' })
  for (const r of (customers.data || [])) items.push({ kind: 'customer', id: r.id, deletedAt: r.deleted_at, label: r.name, sub: 'Customer' })
  for (const r of (invoices.data || [])) items.push({ kind: 'invoice', id: r.id, deletedAt: r.deleted_at, label: `${r.id} · ${r.cust_name}`, sub: 'Invoice' })
  // Most recently deleted first
  items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
  return items
}

const TABLE_FOR_KIND = { sku: 'skus', batch: 'batches', used: 'used_tyres', customer: 'customers', invoice: 'invoices' }

// Restore a soft-deleted item (clear deleted_at).
export async function restoreDeletedItem(kind, id) {
  const table = TABLE_FOR_KIND[kind]
  if (!table) throw new Error('Unknown item type')
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

// Permanently delete a single soft-deleted item (hard delete).
export async function purgeDeletedItem(garageId, kind, id) {
  const table = TABLE_FOR_KIND[kind]
  if (!table) throw new Error('Unknown item type')
  if (kind === 'invoice') {
    await supabase.from('invoice_lines').delete().eq('account_id', garageId).eq('invoice_id', id)
  }
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

// Auto-purge anything deleted more than RECYCLE_DAYS ago. Best-effort.
export async function purgeExpiredDeleted(garageId) {
  const cutoff = new Date(Date.now() - RECYCLE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  for (const table of ['skus', 'batches', 'used_tyres', 'customers', 'invoices']) {
    try {
      await supabase.from(table).delete().eq('account_id', garageId).lt('deleted_at', cutoff)
    } catch (e) {
      console.error(`Auto-purge failed for ${table}:`, e)
    }
  }
}

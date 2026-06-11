import { supabase } from './supabase'

// ============================================================
// ADMIN FUNCTIONS
// ============================================================
export async function checkIsAdmin(email) {
  const { data, error } = await supabase
    .from('garage_users')
    .select('is_admin')
    .eq('email', email)
    .eq('is_admin', true)
    .single()
  
  if (error || !data) return false
  return data.is_admin === true
}

export async function getAllGarages() {
  const { data, error } = await supabase
    .from('garages')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function updateGarageTier(garageId, tier) {
  const { error } = await supabase
    .from('garages')
    .update({ tier })
    .eq('id', garageId)
  
  if (error) throw error
}

export async function updateGarageStatus(garageId, status) {
  const { error } = await supabase
    .from('garages')
    .update({ status })
    .eq('id', garageId)
  
  if (error) throw error
}

export async function deleteGarage(garageId) {
  // Delete garage_users first (foreign key)
  await supabase.from('garage_users').delete().eq('garage_id', garageId)
  // Then delete the garage
  const { error } = await supabase.from('garages').delete().eq('id', garageId)
  if (error) throw error
}

// ============================================================
// GARAGE
// ============================================================
export async function getGarageByEmail(email) {
  const { data: gu } = await supabase
    .from('garage_users').select('garage_id').eq('email', email).single()
  if (!gu) return null
  const { data: garage } = await supabase
    .from('garages').select('*').eq('id', gu.garage_id).single()
  return garage
}

// ============================================================
// MULTI-PRODUCT (Option B)
// ------------------------------------------------------------
// One email can hold one garage per product. These helpers find
// the garage for a specific product, and create one when an
// existing Alzaro user joins this product for the first time.
// ============================================================
export async function getGarageForProduct(email, product) {
  const { data: links, error: linkErr } = await supabase
    .from('garage_users').select('garage_id').eq('email', email)
  if (linkErr) throw linkErr
  if (!links || links.length === 0) return null

  const ids = links.map(l => l.garage_id)
  const { data: garages, error: gErr } = await supabase
    .from('garages').select('*').in('id', ids).eq('product', product)
  if (gErr) throw gErr
  return (garages && garages[0]) || null
}

// Creates a new trial garage for this product on the signed-in user's
// account (via the join_product database function). Idempotent: if a
// garage for this product already exists, its id is returned instead.
export async function joinProduct(product, garageName) {
  const { data, error } = await supabase.rpc('join_product', {
    p_product: product,
    p_garage_name: garageName || '',
  })
  if (error) throw error
  return data
}

export async function updateGarage(garageId, updates) {
  const { error } = await supabase.from('garages').update(updates).eq('id', garageId)
  if (error) throw error
}

// ============================================================
// SKUS  (TyreOps)
// ============================================================
export async function getSKUs(garageId) {
  const { data, error } = await supabase.from('skus').select('*').eq('garage_id', garageId).order('brand')
  if (error) throw error
  return data || []
}

export async function insertSKU(garageId, sku) {
  const { data, error } = await supabase.from('skus').insert({
    garage_id: garageId, brand: sku.brand, model: sku.model,
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
  const { error } = await supabase.from('skus').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// BATCHES  (TyreOps)
// ============================================================
export async function getBatches(garageId) {
  const { data, error } = await supabase.from('batches').select('*').eq('garage_id', garageId).order('date')
  if (error) throw error
  return data || []
}

export async function insertBatch(garageId, batch) {
  const { data, error } = await supabase.from('batches').insert({
    garage_id: garageId, 
    sku_id: batch.skuId, 
    date: batch.date,
    qty: batch.qty, 
    remaining: batch.qty, 
    cost: batch.cost,
    supplier: batch.supplier, 
    ref: batch.ref, 
    notes: batch.notes,
    invoice_url: batch.invoiceUrl || null
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
  const { error } = await supabase.from('batches').delete().eq('id', id)
  if (error) throw error
}

// Remove a purchase-invoice file from storage given its public URL.
// Best-effort: failures are logged but not thrown (the DB row is what matters).
export async function deletePurchaseInvoice(publicUrl) {
  if (!publicUrl) return
  try {
    const marker = '/purchase-invoices/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return
    const path = publicUrl.slice(idx + marker.length)
    const { error } = await supabase.storage.from('purchase-invoices').remove([path])
    if (error) console.error('Failed to delete invoice file:', error)
  } catch (err) {
    console.error('Failed to delete invoice file:', err)
  }
}

// ============================================================
// USED TYRES  (TyreOps)
// ============================================================
export async function getUsedTyres(garageId) {
  const { data, error } = await supabase.from('used_tyres').select('*').eq('garage_id', garageId).order('date', { ascending: false })
  if (error) throw error
  return (data || []).map(u => ({
    ...u, sourceCust: u.source_cust, lineType: 'used'
  }))
}

export async function insertUsedTyre(garageId, tyre) {
  const { data, error } = await supabase.from('used_tyres').insert({
    garage_id: garageId, brand: tyre.brand, model: tyre.model,
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
  const { error } = await supabase.from('used_tyres').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CUSTOMERS  (shared — TyreOps + GarageOps)
// ============================================================
export async function getCustomers(garageId) {
  const { data, error } = await supabase.from('customers').select('*').eq('garage_id', garageId).order('name')
  if (error) throw error
  return data || []
}

export async function checkDuplicateCustomer(garageId, email, phone, excludeId = null) {
  if (!email && !phone) return null
  
  let query = supabase.from('customers').select('*').eq('garage_id', garageId)
  
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
    garage_id: garageId, name: customer.name, email: customer.email,
    phone: customer.phone, reg: customer.reg, vehicle: customer.vehicle,
    vehicles: customer.vehicles || []
  }).select().single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, updates) {
  // Only send columns that exist on the customers table — anything else
  // (internal/UI-only fields) would make Supabase reject the whole update.
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
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// INVOICES  (shared — TyreOps + GarageOps)
// ============================================================
export async function getInvoices(garageId) {
  const { data: invs, error } = await supabase
    .from('invoices').select('*').eq('garage_id', garageId).order('created_at', { ascending: false })
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
    id: inv.id, garage_id: garageId, cust_id: inv.custId || null,
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
        invoice_id: inv.id, garage_id: garageId,
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
    .eq('garage_id', garageId).eq('id', id)
  if (error) throw error
}

export async function updateInvoiceStatus(garageId, id, status) {
  const { error } = await supabase.from('invoices').update({ status })
    .eq('garage_id', garageId).eq('id', id)
  if (error) throw error
}

export async function deleteInvoice(garageId, id) {
  await supabase.from('invoice_lines').delete()
    .eq('garage_id', garageId).eq('invoice_id', id)
  const { error } = await supabase.from('invoices').delete()
    .eq('garage_id', garageId).eq('id', id)
  if (error) throw error
}

// ============================================================
// LOAD ALL DATA FOR A GARAGE
// ============================================================
// Called on login and on page refresh. Loads everything TyreOps
// needs in one go: skus, batches, used tyres, customers, invoices.
// ============================================================
export async function loadAllGarageData(email) {
  try {
    const garage = await getGarageForProduct(email, 'tyreops')
    if (!garage) return null

    const [skus, batches, usedTyres, customers, invoices] = await Promise.all([
      getSKUs(garage.id),
      getBatches(garage.id),
      getUsedTyres(garage.id),
      getCustomers(garage.id),
      getInvoices(garage.id),
    ])

    // Normalise batch field names
    const normBatches = batches.map(b => ({
      ...b,
      skuId: b.sku_id,
      remaining: b.remaining,
      invoiceUrl: b.invoice_url,
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

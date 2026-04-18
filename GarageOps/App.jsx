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
    phone: customer.phone, reg: customer.reg, vehicle: customer.vehicle
  }).select().single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, updates) {
  const { error } = await supabase.from('customers').update(updates).eq('id', id)
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

export async function updateInvoice(id, updates) {
  const dbUpdates = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod
  if (updates.paidAt !== undefined) dbUpdates.paid_at = updates.paidAt
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  
  const { error } = await supabase.from('invoices').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function updateInvoiceStatus(id, status) {
  const { error } = await supabase.from('invoices').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteInvoice(id) {
  await supabase.from('invoice_lines').delete().eq('invoice_id', id)
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// =========================== GARAGEOPS =====================================
// ============================================================================
// All functions below are for GarageOps-specific tables added in Phase 1.
// They are only called when garage.product === 'garageops'.
// TyreOps code paths never touch these.
// ============================================================================

// ============================================================
// VEHICLES (GarageOps)
// ============================================================
export async function getVehicles(garageId) {
  const { data, error } = await supabase
    .from('vehicles').select('*').eq('garage_id', garageId).order('reg')
  if (error) throw error
  return (data || []).map(mapVehicleFromDb)
}

function mapVehicleFromDb(v) {
  return {
    ...v,
    customerId: v.customer_id,
    fuelType: v.fuel_type,
    engineSize: v.engine_size,
    motDue: v.mot_due,
    taxDue: v.tax_due,
    lastServiceDate: v.last_service_date,
    nextServiceDue: v.next_service_due,
    mileageLastSeen: v.mileage_last_seen,
    mileageLastSeenDate: v.mileage_last_seen_date,
    dvlaLastSynced: v.dvla_last_synced,
  }
}

export async function insertVehicle(garageId, vehicle) {
  const { data, error } = await supabase.from('vehicles').insert({
    garage_id: garageId,
    customer_id: vehicle.customerId || null,
    reg: vehicle.reg,
    make: vehicle.make || null,
    model: vehicle.model || null,
    year: vehicle.year || null,
    colour: vehicle.colour || null,
    fuel_type: vehicle.fuelType || null,
    engine_size: vehicle.engineSize || null,
    vin: vehicle.vin || null,
    mot_due: vehicle.motDue || null,
    tax_due: vehicle.taxDue || null,
    last_service_date: vehicle.lastServiceDate || null,
    next_service_due: vehicle.nextServiceDue || null,
    mileage_last_seen: vehicle.mileageLastSeen || null,
    mileage_last_seen_date: vehicle.mileageLastSeenDate || null,
    dvla_last_synced: vehicle.dvlaLastSynced || null,
    notes: vehicle.notes || null,
  }).select().single()
  if (error) throw error
  return mapVehicleFromDb(data)
}

export async function updateVehicle(id, updates) {
  const dbUpdates = {}
  if (updates.customerId !== undefined) dbUpdates.customer_id = updates.customerId
  if (updates.reg !== undefined) dbUpdates.reg = updates.reg
  if (updates.make !== undefined) dbUpdates.make = updates.make
  if (updates.model !== undefined) dbUpdates.model = updates.model
  if (updates.year !== undefined) dbUpdates.year = updates.year
  if (updates.colour !== undefined) dbUpdates.colour = updates.colour
  if (updates.fuelType !== undefined) dbUpdates.fuel_type = updates.fuelType
  if (updates.engineSize !== undefined) dbUpdates.engine_size = updates.engineSize
  if (updates.vin !== undefined) dbUpdates.vin = updates.vin
  if (updates.motDue !== undefined) dbUpdates.mot_due = updates.motDue
  if (updates.taxDue !== undefined) dbUpdates.tax_due = updates.taxDue
  if (updates.lastServiceDate !== undefined) dbUpdates.last_service_date = updates.lastServiceDate
  if (updates.nextServiceDue !== undefined) dbUpdates.next_service_due = updates.nextServiceDue
  if (updates.mileageLastSeen !== undefined) dbUpdates.mileage_last_seen = updates.mileageLastSeen
  if (updates.mileageLastSeenDate !== undefined) dbUpdates.mileage_last_seen_date = updates.mileageLastSeenDate
  if (updates.dvlaLastSynced !== undefined) dbUpdates.dvla_last_synced = updates.dvlaLastSynced
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes

  const { error } = await supabase.from('vehicles').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteVehicle(id) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// SERVICES (GarageOps — the service menu)
// ============================================================
export async function getServices(garageId) {
  const { data, error } = await supabase
    .from('services').select('*').eq('garage_id', garageId).order('category').order('name')
  if (error) throw error
  return (data || []).map(s => ({
    ...s,
    labourHours: s.labour_hours,
    defaultPrice: s.default_price,
  }))
}

export async function insertService(garageId, service) {
  const { data, error } = await supabase.from('services').insert({
    garage_id: garageId,
    name: service.name,
    category: service.category || null,
    description: service.description || null,
    labour_hours: service.labourHours || 0,
    default_price: service.defaultPrice || 0,
    active: service.active !== false,
  }).select().single()
  if (error) throw error
  return { ...data, labourHours: data.labour_hours, defaultPrice: data.default_price }
}

export async function updateService(id, updates) {
  const dbUpdates = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.labourHours !== undefined) dbUpdates.labour_hours = updates.labourHours
  if (updates.defaultPrice !== undefined) dbUpdates.default_price = updates.defaultPrice
  if (updates.active !== undefined) dbUpdates.active = updates.active

  const { error } = await supabase.from('services').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteService(id) {
  const { error } = await supabase.from('services').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// PARTS (GarageOps)
// ============================================================
export async function getParts(garageId) {
  const { data, error } = await supabase
    .from('parts').select('*').eq('garage_id', garageId).order('name')
  if (error) throw error
  return (data || []).map(p => ({
    ...p,
    partNumber: p.part_number,
    sellPrice: p.sell_price,
    alertLevel: p.alert_level,
  }))
}

export async function insertPart(garageId, part) {
  const { data, error } = await supabase.from('parts').insert({
    garage_id: garageId,
    part_number: part.partNumber || null,
    name: part.name,
    description: part.description || null,
    category: part.category || null,
    brand: part.brand || null,
    sell_price: part.sellPrice || 0,
    alert_level: part.alertLevel || 2,
    active: part.active !== false,
  }).select().single()
  if (error) throw error
  return {
    ...data,
    partNumber: data.part_number,
    sellPrice: data.sell_price,
    alertLevel: data.alert_level,
  }
}

export async function updatePart(id, updates) {
  const dbUpdates = {}
  if (updates.partNumber !== undefined) dbUpdates.part_number = updates.partNumber
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.brand !== undefined) dbUpdates.brand = updates.brand
  if (updates.sellPrice !== undefined) dbUpdates.sell_price = updates.sellPrice
  if (updates.alertLevel !== undefined) dbUpdates.alert_level = updates.alertLevel
  if (updates.active !== undefined) dbUpdates.active = updates.active

  const { error } = await supabase.from('parts').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deletePart(id) {
  const { error } = await supabase.from('parts').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// PART BATCHES (GarageOps — FIFO stock intake)
// ============================================================
export async function getPartBatches(garageId) {
  const { data, error } = await supabase
    .from('part_batches').select('*').eq('garage_id', garageId).order('date')
  if (error) throw error
  return (data || []).map(b => ({
    ...b,
    partId: b.part_id,
    invoiceUrl: b.invoice_url,
  }))
}

export async function insertPartBatch(garageId, batch) {
  const { data, error } = await supabase.from('part_batches').insert({
    garage_id: garageId,
    part_id: batch.partId,
    date: batch.date,
    qty: batch.qty,
    remaining: batch.qty,
    cost: batch.cost,
    supplier: batch.supplier || null,
    ref: batch.ref || null,
    invoice_url: batch.invoiceUrl || null,
    notes: batch.notes || null,
  }).select().single()
  if (error) throw error
  return { ...data, partId: data.part_id, invoiceUrl: data.invoice_url }
}

export async function updatePartBatch(id, updates) {
  const dbUpdates = { ...updates }
  if (updates.partId !== undefined) { dbUpdates.part_id = updates.partId; delete dbUpdates.partId }
  if (updates.invoiceUrl !== undefined) { dbUpdates.invoice_url = updates.invoiceUrl; delete dbUpdates.invoiceUrl }
  const { error } = await supabase.from('part_batches').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deletePartBatch(id) {
  const { error } = await supabase.from('part_batches').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// LABOUR RATES (GarageOps)
// ============================================================
export async function getLabourRates(garageId) {
  const { data, error } = await supabase
    .from('labour_rates').select('*').eq('garage_id', garageId).order('name')
  if (error) throw error
  return (data || []).map(r => ({
    ...r,
    hourlyRate: r.hourly_rate,
    isDefault: r.is_default,
  }))
}

export async function insertLabourRate(garageId, rate) {
  const { data, error } = await supabase.from('labour_rates').insert({
    garage_id: garageId,
    name: rate.name,
    hourly_rate: rate.hourlyRate,
    is_default: rate.isDefault || false,
    active: rate.active !== false,
  }).select().single()
  if (error) throw error
  return { ...data, hourlyRate: data.hourly_rate, isDefault: data.is_default }
}

export async function updateLabourRate(id, updates) {
  const dbUpdates = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate
  if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault
  if (updates.active !== undefined) dbUpdates.active = updates.active

  const { error } = await supabase.from('labour_rates').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteLabourRate(id) {
  const { error } = await supabase.from('labour_rates').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// JOBS & JOB LINES (GarageOps)
// ============================================================
export async function getJobs(garageId) {
  const { data: jobs, error } = await supabase
    .from('jobs').select('*').eq('garage_id', garageId).order('created_at', { ascending: false })
  if (error) throw error
  if (!jobs?.length) return []

  const { data: lines } = await supabase
    .from('job_lines').select('*').in('job_id', jobs.map(j => j.id))

  return jobs.map(j => ({
    ...j,
    customerId: j.customer_id,
    vehicleId: j.vehicle_id,
    custName: j.cust_name,
    custEmail: j.cust_email,
    bookedDate: j.booked_date,
    startDate: j.start_date,
    completeDate: j.complete_date,
    mileageIn: j.mileage_in,
    mileageOut: j.mileage_out,
    reportedIssues: j.reported_issues,
    workCarriedOut: j.work_carried_out,
    technicianNotes: j.technician_notes,
    labourRateId: j.labour_rate_id,
    invoiceId: j.invoice_id,
    lines: (lines || []).filter(l => l.job_id === j.id).map(l => ({
      ...l,
      desc: l.line_desc,
      lineType: l.line_type,
      partId: l.part_id,
      partBatchId: l.part_batch_id,
      labourRateId: l.labour_rate_id,
      serviceId: l.service_id,
      sortOrder: l.sort_order,
    })),
  }))
}

export async function insertJob(garageId, job) {
  const { error: jobErr } = await supabase.from('jobs').insert({
    id: job.id,
    garage_id: garageId,
    customer_id: job.customerId || null,
    vehicle_id: job.vehicleId || null,
    cust_name: job.custName || null,
    cust_email: job.custEmail || null,
    reg: job.reg || null,
    status: job.status || 'booked',
    booked_date: job.bookedDate || null,
    start_date: job.startDate || null,
    complete_date: job.completeDate || null,
    mileage_in: job.mileageIn || null,
    mileage_out: job.mileageOut || null,
    reported_issues: job.reportedIssues || null,
    work_carried_out: job.workCarriedOut || null,
    technician_notes: job.technicianNotes || null,
    labour_rate_id: job.labourRateId || null,
    invoice_id: job.invoiceId || null,
  })
  if (jobErr) throw jobErr

  if (job.lines?.length) {
    const { error: linesErr } = await supabase.from('job_lines').insert(
      job.lines.map((l, i) => ({
        job_id: job.id,
        garage_id: garageId,
        line_type: l.lineType,
        line_desc: l.desc,
        qty: l.qty || 1,
        unit: l.unit || 0,
        cost: l.cost || 0,
        part_id: l.partId || null,
        part_batch_id: l.partBatchId || null,
        labour_rate_id: l.labourRateId || null,
        service_id: l.serviceId || null,
        sort_order: l.sortOrder ?? i,
      }))
    )
    if (linesErr) throw linesErr
  }
}

export async function updateJob(id, updates) {
  const dbUpdates = {}
  if (updates.customerId !== undefined) dbUpdates.customer_id = updates.customerId
  if (updates.vehicleId !== undefined) dbUpdates.vehicle_id = updates.vehicleId
  if (updates.custName !== undefined) dbUpdates.cust_name = updates.custName
  if (updates.custEmail !== undefined) dbUpdates.cust_email = updates.custEmail
  if (updates.reg !== undefined) dbUpdates.reg = updates.reg
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.bookedDate !== undefined) dbUpdates.booked_date = updates.bookedDate
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate
  if (updates.completeDate !== undefined) dbUpdates.complete_date = updates.completeDate
  if (updates.mileageIn !== undefined) dbUpdates.mileage_in = updates.mileageIn
  if (updates.mileageOut !== undefined) dbUpdates.mileage_out = updates.mileageOut
  if (updates.reportedIssues !== undefined) dbUpdates.reported_issues = updates.reportedIssues
  if (updates.workCarriedOut !== undefined) dbUpdates.work_carried_out = updates.workCarriedOut
  if (updates.technicianNotes !== undefined) dbUpdates.technician_notes = updates.technicianNotes
  if (updates.labourRateId !== undefined) dbUpdates.labour_rate_id = updates.labourRateId
  if (updates.invoiceId !== undefined) dbUpdates.invoice_id = updates.invoiceId

  const { error } = await supabase.from('jobs').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function updateJobStatus(id, status) {
  const { error } = await supabase.from('jobs').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteJob(id) {
  await supabase.from('job_lines').delete().eq('job_id', id)
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

export async function replaceJobLines(jobId, garageId, lines) {
  await supabase.from('job_lines').delete().eq('job_id', jobId)
  if (!lines?.length) return
  const { error } = await supabase.from('job_lines').insert(
    lines.map((l, i) => ({
      job_id: jobId,
      garage_id: garageId,
      line_type: l.lineType,
      line_desc: l.desc,
      qty: l.qty || 1,
      unit: l.unit || 0,
      cost: l.cost || 0,
      part_id: l.partId || null,
      part_batch_id: l.partBatchId || null,
      labour_rate_id: l.labourRateId || null,
      service_id: l.serviceId || null,
      sort_order: l.sortOrder ?? i,
    }))
  )
  if (error) throw error
}

// ============================================================
// MOT REMINDERS (GarageOps)
// ============================================================
export async function getMotReminders(garageId) {
  const { data, error } = await supabase
    .from('mot_reminders').select('*').eq('garage_id', garageId).order('mot_due')
  if (error) throw error
  return (data || []).map(r => ({
    ...r,
    vehicleId: r.vehicle_id,
    motDue: r.mot_due,
    reminderSentAt: r.reminder_sent_at,
    reminderMethod: r.reminder_method,
  }))
}

export async function insertMotReminder(garageId, reminder) {
  const { data, error } = await supabase.from('mot_reminders').insert({
    garage_id: garageId,
    vehicle_id: reminder.vehicleId,
    mot_due: reminder.motDue,
    status: reminder.status || 'pending',
    reminder_sent_at: reminder.reminderSentAt || null,
    reminder_method: reminder.reminderMethod || null,
    notes: reminder.notes || null,
  }).select().single()
  if (error) throw error
  return {
    ...data,
    vehicleId: data.vehicle_id,
    motDue: data.mot_due,
    reminderSentAt: data.reminder_sent_at,
    reminderMethod: data.reminder_method,
  }
}

export async function updateMotReminder(id, updates) {
  const dbUpdates = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.reminderSentAt !== undefined) dbUpdates.reminder_sent_at = updates.reminderSentAt
  if (updates.reminderMethod !== undefined) dbUpdates.reminder_method = updates.reminderMethod
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (updates.motDue !== undefined) dbUpdates.mot_due = updates.motDue

  const { error } = await supabase.from('mot_reminders').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function deleteMotReminder(id) {
  const { error } = await supabase.from('mot_reminders').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// LOAD ALL DATA FOR A GARAGE (product-aware)
// ============================================================
// On login we check garage.product and load the relevant tables.
// For TyreOps: existing behaviour (skus, batches, used_tyres, customers, invoices)
// For GarageOps: new tables (vehicles, services, parts, part_batches,
//   labour_rates, jobs, mot_reminders, customers, invoices)
// Shared tables (customers, invoices) are loaded in both cases.
// ============================================================
export async function loadAllGarageData(email) {
  try {
    const garage = await getGarageByEmail(email)
    if (!garage) return null

    const product = garage.product || 'tyreops'

    if (product === 'garageops') {
      const [
        customers, invoices,
        vehicles, services, parts, partBatches, labourRates, jobs, motReminders,
      ] = await Promise.all([
        getCustomers(garage.id),
        getInvoices(garage.id),
        getVehicles(garage.id),
        getServices(garage.id),
        getParts(garage.id),
        getPartBatches(garage.id),
        getLabourRates(garage.id),
        getJobs(garage.id),
        getMotReminders(garage.id),
      ])

      return {
        garage,
        product,
        customers,
        invoices,
        vehicles,
        services,
        parts,
        partBatches,
        labourRates,
        jobs,
        motReminders,
        // TyreOps-specific collections stay empty
        skus: [],
        batches: [],
        usedTyres: [],
      }
    }

    // TyreOps (default) — existing behaviour preserved
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
      product,
      skus,
      batches: normBatches,
      usedTyres,
      customers,
      invoices,
      // GarageOps-specific collections stay empty
      vehicles: [],
      services: [],
      parts: [],
      partBatches: [],
      labourRates: [],
      jobs: [],
      motReminders: [],
    }
  } catch (err) {
    console.error('Error loading garage data:', err)
    return null
  }
}

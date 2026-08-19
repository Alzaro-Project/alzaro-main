// GarageOps multi-user (staff seats) — data layer.
// Rows live in the shared garage_staff table, product-scoped to 'garageops'.
import { supabase } from './supabase'

export const STAFF_PERMS = [
  ['dashboard', 'Dashboard',     'Workshop totals and charts'],
  ['invoices',  'Invoices',      'Create, edit and send invoices'],
  ['customers', 'Customers',     'Manage the customer list'],
  ['items',     'Items',         'Parts, services and labour rates'],
  ['database',  'Database',      'Vehicles, jobs and workshop history'],
  ['purchases', 'Purchases',     'Record parts purchases'],
  ['calendar',  'Calendar',      'Bookings and the workshop diary'],
  ['reports',   'VAT & Reports', 'Read-only VAT and reporting'],
]

// Is THIS login a staff seat on someone's garage? Fails open to null on any
// error (e.g. migration 013 not run yet) so normal owners always boot.
export async function getStaffMapping(uid) {
  try {
    const { data, error } = await supabase
      .from('garage_staff')
      .select('id, owner_id, permissions, status')
      .eq('product', 'garageops')
      .eq('staff_user_id', uid)
      .in('status', ['invited', 'active'])
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch (e) {
    return null
  }
}

// Owner's view of their staff rows (RLS: owner_id = auth.uid()).
export async function listStaff() {
  return supabase
    .from('garage_staff')
    .select('id, staff_email, permissions, status, created_via_invite, created_at')
    .eq('product', 'garageops')
    .order('created_at', { ascending: true })
}
export async function updateStaffPermissions(id, permissions) {
  return supabase.from('garage_staff').update({ permissions }).eq('id', id)
}
export async function removeStaff(id) {
  return supabase.from('garage_staff').delete().eq('id', id)
}

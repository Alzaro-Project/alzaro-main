// PropertyOps multi-user (staff seats) — data layer.
// Mirrors SoloOps' staff helpers against the prop_staff table.
import { db } from "./supabase.js";

export const STAFF_PERMS = [
  ["dashboard",   "Dashboard",   "Portfolio totals and charts"],
  ["properties",  "Properties",  "Add and manage properties"],
  ["tenants",     "Tenants",     "Manage tenants and tenancies"],
  ["finance",     "Finance",     "Rent payments, invoices and arrears"],
  ["maintenance", "Maintenance", "Log and track maintenance jobs"],
  ["compliance",  "Compliance",  "Certificates and compliance deadlines"],
  ["documents",   "Documents",   "Upload and view documents"],
  ["reports",     "Reports",     "Read-only reports over the portfolio"],
];

// Is THIS login a staff seat on someone's portfolio? Fails open to null on
// any error (e.g. migration 012 not run yet) so normal owners always boot.
export async function getStaffMapping(uid) {
  try {
    const { data, error } = await db
      .from("prop_staff")
      .select("id, owner_id, permissions, status")
      .eq("staff_user_id", uid)
      .in("status", ["invited", "active"])
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch (e) {
    return null;
  }
}

// Owner's view of their staff rows (RLS: owner_id = auth.uid()).
export async function listStaff() {
  return db
    .from("prop_staff")
    .select("id, staff_email, permissions, status, created_via_invite, created_at")
    .order("created_at", { ascending: true });
}
export async function updateStaffPermissions(id, permissions) {
  return db.from("prop_staff").update({ permissions }).eq("id", id);
}
export async function removeStaff(id) {
  return db.from("prop_staff").delete().eq("id", id);
}

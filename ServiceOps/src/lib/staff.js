// ServiceOps multi-user (staff seats) — data layer.
import { db } from "./db.js";

export const STAFF_PERMS = [
  ["dashboard",    "Dashboard",    "Business totals and charts"],
  ["invoicing",    "Invoicing",    "Create, edit and send invoices"],
  ["quotes",       "Quotes",       "Create and manage quotes"],
  ["customers",    "Customers",    "Customers and their properties"],
  ["diary",        "Diary",        "Jobs, bookings and day notes"],
  ["certificates", "Certificates", "Certificates and documents"],
  ["reports",      "Reports",      "Read-only reports"],
];

// Pages reachable outside the nav map onto nav permissions.
export const PAGE_PERM = { properties: "customers", jobs: "diary", documents: "certificates" };

// Is THIS login a staff seat on someone's business? Fails open to null on any
// error (e.g. migration 015 not run yet) so normal owners always boot.
export async function getStaffMapping(uid) {
  try {
    const { data, error } = await db
      .from("svc_staff")
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

export async function listStaff() {
  return db
    .from("svc_staff")
    .select("id, staff_email, permissions, status, created_via_invite, created_at")
    .order("created_at", { ascending: true });
}
export async function updateStaffPermissions(id, permissions) {
  return db.from("svc_staff").update({ permissions }).eq("id", id);
}
export async function removeStaff(id) {
  return db.from("svc_staff").delete().eq("id", id);
}

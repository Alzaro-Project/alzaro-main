// PropertyOps accountant link — data layer.
// Creation goes through /api/accountant (service role: membership check +
// invite email). These helpers run under RLS: the client can see, retune the
// visibility of, and revoke their own link — nothing else. Mirror of the
// SoloOps/TyreOps/GarageOps/ServiceOps helpers, product-scoped to 'propertyops'.
import { db } from "./supabase.js";

export async function getAccountantLink() {
  try {
    const { data, error } = await db
      .from("accountant_links")
      .select("id, accountant_email, permissions, status, created_at")
      .eq("product", "propertyops")
      .limit(1)
      .maybeSingle();
    if (error) return null;   // fails open pre-migration, same as staff
    return data || null;
  } catch (e) {
    return null;
  }
}
export async function updateAccountantPermissions(id, permissions) {
  return db.from("accountant_links").update({ permissions }).eq("id", id);
}
export async function revokeAccountant(id) {
  return db.from("accountant_links").delete().eq("id", id);
}

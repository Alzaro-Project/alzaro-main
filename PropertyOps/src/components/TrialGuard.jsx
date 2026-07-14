import { useEffect, useState } from "react";
import { db } from "../lib/supabase.js";

// Status gating for PropertyOps, mirroring the other verticals' TrialGuard.
// Reads product_members.id / status / trial_ends (by user_id + product) and
// blocks access when a subscription is suspended/cancelled or an unpaid trial
// has expired. The Stripe webhook keeps status in sync; re-check on mount + 30s.
//
// IMPORTANT: the block screens must never dead-end. An expired trial shows the
// plan cards with REAL checkout buttons right here (the app behind the guard is
// unreachable, so linking to /settings would just reload this screen). After
// Stripe checkout the webhook sets status=active and the guard unlocks.

// Same tiers/prices as the Settings subscription tab and api/_billing-config.js.
const TIERS = [
  { key: "basic",  name: "Basic",  icon: "⚪", price: 8.99, best: "Getting started",   features: ["Up to 5 properties", "Tenant & rent records", "Dashboard overview"] },
  { key: "bronze", name: "Bronze", icon: "🥉", price: 14.99, best: "Small portfolios",   features: ["Everything in Basic", "Up to 15 properties", "Maintenance tracking"] },
  { key: "silver", name: "Silver", icon: "🥈", price: 18.99, best: "Growing portfolios", features: ["Everything in Bronze", "Unlimited properties", "Compliance & reports", "Finance tracking"] },
  { key: "gold",   name: "Gold",   icon: "🥇", price: 28.99, best: "Full operation",     features: ["Everything in Silver", "Document vault", "Priority support"] },
];

export default function TrialGuard({ user, children }) {
  const [memberId, setMemberId] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [liveTrialEnds, setLiveTrialEnds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changingTier, setChangingTier] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [err, setErr] = useState("");
  // Fail closed: if we can NEVER read the account status, we must not render the
  // app (a suspended/expired account would otherwise slip through on an error).
  // verifyFailed is only set after retries AND only when we've never had a good
  // read — a transient blip during the 30s poll keeps the last known status.
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [everLoaded, setEverLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;

    const readOnce = async () => {
      const { data, error } = await db
        .from("product_members")
        .select("id, status, trial_ends")
        .eq("user_id", user.id)
        .eq("product", "propertyops")
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    const fetchStatus = async () => {
      // Retry a couple of times before giving up, to ride out brief network blips.
      let data = null, lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { data = await readOnce(); lastErr = null; break; }
        catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
      }
      if (cancelled) return;
      if (!lastErr) {
        // A real (possibly empty) result. If a member row exists, apply it.
        if (data) {
          setMemberId(data.id);
          setLiveStatus(data.status);
          setLiveTrialEnds(data.trial_ends);
        }
        setEverLoaded(true);
        setVerifyFailed(false);
      } else {
        // All retries failed. Only wall the user if we've NEVER had a good read;
        // otherwise keep the last known status and try again on the next poll.
        console.error("Failed to fetch PropertyOps status:", lastErr);
        if (!everLoaded) setVerifyFailed(true);
      }
      setLoading(false);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id, everLoaded]);

  const signOut = async () => {
    try { await db.auth.signOut(); } catch (e) { /* ignore */ }
    window.location.href = "/propertyops/login";
  };

  // Current Supabase access token for authenticating API calls (same pattern
  // as the Settings page).
  const authHeaders = async () => {
    const { data: { session } } = await db.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  // Start a real Stripe Checkout for the chosen plan straight from the guard.
  const startCheckout = async (tierKey) => {
    setErr("");
    if (!memberId || !user?.email) {
      setErr("Your account is still loading — please try again in a moment.");
      return;
    }
    setChangingTier(tierKey);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ email: user.email, garageId: memberId, product: "propertyops", tier: tierKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      setErr(e.message === "Failed to fetch" ? "Could not reach the billing service — please try again." : (e.message || "Could not start checkout"));
      setChangingTier(null);
    }
  };

  // Open the Stripe Billing Portal (suspended accounts: fix payment / reactivate).
  const openPortal = async () => {
    setErr("");
    if (!memberId) {
      setErr("Your account is still loading — please try again in a moment.");
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ garageId: memberId, product: "propertyops" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open billing portal");
      window.location.href = data.url;
    } catch (e) {
      setErr(e.message || "Could not open billing portal");
      setPortalLoading(false);
    }
  };

  const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
  const cardStyle = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "34px 30px", maxWidth: 460, textAlign: "center" };
  const outBtn = { marginTop: 18, background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 18px", color: "var(--txt)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const errBox = err ? (
    <div style={{ background: "var(--red-soft)", border: "0.5px solid var(--red)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--red)", margin: "14px auto 0", maxWidth: 420 }}>{err}</div>
  ) : null;

  if (loading) {
    return <div style={{ ...wrap, color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>;
  }

  // Fail closed: we couldn't verify the account status at all (and never have).
  // Don't render the app — show a retry screen instead of risking full access
  // for a suspended/expired account.
  if (verifyFailed) {
    return (
      <div style={wrap}>
        <div style={cardStyle}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Couldn't verify your account</div>
          <div style={{ color: "var(--txt-2)", marginBottom: 20, lineHeight: 1.6, fontSize: 13.5 }}>
            We couldn't reach our servers to confirm your subscription. Please check your connection and try again — your data is safe.
          </div>
          <div onClick={() => window.location.reload()} style={{ display: "inline-block", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "12px 22px", borderRadius: 8, cursor: "pointer" }}>
            Try again
          </div>
          <div style={{ color: "var(--txt-3)", fontSize: 12.5, marginTop: 16 }}>Still stuck? support@alzaro.co.uk</div>
          <button onClick={signOut} style={outBtn}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (liveStatus === "suspended") {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 880;
    return (
      <div style={{ ...wrap, alignItems: "flex-start", paddingTop: 40, overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 960 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🔒</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Account Suspended</div>
            <div style={{ color: "var(--txt-2)", lineHeight: 1.6, fontSize: 13.5, maxWidth: 520, margin: "0 auto" }}>
              Your subscription is no longer active — but your data is safe. If a payment failed, update your billing details to restore access. Otherwise, pick a plan below to start a fresh subscription.
            </div>
            <div onClick={portalLoading ? undefined : openPortal} style={{ display: "inline-block", background: "var(--panel)", border: "0.5px solid var(--line)", color: "var(--txt)", fontWeight: 600, fontSize: 13.5, padding: "11px 22px", borderRadius: 8, marginTop: 16, cursor: portalLoading ? "default" : "pointer", opacity: portalLoading ? 0.7 : 1 }}>
              {portalLoading ? "Opening…" : "Update billing details"}
            </div>
            {errBox}
          </div>

          <div style={{ textAlign: "center", color: "var(--txt-3)", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Or start a new subscription:</div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 12 }}>
            {TIERS.map((t) => (
              <div key={t.key} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 14, padding: "18px 18px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.icon} {t.name}</div>
                <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 12 }}>{t.best}</div>
                <div style={{ marginBottom: 14 }}><span style={{ fontSize: 24, fontWeight: 700 }}>£{t.price}</span><span style={{ fontSize: 12, color: "var(--txt-3)" }}> /month</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16, flex: 1 }}>
                  {t.features.map((f, k) => (
                    <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5, color: "var(--txt-2)" }}>
                      <i className="ti ti-check" style={{ fontSize: 13, color: "var(--green)", marginTop: 1, flexShrink: 0 }} />{f}
                    </div>
                  ))}
                </div>
                <div onClick={() => { if (!changingTier) startCheckout(t.key); }}
                  style={{ textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#fff", background: "var(--brand)", padding: "10px", borderRadius: 8, cursor: changingTier ? "default" : "pointer", opacity: changingTier && changingTier !== t.key ? 0.6 : 1 }}>
                  {changingTier === t.key ? "Starting checkout…" : `Subscribe to ${t.name}`}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <div style={{ color: "var(--txt-3)", fontSize: 12.5 }}>Secure checkout via Stripe · Cancel anytime · Questions? support@alzaro.co.uk</div>
            <button onClick={signOut} style={{ ...outBtn, background: "none", border: "none", textDecoration: "underline", color: "var(--txt-3)", fontWeight: 500, fontSize: 12 }}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (liveStatus === "trial" && liveTrialEnds) {
    const trialEnd = new Date(liveTrialEnds);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    trialEnd.setHours(0, 0, 0, 0);
    if (today > trialEnd) {
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 880;
      return (
        <div style={{ ...wrap, alignItems: "flex-start", paddingTop: 40, overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 960 }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>⏰</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your free trial has ended</div>
              <div style={{ color: "var(--txt-2)", lineHeight: 1.6, fontSize: 13.5, maxWidth: 520, margin: "0 auto" }}>
                All your properties, tenants and records are safe. Pick a plan below to carry on exactly where you left off.
              </div>
              {errBox}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 12 }}>
              {TIERS.map((t) => (
                <div key={t.key} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 14, padding: "18px 18px", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.icon} {t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 12 }}>{t.best}</div>
                  <div style={{ marginBottom: 14 }}><span style={{ fontSize: 24, fontWeight: 700 }}>£{t.price}</span><span style={{ fontSize: 12, color: "var(--txt-3)" }}> /month</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16, flex: 1 }}>
                    {t.features.map((f, k) => (
                      <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5, color: "var(--txt-2)" }}>
                        <i className="ti ti-check" style={{ fontSize: 13, color: "var(--green)", marginTop: 1, flexShrink: 0 }} />{f}
                      </div>
                    ))}
                  </div>
                  <div onClick={() => { if (!changingTier) startCheckout(t.key); }}
                    style={{ textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#fff", background: "var(--brand)", padding: "10px", borderRadius: 8, cursor: changingTier ? "default" : "pointer", opacity: changingTier && changingTier !== t.key ? 0.6 : 1 }}>
                    {changingTier === t.key ? "Starting checkout…" : `Subscribe to ${t.name}`}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <div style={{ color: "var(--txt-3)", fontSize: 12.5 }}>Secure checkout via Stripe · Cancel anytime · Questions? support@alzaro.co.uk</div>
              <button onClick={signOut} style={{ ...outBtn, background: "none", border: "none", textDecoration: "underline", color: "var(--txt-3)", fontWeight: 500, fontSize: 12 }}>Sign out</button>
            </div>
          </div>
        </div>
      );
    }
  }

  return children;
}

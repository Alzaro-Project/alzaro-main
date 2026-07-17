import React, { useState, useEffect, useRef } from "react";
import { Btn, ConfirmDialog, DetailBox, DetailRow, Metric, PageHead, Panel, Pill, Table, Td, WelcomeBanner, useConfirm } from "../components/UI.jsx";
import { gbp, ukDate, propLabel, toneVar, usePropertyList, useIsMobile, NAV, TIER_ORDER, effectiveStatus, friendlyError, dashRange, inDashRange } from "../lib/helpers.js";
import { DB_READY, db } from "../lib/supabase.js";

// ===== Dashboard interactivity: cursor-tilt cards, hover lift/glow, staggered entrance =====
// Injected once. Scoped to .pdash-* so it can't collide with other styles.
if (typeof document !== "undefined" && !document.getElementById("pdash-css")) {
  const st = document.createElement("style");
  st.id = "pdash-css";
  st.textContent = `
    .pdash-card {
      transition: transform .25s cubic-bezier(.2,.8,.3,1), box-shadow .25s ease, border-color .25s ease;
      will-change: transform;
      animation: pdashIn .45s cubic-bezier(.2,.8,.3,1) backwards;
    }
    .pdash-card:hover {
      box-shadow: 0 16px 36px rgba(0,0,0,.28);
      border-color: var(--line-2) !important;
      transition: transform .06s linear, box-shadow .25s ease, border-color .25s ease;
    }
    @keyframes pdashIn { from { opacity:0; transform: translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
    .pdash-row { transition: background .15s ease, padding-left .15s ease; }
    .pdash-row:hover { background: var(--panel-2); padding-left: 12px !important; }
    @media (prefers-reduced-motion: reduce) { .pdash-card { animation:none; transition:none; } }
  `;
  document.head.appendChild(st);
}

// Interactive card: follows the cursor with a subtle 3D tilt, lifts on hover,
// shows a soft glow in the accent colour, and slides an arrow if clickable.
// When `locked`, it shows a lock + tier tag instead of the value (upgrade nudge).
function TiltCard({ label, value, sub, subColor, color = "var(--txt)", icon, onClick, index = 0, children, locked = false, lockTier }) {
  const ref = React.useRef(null);
  const [transform, setTransform] = useState("");
  const [hover, setHover] = useState(false);
  const onMove = (e) => {
    if (locked) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTransform(`perspective(700px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateY(-4px) scale(1.02)`);
  };
  const onLeave = () => { setTransform(""); setHover(false); };
  const tierName = lockTier ? lockTier.charAt(0).toUpperCase() + lockTier.slice(1) : "Silver";
  return (
    <div ref={ref} className="pdash-card" onMouseMove={onMove} onMouseEnter={() => setHover(true)} onMouseLeave={onLeave} onClick={onClick}
      style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 14, padding: 16, cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden", transform, animationDelay: `${index * 55}ms`, opacity: locked ? 0.82 : 1 }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: hover && !locked ? 1 : 0, transition: "opacity .25s",
        background: `radial-gradient(420px circle at 30% 0%, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)` }} />
      {children ? children : (<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ width: 26, height: 26, borderRadius: 7, background: locked ? "var(--panel-2)" : `color-mix(in srgb, ${color} 14%, transparent)`, color: locked ? "var(--txt-3)" : color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${icon}`} style={{ fontSize: 15 }} /></span>}
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--txt-3)" }}>{label}</div>
          </div>
          {locked
            ? <i className="ti ti-lock" style={{ fontSize: 14, color: "var(--txt-3)" }} />
            : (onClick && <i className="ti ti-arrow-right" style={{ fontSize: 15, color, opacity: hover ? 1 : 0.3, transform: hover ? "translateX(2px)" : "none", transition: "transform .2s, opacity .2s" }} />)}
        </div>
        {locked ? (
          <>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 4, background: "var(--brand-soft)", color: "var(--brand)", fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 7 }}>
              <i className="ti ti-sparkles" style={{ fontSize: 13 }} />{tierName} feature
            </div>
            <div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>Upgrade to unlock</div>
          </>
        ) : (<>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8, marginBottom: 2, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          {sub && <div style={{ fontSize: 11.5, color: subColor || "var(--txt-3)" }}>{sub}</div>}
        </>)}
      </>)}
    </div>
  );
}

// 6-month rent chart: Collected (Paid) vs Outstanding (Pending + Overdue),
// grouped by due-date month. Hand-drawn bars (no chart library), with a hover
// tooltip, gridlines and a legend — matching the interactive card style.
function RentChart({ pays, go }) {
  const [hov, setHov] = useState(null);
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleDateString("en-GB", { month: "short" }), collected: 0, outstanding: 0 });
  }
  const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  (pays || []).forEach((p) => {
    const dateStr = p.due_date || p.billing_date;
    if (!dateStr) return;
    const key = String(dateStr).slice(0, 7);
    if (!(key in idx)) return;
    const amt = +p.amount || 0;
    if (p.status === "Paid") months[idx[key]].collected += amt;
    else months[idx[key]].outstanding += amt; // Pending or Overdue
  });
  const maxVal = Math.max(...months.map((m) => m.collected + m.outstanding), 1) * 1.15;
  const totalCollected = months.reduce((s, m) => s + m.collected, 0);
  const hasAny = months.some((m) => m.collected || m.outstanding);

  return (
    <div className="pdash-card" onClick={() => go("finance")}
      style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 14, padding: 16, cursor: "pointer", position: "relative", overflow: "hidden", animationDelay: "0ms" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--txt-3)" }}>Rent Collected · Last 6 Months</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green)" }}>{gbp(totalCollected)}</div>
      </div>

      {!hasAny ? (
        <div style={{ fontSize: 12, color: "var(--txt-3)", padding: "28px 0", textAlign: "center" }}>No rent payments logged yet. Add payments in Finance to see them here.</div>
      ) : (
        <>
          <div style={{ position: "relative", height: 150, marginTop: 14 }}>
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <div key={g} style={{ position: "absolute", left: 0, right: 0, bottom: `${g * 100}%`, borderTop: "0.5px solid var(--line)", opacity: 0.6 }} />
            ))}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: "100%", position: "relative" }}>
              {months.map((m, i) => {
                const total = m.collected + m.outstanding;
                const collH = (m.collected / maxVal) * 100;
                const outH = (m.outstanding / maxVal) * 100;
                return (
                  <div key={m.key} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                    style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", cursor: "pointer" }}>
                    <div style={{ width: "72%", maxWidth: 46, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", borderRadius: 6, overflow: "hidden", opacity: hov === null || hov === i ? 1 : 0.45, transition: "opacity .15s" }}>
                      {outH > 0 && <div style={{ height: `${outH}%`, background: "var(--amber)", transition: "height .3s ease" }} />}
                      <div style={{ height: `${collH}%`, background: "var(--green)", transition: "height .3s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {hov !== null && (
              <div style={{ position: "absolute", top: -6, left: `${(hov + 0.5) * (100 / 6)}%`, transform: "translateX(-50%)", background: "var(--panel-2)", border: "0.5px solid var(--line-2)", borderRadius: 8, padding: "7px 10px", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5, boxShadow: "0 8px 20px rgba(0,0,0,.25)" }}>
                <div style={{ color: "var(--txt-3)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{months[hov].label}</div>
                <div style={{ color: "var(--green)" }}>Collected {gbp(Math.round(months[hov].collected))}</div>
                <div style={{ color: "var(--amber)" }}>Outstanding {gbp(Math.round(months[hov].outstanding))}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {months.map((m) => <div key={m.key} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "var(--txt-3)" }}>{m.label}</div>)}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--line)" }}>
            <span style={{ fontSize: 10.5, color: "var(--txt-2)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, background: "var(--green)", borderRadius: 2 }} />Collected</span>
            <span style={{ fontSize: 10.5, color: "var(--txt-2)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, background: "var(--amber)", borderRadius: 2 }} />Outstanding</span>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardPage({ range, customRange, go, user, tier }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [emailDismissed, setEmailDismissed] = useState(() => {
    try { return localStorage.getItem(`propops_email_nudge_dismissed_${user?.id || "anon"}`) === "1"; } catch (e) { return false; }
  });

  // Which features this plan can open. Mirrors the nav gate so a dashboard card
  // never promises data from a page the user is locked out of.
  const userTierIdx = Math.max(0, TIER_ORDER.indexOf((tier || "basic").toLowerCase()));
  const featureMin = (id) => { const n = NAV.find((x) => x.id === id); return n ? n.min : "basic"; };
  const allows = (id) => userTierIdx >= TIER_ORDER.indexOf(featureMin(id));
  const canCompliance = allows("compliance");
  const canFinance = allows("finance");
  const canMaint = allows("maintenance");

  useEffect(() => {
    if (!DB_READY) { setData({ props: [], comp: [], pays: [], maint: [], tenants: [] }); return; }
    Promise.all([
      db.from("prop_properties").select("*"),
      db.from("prop_compliance").select("*"),
      db.from("prop_payments").select("*"),
      db.from("prop_maintenance").select("*"),
      db.from("prop_tenants").select("*"),
    ]).then(([p, c, pay, mt, tn]) => setData({ props: p.data || [], comp: c.data || [], pays: pay.data || [], maint: mt.data || [], tenants: tn.data || [] }));
    // Has this company set up their own sending email yet? Invoices require it
    // (they must come from the company's address, not Alzaro's), so nudge if not.
    // Presence check only — never pull smtp_pass into the browser. Host + user
    // present means email is set up (the server holds/verifies the password).
    db.from("prop_settings").select("smtp_host, smtp_user").eq("user_id", user.id)
      .then(({ data: s }) => { const r = s && s[0]; setNeedsEmail(!(r && r.smtp_host && r.smtp_user)); });
  }, []);

  if (!data) return <div className="fade-in" style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading your portfolio…</div>;

  const { props, comp, pays, maint, tenants = [] } = data;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Active range window from the tabs at the top. null = all time.
  const win = dashRange(range, customRange);
  // Card sublabel for the window. Custom shows the real dates ("01/03/2026 –
  // 31/03/2026", or "since X" / "up to X" when one side is open-ended).
  const rangeLabel = (() => {
    if (!win) return "all time";
    if (range !== "Custom") return String(range).toLowerCase();
    let { from = "", to = "" } = customRange || {};
    if (from && to && from > to) { const t = from; from = to; to = t; } // mirror dashRange's swap
    if (from && to) return `${ukDate(from)} – ${ukDate(to)}`;
    return from ? `since ${ukDate(from)}` : `up to ${ukDate(to)}`;
  })();

  // properties / occupancy — a property counts as let if it has a tenancy
  // overlapping the window. Falls back to its current status when the range
  // is all-time or the property has no tenancy rows.
  const tenanciesFor = (p) => (tenants || []).filter((t) => t.property_id === p.id || t.property === p.name || t.property === p.address);
  const letInWindow = (p) => {
    if (!win) return p.status === "Let";
    const ts = tenanciesFor(p);
    if (!ts.length) return p.status === "Let";
    return ts.some((t) => {
      const s = t.tenancy_start ? new Date(t.tenancy_start) : null;
      const e = t.tenancy_end ? new Date(t.tenancy_end) : null;
      if (s && !isNaN(s) && s > win[1]) return false;  // starts after window
      if (e && !isNaN(e) && e < win[0]) return false;  // ended before window
      return true;
    });
  };
  const totalProps = props.length;
  const letProps = props.filter(letInWindow).length;
  const occupancy = totalProps ? Math.round((letProps / totalProps) * 1000) / 10 : 0;
  const income = pays
    .filter((p) => String(p.status || "").toLowerCase() === "paid" && inDashRange(p.due_date, win))
    .reduce((s, p) => s + (p.amount || 0), 0);

  // compliance — when a range is active, only score certificates expiring
  // inside that window; otherwise score the whole portfolio.
  const allCerts = comp.map((c) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; return { ...c, days: d }; });
  const certs = win ? allCerts.filter((c) => inDashRange(c.expiry_date, win)) : allCerts;
  const valid = certs.filter((c) => c.days !== null && c.days > 30).length;
  const hasCerts = certs.length > 0;
  const score = hasCerts ? Math.max(0, Math.round((valid / certs.length) * 100)) : null;
  const attention = certs.filter((c) => c.days !== null && c.days <= 30).length;

  // finance — arrears from payments due inside the window.
  const overdue = pays.filter((p) => effectiveStatus(p) === "Overdue" && inDashRange(p.due_date, win));
  const arrears = overdue.reduce((s, p) => s + (p.amount || 0), 0);
  const arrearsCount = overdue.length;

  // maintenance — jobs logged inside the window.
  const maintInRange = win ? maint.filter((m) => inDashRange(m.created_at, win)) : maint;
  const openMaint = maintInRange.filter((m) => m.status !== "Completed").length;
  const highPri = maintInRange.filter((m) => m.status !== "Completed" && m.priority === "High").length;

  const toneFor = { "Gas Safety": "ti-flame", "EICR": "ti-bolt", "EPC": "ti-leaf", "Smoke Alarm": "ti-bell-ringing", "Carbon Monoxide": "ti-cloud", "Legionella Risk": "ti-droplet", "PAT Testing": "ti-plug", "Buildings Insurance": "ti-umbrella", "HMO Licence": "ti-license", "Fire Risk Assessment": "ti-fire-extinguisher" };
  const certTone = (d) => d < 0 || d <= 7 ? "red" : d <= 30 ? "amber" : "blue";

  // Combined "Expiring Soon" — certificates AND tenancy end dates, within 60 days (or already passed).
  const certItems = certs
    .filter((c) => c.days !== null && c.days <= 60)
    .map((c) => ({ kind: "cert", id: "c" + c.id, label: c.type, sub: c.property || c.reference || "—", days: c.days, icon: toneFor[c.type] || "ti-shield-check", page: "compliance" }));
  const tenancyItems = (tenants || [])
    .filter((t) => t.tenancy_end)
    .map((t) => ({ kind: "tenancy", id: "t" + t.id, days: Math.round((new Date(t.tenancy_end) - today) / 864e5), label: "Tenancy ends · " + (t.name || "Tenant"), sub: t.property || "—", icon: "ti-calendar-event", page: "tenants" }))
    .filter((t) => t.days <= 60);
  const expiringSoon = [...(canCompliance ? certItems : []), ...tenancyItems].sort((a, b) => a.days - b.days).slice(0, 6);

  return (
    <div className="fade-in">
      <WelcomeBanner data={data} go={go} user={user} />
      {needsEmail && !emailDismissed && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--amber-soft, rgba(214,158,46,.12))", border: "0.5px solid var(--amber)", borderRadius: 12, padding: "13px 16px", marginBottom: 16 }}>
          <i className="ti ti-mail-cog" style={{ fontSize: 20, color: "var(--amber)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>Set up your business email</div>
            <div style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.4 }}>Connect your email so invoices send from your company's own address — not from Alzaro. Required before you can email invoices to tenants.</div>
          </div>
          <span onClick={() => { go("settings"); if (typeof window !== "undefined") window.location.hash = "email"; }} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--brand)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Set up now</span>
          <i className="ti ti-x" onClick={() => { setEmailDismissed(true); try { localStorage.setItem(`propops_email_nudge_dismissed_${user?.id || "anon"}`, "1"); } catch (e) {} }} style={{ fontSize: 16, color: "var(--txt-3)", cursor: "pointer", flexShrink: 0 }} title="Dismiss" />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <TiltCard index={0} onClick={() => go("compliance")} icon="ti-shield-check" locked={!canCompliance} lockTier={featureMin("compliance")} label="Compliance Score" color={!hasCerts ? "var(--txt-3)" : score >= 90 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"}
          value={<>{hasCerts ? score : 0}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>}
          sub={!hasCerts ? (win ? `No certificates due ${rangeLabel}` : "No certificates tracked yet") : score >= 90 ? "Portfolio healthy" : score >= 60 ? "Needs attention" : "At risk"} />
        <TiltCard index={1} onClick={() => go("finance")} icon="ti-coin" locked={!canFinance} lockTier={featureMin("finance")} label="Rent Arrears" color={arrears ? "var(--red)" : "var(--green)"} value={gbp(arrears)} sub={`${arrearsCount} overdue${win ? " · " + rangeLabel : ""}`} />
        <TiltCard index={2} onClick={() => go("properties")} icon="ti-home-check" label="Occupancy" color="var(--blue)" value={occupancy + "%"} sub={`${letProps} of ${totalProps} let`} />
        <TiltCard index={3} onClick={() => go("finance")} icon="ti-cash" locked={!canFinance} lockTier={featureMin("finance")} label="Income Collected" color="var(--brand)" value={gbp(income)} sub={win ? `Paid · ${rangeLabel}` : "Paid · all time"} />
      </div>
      {canFinance && (
        <div style={{ marginBottom: 12 }}>
          <RentChart pays={pays} go={go} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Expiring Soon" action="View all" onAction={() => go(canCompliance ? "compliance" : "tenants")}>
          {expiringSoon.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)", padding: "8px 0" }}>Nothing expiring in the next 60 days. {((canCompliance ? certs.length : 0) === 0 && (tenants || []).length === 0) && (canCompliance ? "Add certificates and tenants to track renewals here." : "Add tenants to track tenancy renewals here.")}</div>
          ) : expiringSoon.map((c, i) => {
            const t = toneVar(certTone(c.days));
            return (
              <div key={c.id || i} className="pdash-row" onClick={() => go(c.page)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < expiringSoon.length - 1 ? "0.5px solid var(--line)" : "none", cursor: "pointer", margin: "0 -8px", paddingLeft: 8, paddingRight: 8, borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${c.icon}`} style={{ fontSize: 16 }} /></span>
                  <div><div style={{ fontSize: 12.5 }}>{c.label}{c.sub && c.sub !== "—" ? " · " + c.sub : ""}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{c.kind === "tenancy" ? "Tenancy end date" : "Certificate"}</div></div>
                </div>
                <Pill text={c.days < 0 ? "expired" : c.days + " days"} tone={certTone(c.days)} />
              </div>
            );
          })}
        </Panel>
        <Panel title="Portfolio Summary">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { label: "Properties", val: totalProps, page: "properties", show: true },
              { label: "Let / Vacant", val: `${letProps} / ${totalProps - letProps}`, page: "properties", show: true },
              { label: "Certificates tracked", val: certs.length, page: "compliance", show: canCompliance },
              { label: "Open maintenance", val: openMaint, page: "maintenance", show: canMaint },
              { label: "Payments logged", val: pays.filter((p) => inDashRange(p.due_date, win)).length, page: "finance", show: canFinance },
            ].filter((r) => r.show).map((r, i) => (
              <div key={i} className="pdash-row" onClick={() => go(r.page)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 8px", margin: "0 -8px", borderRadius: 8, cursor: "pointer" }}>
                <span style={{ color: "var(--txt-2)" }}>{r.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontWeight: 600 }}>{r.val}</span><i className="ti ti-chevron-right" style={{ fontSize: 13, color: "var(--txt-3)" }} /></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
        <TiltCard index={4} onClick={() => go("maintenance")} icon="ti-tools" locked={!canMaint} lockTier={featureMin("maintenance")} label="Open Maintenance" value={openMaint} sub={`${highPri} high priority`} color="var(--amber)" />
        <TiltCard index={5} onClick={() => go("compliance")} icon="ti-alert-triangle" locked={!canCompliance} lockTier={featureMin("compliance")} label="Urgent Compliance" value={certs.filter((c) => c.days !== null && c.days <= 7).length} sub="Within 7 days" color="var(--red)" />
        <TiltCard index={6} onClick={() => go("properties")} icon="ti-building-estate" label="Properties" value={totalProps} sub={!hasCerts ? "No certificates yet" : score >= 90 ? "Portfolio healthy ✓" : "Check compliance"} subColor={!hasCerts ? "var(--txt-3)" : score >= 90 ? "var(--green)" : "var(--amber)"} color="var(--txt)" />
      </div>
    </div>
  );
}


export function PropertiesPage({ user, go, tier }) {
  const isMobile = useIsMobile();
  const [q, setQ] = useState("");
  // Click-to-sort for the property table.
  const [sort, setSort] = useState({ key: "address", dir: "asc" });
  const onSort = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const [rows, setRows] = useState(null);   // null = loading
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], comp: [], maint: [], pays: [] });
  const blank = { address: "", area: "", type: "House", status: "Let", rent: "", invoice_day: "" };
  const [form, setForm] = useState(blank);
  // Tracks whether the "Manual…" invoice-day mode is active, so the free-type
  // number box shows even when the field is momentarily empty. Without this,
  // selecting Manual set the value to "" and the input never appeared.
  const [manualDay, setManualDay] = useState(false);

  // Property count limits by subscription tier. Infinity = unlimited.
  // Matches the plan cards: Basic 5, Bronze 15, Silver & Gold unlimited.
  const PROPERTY_LIMIT = { basic: 5, bronze: 15, silver: Infinity, gold: Infinity };
  const propCap = PROPERTY_LIMIT[(tier || "basic").toLowerCase()] ?? 5;
  const propCount = (rows || []).length;
  const atLimit = propCount >= propCap;

  React.useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_properties").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(friendlyError(error, "loading data")); setRows([]); }
        else setRows(data || []);
      });
    Promise.all([
      db.from("prop_tenants").select("*"), db.from("prop_compliance").select("*"),
      db.from("prop_maintenance").select("*"), db.from("prop_payments").select("*"),
    ]).then(([t, c, m, p]) => setRelated({ tenants: t.data || [], comp: c.data || [], maint: m.data || [], pays: p.data || [] }));
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_properties").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => {
    if (!adding && atLimit) {
      setErr(`Your ${(tier || "basic")} plan includes up to ${propCap} properties. Upgrade to add more.`);
      return;
    }
    setForm(blank); setEditId(null); setManualDay(false); setAdding(!adding); setErr("");
  };
  const formRef = useRef(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const scrollToForm = () => { setTimeout(() => { try { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }, 60); };
  const openEdit = (p) => { setForm({ address: p.address || "", area: p.area || "", type: p.type || "House", status: p.status || "Let", rent: p.rent || "", invoice_day: p.invoice_day || "" }); setManualDay(p.invoice_day != null && p.invoice_day !== "" && !["1", "15", "31"].includes(String(p.invoice_day))); setEditId(p.id); setAdding(true); setErr(""); scrollToForm(); };
  const save = async () => {
    if (!form.address.trim()) { setErr("Address is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys in supabase.js to save for real."); return; }
    // Enforce the property cap on new additions (edits are always allowed).
    if (!editId && atLimit) {
      setErr(`Your ${(tier || "basic")} plan includes up to ${propCap} properties. Upgrade to add more.`);
      return;
    }
    // Invoice day must be a whole number 1–31. Warn instead of silently
    // clamping bad input; the projection logic later clamps a chosen day down
    // to each month's last day (e.g. 31 -> 28/29/30 as appropriate).
    if (form.invoice_day !== "" && form.invoice_day !== null && form.invoice_day !== undefined) {
      const day = Number(form.invoice_day);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        setErr("Invoice day needs to be a whole number between 1 and 31.");
        return;
      }
    }
    setErr("");
    const payload = { ...form, rent: form.rent === "" ? 0 : +form.rent, invoice_day: form.invoice_day === "" ? null : Number(form.invoice_day) };
    if (savingRef.current) return; savingRef.current = true; setSaving(true);
    let error;
    if (editId) {
      ({ error } = await db.from("prop_properties").update(payload).eq("id", editId));
    } else {
      ({ error } = await db.from("prop_properties").insert([{ ...payload, score: 100, user_id: user.id }]));
    }
    savingRef.current = false; setSaving(false);
    if (error) { setErr(friendlyError(error)); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const confirm = useConfirm();
  const doRemove = async (id) => { if (id && DB_READY) { await db.from("prop_properties").delete().eq("id", id); refresh(); } };
  const remove = (id) => confirm.ask({ title: "Delete this property?", message: "This property will be permanently deleted. Related tenants, certificates and records are not deleted but will no longer be linked. This can't be undone.", onConfirm: () => doRemove(id) });

  const filtered = (rows || []).filter((p) => ((p.address || p.addr || "") + (p.area || "") + (p.type || "")).toLowerCase().includes(q.toLowerCase()));
  const sortVal = (p) => {
    switch (sort.key) {
      case "address": return (p.address || p.addr || "").toLowerCase();
      case "area": return (p.area || "").toLowerCase();
      case "type": return (p.type || "").toLowerCase();
      case "status": return (p.status || "").toLowerCase();
      case "rent": return Number(p.rent) || 0;
      default: return "";
    }
  };
  const list = [...filtered].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b);
    const aE = av === "" || av === 0, bE = bv === "" || bv === 0;
    if (aE && bE) return 0; if (aE) return 1; if (bE) return -1;
    const num = sort.key === "rent";
    const cmp = num ? (av - bv) : String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
    return sort.dir === "asc" ? cmp : -cmp;
  });
  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" };

  return (
    <div className="fade-in">
      <ConfirmDialog {...confirm.props} />
      <PageHead title="Properties" sub={rows ? `${propCount}${propCap === Infinity ? "" : ` / ${propCap}`} ${DB_READY ? "" : "(demo) "}properties${atLimit && propCap !== Infinity ? " · limit reached" : ""}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : (atLimit ? "ti-lock" : "ti-plus")} label={adding ? "Cancel" : "Add property"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div ref={formRef} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit property" : "New property"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Area<input style={inp} placeholder="e.g. Manchester" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Type<select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["House", "Flat", "Bungalow", "HMO", "Block", "Commercial"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Let", "Vacant", "Sale agreed"].map((x) => <option key={x}>{x}</option>)}</select></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Rent (£ pcm)<input style={inp} type="number" min="0" placeholder="e.g. 1250" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Invoice day
              <select style={inp} value={manualDay ? "manual" : (["", "1", "15", "31"].includes(String(form.invoice_day)) ? (String(form.invoice_day) || "") : "manual")} onChange={(e) => { const v = e.target.value; if (v === "manual") { setManualDay(true); } else { setManualDay(false); setForm({ ...form, invoice_day: v }); } }}>
                <option value="">— none —</option>
                <option value="1">1st of month</option>
                <option value="15">15th of month</option>
                <option value="31">End of month</option>
                <option value="manual">Manual…</option>
              </select>
              {manualDay && (
                <input style={{ ...inp, marginTop: 6 }} type="number" min="1" max="31" placeholder="Day (1–31)" value={form.invoice_day} onChange={(e) => setForm({ ...form, invoice_day: e.target.value })} autoFocus />
              )}
              <span style={{ fontSize: 9.5, color: "var(--txt-3)" }}>Day each month rent is invoiced (31 = last day; shorter months adjust automatically)</span>
            </label>
            </div>
          <div style={{ marginTop: 12 }}><span onClick={saving ? undefined : save} style={{ opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : (editId ? "Update property" : "Save property")} primary /></span></div>
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by address, area or type…" style={{ ...inp, width: "100%", marginBottom: 14 }} />

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading properties…</div>
      ) : (
        <Table sort={sort} onSort={onSort} cols={["", { label: "Address", sortKey: "address" }, { label: "Area", sortKey: "area" }, { label: "Type", sortKey: "type" }, { label: "Status", sortKey: "status" }, { label: "Rent (pcm)", sortKey: "rent" }, "Compliance", ""]}>
          {list.map((p, i) => {
            const addr = (p.address || p.addr || "").toLowerCase();
            const match = (s) => (s || "").toLowerCase() === addr || (addr && (s || "").toLowerCase().includes(addr));
            // Prefer matching linked records by property_id (reliable); fall
            // back to the legacy address match for rows saved before ids.
            const linked = (arr) => arr.filter((x) => (p.id && String(x.property_id) === String(p.id)) || (!x.property_id && match(x.property)));
            const isOpen = expandedId === (p.id || i);
            const pT = linked(related.tenants);
            const pC = linked(related.comp);
            const pM = linked(related.maint);
            const pP = linked(related.pays);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            // Live compliance score for THIS property — % of its certificates
            // with more than 30 days left (same rule as the Compliance page).
            // The stored p.score is a stale insert-time value; ignore it.
            const dated = pC.filter((c) => c.expiry_date);
            const validCerts = dated.filter((c) => Math.round((new Date(c.expiry_date) - today) / 864e5) > 30).length;
            const liveScore = dated.length ? Math.round((validCerts / dated.length) * 100) : null;
            const scoreTone = liveScore === null ? "txt-3" : liveScore >= 90 ? "green" : liveScore >= 60 ? "amber" : "red";
            return (
              <React.Fragment key={p.id || i}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (p.id || i))}>
                  <Td><i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 15, color: "var(--txt-3)" }} /></Td>
                  <Td><span style={{ fontWeight: 500 }}>{p.address || p.addr}</span></Td>
                  <Td color="var(--txt-2)">{p.area || "—"}</Td>
                  <Td color="var(--txt-2)">{p.type}</Td>
                  <Td><Pill text={p.status} tone={p.status === "Let" ? "green" : "amber"} /></Td>
                  <Td>{p.rent ? gbp(p.rent) : "—"}</Td>
                  <Td><span style={{ color: `var(--${scoreTone})`, fontWeight: 600 }}>{liveScore === null ? "—" : liveScore}</span>{liveScore !== null && <span style={{ color: "var(--txt-3)" }}>/100</span>}</Td>
                  <Td>{p.id && DB_READY ? <span style={{ display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(p)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(p.id)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 14 }}>
                        <DetailBox title="Tenants" icon="ti-users" empty={pT.length === 0} emptyText="No tenants linked." onClick={() => go && go("tenants")}>
                          {pT.map((t, j) => <DetailRow key={j} main={t.name} sub={t.rent ? gbp(t.rent) + " pcm" : ""} pill={t.rent_status} tone={t.rent_status === "Overdue" ? "red" : "green"} />)}
                        </DetailBox>
                        <DetailBox title="Compliance" icon="ti-shield-check" empty={pC.length === 0} emptyText="No certificates tracked." onClick={() => go && go("compliance")}>
                          {pC.map((c, j) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; const tone = d === null ? "blue" : d <= 7 ? "red" : d <= 30 ? "amber" : "green"; return <DetailRow key={j} main={c.type} sub={c.expiry_date ? `expires ${ukDate(c.expiry_date)}` : ""} pill={d === null ? "—" : d < 0 ? "expired" : d + "d"} tone={tone} />; })}
                        </DetailBox>
                        <DetailBox title="Maintenance" icon="ti-tools" empty={pM.length === 0} emptyText="No maintenance jobs." onClick={() => go && go("maintenance")}>
                          {pM.map((m, j) => <DetailRow key={j} main={m.title} sub={m.contractor || ""} pill={m.status} tone={m.status === "Completed" ? "green" : m.priority === "High" ? "red" : "amber"} />)}
                        </DetailBox>
                        <DetailBox title="Payments" icon="ti-coin" empty={pP.length === 0} emptyText="No payments logged." onClick={() => go && go("finance")}>
                          {pP.map((x, j) => <DetailRow key={j} main={gbp(x.amount || 0)} sub={x.due_date ? ukDate(x.due_date) : ""} pill={effectiveStatus(x)} tone={effectiveStatus(x) === "Paid" ? "green" : effectiveStatus(x) === "Overdue" ? "red" : "amber"} />)}
                        </DetailBox>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </Table>
      )}
    </div>
  );
}


export function CompliancePage({ user, go }) {
  const TYPES = {
    "Gas Safety": "ti-flame", "EICR": "ti-bolt", "EPC": "ti-leaf", "Smoke Alarm": "ti-bell-ringing",
    "Carbon Monoxide": "ti-cloud", "Legionella Risk": "ti-droplet", "PAT Testing": "ti-plug",
    "Buildings Insurance": "ti-umbrella", "HMO Licence": "ti-license", "Fire Risk Assessment": "ti-fire-extinguisher",
  };
  const isMobile = useIsMobile();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], maint: [] });
  const [showBin, setShowBin] = useState(false);
  const [binRows, setBinRows] = useState([]);
  const properties = usePropertyList();
  const blank = { type: "Gas Safety", property_id: "", reference: "", start_date: "", expiry_date: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) {
      setRows([]);
      return;
    }
    // Only show live (not soft-deleted) certificates in the main timeline.
    db.from("prop_compliance").select("*").is("deleted_at", null)
      .then(({ data, error }) => { if (error) { setErr(friendlyError(error, "loading data")); setRows([]); } else setRows(data); });
    Promise.all([db.from("prop_tenants").select("*"), db.from("prop_maintenance").select("*")])
      .then(([t, m]) => setRelated({ tenants: t.data || [], maint: m.data || [] }));
  }, []);

  const refresh = async () => { const { data } = await db.from("prop_compliance").select("*").is("deleted_at", null); setRows(data || []); };
  // Recycle bin: soft-deleted certificates, most-recently-deleted first.
  const refreshBin = async () => { const { data } = await db.from("prop_compliance").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }); setBinRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const formRef = useRef(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const scrollToForm = () => { setTimeout(() => { try { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }, 60); };
  const openEdit = (c) => { setForm({ type: c.type || "Gas Safety", property_id: c.property_id || "", reference: c.reference || "", start_date: c.start_date || "", expiry_date: c.expiry_date || "" }); setEditId(c.id); setAdding(true); setErr(""); scrollToForm(); };

  const save = async () => {
    if (!form.expiry_date) { setErr("Expiry date is required — it's what we track."); return; }
    // Expiry can't be before the issue/start date (only checked when both set).
    if (form.start_date && form.expiry_date) {
      const start = new Date(form.start_date); start.setHours(0, 0, 0, 0);
      const exp = new Date(form.expiry_date); exp.setHours(0, 0, 0, 0);
      if (exp < start) { setErr("Expiry date can't be before the issue / start date."); return; }
    }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    // Empty date → null (Postgres rejects "" for date columns). Using null
    // instead of deleting the key means clearing the field on edit actually
    // clears it, rather than silently keeping the old value.
    payload.start_date = form.start_date || null;
    if (savingRef.current) return; savingRef.current = true; setSaving(true);
    let error;
    if (editId) ({ error } = await db.from("prop_compliance").update(payload).eq("id", editId));
    else ({ error } = await db.from("prop_compliance").insert([{ ...payload, user_id: user.id }]));
    savingRef.current = false; setSaving(false);
    if (error) { setErr(friendlyError(error)); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const confirm = useConfirm();
  // ── Date presets ──────────────────────────────────────────────
  // <input type="date"> needs YYYY-MM-DD. Build that from a Date safely
  // (local time, no timezone drift).
  const toISO = (d) => { const x = new Date(d); const y = x.getFullYear(); const m = String(x.getMonth() + 1).padStart(2, "0"); const day = String(x.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; };
  const addMonths = (base, months) => { const d = new Date(base); d.setMonth(d.getMonth() + months); return d; };
  const setStart = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); setForm((f) => ({ ...f, start_date: toISO(d) })); };
  // Expiry is measured FROM the issue date (or today if none set yet), which
  // is how renewal periods actually work (e.g. gas safety = issue + 1 year).
  const setExpiryFromIssue = (months) => { const base = form.start_date ? new Date(form.start_date) : new Date(); setForm((f) => ({ ...f, expiry_date: toISO(addMonths(base, months)) })); };
  const startPresets = [{ label: "Today", off: 0 }, { label: "Yesterday", off: -1 }];
  const expiryPresets = [{ label: "+6 months", m: 6 }, { label: "1 year", m: 12 }, { label: "2 years", m: 24 }, { label: "3 years", m: 36 }, { label: "5 years", m: 60 }];
  const chip = { fontSize: 10.5, fontWeight: 600, padding: "4px 9px", borderRadius: 6, cursor: "pointer", background: "var(--panel)", border: "0.5px solid var(--line)", color: "var(--txt-2)", whiteSpace: "nowrap" };
  // Soft-delete: move to the recycle bin (set deleted_at) instead of erasing,
  // so a certificate can be restored later.
  const doRemove = async (id) => { if (id && DB_READY) { await db.from("prop_compliance").update({ deleted_at: new Date().toISOString() }).eq("id", id); refresh(); if (showBin) refreshBin(); } };
  const remove = (id) => confirm.ask({ title: "Delete this certificate?", message: "It will be moved to the recycle bin. You can restore it later from there.", onConfirm: () => doRemove(id) });
  // Restore from bin back into the live timeline.
  const restore = async (id) => { if (id && DB_READY) { await db.from("prop_compliance").update({ deleted_at: null }).eq("id", id); await refreshBin(); refresh(); } };
  // Permanently erase a single certificate (only from the bin).
  const doPurge = async (id) => { if (id && DB_READY) { await db.from("prop_compliance").delete().eq("id", id); refreshBin(); } };
  const purge = (id) => confirm.ask({ title: "Delete forever?", message: "This certificate will be permanently deleted and can't be recovered.", onConfirm: () => doPurge(id) });
  // Empty the whole bin at once.
  const doEmptyBin = async () => { if (!DB_READY) return; await db.from("prop_compliance").delete().not("deleted_at", "is", null); refreshBin(); };
  const emptyBin = () => confirm.ask({ title: "Empty recycle bin?", message: "Every certificate in the bin will be permanently deleted and can't be recovered.", onConfirm: () => doEmptyBin() });
  const toggleBin = () => { const next = !showBin; setShowBin(next); if (next) refreshBin(); };

  // compute days-to-expiry + status for each item
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = (rows || []).map((c) => {
    const exp = c.expiry_date ? new Date(c.expiry_date) : null;
    const days = exp ? Math.round((exp - today) / 864e5) : null;
    const tone = days === null ? "blue" : days < 0 ? "red" : days <= 7 ? "red" : days <= 30 ? "amber" : "green";
    const status = days === null ? "No date" : days < 0 ? "Expired" : days <= 7 ? "Urgent" : days <= 30 ? "Due soon" : "Valid";
    return { ...c, days, tone, status };
  }).sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));

  const urgent = items.filter((c) => c.days !== null && c.days <= 7).length;
  const soon = items.filter((c) => c.days !== null && c.days > 7 && c.days <= 30).length;
  const valid = items.filter((c) => c.days !== null && c.days > 30).length;
  const score = items.length ? Math.max(0, Math.round((valid / items.length) * 100)) : 100;

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };

  return (
    <div className="fade-in">
      <ConfirmDialog {...confirm.props} />
      <PageHead title="Compliance" sub="Live tracking of every legal obligation across your portfolio."
        right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span onClick={toggleBin}><Btn icon={showBin ? "ti-arrow-back-up" : "ti-trash"} label={showBin ? "Back to certificates" : `Recycle bin${binRows.length ? ` (${binRows.length})` : ""}`} /></span>
          {!showBin && <span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add certificate"} primary /></span>}
        </div>} />
      {showBin && binRows.length > 0 && DB_READY && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}><span onClick={emptyBin} style={{ fontSize: 11.5, color: "var(--red)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><i className="ti ti-trash-x" style={{ fontSize: 14 }} />Empty bin</span></div>
      )}

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {showBin ? (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "6px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", padding: "12px 0 6px" }}>Recycle bin — deleted certificates</div>
          {binRows.length === 0 ? (
            <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center" }}>The recycle bin is empty. Deleted certificates appear here and can be restored.</div>
          ) : (
            binRows.map((c, i) => {
              const propName = propLabel(properties, c.property_id) || c.property || "—";
              const delWhen = c.deleted_at ? new Date(c.deleted_at) : null;
              return (
                <div key={c.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: i < binRows.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--panel)", color: "var(--txt-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${TYPES[c.type] || "ti-shield-check"}`} style={{ fontSize: 16 }} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.type}</div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{propName}{c.reference ? " · " + c.reference : ""}{delWhen ? " · deleted " + ukDate(c.deleted_at) : ""}</div>
                    </div>
                  </div>
                  {DB_READY && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      <span onClick={() => restore(c.id)} title="Restore" style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--green)", fontSize: 11.5, fontWeight: 600 }}><i className="ti ti-arrow-back-up" style={{ fontSize: 14 }} />Restore</span>
                      <span onClick={() => purge(c.id)} title="Delete forever" style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--red)", fontSize: 11.5, fontWeight: 600 }}><i className="ti ti-trash-x" style={{ fontSize: 14 }} />Delete</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
      <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Compliance Score" value={items.length ? <>{score}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></> : "—"} sub={!items.length ? "No certificates yet" : score >= 90 ? "Portfolio healthy" : score >= 60 ? "Needs attention" : "At risk"} color={!items.length ? "var(--txt-3)" : score >= 90 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"} />
        <Metric label="Urgent (≤7 days)" value={urgent} sub="Act now" color="var(--red)" />
        <Metric label="Due Soon (≤30 days)" value={soon} sub="Schedule renewal" color="var(--amber)" />
        <Metric label="Tracked Items" value={items.length} sub="Certificates" color="var(--blue)" />
      </div>

      {adding && (
        <div ref={formRef} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit certificate" : "New certificate"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            <label style={fld}>Type<select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.keys(TYPES).map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Reference / notes<input style={inp} placeholder="e.g. CP12 certificate" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
            <label style={fld}>Issued / start date (DD/MM/YYYY)<input style={inp} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{startPresets.map((p) => <span key={p.label} onClick={() => setStart(p.off)} style={chip}>{p.label}</span>)}</div>
            </label>
            <label style={fld}>Expiry date (DD/MM/YYYY)<input style={inp} type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{expiryPresets.map((p) => <span key={p.label} onClick={() => setExpiryFromIssue(p.m)} style={chip}>{p.label}</span>)}</div>
              <div style={{ fontSize: 9.5, color: "var(--txt-3)", marginTop: 4 }}>Counts from the issue date{form.start_date ? "" : " (today, until you set one)"}.</div>
            </label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={saving ? undefined : save} style={{ opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : (editId ? "Update certificate" : "Save certificate")} primary /></span></div>
        </div>
      )}

      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Compliance timeline — soonest first</div>
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading certificates…</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No certificates tracked yet. Click "Add certificate" to start tracking expiry dates.</div>
      ) : (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "6px 18px" }}>
          {items.map((c, i) => {
            const t = toneVar(c.tone);
            const isOpen = expandedId === (c.id || i);
            const pid = c.property_id;
            const same = (x) => pid && String(x.property_id) === String(pid);
            const propName = propLabel(properties, pid) || c.property || "—";
            const cT = related.tenants.filter(same);
            const cM = related.maint.filter(same);
            return (
              <React.Fragment key={c.id || i}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 0", borderBottom: (isOpen || i < items.length - 1) ? "0.5px solid var(--line)" : "none", cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (c.id || i))}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                    <i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 14, color: "var(--txt-3)", flexShrink: 0 }} />
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${TYPES[c.type] || "ti-shield-check"}`} style={{ fontSize: 16 }} /></span>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.type}</div><div style={{ fontSize: 11, color: "var(--txt-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{propName}{c.reference ? " · " + c.reference : ""}</div></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, flexShrink: 0 }}>
                    <span style={{ fontSize: 11.5, color: "var(--txt-2)", whiteSpace: "nowrap" }}>{c.days === null ? "—" : c.days < 0 ? `${-c.days}d ago` : `in ${c.days}d`}</span>
                    <Pill text={c.status} tone={c.tone} />
                    {c.id && DB_READY && <span style={{ display: "flex", gap: 10 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(c)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(c.id)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span>}
                  </div>
                </div>
                {isOpen && (
                  <div className="fade-in" style={{ padding: "12px 0 16px 26px", borderBottom: i < items.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
                      <DetailBox title="Tenant(s)" icon="ti-users" empty={cT.length === 0} emptyText={pid ? "No tenants on this property." : "No property linked."} onClick={() => go && go("tenants")}>
                        {cT.map((x, j) => <DetailRow key={j} main={x.name} sub={x.rent ? gbp(x.rent) + " pcm" : ""} pill={x.rent_status} tone={x.rent_status === "Overdue" ? "red" : "green"} />)}
                      </DetailBox>
                      <DetailBox title="Maintenance" icon="ti-tools" empty={cM.length === 0} emptyText={pid ? "No jobs." : "No property linked."} onClick={() => go && go("maintenance")}>
                        {cM.map((m, j) => <DetailRow key={j} main={m.title} sub={m.contractor || ""} pill={m.status} tone={m.status === "Completed" ? "green" : m.priority === "High" ? "red" : "amber"} />)}
                      </DetailBox>
                    </div>
                    <div style={{ marginTop: 12 }}><span onClick={() => go && go("documents")}><Btn icon="ti-folder" label="View documents" /></span></div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}


export function TenantsPage({ user, go, tier }) {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ comp: [], maint: [], pays: [] });
  // Click-to-sort for the tenant table.
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const onSort = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const prevPropertyIdRef = useRef(null); // property the tenant was on before an edit
  const properties = usePropertyList();
  const blank = { name: "", property_id: "", email: "", phone: "", tenancy_start: "", tenancy_end: "", deposit_amount: "", deposit_protected: false, rent_status: "Up to date", rtr_status: "Pending", co_tenant_name: "", co_tenant_email: "", co_tenant_phone: "" };
  const [form, setForm] = useState(blank);

  // HMO / Block multi-tenant limits by subscription tier.
  const HMO_LIMIT = { basic: 1, bronze: 2, silver: 3, gold: 5 };
  const hmoCap = HMO_LIMIT[(tier || "basic").toLowerCase()] || 1;
  // House / Flat = one joint tenancy (a couple share one agreement). HMO / Block = multiple separate tenants.
  const propTypeOf = (pid) => { const p = properties.find((x) => String(x.id) === String(pid)); return p ? (p.type || "House") : null; };
  const isMultiType = (t) => t === "HMO" || t === "Block";

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_tenants").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(friendlyError(error, "loading data")); setRows([]); } else setRows(data); });
    Promise.all([
      db.from("prop_compliance").select("*"), db.from("prop_maintenance").select("*"), db.from("prop_payments").select("*"),
    ]).then(([c, m, p]) => setRelated({ comp: c.data || [], maint: m.data || [], pays: p.data || [] }));
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_tenants").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { prevPropertyIdRef.current = null; setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const formRef = useRef(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const scrollToForm = () => { setTimeout(() => { try { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }, 60); };
  const openEdit = (t) => { prevPropertyIdRef.current = t.property_id || null; setForm({ name: t.name || "", property_id: t.property_id || "", email: t.email || "", phone: t.phone || "", tenancy_start: t.tenancy_start || "", tenancy_end: t.tenancy_end || "", deposit_amount: t.deposit_amount || "", deposit_protected: !!t.deposit_protected, rent_status: t.rent_status || "Up to date", rtr_status: t.rtr_status || "Pending", co_tenant_name: t.co_tenant_name || "", co_tenant_email: t.co_tenant_email || "", co_tenant_phone: t.co_tenant_phone || "" }); setEditId(t.id); setAdding(true); setErr(""); scrollToForm(); };
  const save = async () => {
    if (!form.name.trim()) { setErr("Tenant name is required."); return; }
    if (form.tenancy_end) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const end = new Date(form.tenancy_end); end.setHours(0, 0, 0, 0);
      // 1) End-before-start is ALWAYS invalid — check it first and on its own,
      //    independent of past/future, so the right message always shows.
      if (form.tenancy_start) {
        const start = new Date(form.tenancy_start); start.setHours(0, 0, 0, 0);
        if (end < start) { setErr("Tenancy end date can't be before the start date."); return; }
      }
      // 2) A past end date is only rejected when it's newly set or actually
      //    changed — otherwise you couldn't edit anything else on a tenant
      //    whose tenancy has already ended (a real, common case).
      const original = editId ? (rows || []).find((t) => t.id === editId) : null;
      const dateChanged = !original || (original.tenancy_end || "") !== form.tenancy_end;
      if (dateChanged && end < today) { setErr("Tenancy end date can't be in the past. Pick today or a future date."); return; }
    }
    // Per-property tenant limits.
    if (form.property_id) {
      const ptype = propTypeOf(form.property_id);
      const existing = (rows || []).filter((t) => String(t.property_id) === String(form.property_id) && t.id !== editId);
      if (!isMultiType(ptype)) {
        // House / Flat: only one tenancy record (the second person goes in the co-tenant section).
        if (existing.length >= 1) { setErr(`A ${ptype} holds one tenancy. To add a partner, edit the existing tenant and use "Add co-tenant" — a joint agreement counts as one tenancy.`); return; }
      } else {
        // HMO / Block: multiple separate tenants, capped by tier.
        if (existing.length >= hmoCap) { setErr(`Your ${(tier || "basic")} plan allows up to ${hmoCap} tenant${hmoCap === 1 ? "" : "s"} per ${ptype}. Upgrade to add more.`); return; }
      }
    }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const multi = isMultiType(propTypeOf(form.property_id));
    const payload = { ...form, deposit_amount: form.deposit_amount === "" ? null : +form.deposit_amount, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    // Co-tenant only applies to a joint House/Flat tenancy — clear it on HMO/Block.
    if (multi) { payload.co_tenant_name = ""; payload.co_tenant_email = ""; payload.co_tenant_phone = ""; }
    // Empty date → null (not delete), so clearing a tenancy date on edit sticks
    // instead of silently reverting to the old value.
    payload.tenancy_end = form.tenancy_end || null;
    payload.tenancy_start = form.tenancy_start || null;
    if (savingRef.current) return; savingRef.current = true; setSaving(true);
    let error;
    if (editId) {
      ({ error } = await db.from("prop_tenants").update(payload).eq("id", editId));
    } else {
      ({ error } = await db.from("prop_tenants").insert([{ ...payload, user_id: user.id }]));
    }
    if (error) { savingRef.current = false; setSaving(false); setErr(friendlyError(error)); return; }
    // If this tenant is assigned to a property that isn't already Let, mark it Let.
    if (form.property_id && DB_READY) {
      const { data: prop } = await db.from("prop_properties").select("status").eq("id", form.property_id).maybeSingle();
      if (prop && prop.status !== "Let") {
        await db.from("prop_properties").update({ status: "Let" }).eq("id", form.property_id);
      }
    }
    // If editing moved this tenant off a previous property, that old property
    // may now be empty — revert it to Vacant.
    if (editId && prevPropertyIdRef.current && prevPropertyIdRef.current !== form.property_id) {
      await revertIfEmpty(prevPropertyIdRef.current);
    }
    savingRef.current = false; setSaving(false);
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const confirm = useConfirm();
  // After a tenant leaves a property (deleted, or moved elsewhere), if no other
  // tenant remains on that property, revert its status Let -> Vacant so
  // occupancy and income figures don't drift. Only touches properties currently
  // marked "Let" (never overrides a manual status like "Sale agreed").
  const revertIfEmpty = async (propertyId) => {
    if (!propertyId || !DB_READY) return;
    const { data: remaining } = await db.from("prop_tenants").select("id").eq("property_id", propertyId).limit(1);
    if (remaining && remaining.length) return; // still occupied
    const { data: prop } = await db.from("prop_properties").select("status").eq("id", propertyId).maybeSingle();
    if (prop && prop.status === "Let") {
      await db.from("prop_properties").update({ status: "Vacant" }).eq("id", propertyId);
    }
  };
  const doRemove = async (t) => {
    if (!t?.id || !DB_READY) return;
    await db.from("prop_tenants").delete().eq("id", t.id);
    await revertIfEmpty(t.property_id); // free up the property if now empty
    refresh();
  };
  const remove = (t) => confirm.ask({ title: "Delete this tenant?", message: "This tenant record will be permanently deleted. This can't be undone.", onConfirm: () => doRemove(t) });

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };

  return (
    <div className="fade-in">
      <ConfirmDialog {...confirm.props} />
      <PageHead title="Tenants" sub={rows ? `${rows.length} ${DB_READY ? "" : "(demo) "}tenants` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-user-plus"} label={adding ? "Cancel" : "Add tenant"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div ref={formRef} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit tenant" : "New tenant"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Tenant name<input style={inp} placeholder="e.g. Sarah Connor" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label style={fld}>Tenancy start date (DD/MM/YYYY)<input style={inp} type="date" value={form.tenancy_start} onChange={(e) => setForm({ ...form, tenancy_start: e.target.value })} /></label>
            <label style={fld}>Tenancy end date (DD/MM/YYYY)<input style={inp} type="date" value={form.tenancy_end} onChange={(e) => setForm({ ...form, tenancy_end: e.target.value })} /></label>
            <label style={fld}>Rent status<select style={inp} value={form.rent_status} onChange={(e) => setForm({ ...form, rent_status: e.target.value })}>{["Up to date", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Right to Rent<select style={inp} value={form.rtr_status} onChange={(e) => setForm({ ...form, rtr_status: e.target.value })}>{["Verified", "Pending"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Deposit received (£)<input style={inp} type="number" min="0" placeholder="e.g. 1500" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></label>
            <label style={{ ...fld, justifyContent: "flex-end" }}>Protected under DPS
              <div onClick={() => setForm({ ...form, deposit_protected: !form.deposit_protected })} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ width: 38, height: 22, borderRadius: 11, background: form.deposit_protected ? "var(--brand)" : "var(--line-2)", position: "relative", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: form.deposit_protected ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </span>
                <span style={{ fontSize: 12, color: "var(--txt)" }}>{form.deposit_protected ? "Protected" : "Not protected"}</span>
              </div>
            </label>
          </div>

          {form.property_id && !isMultiType(propTypeOf(form.property_id)) && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px dashed var(--line)" }}>
              <div style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 4, fontWeight: 500 }}>Co-tenant (optional)</div>
              <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginBottom: 10, lineHeight: 1.5 }}>For a joint tenancy — e.g. a couple sharing one agreement. Counts as one tenancy.</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                <label style={fld}>Co-tenant name<input style={inp} placeholder="e.g. James Connor" value={form.co_tenant_name} onChange={(e) => setForm({ ...form, co_tenant_name: e.target.value })} /></label>
                <label style={fld}>Co-tenant email<input style={inp} type="email" placeholder="e.g. james@email.com" value={form.co_tenant_email} onChange={(e) => setForm({ ...form, co_tenant_email: e.target.value })} /></label>
                <label style={fld}>Co-tenant phone<input style={inp} placeholder="e.g. 07700 900124" value={form.co_tenant_phone} onChange={(e) => setForm({ ...form, co_tenant_phone: e.target.value })} /></label>
              </div>
            </div>
          )}
          {form.property_id && isMultiType(propTypeOf(form.property_id)) && (
            <div style={{ marginTop: 12, fontSize: 10.5, color: "var(--txt-3)" }}>{propTypeOf(form.property_id)} — add separate tenants individually (up to {hmoCap} on your {(tier || "basic")} plan).</div>
          )}

          <div style={{ marginTop: 12 }}><span onClick={saving ? undefined : save} style={{ opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : (editId ? "Update tenant" : "Save tenant")} primary /></span></div>
        </div>
      )}

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading tenants…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No tenants yet. Click "Add tenant" to create your first one.</div>
      ) : (() => {
        const tSortVal = (t) => {
          switch (sort.key) {
            case "name": return (t.name || "").toLowerCase();
            case "property": return (propLabel(properties, t.property_id) || t.property || "").toLowerCase();
            case "start": return t.tenancy_start || "";
            case "end": return t.tenancy_end || "";
            case "rent_status": return (t.rent_status || "").toLowerCase();
            case "rtr_status": return (t.rtr_status || "").toLowerCase();
            default: return "";
          }
        };
        const sortedTenants = [...(rows || [])].sort((a, b) => {
          const av = tSortVal(a), bv = tSortVal(b);
          if (av === "" && bv === "") return 0; if (av === "") return 1; if (bv === "") return -1;
          const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
          return sort.dir === "asc" ? cmp : -cmp;
        });
        return (
        <Table sort={sort} onSort={onSort} cols={["", { label: "Tenant", sortKey: "name" }, { label: "Property", sortKey: "property" }, { label: "Tenancy starts", sortKey: "start" }, { label: "Tenancy ends", sortKey: "end" }, { label: "Rent status", sortKey: "rent_status" }, { label: "Right to Rent", sortKey: "rtr_status" }, ""]}>
          {sortedTenants.map((t, i) => {
            const isOpen = expandedId === (t.id || i);
            const pid = t.property_id;
            const sameProp = (x) => pid && String(x.property_id) === String(pid);
            const propName = propLabel(properties, pid) || t.property || "—";
            const tComp = related.comp.filter(sameProp);
            const tMaint = related.maint.filter(sameProp);
            const tPays = related.pays.filter((x) => sameProp(x) || (t.name && (x.tenant || "").toLowerCase() === t.name.toLowerCase()));
            const today = new Date(); today.setHours(0, 0, 0, 0);
            // Days until the tenancy ends, so we can flag ones ending soon.
            const endDays = t.tenancy_end ? Math.round((new Date(t.tenancy_end) - today) / 864e5) : null;
            const endTone = endDays === null ? null : endDays < 0 ? "red" : endDays <= 30 ? "red" : endDays <= 60 ? "amber" : null;
            const endBadge = endDays === null ? null : endDays < 0 ? "ended" : endDays === 0 ? "today" : `${endDays}d`;
            return (
              <React.Fragment key={t.id || i}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (t.id || i))}>
                  <Td><i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 15, color: "var(--txt-3)" }} /></Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{(t.name || "?").split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500 }}>{t.name}</span>
                        {t.co_tenant_name ? <span style={{ fontSize: 10.5, color: "var(--txt-3)" }}>+ {t.co_tenant_name} (joint)</span> : null}
                      </span>
                    </div>
                  </Td>
                  <Td color="var(--txt-2)">{propName}</Td>
                  <Td color="var(--txt-2)">{ukDate(t.tenancy_start)}</Td>
                  <Td>
                    {endTone ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: `var(--${endTone})`, fontWeight: 600 }}>{ukDate(t.tenancy_end)}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: `var(--${endTone})`, background: `var(--${endTone}-soft)`, padding: "2px 6px", borderRadius: 5, whiteSpace: "nowrap" }}>{endBadge}</span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--txt-2)" }}>{ukDate(t.tenancy_end)}</span>
                    )}
                  </Td>
                  <Td><Pill text={t.rent_status || "—"} tone={t.rent_status === "Overdue" ? "red" : "green"} /></Td>
                  <Td><Pill text={t.rtr_status || "Pending"} tone={t.rtr_status === "Verified" ? "green" : "amber"} /></Td>
                  <Td>{t.id && DB_READY ? <span style={{ display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(t)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(t)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 14 }}>
                        <DetailBox title="Contact" icon="ti-address-book">
                          <DetailRow main={t.email || "No email"} sub="Email" />
                          <DetailRow main={t.phone || "No phone"} sub="Phone" />
                          <DetailRow main={propName} sub="Property" pill={t.rent ? gbp(t.rent) + " pcm" : ""} tone="blue" />
                          {(t.deposit_amount || t.deposit_protected) && <DetailRow main={t.deposit_amount ? gbp(t.deposit_amount) : "—"} sub="Deposit" pill={t.deposit_protected ? "DPS protected" : "Not protected"} tone={t.deposit_protected ? "green" : "amber"} />}
                        </DetailBox>
                        <DetailBox title="Payments" icon="ti-coin" empty={tPays.length === 0} emptyText="No payments linked." onClick={() => go && go("finance")}>
                          {tPays.map((x, j) => <DetailRow key={j} main={gbp(x.amount || 0)} sub={x.due_date ? ukDate(x.due_date) : ""} pill={effectiveStatus(x)} tone={effectiveStatus(x) === "Paid" ? "green" : effectiveStatus(x) === "Overdue" ? "red" : "amber"} />)}
                        </DetailBox>
                        <DetailBox title="Property Compliance" icon="ti-shield-check" empty={tComp.length === 0} emptyText={pid ? "No certificates on this property." : "Link a property to see its certificates."} onClick={() => go && go("compliance")}>
                          {tComp.map((c, j) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; const tone = d === null ? "blue" : d <= 7 ? "red" : d <= 30 ? "amber" : "green"; return <DetailRow key={j} main={c.type} sub={c.expiry_date ? `expires ${ukDate(c.expiry_date)}` : ""} pill={d === null ? "—" : d < 0 ? "expired" : d + "d"} tone={tone} />; })}
                        </DetailBox>
                        <DetailBox title="Property Maintenance" icon="ti-tools" empty={tMaint.length === 0} emptyText={pid ? "No maintenance on this property." : "Link a property to see its jobs."} onClick={() => go && go("maintenance")}>
                          {tMaint.map((m, j) => <DetailRow key={j} main={m.title} sub={m.contractor || ""} pill={m.status} tone={m.status === "Completed" ? "green" : m.priority === "High" ? "red" : "amber"} />)}
                        </DetailBox>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </Table>
        );
      })()}
    </div>
  );
}

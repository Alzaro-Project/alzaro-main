import { useState, useEffect } from "react";
import { db, DB_READY } from "./lib/supabase.js";
import { NAV, RANGES, gbp, toneVar, tierBadge, useIsMobile } from "./lib/helpers.js";
import {
  DashboardPage, PropertiesPage, CompliancePage, TenantsPage,
} from "./pages/Portfolio.jsx";
import {
  MaintenancePage, FinancePage, DocumentsPage, ReportsPage, SettingsPage,
} from "./pages/Operations.jsx";
import { AuthScreen, JoinScreen } from "./pages/Auth.jsx";

const PAGES = {
  properties: PropertiesPage, compliance: CompliancePage, tenants: TenantsPage,
  maintenance: MaintenancePage, finance: FinancePage, documents: DocumentsPage,
  reports: ReportsPage, settings: SettingsPage,
};

function Dashboard({ user, signOut }) {
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [range, setRange] = useState("This Month");
  const [light, setLight] = useState(() => {
    try { return localStorage.getItem("propops_theme") === "light"; } catch (e) { return false; }
  });
  const [allData, setAllData] = useState(null);
  const [query, setQuery] = useState("");
  const [showNotif, setShowNotif] = useState(false);

  // ---- business identity for the sidebar (real DB data, not email) ----
  // Priority: prop_settings.company_name → product_members.company_name →
  // user_metadata.company_name → email prefix (last resort). Tier read from
  // settings/membership if a column exists, else defaults to Enterprise.
  const [biz, setBiz] = useState({ name: "", tier: "enterprise", loaded: false });

  useEffect(() => {
    if (!DB_READY) {
      setBiz({ name: "", tier: "", loaded: true });
      return;
    }
    let cancelled = false;
    const loadBiz = async () => {
      let name = "", tier = "";
      // 1) prop_settings (most likely to be user-corrected)
      try {
        const { data: s } = await db.from("prop_settings").select("*").eq("user_id", user.id).maybeSingle();
        if (s) { name = s.company_name || name; tier = s.tier || s.plan || tier; }
      } catch (e) {}
      // 2) product_members (set at signup / join) — select * so a missing
      // tier/plan column can't throw and swallow the company_name.
      if (!name || !tier) {
        try {
          const { data: m } = await db.from("product_members").select("*").eq("user_id", user.id).eq("product", "propertyops").maybeSingle();
          if (m) { name = name || m.company_name || ""; tier = tier || m.tier || m.plan || ""; }
        } catch (e) {}
      }
      // 3) auth metadata (always set at signup)
      if (!name) name = user.user_metadata?.company_name || "";
      // 4) last resort — email prefix
      if (!name) name = (user.email || "").split("@")[0];
      if (!cancelled) setBiz({ name, tier: tier || "enterprise", loaded: true });
    };
    loadBiz();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    document.body.classList.toggle("light", light);
  }, [light]);

  const toggleTheme = () => setLight((v) => {
    const next = !v;
    try { localStorage.setItem("propops_theme", next ? "light" : "dark"); } catch (e) {}
    return next;
  });

  // load everything once for search + notifications
  useEffect(() => {
    if (!DB_READY) { setAllData({ props: [], comp: [], pays: [], maint: [], tenants: [], docs: [] }); return; }
    Promise.all([
      db.from("prop_properties").select("*"), db.from("prop_compliance").select("*"),
      db.from("prop_payments").select("*"), db.from("prop_maintenance").select("*"),
      db.from("prop_tenants").select("*"), db.from("prop_documents").select("*"),
    ]).then(([p, c, pay, mt, tn, dc]) => setAllData({ props: p.data || [], comp: c.data || [], pays: pay.data || [], maint: mt.data || [], tenants: tn.data || [], docs: dc.data || [] }));
  }, [active]);

  // ---- global search ----
  const q = query.trim().toLowerCase();
  const results = [];
  if (q && allData) {
    const has = (s) => (s || "").toLowerCase().includes(q);
    allData.props.forEach((p) => { if (has(p.address || p.addr) || has(p.area) || has(p.type)) results.push({ icon: "ti-building-estate", label: p.address || p.addr, sub: `Property · ${p.area || ""}`, page: "properties" }); });
    allData.tenants.forEach((t) => { if (has(t.name) || has(t.property)) results.push({ icon: "ti-user", label: t.name, sub: `Tenant · ${t.property || ""}`, page: "tenants" }); });
    allData.comp.forEach((c) => { if (has(c.type) || has(c.property) || has(c.reference)) results.push({ icon: "ti-shield-check", label: c.type, sub: `Certificate · ${c.property || ""}`, page: "compliance" }); });
    allData.maint.forEach((m) => { if (has(m.title) || has(m.property) || has(m.contractor)) results.push({ icon: "ti-tools", label: m.title, sub: `Maintenance · ${m.property || ""}`, page: "maintenance" }); });
    allData.pays.forEach((p) => { if (has(p.tenant) || has(p.property)) results.push({ icon: "ti-coin", label: `${p.tenant} · ${gbp(p.amount || 0)}`, sub: `Payment · ${p.status}`, page: "finance" }); });
    allData.docs.forEach((dd) => { if (has(dd.name) || has(dd.category)) results.push({ icon: "ti-file", label: dd.name, sub: `Document · ${dd.category}`, page: "documents" }); });
  }

  // ---- notifications: expiring certs + arrears ----
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const alerts = [];
  if (allData) {
    allData.comp.forEach((c) => {
      if (!c.expiry_date) return;
      const days = Math.round((new Date(c.expiry_date) - today) / 864e5);
      if (days <= 30) alerts.push({ tone: days <= 7 ? "red" : "amber", icon: "ti-shield-check", text: `${c.type}${c.property ? " · " + c.property : ""}`, sub: days < 0 ? `Expired ${-days} days ago` : `Expires in ${days} days`, page: "compliance", days });
    });
    allData.pays.filter((p) => p.status === "Overdue").forEach((p) => {
      alerts.push({ tone: "red", icon: "ti-coin", text: `Rent overdue · ${p.tenant}`, sub: `${gbp(p.amount || 0)} outstanding`, page: "finance", days: -1 });
    });
  }
  alerts.sort((a, b) => a.days - b.days);

  let body;
  if (active === "dashboard") body = <DashboardPage range={range} go={setActive} user={user} />;
  else { const P = PAGES[active]; body = <P user={user} go={setActive} />; }

  const goTo = (page) => { setActive(page); setQuery(""); setShowNotif(false); };

  // resolved sidebar identity
  const badge = tierBadge(biz.tier);
  const displayName = biz.loaded ? (biz.name || (user ? (user.email || "").split("@")[0] : "")) : "…";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {isMobile && navOpen && <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 80 }} />}
      <aside style={{ width: 240, background: "var(--panel)", borderRight: "0.5px solid var(--line)", padding: "18px 14px", display: "flex", flexDirection: "column", overflowY: "auto",
        ...(isMobile
          ? { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 90, transform: navOpen ? "translateX(0)" : "translateX(-105%)", transition: "transform .25s ease", boxShadow: navOpen ? "0 0 40px rgba(0,0,0,.5)" : "none" }
          : { width: 210, position: "sticky", top: 0, height: "100vh" }) }}>
        {/* logo */}
        <div className="brand" style={{ fontSize: 18, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
        <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 18 }}>Property Operations Pro</div>
        {/* business name (real DB data, not email) */}
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--txt)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={displayName}>{displayName}</div>
        {/* tier badge with crown icon */}
        <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: "#2a1f5c", background: "#bcb3f5", padding: "2px 10px", borderRadius: 6, margin: "6px 0 16px" }}>
          <span style={{ fontSize: 11 }}>{badge.icon}</span>{badge.label}
        </span>
        {/* working search bar */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}>
            <i className="ti ti-search" style={{ fontSize: 14, color: "var(--txt-3)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--txt)", fontSize: 12, fontFamily: "Inter" }} />
            {query && <i className="ti ti-x" onClick={() => setQuery("")} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} />}
          </div>
          {q && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.4)", zIndex: 95, maxHeight: 320, overflow: "auto" }}>
              {results.length === 0 ? (
                <div style={{ padding: "14px", fontSize: 12, color: "var(--txt-3)" }}>No matches for "{query}".</div>
              ) : results.slice(0, 12).map((r, i) => (
                <div key={i} onClick={() => { goTo(r.page); setNavOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", cursor: "pointer", borderBottom: i < Math.min(results.length, 12) - 1 ? "0.5px solid var(--line)" : "none" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <i className={`ti ${r.icon}`} style={{ fontSize: 15, color: "var(--brand)" }} />
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div><div style={{ fontSize: 10, color: "var(--txt-3)" }}>{r.sub}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => {
            const on = n.id === active;
            return (
              <div key={n.id} onClick={() => { setActive(n.id); setNavOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "12px 11px" : "9px 11px", borderRadius: 8, cursor: "pointer", background: on ? "var(--panel-2)" : "transparent", color: on ? "var(--txt)" : "var(--txt-2)", border: on ? "0.5px solid var(--line)" : "0.5px solid transparent" }}>
                <i className={`ti ${n.icon}`} style={{ fontSize: 17, color: on ? "var(--brand)" : "var(--txt-2)" }} />
                <span style={{ fontSize: 13 }}>{n.label}</span>
              </div>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", borderTop: "0.5px solid var(--line)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 9 }}>{user ? user.email : ""}</div>
          <div onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px", cursor: "pointer", marginBottom: 7 }}>
            <i className={`ti ${light ? "ti-moon" : "ti-sun"}`} style={{ fontSize: 15, color: "var(--amber)" }} />
            <span style={{ fontSize: 12, color: "var(--txt)" }}>{light ? "Dark Mode" : "Light Mode"}</span>
          </div>
          <div onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", cursor: "pointer", color: "var(--txt-2)" }}>
            <i className="ti ti-logout" style={{ fontSize: 15 }} /><span style={{ fontSize: 12 }}>Sign Out</span></div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: isMobile ? "14px 12px" : "18px 22px", maxWidth: 1180, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, marginBottom: 16 }}>
          {isMobile && (
            <div onClick={() => setNavOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 8, background: "var(--panel-2)", border: "0.5px solid var(--line)", cursor: "pointer", flexShrink: 0 }}>
              <i className="ti ti-menu-2" style={{ fontSize: 19, color: "var(--txt)" }} />
            </div>
          )}
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 13px" }}>
              <i className="ti ti-search" style={{ fontSize: 15, color: "var(--txt-3)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search properties, tenants, certificates…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter" }} />
              {query && <i className="ti ti-x" onClick={() => setQuery("")} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} />}
            </div>
            {q && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.4)", zIndex: 40, maxHeight: 340, overflow: "auto" }}>
                {results.length === 0 ? (
                  <div style={{ padding: "16px", fontSize: 12.5, color: "var(--txt-3)" }}>No matches for "{query}".</div>
                ) : results.slice(0, 12).map((r, i) => (
                  <div key={i} onClick={() => goTo(r.page)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", cursor: "pointer", borderBottom: i < Math.min(results.length, 12) - 1 ? "0.5px solid var(--line)" : "none" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <i className={`ti ${r.icon}`} style={{ fontSize: 16, color: "var(--brand)" }} />
                    <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{r.sub}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <div onClick={() => setShowNotif((v) => !v)} style={{ position: "relative", color: "var(--txt-2)", cursor: "pointer" }}>
              <i className="ti ti-bell" style={{ fontSize: 20 }} />
              {alerts.length > 0 && <span style={{ position: "absolute", top: -4, right: -5, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{alerts.length}</span>}
            </div>
            {showNotif && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "min(320px, calc(100vw - 40px))", background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.4)", zIndex: 40, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line)", fontSize: 12, fontWeight: 600 }}>Notifications {alerts.length > 0 && <span style={{ color: "var(--txt-3)", fontWeight: 400 }}>· {alerts.length}</span>}</div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: "20px 16px", fontSize: 12.5, color: "var(--txt-3)", textAlign: "center" }}>All clear — nothing needs attention.</div>
                  ) : alerts.map((a, i) => {
                    const t = toneVar(a.tone);
                    return (
                      <div key={i} onClick={() => goTo(a.page)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 16px", cursor: "pointer", borderBottom: i < alerts.length - 1 ? "0.5px solid var(--line)" : "none" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${a.icon}`} style={{ fontSize: 15 }} /></span>
                        <div><div style={{ fontSize: 12, fontWeight: 500 }}>{a.text}</div><div style={{ fontSize: 10.5, color: t.color }}>{a.sub}</div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {active === "dashboard" && (
          <div style={{ display: "flex", gap: 5, marginBottom: 18, fontSize: 12, flexWrap: "wrap" }}>
            {RANGES.map((r) => <span key={r} onClick={() => setRange(r)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: r === range ? "var(--txt)" : "var(--txt-2)", background: r === range ? "var(--panel-2)" : "transparent" }}>{r}</span>)}
          </div>
        )}
        {body}
      </main>
    </div>
  );
}

/*  MEMBERSHIP GATE — multi-product accounts                          */
/*  One Alzaro login can hold several products. PropertyOps access    */
/*  requires a row in product_members for this user. Users who        */
/*  originally registered via PropertyOps are let in silently; users  */


// ROOT
function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
  const [member, setMember] = useState(undefined);   // undefined = checking, true/false

  useEffect(() => {
    if (!DB_READY) { setSession(null); return; }
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Membership check whenever the signed-in user changes
  useEffect(() => {
    if (!session?.user) { setMember(undefined); return; }
    let cancelled = false;
    const check = async () => {
      const { data, error } = await db.from("product_members")
        .select("id").eq("user_id", session.user.id).eq("product", "propertyops").maybeSingle();
      if (cancelled) return;
      if (error) { console.error("Membership check:", error); setMember(false); return; }
      if (data) { setMember(true); return; }
      // No membership row — if they originally registered via PropertyOps,
      // create it silently (covers pre-existing users and fresh signups).
      if (session.user.user_metadata?.product === "propertyops") {
        const { error: insErr } = await db.from("product_members").insert([{
          user_id: session.user.id,
          email: session.user.email,
          product: "propertyops",
          company_name: session.user.user_metadata?.company_name || "My Company",
        }]);
        if (!cancelled) setMember(!insErr);
        if (insErr) console.error("Auto-join:", insErr);
        return;
      }
      setMember(false); // came from another Alzaro product — offer the trial
    };
    check();
    return () => { cancelled = true; };
  }, [session]);

  const signOut = () => db.auth.signOut();

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>;
  }
  if (!session) return <AuthScreen />;
  if (member === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>;
  }
  if (!member) return <JoinScreen user={session.user} onJoined={() => setMember(true)} signOut={signOut} />;
  return <Dashboard user={session.user} signOut={signOut} />;
}


export default App;

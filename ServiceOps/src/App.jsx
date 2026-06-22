import { useState, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { db, DB_READY } from './lib/db.js'
import { NAV, RANGES, gbp, toneVar, inp, fld, emptyCard, TIER_ORDER } from './lib/helpers.js'
import { PageHead, Btn, useIsMobile, SearchGroup } from './components/UI.jsx'
import { DashboardPage, CertificatesPage, DocumentsPage, ReportsPage, SettingsPage } from './pages/Records.jsx'
import { CustomersPage, CustomerDetail, PropertiesPage } from './pages/CustomersProperties.jsx'
import { QuotesPage, JobsPage, DiaryPage, InvoicingPage } from './pages/JobsQuotesInvoicing.jsx'
import { AuthScreen, ActivateScreen } from './pages/Auth.jsx'

const PAGES = {
  customers: CustomersPage, properties: PropertiesPage, quotes: QuotesPage, jobs: JobsPage, diary: DiaryPage,
  invoicing: InvoicingPage, certificates: CertificatesPage, documents: DocumentsPage,
  reports: ReportsPage, settings: SettingsPage,
};


function Dashboard({ user, signOut }) {
  const pageFromUrl = () => {
    const seg = (window.location.pathname.split("/serviceops/")[1] || "").replace(/\/$/, "");
    const known = ["dashboard", "customers", "properties", "quotes", "jobs", "diary", "invoicing", "certificates", "documents", "reports", "settings"];
    return known.includes(seg) ? seg : "dashboard";
  };
  const [active, setActive] = useState(pageFromUrl);
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  // ---- business identity for the sidebar (real DB data, not email) ----
  // Reads company_name + tier from product_members; falls back to auth
  // metadata, then email prefix. Defaults tier to PRO if none stored.
  const [biz, setBiz] = useState({ name: "", tier: "", loaded: false });
  useEffect(() => {
    if (!DB_READY || !user) { setBiz({ name: "Your Business", tier: "", loaded: true }); return; }
    let cancelled = false;
    db.from("product_members").select("*").eq("user_id", user.id).eq("product", "serviceops").maybeSingle()
      .then(({ data: m }) => {
        if (cancelled) return;
        let name = (m && m.company_name) || user.user_metadata?.company_name || (user.email || "").split("@")[0];
        let tier = (m && (m.tier || m.plan)) || "";
        setBiz({ name, tier, loaded: true });
      });
    return () => { cancelled = true; };
  }, [user]);
  const displayName = biz.loaded ? (biz.name || (user ? (user.email || "").split("@")[0] : "Your Business")) : "…";
  const tierLabel = (biz.tier || "BRONZE").toUpperCase();
  const TIER_COL = {
    bronze:   { bg: "rgba(180,100,30,0.12)",  color: "#b36b1a", border: "rgba(180,100,30,0.25)" },
    silver:   { bg: "rgba(100,100,120,0.1)",  color: "#6b7080", border: "rgba(100,100,120,0.25)" },
    gold:     { bg: "rgba(79,70,229,0.1)",    color: "#4f46e5", border: "rgba(79,70,229,0.25)" },
  };
  const tierStyle = TIER_COL[(biz.tier || "").toLowerCase()] || TIER_COL.bronze;

  // Tier gating: a nav item is allowed if the user's tier >= the item's min.
  // Empty/unknown tier fails closed to bronze (locked down, not unlocked).
  const userTierIdx = Math.max(0, TIER_ORDER.indexOf((biz.tier || "bronze").toLowerCase()));
  const tierAllows = (min) => userTierIdx >= TIER_ORDER.indexOf(min || "bronze");

  // keep the URL in sync: handle back/forward, and tidy /login → /dashboard on entry
  useEffect(() => {
    const onPop = () => setActive(pageFromUrl());
    window.addEventListener("popstate", onPop);
    const seg = (window.location.pathname.split("/serviceops/")[1] || "").replace(/\/$/, "");
    if (seg === "login" || seg === "register" || seg === "" ) {
      try { window.history.replaceState({ page: "dashboard" }, "", "/serviceops/dashboard"); } catch (e) {}
    }
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navItems = NAV;
  const [range, setRange] = useState("This Month");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [light, setLight] = useState(false);
  const [search, setSearch] = useState("");
  const [showNotif, setShowNotif] = useState(false);
  const [hits, setHits] = useState({ customers: [], jobs: [], invoices: [], quotes: [], properties: [] });
  const [notifs, setNotifs] = useState([]);
  const toggleTheme = () => setLight((v) => { document.body.classList.toggle("light", !v); return !v; });

  // notifications: overdue invoices + certs expiring within 30 days
  useEffect(() => {
    if (!DB_READY) return;
    Promise.all([
      db.from("svc_invoices").select("ref,customer,amount,status").eq("status", "Overdue"),
      db.from("svc_certificates").select("cert_type,customer,site,expiry_date"),
    ]).then(([inv, cert]) => {
      const list = [];
      (inv.data || []).forEach((v) => list.push({ icon: "ti-receipt", tone: "red", text: `Overdue invoice ${v.ref || ""} · ${v.customer || ""} · ${gbp(+v.amount || 0)}`, go: "invoicing" }));
      (cert.data || []).forEach((c) => {
        if (!c.expiry_date) return;
        const days = Math.ceil((new Date(c.expiry_date + "T00:00:00") - new Date()) / 86400000);
        if (days <= 30) list.push({ icon: "ti-shield-check", tone: days <= 7 ? "red" : "amber", text: `${c.cert_type} ${days < 0 ? "expired" : "due in " + days + "d"} · ${c.customer || c.site || ""}`, go: "certificates" });
      });
      setNotifs(list);
    });
  }, []);

  // global search across tables (debounced-ish: on each change)
  useEffect(() => {
    const term = search.trim();
    if (!term || !DB_READY) { setHits({ customers: [], jobs: [], invoices: [], quotes: [], properties: [] }); return; }
    const like = `%${term}%`;
    Promise.all([
      db.from("svc_customers").select("id,name,site,area,type,contact,email").or(`name.ilike.${like},site.ilike.${like},area.ilike.${like},email.ilike.${like}`).limit(8),
      db.from("svc_jobs").select("id,title,customer,status").or(`title.ilike.${like},customer.ilike.${like},site.ilike.${like}`).limit(8),
      db.from("svc_invoices").select("id,ref,customer,amount,status").or(`ref.ilike.${like},customer.ilike.${like}`).limit(8),
      db.from("svc_quotes").select("id,ref,customer,amount,status").or(`ref.ilike.${like},customer.ilike.${like}`).limit(8),
      db.from("svc_properties").select("id,address,postcode,customer,customer_id").or(`address.ilike.${like},postcode.ilike.${like},customer.ilike.${like}`).limit(8),
    ]).then(([c, j, i, q, p]) => setHits({ customers: c.data || [], jobs: j.data || [], invoices: i.data || [], quotes: q.data || [], properties: p.data || [] }));
  }, [search]);

  const searching = search.trim().length > 0;
  const totalHits = hits.customers.length + hits.jobs.length + hits.invoices.length + hits.quotes.length + hits.properties.length;

  // navigate: always clear search + close notifications so the overlay never lingers
  const goTo = (page) => { setSearch(""); setShowNotif(false); setMenuOpen(false); setActive(page); try { window.history.pushState({ page }, "", `/serviceops/${page}`); } catch (e) {} };
  // open a specific customer's detail from search
  const [openCustomerId, setOpenCustomerId] = useState(null);
  const openCustomer = (id) => { setSearch(""); setShowNotif(false); setOpenCustomerId(id); setActive("customers"); try { window.history.pushState({ page: "customers" }, "", "/serviceops/customers"); } catch (e) {} };

  let body;
  const activeNav = navItems.find((n) => n.id === active);
  if (activeNav && !tierAllows(activeNav.min)) {
    body = <TierLocked feature={activeNav.label} requiredTier={activeNav.min} currentTier={biz.tier} onUpgrade={() => goTo("settings")} />;
  }
  else if (active === "dashboard") body = <DashboardPage range={range === "Custom" && rangeFrom && rangeTo ? `${rangeFrom} → ${rangeTo}` : range} go={goTo} user={user} />;
  else if (active === "customers") body = <CustomersPage user={user} openCustomerId={openCustomerId} clearOpen={() => setOpenCustomerId(null)} go={goTo} />;
  else { const P = PAGES[active]; body = <P user={user} />; }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {isMobile && menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 120 }} />}
      <aside style={{ width: 236, background: "var(--panel)", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", ...(isMobile
        ? { position: "fixed", top: 0, left: 0, height: "100dvh", zIndex: 130, transform: menuOpen ? "translateX(0)" : "translateX(-105%)", transition: "transform .25s ease", boxShadow: menuOpen ? "12px 0 40px rgba(0,0,0,.45)" : "none" }
        : { position: "sticky", top: 0, height: "100vh", overflow: "hidden" }) }}>
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <div className="font-head" style={{ fontSize: 16, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>ServiceOps</span></div>
          <div className="mono" style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 2 }}>Field Service Pro</div>
        </div>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={displayName}>{displayName}</div>
          <div className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tierStyle.bg, color: tierStyle.color, border: `1px solid ${tierStyle.border}`, textTransform: "uppercase" }}><i className="ti ti-crown" style={{ fontSize: 12 }} />{tierLabel}</div>
        </div>
        <div style={{ padding: "12px 12px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}>
            <i className="ti ti-search" style={{ fontSize: 14, color: "var(--txt-3)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--txt)", fontSize: 12.5, fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
            {search && <i className="ti ti-x" onClick={() => setSearch("")} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} />}
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", flex: 1, minHeight: 0, padding: "10px 0" }}>
          {navItems.map((n) => {
            const on = n.id === active;
            const locked = !tierAllows(n.min);
            return (
              <div key={n.id} onClick={() => goTo(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", margin: "2px 8px", borderRadius: 8, cursor: "pointer", background: on ? "var(--surface3)" : "transparent", color: on ? "var(--txt)" : "var(--txt-2)", fontWeight: on ? 600 : 500, flexShrink: 0, transition: "background .12s", opacity: locked ? 0.55 : 1 }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                <i className={`ti ${n.icon}`} style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0, color: on ? "var(--brand)" : "var(--txt-2)" }} />
                <span style={{ fontSize: 13, flex: 1 }}>{n.label}</span>
                {locked && <i className="ti ti-lock" style={{ fontSize: 13, color: "var(--txt-3)", flexShrink: 0 }} title={`Upgrade to ${(n.min || "").charAt(0).toUpperCase() + (n.min || "").slice(1)}`} />}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user ? user.email : ""}</div>
          <div onClick={toggleTheme} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", marginBottom: 6, color: "var(--txt-2)", fontSize: 12 }}>
            <i className={`ti ${light ? "ti-moon" : "ti-sun"}`} style={{ fontSize: 14 }} />
            <span>{light ? "Dark Mode" : "Light Mode"}</span>
          </div>
          <div onClick={signOut} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--txt-2)", fontSize: 12 }}>
            <i className="ti ti-logout" style={{ fontSize: 14 }} /><span>Sign Out</span></div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? "14px 12px" : "18px 22px", maxWidth: 1180 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, marginBottom: 16, position: "relative" }}>
          {isMobile && <i className="ti ti-menu-2" onClick={() => setMenuOpen(true)} style={{ fontSize: 23, color: "var(--txt)", cursor: "pointer", flexShrink: 0 }} title="Menu" />}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 13px" }}>
            <i className="ti ti-search" style={{ fontSize: 15, color: "var(--txt-3)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isMobile ? "Search…" : "Search customers, jobs, invoices, quotes, properties…"} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--txt)", fontSize: 12.5, fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
            {search && <i className="ti ti-x" onClick={() => setSearch("")} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} />}
          </div>
          <div onClick={() => setShowNotif((v) => !v)} style={{ position: "relative", color: "var(--txt-2)", cursor: "pointer" }}>
            <i className="ti ti-bell" style={{ fontSize: 20 }} />
            {notifs.length > 0 && <span style={{ position: "absolute", top: -4, right: -5, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 8, background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifs.length}</span>}
          </div>
          {showNotif && (
            <div style={{ position: "absolute", top: 46, right: 0, width: 320, background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.4)", zIndex: 40, overflow: "hidden" }}>
              <div style={{ padding: "12px 15px", borderBottom: "0.5px solid var(--line)", fontSize: 12, fontWeight: 600 }}>Notifications</div>
              <div style={{ maxHeight: 320, overflow: "auto" }}>
                {notifs.length === 0 ? <div style={{ padding: 16, fontSize: 12, color: "var(--txt-3)" }}>You're all caught up. No overdue invoices or expiring certificates.</div>
                  : notifs.map((n, i) => {
                    const t = toneVar(n.tone);
                    return (
                      <div key={i} onClick={() => { goTo(n.go); }} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 15px", borderBottom: i < notifs.length - 1 ? "0.5px solid var(--line)" : "none", cursor: "pointer" }}>
                        <span style={{ width: 26, height: 26, borderRadius: 7, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${n.icon}`} style={{ fontSize: 14 }} /></span>
                        <span style={{ fontSize: 11.5 }}>{n.text}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        {searching ? (
          <div className="fade-in">
            <PageHead title="Search results" sub={`${totalHits} match${totalHits === 1 ? "" : "es"} for "${search}"`} right={<span onClick={() => setSearch("")}><Btn icon="ti-x" label="Clear" /></span>} />
            {totalHits === 0 ? <div style={emptyCard}>No matches. Try a customer name, address, job title, or invoice/quote reference.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {hits.customers.length > 0 && <SearchGroup title="Customers" goLabel="Customers" onGo={() => goTo("customers")}
                  rows={hits.customers.map((c) => ({ label: `${c.name}${c.site ? " · " + c.site : c.area ? " · " + c.area : ""}`, onClick: () => openCustomer(c.id) }))} />}
                {hits.properties.length > 0 && <SearchGroup title="Properties" goLabel="Properties" onGo={() => goTo("properties")}
                  rows={hits.properties.map((p) => ({ label: `${p.address}${p.postcode ? ", " + p.postcode : ""} · ${p.customer || ""}`, onClick: () => p.customer_id ? openCustomer(p.customer_id) : goTo("properties") }))} />}
                {hits.jobs.length > 0 && <SearchGroup title="Jobs" goLabel="Jobs" onGo={() => goTo("jobs")}
                  rows={hits.jobs.map((j) => ({ label: `${j.title} · ${j.customer || ""} · ${j.status}`, onClick: () => goTo("jobs") }))} />}
                {hits.quotes.length > 0 && <SearchGroup title="Quotes" goLabel="Quotes" onGo={() => goTo("quotes")}
                  rows={hits.quotes.map((q) => ({ label: `${q.ref || "—"} · ${q.customer || ""} · ${gbp(+q.amount || 0)}`, onClick: () => goTo("quotes") }))} />}
                {hits.invoices.length > 0 && <SearchGroup title="Invoices" goLabel="Invoicing" onGo={() => goTo("invoicing")}
                  rows={hits.invoices.map((v) => ({ label: `${v.ref || "—"} · ${v.customer || ""} · ${gbp(+v.amount || 0)}`, onClick: () => goTo("invoicing") }))} />}
              </div>
            )}
          </div>
        ) : (
          <>
            {active === "dashboard" && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 5, fontSize: 12, flexWrap: "wrap" }}>
                  {RANGES.map((r) => <span key={r} onClick={() => setRange(r)} style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: r === range ? 600 : 500, color: r === range ? "var(--txt)" : "var(--txt-2)", background: r === range ? "var(--surface3)" : "transparent", border: r === range ? "0.5px solid var(--line)" : "0.5px solid transparent" }}>{r}</span>)}
                </div>
                {range === "Custom" && (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 10, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 12, width: "fit-content" }}>
                    <label style={fld}>From<input style={{ ...inp, width: 160 }} type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /></label>
                    <label style={fld}>To<input style={{ ...inp, width: 160 }} type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></label>
                    {rangeFrom && rangeTo && <span style={{ fontSize: 11.5, color: "var(--txt-3)", paddingBottom: 9 }}>{rangeFrom} → {rangeTo}</span>}
                  </div>
                )}
              </div>
            )}
            {body}
          </>
        )}
      </main>
    </div>
  );
}


function App() {
  const [session, setSession] = useState(undefined);
  const [member, setMember] = useState(undefined); // undefined = checking, true/false = known

  useEffect(() => {
    if (!DB_READY) { setSession(null); return; }
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // membership gate: does this account have a ServiceOps membership?
  useEffect(() => {
    if (!session || !DB_READY) { setMember(undefined); return; }
    db.from("product_members").select("id").eq("user_id", session.user.id).eq("product", "serviceops").maybeSingle().then(async ({ data, error }) => {
      if (error) { console.error("Membership check:", error); setMember(false); return; }
      if (data) { setMember(true); return; }
      // registered via the ServiceOps register page? auto-activate silently
      const meta = session.user.user_metadata || {};
      if (meta.product === "serviceops") {
        const { error: insErr } = await db.from("product_members").insert([{ user_id: session.user.id, email: session.user.email, product: "serviceops", company_name: meta.company_name || "My Company" }]);
        setMember(!insErr);
        if (insErr) console.error("Auto-join:", insErr);
      } else {
        setMember(false);
      }
    });
  }, [session]);

  const signOut = () => db.auth.signOut();

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>;
  }
  if (!session) return <AuthScreen />;
  if (member === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>;
  }
  if (!member) return <ActivateScreen user={session.user} signOut={signOut} />;
  return <Dashboard user={session.user} signOut={signOut} />;
}

// Full-page lockout shown when the user's tier is below a feature's minimum.
function TierLocked({ feature, requiredTier, currentTier, onUpgrade }) {
  const name = (requiredTier || "").charAt(0).toUpperCase() + (requiredTier || "").slice(1);
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center", background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "40px 32px" }}>
        <i className="ti ti-lock" style={{ fontSize: 44, color: "var(--brand)", marginBottom: 14, display: "block" }} />
        <div className="font-head" style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>{feature} is a {name} feature</div>
        <div style={{ color: "var(--txt-2)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Upgrade your plan to unlock {feature ? feature.toLowerCase() : "this feature"} and other advanced tools.
        </div>
        <div onClick={onUpgrade} style={{ display: "inline-block", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: "12px 26px", borderRadius: 10, cursor: "pointer" }}>
          View plans
        </div>
      </div>
    </div>
  );
}

// Vite entry: wrap the existing App (which still uses pushState/pathname
// navigation internally) in a router scoped to the /serviceops base path.
export default function AppRoot() {
  return (
    <BrowserRouter basename="/serviceops">
      <App />
    </BrowserRouter>
  )
}

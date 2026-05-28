const { useState, useMemo } = React;

/* ------------------------------------------------------------------ */
/*  DEMO DATA  — replace with Supabase queries in phase 2             */
/* ------------------------------------------------------------------ */
const DEMO = {
  user: { name: "James M.", email: "james@alzaro.co.uk", tier: "ENTERPRISE" },
  metrics: {
    complianceScore: 94,
    arrears: 4250,
    occupancy: 95.2,
    income: 68400,
    openMaintenance: 7,
    renewalsDue: 5,
    properties: 42,
    let: 40,
  },
  certificates: [
    { type: "Gas Safety", ref: "CP12 certificate", addr: "14 Oak St", days: 4, icon: "ti-flame", tone: "red" },
    { type: "EICR", ref: "Electrical report", addr: "9 Mill Lane Flat 2", days: 18, icon: "ti-bolt", tone: "amber" },
    { type: "EPC", ref: "Energy rating C", addr: "22 Bridge Rd", days: 41, icon: "ti-leaf", tone: "blue" },
    { type: "Smoke Alarm", ref: "Annual check", addr: "5 King's Court", days: 53, icon: "ti-bell-ringing", tone: "blue" },
  ],
  activity: [
    { text: "EICR uploaded · 31 Park View", time: "12 min ago", tone: "green" },
    { text: "Rent received · Flat 4, £1,150", time: "1 hr ago", tone: "blue" },
    { text: "Boiler fault reported · Flat 2", time: "3 hrs ago", tone: "amber" },
    { text: "Tenancy renewed · 8 Vale Rd", time: "Yesterday", tone: "green" },
  ],
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
  { id: "properties", label: "Properties", icon: "ti-building-estate" },
  { id: "compliance", label: "Compliance", icon: "ti-shield-check" },
  { id: "tenants", label: "Tenants", icon: "ti-users" },
  { id: "maintenance", label: "Maintenance", icon: "ti-tools" },
  { id: "finance", label: "Finance", icon: "ti-coin" },
  { id: "documents", label: "Documents", icon: "ti-folder" },
  { id: "reports", label: "Reports", icon: "ti-chart-bar" },
  { id: "settings", label: "Settings", icon: "ti-settings" },
];

/* ------------------------------------------------------------------ */
/*  REPORTS  — what a UK landlord / agent actually needs to pull      */
/* ------------------------------------------------------------------ */
const REPORTS = [
  {
    cat: "Financial", tone: "green", icon: "ti-coin",
    items: [
      { name: "Rent statement", desc: "Rent due vs received per property, with running balance.", icon: "ti-receipt" },
      { name: "Arrears report", desc: "Every overdue tenant, amount, and days late.", icon: "ti-alert-triangle" },
      { name: "Landlord statement", desc: "Income, fees and net payout for each landlord.", icon: "ti-file-invoice" },
      { name: "Profit & loss", desc: "Income vs expenses across the portfolio for any period.", icon: "ti-chart-line" },
      { name: "Tax-year summary", desc: "SA105-ready income & allowable expenses for HMRC.", icon: "ti-building-bank" },
    ],
  },
  {
    cat: "Compliance", tone: "red", icon: "ti-shield-check",
    items: [
      { name: "Compliance audit", desc: "Every certificate, status and expiry — your audit trail.", icon: "ti-clipboard-check" },
      { name: "Expiring certificates", desc: "Gas, EICR, EPC, alarms due in the next 30/60/90 days.", icon: "ti-calendar-due" },
      { name: "Overdue & at-risk", desc: "Properties currently out of compliance, ranked by risk.", icon: "ti-flag" },
      { name: "Compliance score history", desc: "How your portfolio score has moved over time.", icon: "ti-trending-up" },
    ],
  },
  {
    cat: "Portfolio & tenancy", tone: "blue", icon: "ti-building-estate",
    items: [
      { name: "Occupancy report", desc: "Let vs vacant units and void periods.", icon: "ti-home-check" },
      { name: "Tenancy renewals", desc: "Tenancies ending soon and renewal status.", icon: "ti-calendar-repeat" },
      { name: "Rent review", desc: "Current rent vs market, properties due a review.", icon: "ti-arrows-up-down" },
    ],
  },
  {
    cat: "Operations", tone: "amber", icon: "ti-tools",
    items: [
      { name: "Maintenance summary", desc: "Open vs closed jobs, average resolution time.", icon: "ti-progress" },
      { name: "Contractor performance", desc: "Jobs, spend and response time per contractor.", icon: "ti-users" },
      { name: "Spend by category", desc: "Where maintenance money went, broken down.", icon: "ti-chart-pie" },
    ],
  },
];

const RANGES = ["Today", "This Week", "This Month", "Quarter", "This Year"];

const gbp = (n) => "£" + n.toLocaleString("en-GB");

/* ------------------------------------------------------------------ */
/*  SMALL COMPONENTS                                                  */
/* ------------------------------------------------------------------ */
function Metric({ label, value, sub, color, subColor }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--txt-3)", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "Sora,sans-serif", color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: subColor || "var(--txt-3)", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "15px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase" }}>{title}</span>
        {action && <span style={{ fontSize: 11.5, color: "var(--brand)", cursor: "pointer" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

const toneVar = (t) => ({ color: `var(--${t})`, soft: `var(--${t}-soft)` });

/* ------------------------------------------------------------------ */
/*  PLACEHOLDER PAGE (non-dashboard nav items)                        */
/* ------------------------------------------------------------------ */
function Placeholder({ label, icon }) {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", color: "var(--txt-3)" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 44, color: "var(--brand)", marginBottom: 14 }} />
      <div style={{ fontSize: 20, fontFamily: "Sora,sans-serif", color: "var(--txt)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>This module is coming next. The dashboard is live — pick "Dashboard".</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD PAGE                                                    */
/* ------------------------------------------------------------------ */
function DashboardPage({ range }) {
  const m = DEMO.metrics;
  return (
    <div className="fade-in">
      {/* greeting */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>Good morning, James</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{m.properties} properties · 3 items need attention · {range}</div>
      </div>

      {/* metric row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Compliance Score" value={<>{m.complianceScore}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub="Portfolio healthy" color="var(--green)" />
        <Metric label="Rent Arrears" value={gbp(m.arrears)} sub="3 tenants overdue" color="var(--red)" />
        <Metric label="Occupancy" value={m.occupancy + "%"} sub={`${m.let} of ${m.properties} let`} color="var(--blue)" />
        <Metric label="Monthly Income" value={gbp(m.income)} sub="+2.1% vs last month" color="var(--brand)" subColor="var(--green)" />
      </div>

      {/* two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Expiring Certificates" action="View all">
          {DEMO.certificates.map((c, i) => {
            const t = toneVar(c.tone);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < DEMO.certificates.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`ti ${c.icon}`} style={{ fontSize: 16 }} />
                  </span>
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--txt)" }}>{c.type} · {c.addr}</div>
                    <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{c.ref}</div>
                  </div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: t.color, background: t.soft, padding: "3px 9px", borderRadius: 6 }}>{c.days} days</span>
              </div>
            );
          })}
        </Panel>

        <Panel title="Recent Activity">
          {DEMO.activity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < DEMO.activity.length - 1 ? 13 : 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${a.tone})`, marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11.5, color: "var(--txt)" }}>{a.text}</div>
                <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{a.time}</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {/* bottom metric row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Metric label="Open Maintenance" value={m.openMaintenance} sub="2 high priority" color="var(--amber)" />
        <Metric label="Renewals Due" value={m.renewalsDue} sub="Next 60 days" color="var(--blue)" />
        <Metric label="Properties" value={m.properties} sub="All compliant ✓" color="var(--txt)" subColor="var(--green)" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  REPORTS PAGE                                                      */
/* ------------------------------------------------------------------ */
function ReportsPage() {
  const [period, setPeriod] = useState("This Month");
  const periods = ["This Month", "Quarter", "Tax Year", "Custom"];
  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 600 }}>Reports</h2>
          <div style={{ fontSize: 13, color: "var(--txt-2)" }}>Generate, preview and export any report across your portfolio.</div>
        </div>
        <div style={{ display: "flex", gap: 5, fontSize: 12 }}>
          {periods.map((p) => (
            <span key={p} onClick={() => setPeriod(p)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: p === period ? "var(--txt)" : "var(--txt-2)", background: p === period ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (p === period ? "var(--line)" : "transparent") }}>{p}</span>
          ))}
        </div>
      </div>

      {REPORTS.map((group, gi) => {
        const t = toneVar(group.tone);
        return (
          <div key={gi} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`ti ${group.icon}`} style={{ fontSize: 15 }} />
              </span>
              <span style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase" }}>{group.cat}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 11 }}>
              {group.items.map((r, ri) => (
                <div key={ri} className="report-card" style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = t.color}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line)"}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className={`ti ${r.icon}`} style={{ fontSize: 16 }} />
                    </span>
                    <i className="ti ti-download" style={{ fontSize: 15, color: "var(--txt-3)" }} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--txt)", marginBottom: 4 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--txt-3)", lineHeight: 1.5 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APP SHELL                                                         */
/* ------------------------------------------------------------------ */
function App() {
  const [active, setActive] = useState("dashboard");
  const [range, setRange] = useState("This Month");
  const [light, setLight] = useState(false);

  const toggleTheme = () => {
    setLight((v) => {
      document.body.classList.toggle("light", !v);
      return !v;
    });
  };

  const activeNav = NAV.find((n) => n.id === active);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ---------------- SIDEBAR ---------------- */}
      <aside style={{ width: 210, background: "var(--panel)", borderRight: "0.5px solid var(--line)", padding: "18px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div className="brand" style={{ fontSize: 18, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
        <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 20 }}>Property Operations Pro</div>

        <div style={{ fontSize: 15, fontWeight: 600 }}>{DEMO.user.name}</div>
        <span style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 600, color: "#2a1f5c", background: "#bcb3f5", padding: "2px 10px", borderRadius: 6, margin: "6px 0 18px" }}>{DEMO.user.tier}</span>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => {
            const on = n.id === active;
            return (
              <div key={n.id} onClick={() => setActive(n.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 11px", borderRadius: 8, cursor: "pointer", background: on ? "var(--panel-2)" : "transparent", color: on ? "var(--txt)" : "var(--txt-2)", border: on ? "0.5px solid var(--line)" : "0.5px solid transparent" }}>
                <i className={`ti ${n.icon}`} style={{ fontSize: 17, color: on ? "var(--brand)" : "var(--txt-2)" }} />
                <span style={{ fontSize: 13 }}>{n.label}</span>
              </div>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", borderTop: "0.5px solid var(--line)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 9 }}>{DEMO.user.email}</div>
          <div onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px", cursor: "pointer", marginBottom: 7 }}>
            <i className={`ti ${light ? "ti-moon" : "ti-sun"}`} style={{ fontSize: 15, color: "var(--amber)" }} />
            <span style={{ fontSize: 12, color: "var(--txt)" }}>{light ? "Dark Mode" : "Light Mode"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", cursor: "pointer", color: "var(--txt-2)" }}>
            <i className="ti ti-logout" style={{ fontSize: 15 }} />
            <span style={{ fontSize: 12 }}>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN ---------------- */}
      <main style={{ flex: 1, padding: "18px 22px", maxWidth: 1180 }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 13px" }}>
            <i className="ti ti-search" style={{ fontSize: 15, color: "var(--txt-3)" }} />
            <input placeholder="Search properties, tenants, certificates…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter" }} />
          </div>
          <div style={{ position: "relative", color: "var(--txt-2)", cursor: "pointer" }}>
            <i className="ti ti-bell" style={{ fontSize: 20 }} />
            <span style={{ position: "absolute", top: -2, right: -3, width: 7, height: 7, borderRadius: "50%", background: "var(--red)" }} />
          </div>
        </div>

        {/* time range tabs (dashboard only) */}
        {active === "dashboard" && (
          <div style={{ display: "flex", gap: 5, marginBottom: 18, fontSize: 12 }}>
            {RANGES.map((r) => (
              <span key={r} onClick={() => setRange(r)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: r === range ? "var(--txt)" : "var(--txt-2)", background: r === range ? "var(--panel-2)" : "transparent" }}>{r}</span>
            ))}
          </div>
        )}

        {active === "dashboard" ? <DashboardPage range={range} /> : active === "reports" ? <ReportsPage /> : <Placeholder label={activeNav.label} icon={activeNav.icon} />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

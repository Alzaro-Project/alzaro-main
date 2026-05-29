const { useState, useEffect } = React;

/* ================================================================== */
/*  DEMO DATA  — replace with Supabase queries in phase 2             */
/* ================================================================== */
const DEMO = {
  user: { name: "James M.", email: "james@alzaro.co.uk", tier: "ENTERPRISE" },
  metrics: { complianceScore: 94, arrears: 4250, occupancy: 95.2, income: 68400, openMaintenance: 7, renewalsDue: 5, properties: 42, let: 40 },
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
  properties: [
    { addr: "14 Oak Street", area: "Manchester", units: 1, type: "House", status: "Let", rent: 1250, score: 78, tone: "amber" },
    { addr: "9 Mill Lane", area: "Leeds", units: 4, type: "HMO", status: "Let", rent: 3200, score: 88, tone: "green" },
    { addr: "22 Bridge Road", area: "Manchester", units: 1, type: "Flat", status: "Let", rent: 950, score: 95, tone: "green" },
    { addr: "5 King's Court", area: "Liverpool", units: 6, type: "Block", status: "Let", rent: 5400, score: 91, tone: "green" },
    { addr: "31 Park View", area: "Leeds", units: 1, type: "Flat", status: "Vacant", rent: 0, score: 100, tone: "green" },
    { addr: "8 Vale Road", area: "Sheffield", units: 1, type: "House", status: "Let", rent: 1100, score: 96, tone: "green" },
  ],
  tenants: [
    { name: "Sarah Connor", prop: "14 Oak Street", end: "2026-09-14", rent: 1250, paid: true, rtr: "Verified" },
    { name: "Tom Hardy", prop: "9 Mill Lane Flat 2", end: "2026-07-01", rent: 800, paid: false, rtr: "Verified" },
    { name: "Aisha Khan", prop: "22 Bridge Road", end: "2027-01-30", rent: 950, paid: true, rtr: "Verified" },
    { name: "David Lowe", prop: "5 King's Court Flat 1", end: "2026-06-20", rent: 900, paid: false, rtr: "Pending" },
    { name: "Maria Silva", prop: "8 Vale Road", end: "2026-11-08", rent: 1100, paid: true, rtr: "Verified" },
  ],
  maintenance: [
    { title: "Boiler not firing", prop: "9 Mill Lane Flat 2", status: "In Progress", priority: "High", contractor: "GasPro Ltd", days: 1 },
    { title: "Leaking kitchen tap", prop: "14 Oak Street", status: "Assigned", priority: "Medium", contractor: "FlowFix", days: 2 },
    { title: "Broken window latch", prop: "5 King's Court", status: "Reported", priority: "Low", contractor: "—", days: 0 },
    { title: "Damp in bedroom", prop: "22 Bridge Road", status: "In Progress", priority: "High", contractor: "DryWall Co", days: 4 },
    { title: "Annual boiler service", prop: "8 Vale Road", status: "Completed", priority: "Medium", contractor: "GasPro Ltd", days: 12 },
  ],
  payments: [
    { tenant: "Sarah Connor", prop: "14 Oak Street", amount: 1250, due: "2026-05-01", status: "Paid" },
    { tenant: "Aisha Khan", prop: "22 Bridge Road", amount: 950, due: "2026-05-01", status: "Paid" },
    { tenant: "Maria Silva", prop: "8 Vale Road", amount: 1100, due: "2026-05-01", status: "Paid" },
    { tenant: "Tom Hardy", prop: "9 Mill Lane Flat 2", amount: 800, due: "2026-05-01", status: "Overdue" },
    { tenant: "David Lowe", prop: "5 King's Court Flat 1", amount: 900, due: "2026-05-01", status: "Overdue" },
  ],
  documents: [
    { name: "Tenancy Agreement — 14 Oak St.pdf", cat: "Agreements", size: "240 KB", date: "12 Mar 2026", icon: "ti-file-text", tone: "blue" },
    { name: "Gas Safety CP12 — 9 Mill Lane.pdf", cat: "Certificates", size: "180 KB", date: "01 Feb 2026", icon: "ti-flame", tone: "red" },
    { name: "EICR Report — 22 Bridge Rd.pdf", cat: "Certificates", size: "1.2 MB", date: "18 Jan 2026", icon: "ti-bolt", tone: "amber" },
    { name: "Right to Rent — S. Connor.pdf", cat: "Right to Rent", size: "95 KB", date: "10 Mar 2026", icon: "ti-id", tone: "green" },
    { name: "Section 21 Notice — Flat 1.pdf", cat: "Notices", size: "60 KB", date: "05 May 2026", icon: "ti-mail", tone: "blue" },
    { name: "Invoice — GasPro Ltd.pdf", cat: "Invoices", size: "120 KB", date: "20 May 2026", icon: "ti-receipt", tone: "green" },
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

const REPORTS = [
  { cat: "Financial", tone: "green", icon: "ti-coin", items: [
    { name: "Rent statement", desc: "Rent due vs received per property, with running balance.", icon: "ti-receipt" },
    { name: "Arrears report", desc: "Every overdue tenant, amount, and days late.", icon: "ti-alert-triangle" },
    { name: "Landlord statement", desc: "Income, fees and net payout for each landlord.", icon: "ti-file-invoice" },
    { name: "Profit & loss", desc: "Income vs expenses across the portfolio for any period.", icon: "ti-chart-line" },
    { name: "Tax-year summary", desc: "SA105-ready income & allowable expenses for HMRC.", icon: "ti-building-bank" },
  ]},
  { cat: "Compliance", tone: "red", icon: "ti-shield-check", items: [
    { name: "Compliance audit", desc: "Every certificate, status and expiry — your audit trail.", icon: "ti-clipboard-check" },
    { name: "Expiring certificates", desc: "Gas, EICR, EPC, alarms due in the next 30/60/90 days.", icon: "ti-calendar-due" },
    { name: "Overdue & at-risk", desc: "Properties currently out of compliance, ranked by risk.", icon: "ti-flag" },
    { name: "Compliance score history", desc: "How your portfolio score has moved over time.", icon: "ti-trending-up" },
  ]},
  { cat: "Portfolio & tenancy", tone: "blue", icon: "ti-building-estate", items: [
    { name: "Occupancy report", desc: "Let vs vacant units and void periods.", icon: "ti-home-check" },
    { name: "Tenancy renewals", desc: "Tenancies ending soon and renewal status.", icon: "ti-calendar-repeat" },
    { name: "Rent review", desc: "Current rent vs market, properties due a review.", icon: "ti-arrows-up-down" },
  ]},
  { cat: "Operations", tone: "amber", icon: "ti-tools", items: [
    { name: "Maintenance summary", desc: "Open vs closed jobs, average resolution time.", icon: "ti-progress" },
    { name: "Contractor performance", desc: "Jobs, spend and response time per contractor.", icon: "ti-users" },
    { name: "Spend by category", desc: "Where maintenance money went, broken down.", icon: "ti-chart-pie" },
  ]},
];

const RANGES = ["Today", "This Week", "This Month", "Quarter", "This Year"];
const gbp = (n) => "£" + n.toLocaleString("en-GB");
const toneVar = (t) => ({ color: `var(--${t})`, soft: `var(--${t}-soft)` });

/* ================================================================== */
/*  SHARED COMPONENTS                                                 */
/* ================================================================== */
function PageHead({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>{title}</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

function Btn({ icon, label, primary }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
      background: primary ? "var(--brand)" : "var(--panel-2)", color: primary ? "#fff" : "var(--txt)", border: "0.5px solid " + (primary ? "var(--brand)" : "var(--line)") }}>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 15 }} />}{label}
    </span>
  );
}

function Metric({ label, value, sub, color, subColor }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--txt-3)", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "Sora,sans-serif", color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: subColor || "var(--txt-3)", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function Panel({ title, action, children, onAction }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "15px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase" }}>{title}</span>
        {action && <span onClick={onAction} style={{ fontSize: 11.5, color: "var(--brand)", cursor: "pointer" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

function Pill({ text, tone }) {
  const t = toneVar(tone);
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: t.color, background: t.soft, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{text}</span>;
}

function Table({ cols, children }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--line)" }}>
            {cols.map((c, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : "left", padding: "11px 16px", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--txt-3)", fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const Td = ({ children, color }) => <td style={{ padding: "12px 16px", color: color || "var(--txt)", borderBottom: "0.5px solid var(--line)" }}>{children}</td>;

/* ================================================================== */
/*  DASHBOARD                                                         */
/* ================================================================== */
function DashboardPage({ range, go }) {
  const m = DEMO.metrics;
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>Good morning, James</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{m.properties} properties · 3 items need attention · {range}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Compliance Score" value={<>{m.complianceScore}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub="Portfolio healthy" color="var(--green)" />
        <Metric label="Rent Arrears" value={gbp(m.arrears)} sub="3 tenants overdue" color="var(--red)" />
        <Metric label="Occupancy" value={m.occupancy + "%"} sub={`${m.let} of ${m.properties} let`} color="var(--blue)" />
        <Metric label="Monthly Income" value={gbp(m.income)} sub="+2.1% vs last month" color="var(--brand)" subColor="var(--green)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Expiring Certificates" action="View all" onAction={() => go("compliance")}>
          {DEMO.certificates.map((c, i) => {
            const t = toneVar(c.tone);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < DEMO.certificates.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${c.icon}`} style={{ fontSize: 16 }} /></span>
                  <div><div style={{ fontSize: 12.5 }}>{c.type} · {c.addr}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{c.ref}</div></div>
                </div>
                <Pill text={c.days + " days"} tone={c.tone} />
              </div>
            );
          })}
        </Panel>
        <Panel title="Recent Activity">
          {DEMO.activity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < DEMO.activity.length - 1 ? 13 : 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${a.tone})`, marginTop: 5, flexShrink: 0 }} />
              <div><div style={{ fontSize: 11.5 }}>{a.text}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{a.time}</div></div>
            </div>
          ))}
        </Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Metric label="Open Maintenance" value={m.openMaintenance} sub="2 high priority" color="var(--amber)" />
        <Metric label="Renewals Due" value={m.renewalsDue} sub="Next 60 days" color="var(--blue)" />
        <Metric label="Properties" value={m.properties} sub="All compliant ✓" color="var(--txt)" subColor="var(--green)" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PROPERTIES                                                        */
/* ================================================================== */
function PropertiesPage({ user }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);   // null = loading
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ address: "", area: "", type: "House", units: 1, status: "Let", rent: 0 });

  // Load from Supabase on first render (falls back to demo data if keys unset / error)
  React.useEffect(() => {
    if (!DB_READY) { setRows(DEMO.properties); return; }
    db.from("prop_properties").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows(DEMO.properties); }
        else setRows(data.length ? data : DEMO.properties);
      });
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_properties").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const save = async () => {
    if (!form.address.trim()) { setErr("Address is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys in supabase.js to save for real."); return; }
    setErr("");
    const { error } = await db.from("prop_properties").insert([{ ...form, units: +form.units, rent: +form.rent, score: 100, user_id: user.id }]);
    if (error) { setErr(error.message); return; }
    setForm({ address: "", area: "", type: "House", units: 1, status: "Let", rent: 0 });
    setAdding(false);
    refresh();
  };

  const list = (rows || []).filter((p) => ((p.address || p.addr || "") + (p.area || "") + (p.type || "")).toLowerCase().includes(q.toLowerCase()));
  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" };

  return (
    <div className="fade-in">
      <PageHead title="Properties" sub={rows ? `${list.length} ${DB_READY ? "" : "(demo) "}properties` : "Loading…"}
        right={<span onClick={() => { setAdding(!adding); setErr(""); }}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add property"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <input style={inp} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input style={inp} placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {["House", "Flat", "HMO", "Block"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <input style={inp} type="number" placeholder="Units" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
          <select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {["Let", "Vacant"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <input style={inp} type="number" placeholder="Rent pcm" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} />
          <div style={{ gridColumn: "1 / -1" }}><span onClick={save}><Btn icon="ti-device-floppy" label="Save property" primary /></span></div>
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by address, area or type…" style={{ ...inp, width: "100%", marginBottom: 14 }} />

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading properties…</div>
      ) : (
        <Table cols={["Address", "Area", "Type", "Units", "Status", "Rent (pcm)", "Compliance"]}>
          {list.map((p, i) => (
            <tr key={p.id || i}>
              <Td><span style={{ fontWeight: 500 }}>{p.address || p.addr}</span></Td>
              <Td color="var(--txt-2)">{p.area}</Td>
              <Td color="var(--txt-2)">{p.type}</Td>
              <Td color="var(--txt-2)">{p.units}</Td>
              <Td><Pill text={p.status} tone={p.status === "Let" ? "green" : "amber"} /></Td>
              <Td>{p.rent ? gbp(p.rent) : "—"}</Td>
              <Td><span style={{ color: `var(--${p.tone || (p.score >= 90 ? "green" : p.score >= 80 ? "amber" : "red")})`, fontWeight: 600 }}>{p.score}</span><span style={{ color: "var(--txt-3)" }}>/100</span></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ================================================================== */
/*  COMPLIANCE                                                        */
/* ================================================================== */
function CompliancePage() {
  const all = [
    ...DEMO.certificates,
    { type: "Carbon Monoxide", ref: "Annual check", addr: "14 Oak St", days: 88, icon: "ti-cloud", tone: "green" },
    { type: "Buildings Insurance", ref: "Policy renewal", addr: "Portfolio-wide", days: 120, icon: "ti-umbrella", tone: "green" },
    { type: "HMO Licence", ref: "5-year licence", addr: "9 Mill Lane", days: 210, icon: "ti-license", tone: "green" },
    { type: "Legionella Risk", ref: "Risk assessment", addr: "5 King's Court", days: 12, icon: "ti-droplet", tone: "amber" },
  ].sort((a, b) => a.days - b.days);
  const overdue = all.filter((c) => c.days <= 7).length;
  const soon = all.filter((c) => c.days > 7 && c.days <= 30).length;
  return (
    <div className="fade-in">
      <PageHead title="Compliance" sub="Live tracking of every legal obligation across your portfolio." right={<Btn icon="ti-upload" label="Upload certificate" primary />} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Compliance Score" value={<>{DEMO.metrics.complianceScore}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub="Portfolio healthy" color="var(--green)" />
        <Metric label="Urgent (≤7 days)" value={overdue} sub="Act now" color="var(--red)" />
        <Metric label="Due Soon (≤30 days)" value={soon} sub="Schedule renewal" color="var(--amber)" />
        <Metric label="Tracked Items" value={all.length} sub="Across 6 properties" color="var(--blue)" />
      </div>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Compliance timeline — soonest first</div>
      <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "6px 18px" }}>
        {all.map((c, i) => {
          const t = toneVar(c.tone);
          const status = c.days <= 7 ? "Urgent" : c.days <= 30 ? "Due soon" : "Valid";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < all.length - 1 ? "0.5px solid var(--line)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${c.icon}`} style={{ fontSize: 16 }} /></span>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{c.type}</div><div style={{ fontSize: 11, color: "var(--txt-3)" }}>{c.addr} · {c.ref}</div></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>in {c.days} days</span>
                <Pill text={status} tone={c.tone} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  TENANTS                                                           */
/* ================================================================== */
function TenantsPage() {
  return (
    <div className="fade-in">
      <PageHead title="Tenants" sub={`${DEMO.tenants.length} active tenants`} right={<Btn icon="ti-user-plus" label="Add tenant" primary />} />
      <Table cols={["Tenant", "Property", "Tenancy ends", "Rent (pcm)", "Rent status", "Right to Rent"]}>
        {DEMO.tenants.map((t, i) => (
          <tr key={i}>
            <Td>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{t.name.split(" ").map((x) => x[0]).join("")}</span>
                <span style={{ fontWeight: 500 }}>{t.name}</span>
              </div>
            </Td>
            <Td color="var(--txt-2)">{t.prop}</Td>
            <Td color="var(--txt-2)">{t.end}</Td>
            <Td>{gbp(t.rent)}</Td>
            <Td><Pill text={t.paid ? "Up to date" : "Overdue"} tone={t.paid ? "green" : "red"} /></Td>
            <Td><Pill text={t.rtr} tone={t.rtr === "Verified" ? "green" : "amber"} /></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ================================================================== */
/*  MAINTENANCE (kanban)                                              */
/* ================================================================== */
function MaintenancePage() {
  const stages = ["Reported", "Assigned", "In Progress", "Completed"];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  return (
    <div className="fade-in">
      <PageHead title="Maintenance" sub={`${DEMO.maintenance.filter((m) => m.status !== "Completed").length} open jobs · 2 high priority`} right={<Btn icon="ti-plus" label="New job" primary />} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 11 }}>
        {stages.map((s) => {
          const jobs = DEMO.maintenance.filter((m) => m.status === s);
          return (
            <div key={s}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, padding: "0 2px" }}>
                <span style={{ fontSize: 11, letterSpacing: 0.5, color: "var(--txt-2)", textTransform: "uppercase" }}>{s}</span>
                <span style={{ fontSize: 11, color: "var(--txt-3)" }}>{jobs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 80 }}>
                {jobs.map((j, i) => (
                  <div key={i} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{j.title}</span>
                      <Pill text={j.priority} tone={toneFor[j.priority]} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 6 }}>{j.prop}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--txt-2)" }}>
                      <i className="ti ti-user-cog" style={{ fontSize: 13 }} />{j.contractor}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FINANCE                                                           */
/* ================================================================== */
function FinancePage() {
  const collected = DEMO.payments.filter((p) => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const overdue = DEMO.payments.filter((p) => p.status === "Overdue").reduce((s, p) => s + p.amount, 0);
  return (
    <div className="fade-in">
      <PageHead title="Finance" sub="Rent, arrears and payments across the portfolio." right={<Btn icon="ti-download" label="Export" />} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Expected (May)" value={gbp(collected + overdue)} sub="5 tenancies" color="var(--txt)" />
        <Metric label="Collected" value={gbp(collected)} sub="3 of 5 paid" color="var(--green)" />
        <Metric label="Arrears" value={gbp(overdue)} sub="2 overdue" color="var(--red)" />
        <Metric label="Collection rate" value={Math.round((collected / (collected + overdue)) * 100) + "%"} sub="This month" color="var(--blue)" />
      </div>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Payment ledger — May 2026</div>
      <Table cols={["Tenant", "Property", "Amount", "Due date", "Status"]}>
        {DEMO.payments.map((p, i) => (
          <tr key={i}>
            <Td><span style={{ fontWeight: 500 }}>{p.tenant}</span></Td>
            <Td color="var(--txt-2)">{p.prop}</Td>
            <Td>{gbp(p.amount)}</Td>
            <Td color="var(--txt-2)">{p.due}</Td>
            <Td><Pill text={p.status} tone={p.status === "Paid" ? "green" : "red"} /></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ================================================================== */
/*  DOCUMENTS                                                         */
/* ================================================================== */
function DocumentsPage() {
  const [cat, setCat] = useState("All");
  const cats = ["All", "Agreements", "Certificates", "Right to Rent", "Notices", "Invoices"];
  const list = DEMO.documents.filter((d) => cat === "All" || d.cat === cat);
  return (
    <div className="fade-in">
      <PageHead title="Documents" sub="Secure legal document vault — encrypted, versioned, audit-logged." right={<Btn icon="ti-upload" label="Upload" primary />} />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {cats.map((c) => (
          <span key={c} onClick={() => setCat(c)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 12px", borderRadius: 7, color: c === cat ? "var(--txt)" : "var(--txt-2)", background: c === cat ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (c === cat ? "var(--line)" : "transparent") }}>{c}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 11 }}>
        {list.map((d, i) => {
          const t = toneVar(d.tone);
          return (
            <div key={i} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "13px 15px", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${d.icon}`} style={{ fontSize: 18 }} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{d.cat} · {d.size} · {d.date}</div>
              </div>
              <i className="ti ti-download" style={{ fontSize: 16, color: "var(--txt-3)", cursor: "pointer" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  REPORTS  (+ click-to-preview)                                     */
/* ================================================================== */
function ReportPreview({ report, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: 620, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "0.5px solid var(--line)" }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>{report.name}</div><div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>Preview · demo data</div></div>
          <i className="ti ti-x" onClick={onClose} style={{ fontSize: 19, color: "var(--txt-2)", cursor: "pointer" }} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: "var(--txt-2)", marginBottom: 16, lineHeight: 1.6 }}>{report.desc}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: "0.5px solid var(--line)" }}>{report.cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--txt-3)" }}>{c}</th>)}</tr></thead>
            <tbody>{report.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} style={{ padding: "9px 10px", borderBottom: "0.5px solid var(--line)", color: j === 0 ? "var(--txt)" : "var(--txt-2)" }}>{cell}</td>)}</tr>)}</tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <Btn icon="ti-file-type-pdf" label="Export PDF" primary />
            <Btn icon="ti-file-type-csv" label="Export CSV" />
          </div>
          <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 12 }}>Live data and working exports arrive with the Supabase backend.</div>
        </div>
      </div>
    </div>
  );
}

const SAMPLE = {
  cols: ["Property", "Detail", "Value", "Status"],
  rows: [
    ["14 Oak Street", "Sarah Connor", "£1,250", "Paid"],
    ["9 Mill Lane Flat 2", "Tom Hardy", "£800", "Overdue"],
    ["22 Bridge Road", "Aisha Khan", "£950", "Paid"],
    ["5 King's Court Flat 1", "David Lowe", "£900", "Overdue"],
    ["8 Vale Road", "Maria Silva", "£1,100", "Paid"],
  ],
};

function ReportsPage() {
  const [period, setPeriod] = useState("This Month");
  const [preview, setPreview] = useState(null);
  const periods = ["This Month", "Quarter", "Tax Year", "Custom"];
  return (
    <div className="fade-in" style={{ position: "relative" }}>
      <PageHead title="Reports" sub="Generate, preview and export any report across your portfolio."
        right={<div style={{ display: "flex", gap: 5, fontSize: 12 }}>{periods.map((p) => <span key={p} onClick={() => setPeriod(p)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: p === period ? "var(--txt)" : "var(--txt-2)", background: p === period ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (p === period ? "var(--line)" : "transparent") }}>{p}</span>)}</div>} />
      {REPORTS.map((group, gi) => {
        const t = toneVar(group.tone);
        return (
          <div key={gi} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${group.icon}`} style={{ fontSize: 15 }} /></span>
              <span style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase" }}>{group.cat}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 11 }}>
              {group.items.map((r, ri) => (
                <div key={ri} onClick={() => setPreview({ ...r, ...SAMPLE })} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = t.color}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line)"}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${r.icon}`} style={{ fontSize: 16 }} /></span>
                    <i className="ti ti-eye" style={{ fontSize: 15, color: "var(--txt-3)" }} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--txt-3)", lineHeight: 1.5 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ================================================================== */
/*  SETTINGS                                                          */
/* ================================================================== */
function SettingsPage() {
  const sections = [
    { title: "Organisation", icon: "ti-building", rows: [["Company name", "Alzaro Property Co."], ["VAT number", "GB 123 4567 89"], ["Plan", "Enterprise"]] },
    { title: "Team & roles", icon: "ti-users", rows: [["James M.", "Admin"], ["Priya S.", "Property Manager"], ["GasPro Ltd", "Contractor"]] },
    { title: "Notifications", icon: "ti-bell", rows: [["Compliance reminders", "Email + SMS"], ["Rent received", "Email"], ["Reminder lead time", "60 / 30 / 14 / 1 days"]] },
    { title: "Integrations", icon: "ti-plug", rows: [["Xero", "Not connected"], ["QuickBooks", "Not connected"], ["Open Banking", "Not connected"]] },
  ];
  return (
    <div className="fade-in">
      <PageHead title="Settings" sub="Manage your organisation, team, notifications and integrations." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "15px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${s.icon}`} style={{ fontSize: 15 }} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.title}</span>
            </div>
            {s.rows.map((r, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: j < s.rows.length - 1 ? "0.5px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span style={{ color: "var(--txt-2)" }}>{r[0]}</span><span style={{ fontWeight: 500 }}>{r[1]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  AUTH SCREEN  (login + sign up)                                    */
/* ================================================================== */
function AuthScreen() {
  const wantsSignup = typeof window !== "undefined" && (window.location.hash === "#signup" || window.location.hash === "#register");
  const [tab, setTab] = useState(wantsSignup ? "register" : "login");   // "login" | "register"
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [company, setCompany] = useState("");
  const [forgot, setForgot] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash;
      if (h === "#signup" || h === "#register") setTab("register");
      else if (h === "#login") setTab("login");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const reset = () => { setMsg(""); setOk(""); };

  const doLogin = async () => {
    reset();
    if (!email.trim() || !pw.trim()) return setMsg("Please enter email and password.");
    if (!DB_READY) return setMsg("Database not connected. Add your keys in supabase.js.");
    setBusy(true);
    const { error } = await db.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setMsg(error.message);
    // success -> App() listener swaps to dashboard
  };

  const doRegister = async () => {
    reset();
    if (!company.trim() || !email.trim() || !pw.trim()) return setMsg("Please fill all fields.");
    if (pw.length < 6) return setMsg("Password must be at least 6 characters.");
    if (!DB_READY) return setMsg("Database not connected. Add your keys in supabase.js.");
    setBusy(true);
    const { error } = await db.auth.signUp({ email, password: pw, options: { data: { company_name: company.trim(), product: "propertyops" } } });
    setBusy(false);
    if (error) return setMsg(error.message);
    setOk("Check your email to confirm your account, then log in.");
    setTab("login"); setCompany(""); setPw("");
  };

  const doForgot = async () => {
    reset();
    if (!email.trim()) return setMsg("Please enter your email address.");
    if (!DB_READY) return setMsg("Database not connected.");
    setBusy(true);
    const siteUrl = `${window.location.protocol}//${window.location.host}`;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/propertyops/login` });
    setBusy(false);
    if (error) setMsg(error.message);
    else setOk("Password reset link sent! Check your inbox (and spam folder).");
  };

  const inp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "Inter", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "Inter", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(139,127,232,.3)" };
  const Banner = ({ text, good }) => (
    <div style={{ background: good ? "var(--green-soft)" : "var(--red-soft)", border: "1px solid " + (good ? "var(--green)" : "var(--red)"), borderRadius: 8, padding: "11px 14px", fontSize: 13, color: good ? "var(--green)" : "var(--red)", marginBottom: 14, lineHeight: 1.4 }}>{good ? "✓ " : ""}{text}</div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 20 }}>
      <div className="fade-in" style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "40px 36px", width: 440, maxWidth: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.4)" }}>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 28, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
          <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4 }}>Property Operations Infrastructure</div>
        </div>

        {forgot ? (
          <>
            <button onClick={() => { setForgot(false); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18, fontFamily: "Inter" }}>← Back to login</button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <i className="ti ti-key" style={{ fontSize: 34, color: "var(--brand)" }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Reset password</div>
              <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 4 }}>Enter your email and we'll send you a reset link</div>
            </div>
            {msg && <Banner text={msg} />}
            {ok && <Banner text={ok} good />}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doForgot()} />
              <button onClick={doForgot} disabled={busy} style={primaryBtn}>{busy ? "Sending…" : "Send reset link"}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, background: "var(--panel-2)", borderRadius: 10, padding: 4, marginBottom: 22 }}>
              {["login", "register"].map((t) => (
                <div key={t} onClick={() => { setTab(t); reset(); }} style={{ flex: 1, padding: 10, textAlign: "center", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === t ? "var(--line-2)" : "transparent", color: tab === t ? "var(--txt)" : "var(--txt-2)", transition: "all .15s" }}>
                  {t === "login" ? "Login" : "Register"}
                </div>
              ))}
            </div>

            {msg && <Banner text={msg} />}
            {ok && <Banner text={ok} good />}

            {tab === "login" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                <input style={inp} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                <button onClick={doLogin} disabled={busy} style={primaryBtn}>{busy ? "Signing in…" : "Sign in →"}</button>
                <button onClick={() => { setForgot(true); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "Inter" }}>Forgot password?</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--brand-soft)", border: "1px solid rgba(139,127,232,.25)", borderRadius: 8, padding: "11px 14px", fontSize: 12, color: "var(--brand)", textAlign: "center", fontWeight: 500 }}>
                  🏠 Start your <strong>14-day free trial</strong> — full access, no card required
                </div>
                <input style={inp} placeholder="Company name *" value={company} onChange={(e) => setCompany(e.target.value)} />
                <input style={inp} type="email" placeholder="Email address *" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input style={inp} type="password" placeholder="Password (min 6 characters) *" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRegister()} />
                <button onClick={doRegister} disabled={busy} style={primaryBtn}>{busy ? "Creating account…" : "Start free trial →"}</button>
                <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center", fontFamily: "monospace", letterSpacing: 0.3 }}>No credit card · Cancel anytime · UK-based support</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "monospace", letterSpacing: 0.5 }}>Alzaro PropertyOps · Built for UK landlords · v1.0</div>
    </div>
  );
}

/* ================================================================== */
/*  APP SHELL                                                         */
/* ================================================================== */
const PAGES = {
  properties: PropertiesPage, compliance: CompliancePage, tenants: TenantsPage,
  maintenance: MaintenancePage, finance: FinancePage, documents: DocumentsPage,
  reports: ReportsPage, settings: SettingsPage,
};

function Dashboard({ user, signOut }) {
  const [active, setActive] = useState("dashboard");
  const [range, setRange] = useState("This Month");
  const [light, setLight] = useState(false);
  const toggleTheme = () => setLight((v) => { document.body.classList.toggle("light", !v); return !v; });

  let body;
  if (active === "dashboard") body = <DashboardPage range={range} go={setActive} />;
  else { const P = PAGES[active]; body = <P user={user} />; }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 210, background: "var(--panel)", borderRight: "0.5px solid var(--line)", padding: "18px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div className="brand" style={{ fontSize: 18, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
        <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 20 }}>Property Operations Pro</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{user ? user.email.split("@")[0] : DEMO.user.name}</div>
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
          <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 9 }}>{user ? user.email : DEMO.user.email}</div>
          <div onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px", cursor: "pointer", marginBottom: 7 }}>
            <i className={`ti ${light ? "ti-moon" : "ti-sun"}`} style={{ fontSize: 15, color: "var(--amber)" }} />
            <span style={{ fontSize: 12, color: "var(--txt)" }}>{light ? "Dark Mode" : "Light Mode"}</span>
          </div>
          <div onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", cursor: "pointer", color: "var(--txt-2)" }}>
            <i className="ti ti-logout" style={{ fontSize: 15 }} /><span style={{ fontSize: 12 }}>Sign Out</span></div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "18px 22px", maxWidth: 1180 }}>
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
        {active === "dashboard" && (
          <div style={{ display: "flex", gap: 5, marginBottom: 18, fontSize: 12 }}>
            {RANGES.map((r) => <span key={r} onClick={() => setRange(r)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: r === range ? "var(--txt)" : "var(--txt-2)", background: r === range ? "var(--panel-2)" : "transparent" }}>{r}</span>)}
          </div>
        )}
        {body}
      </main>
    </div>
  );
}

/* ================================================================== */
/*  ROOT — decides: login screen or dashboard                         */
/* ================================================================== */
function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out

  useEffect(() => {
    if (!DB_READY) { setSession(null); return; }
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = () => db.auth.signOut();

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>;
  }
  if (!session) return <AuthScreen />;
  return <Dashboard user={session.user} signOut={signOut} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

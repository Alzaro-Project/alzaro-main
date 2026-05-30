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

// Shared: load the user's properties once, for dropdowns + linking
function usePropertyList() {
  const [props, setProps] = useState([]);
  useEffect(() => {
    if (!DB_READY) { setProps(DEMO.properties.map((p, i) => ({ id: i + 1, address: p.addr }))); return; }
    db.from("prop_properties").select("id,address").order("created_at", { ascending: false })
      .then(({ data }) => setProps(data || []));
  }, []);
  return props;
}

// Resolve a property_id to its address label
const propLabel = (props, id) => { const p = props.find((x) => String(x.id) === String(id)); return p ? p.address : null; };

/* ================================================================== */
/*  DASHBOARD                                                         */
/* ================================================================== */
function DashboardPage({ range, go, user }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!DB_READY) { setData({ props: DEMO.properties, comp: [], pays: [], maint: [] }); return; }
    Promise.all([
      db.from("prop_properties").select("*"),
      db.from("prop_compliance").select("*"),
      db.from("prop_payments").select("*"),
      db.from("prop_maintenance").select("*"),
    ]).then(([p, c, pay, mt]) => setData({ props: p.data || [], comp: c.data || [], pays: pay.data || [], maint: mt.data || [] }));
  }, []);

  if (!data) return <div className="fade-in" style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading your portfolio…</div>;

  const { props, comp, pays, maint } = data;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // properties / occupancy
  const totalProps = props.length;
  const letProps = props.filter((p) => p.status === "Let").length;
  const occupancy = totalProps ? Math.round((letProps / totalProps) * 1000) / 10 : 0;
  const income = props.filter((p) => p.status === "Let").reduce((s, p) => s + (p.rent || 0), 0);

  // compliance
  const certs = comp.map((c) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; return { ...c, days: d }; });
  const valid = certs.filter((c) => c.days !== null && c.days > 30).length;
  const score = certs.length ? Math.max(0, Math.round((valid / certs.length) * 100)) : 100;
  const expiringSoon = certs.filter((c) => c.days !== null && c.days <= 30).sort((a, b) => a.days - b.days).slice(0, 5);
  const attention = certs.filter((c) => c.days !== null && c.days <= 30).length;

  // finance
  const arrears = pays.filter((p) => p.status === "Overdue").reduce((s, p) => s + (p.amount || 0), 0);
  const arrearsCount = pays.filter((p) => p.status === "Overdue").length;

  // maintenance
  const openMaint = maint.filter((m) => m.status !== "Completed").length;
  const highPri = maint.filter((m) => m.status !== "Completed" && m.priority === "High").length;

  const toneFor = { "Gas Safety": "ti-flame", "EICR": "ti-bolt", "EPC": "ti-leaf", "Smoke Alarm": "ti-bell-ringing", "Carbon Monoxide": "ti-cloud", "Legionella Risk": "ti-droplet", "PAT Testing": "ti-plug", "Buildings Insurance": "ti-umbrella", "HMO Licence": "ti-license", "Fire Risk Assessment": "ti-fire-extinguisher" };
  const certTone = (d) => d < 0 || d <= 7 ? "red" : d <= 30 ? "amber" : "blue";
  const name = user ? user.email.split("@")[0] : "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>{greet}, {name}</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{totalProps} propert{totalProps === 1 ? "y" : "ies"} · {attention} item{attention === 1 ? "" : "s"} need attention · {range}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Compliance Score" value={<>{score}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub={score >= 90 ? "Portfolio healthy" : score >= 60 ? "Needs attention" : certs.length ? "At risk" : "No certs tracked"} color={score >= 90 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"} />
        <Metric label="Rent Arrears" value={gbp(arrears)} sub={`${arrearsCount} overdue`} color={arrears ? "var(--red)" : "var(--green)"} />
        <Metric label="Occupancy" value={occupancy + "%"} sub={`${letProps} of ${totalProps} let`} color="var(--blue)" />
        <Metric label="Monthly Income" value={gbp(income)} sub="From let properties" color="var(--brand)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Expiring Certificates" action="View all" onAction={() => go("compliance")}>
          {expiringSoon.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)", padding: "8px 0" }}>Nothing expiring in the next 30 days. {certs.length === 0 && "Add certificates in Compliance to track them here."}</div>
          ) : expiringSoon.map((c, i) => {
            const t = toneVar(certTone(c.days));
            return (
              <div key={c.id || i} onClick={() => go("compliance")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < expiringSoon.length - 1 ? "0.5px solid var(--line)" : "none", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${toneFor[c.type] || "ti-shield-check"}`} style={{ fontSize: 16 }} /></span>
                  <div><div style={{ fontSize: 12.5 }}>{c.type}{c.property ? " · " + c.property : ""}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{c.reference || "—"}</div></div>
                </div>
                <Pill text={c.days < 0 ? "expired" : c.days + " days"} tone={certTone(c.days)} />
              </div>
            );
          })}
        </Panel>
        <Panel title="Portfolio Summary">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { label: "Properties", val: totalProps, page: "properties" },
              { label: "Let / Vacant", val: `${letProps} / ${totalProps - letProps}`, page: "properties" },
              { label: "Certificates tracked", val: certs.length, page: "compliance" },
              { label: "Open maintenance", val: openMaint, page: "maintenance" },
              { label: "Payments logged", val: pays.length, page: "finance" },
            ].map((r, i) => (
              <div key={i} onClick={() => go(r.page)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 8px", margin: "0 -8px", borderRadius: 8, cursor: "pointer" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: "var(--txt-2)" }}>{r.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontWeight: 600 }}>{r.val}</span><i className="ti ti-chevron-right" style={{ fontSize: 13, color: "var(--txt-3)" }} /></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <span style={{ cursor: "pointer" }} onClick={() => go("maintenance")}><Metric label="Open Maintenance" value={openMaint} sub={`${highPri} high priority`} color="var(--amber)" /></span>
        <span style={{ cursor: "pointer" }} onClick={() => go("compliance")}><Metric label="Urgent Compliance" value={certs.filter((c) => c.days !== null && c.days <= 7).length} sub="Within 7 days" color="var(--red)" /></span>
        <span style={{ cursor: "pointer" }} onClick={() => go("properties")}><Metric label="Properties" value={totalProps} sub={score >= 90 ? "Portfolio healthy ✓" : "Check compliance"} color="var(--txt)" subColor={score >= 90 ? "var(--green)" : "var(--amber)"} /></span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PROPERTIES                                                        */
/* ================================================================== */
function PropertiesPage({ user, go }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);   // null = loading
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], comp: [], maint: [], pays: [] });
  const blank = { address: "", area: "", type: "House", status: "Let", rent: "" };
  const [form, setForm] = useState(blank);

  React.useEffect(() => {
    if (!DB_READY) { setRows(DEMO.properties); return; }
    db.from("prop_properties").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows(DEMO.properties); }
        else setRows(data.length ? data : DEMO.properties);
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

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (p) => { setForm({ address: p.address || "", area: p.area || "", type: p.type || "House", status: p.status || "Let", rent: p.rent || "" }); setEditId(p.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.address.trim()) { setErr("Address is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys in supabase.js to save for real."); return; }
    setErr("");
    const payload = { ...form, rent: form.rent === "" ? 0 : +form.rent };
    let error;
    if (editId) {
      ({ error } = await db.from("prop_properties").update(payload).eq("id", editId));
    } else {
      ({ error } = await db.from("prop_properties").insert([{ ...payload, score: 100, user_id: user.id }]));
    }
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const remove = async (id) => { if (id && DB_READY) { await db.from("prop_properties").delete().eq("id", id); refresh(); } };

  const list = (rows || []).filter((p) => ((p.address || p.addr || "") + (p.area || "") + (p.type || "")).toLowerCase().includes(q.toLowerCase()));
  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" };

  return (
    <div className="fade-in">
      <PageHead title="Properties" sub={rows ? `${list.length} ${DB_READY ? "" : "(demo) "}properties` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add property"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit property" : "New property"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Area<input style={inp} placeholder="e.g. Manchester" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Type<select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["House", "Flat", "HMO", "Block"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Let", "Vacant"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Rent (£ pcm)<input style={inp} type="number" placeholder="e.g. 1250" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update property" : "Save property"} primary /></span></div>
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by address, area or type…" style={{ ...inp, width: "100%", marginBottom: 14 }} />

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading properties…</div>
      ) : (
        <Table cols={["", "Address", "Area", "Type", "Status", "Rent (pcm)", "Compliance", ""]}>
          {list.map((p, i) => {
            const addr = (p.address || p.addr || "").toLowerCase();
            const match = (s) => (s || "").toLowerCase() === addr || (addr && (s || "").toLowerCase().includes(addr));
            const isOpen = expandedId === (p.id || i);
            const pT = related.tenants.filter((t) => match(t.property));
            const pC = related.comp.filter((c) => match(c.property));
            const pM = related.maint.filter((m) => match(m.property));
            const pP = related.pays.filter((x) => match(x.property));
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return (
              <React.Fragment key={p.id || i}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (p.id || i))}>
                  <Td><i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 15, color: "var(--txt-3)" }} /></Td>
                  <Td><span style={{ fontWeight: 500 }}>{p.address || p.addr}</span></Td>
                  <Td color="var(--txt-2)">{p.area || "—"}</Td>
                  <Td color="var(--txt-2)">{p.type}</Td>
                  <Td><Pill text={p.status} tone={p.status === "Let" ? "green" : "amber"} /></Td>
                  <Td>{p.rent ? gbp(p.rent) : "—"}</Td>
                  <Td><span style={{ color: `var(--${p.tone || (p.score >= 90 ? "green" : p.score >= 80 ? "amber" : "red")})`, fontWeight: 600 }}>{p.score}</span><span style={{ color: "var(--txt-3)" }}>/100</span></Td>
                  <Td>{p.id && DB_READY ? <span style={{ display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(p)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(p.id)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                        <DetailBox title="Tenants" icon="ti-users" empty={pT.length === 0} emptyText="No tenants linked." onClick={() => go && go("tenants")}>
                          {pT.map((t, j) => <DetailRow key={j} main={t.name} sub={t.rent ? gbp(t.rent) + " pcm" : ""} pill={t.rent_status} tone={t.rent_status === "Overdue" ? "red" : "green"} />)}
                        </DetailBox>
                        <DetailBox title="Compliance" icon="ti-shield-check" empty={pC.length === 0} emptyText="No certificates tracked." onClick={() => go && go("compliance")}>
                          {pC.map((c, j) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; const tone = d === null ? "blue" : d <= 7 ? "red" : d <= 30 ? "amber" : "green"; return <DetailRow key={j} main={c.type} sub={c.expiry_date ? `expires ${c.expiry_date}` : ""} pill={d === null ? "—" : d < 0 ? "expired" : d + "d"} tone={tone} />; })}
                        </DetailBox>
                        <DetailBox title="Maintenance" icon="ti-tools" empty={pM.length === 0} emptyText="No maintenance jobs." onClick={() => go && go("maintenance")}>
                          {pM.map((m, j) => <DetailRow key={j} main={m.title} sub={m.contractor || ""} pill={m.status} tone={m.status === "Completed" ? "green" : m.priority === "High" ? "red" : "amber"} />)}
                        </DetailBox>
                        <DetailBox title="Payments" icon="ti-coin" empty={pP.length === 0} emptyText="No payments logged." onClick={() => go && go("finance")}>
                          {pP.map((x, j) => <DetailRow key={j} main={gbp(x.amount || 0)} sub={x.due_date || ""} pill={x.status} tone={x.status === "Paid" ? "green" : x.status === "Overdue" ? "red" : "amber"} />)}
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

function DetailBox({ title, icon, children, empty, emptyText, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = "var(--brand)")} onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = "var(--line)")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 14, color: "var(--brand)" }} />
          <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--txt-2)" }}>{title}</span>
        </div>
        {onClick && <i className="ti ti-arrow-up-right" style={{ fontSize: 14, color: "var(--txt-3)" }} />}
      </div>
      {empty ? <div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>{emptyText}</div> : children}
    </div>
  );
}

function DetailRow({ main, sub, pill, tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", gap: 8 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{main}</div>{sub && <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{sub}</div>}</div>
      {pill && <Pill text={pill} tone={tone} />}
    </div>
  );
}

/* ================================================================== */
/*  COMPLIANCE                                                        */
/* ================================================================== */
function CompliancePage({ user, go }) {
  const TYPES = {
    "Gas Safety": "ti-flame", "EICR": "ti-bolt", "EPC": "ti-leaf", "Smoke Alarm": "ti-bell-ringing",
    "Carbon Monoxide": "ti-cloud", "Legionella Risk": "ti-droplet", "PAT Testing": "ti-plug",
    "Buildings Insurance": "ti-umbrella", "HMO Licence": "ti-license", "Fire Risk Assessment": "ti-fire-extinguisher",
  };
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], maint: [] });
  const properties = usePropertyList();
  const blank = { type: "Gas Safety", property_id: "", reference: "", start_date: "", expiry_date: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) {
      const today = new Date();
      setRows(DEMO.certificates.map((c) => ({ type: c.type, property: c.addr, reference: c.ref, expiry_date: new Date(today.getTime() + c.days * 864e5).toISOString().slice(0, 10) })));
      return;
    }
    db.from("prop_compliance").select("*")
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
    Promise.all([db.from("prop_tenants").select("*"), db.from("prop_maintenance").select("*")])
      .then(([t, m]) => setRelated({ tenants: t.data || [], maint: m.data || [] }));
  }, []);

  const refresh = async () => { const { data } = await db.from("prop_compliance").select("*"); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (c) => { setForm({ type: c.type || "Gas Safety", property_id: c.property_id || "", reference: c.reference || "", start_date: c.start_date || "", expiry_date: c.expiry_date || "" }); setEditId(c.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.expiry_date) { setErr("Expiry date is required — it's what we track."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    if (!payload.start_date) delete payload.start_date;
    let error;
    if (editId) ({ error } = await db.from("prop_compliance").update(payload).eq("id", editId));
    else ({ error } = await db.from("prop_compliance").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const remove = async (id) => { if (id && DB_READY) { await db.from("prop_compliance").delete().eq("id", id); refresh(); } };

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
      <PageHead title="Compliance" sub="Live tracking of every legal obligation across your portfolio."
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add certificate"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Compliance Score" value={<>{score}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub={score >= 90 ? "Portfolio healthy" : score >= 60 ? "Needs attention" : "At risk"} color={score >= 90 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"} />
        <Metric label="Urgent (≤7 days)" value={urgent} sub="Act now" color="var(--red)" />
        <Metric label="Due Soon (≤30 days)" value={soon} sub="Schedule renewal" color="var(--amber)" />
        <Metric label="Tracked Items" value={items.length} sub="Certificates" color="var(--blue)" />
      </div>

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit certificate" : "New certificate"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={fld}>Type<select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.keys(TYPES).map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Reference / notes<input style={inp} placeholder="e.g. CP12 certificate" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
            <label style={fld}>Issued / start date<input style={inp} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
            <label style={fld}>Expiry date<input style={inp} type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update certificate" : "Save certificate"} primary /></span></div>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: (isOpen || i < items.length - 1) ? "0.5px solid var(--line)" : "none", cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (c.id || i))}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 14, color: "var(--txt-3)" }} />
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${TYPES[c.type] || "ti-shield-check"}`} style={{ fontSize: 16 }} /></span>
                    <div><div style={{ fontSize: 13, fontWeight: 500 }}>{c.type}</div><div style={{ fontSize: 11, color: "var(--txt-3)" }}>{propName}{c.reference ? " · " + c.reference : ""}</div></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{c.days === null ? "—" : c.days < 0 ? `${-c.days} days ago` : `in ${c.days} days`}</span>
                    <Pill text={c.status} tone={c.tone} />
                    {c.id && DB_READY && <span style={{ display: "flex", gap: 10 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(c)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(c.id)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span>}
                  </div>
                </div>
                {isOpen && (
                  <div className="fade-in" style={{ padding: "12px 0 16px 26px", borderBottom: i < items.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
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
    </div>
  );
}

/* ================================================================== */
/*  TENANTS                                                           */
/* ================================================================== */
function TenantsPage({ user, go }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ comp: [], maint: [], pays: [] });
  const properties = usePropertyList();
  const blank = { name: "", property_id: "", email: "", phone: "", rent: "", tenancy_start: "", tenancy_end: "", deposit_amount: "", deposit_protected: false, rent_status: "Up to date", rtr_status: "Pending" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows(DEMO.tenants.map((t) => ({ name: t.name, property: t.prop, tenancy_end: t.end, rent: t.rent, rent_status: t.paid ? "Up to date" : "Overdue", rtr_status: t.rtr }))); return; }
    db.from("prop_tenants").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
    Promise.all([
      db.from("prop_compliance").select("*"), db.from("prop_maintenance").select("*"), db.from("prop_payments").select("*"),
    ]).then(([c, m, p]) => setRelated({ comp: c.data || [], maint: m.data || [], pays: p.data || [] }));
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_tenants").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (t) => { setForm({ name: t.name || "", property_id: t.property_id || "", email: t.email || "", phone: t.phone || "", rent: t.rent || "", tenancy_start: t.tenancy_start || "", tenancy_end: t.tenancy_end || "", deposit_amount: t.deposit_amount || "", deposit_protected: !!t.deposit_protected, rent_status: t.rent_status || "Up to date", rtr_status: t.rtr_status || "Pending" }); setEditId(t.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("Tenant name is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, rent: form.rent === "" ? 0 : +form.rent, deposit_amount: form.deposit_amount === "" ? null : +form.deposit_amount, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    if (!payload.tenancy_end) delete payload.tenancy_end;
    if (!payload.tenancy_start) delete payload.tenancy_start;
    let error;
    if (editId) {
      ({ error } = await db.from("prop_tenants").update(payload).eq("id", editId));
    } else {
      ({ error } = await db.from("prop_tenants").insert([{ ...payload, user_id: user.id }]));
    }
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const remove = async (id) => { if (id && DB_READY) { await db.from("prop_tenants").delete().eq("id", id); refresh(); } };

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };

  return (
    <div className="fade-in">
      <PageHead title="Tenants" sub={rows ? `${rows.length} ${DB_READY ? "" : "(demo) "}tenants` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-user-plus"} label={adding ? "Cancel" : "Add tenant"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit tenant" : "New tenant"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Tenant name<input style={inp} placeholder="e.g. Sarah Connor" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label style={fld}>Rent (£ pcm)<input style={inp} type="number" placeholder="e.g. 1250" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} /></label>
            <label style={fld}>Tenancy start date<input style={inp} type="date" value={form.tenancy_start} onChange={(e) => setForm({ ...form, tenancy_start: e.target.value })} /></label>
            <label style={fld}>Tenancy end date<input style={inp} type="date" value={form.tenancy_end} onChange={(e) => setForm({ ...form, tenancy_end: e.target.value })} /></label>
            <label style={fld}>Rent status<select style={inp} value={form.rent_status} onChange={(e) => setForm({ ...form, rent_status: e.target.value })}>{["Up to date", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Right to Rent<select style={inp} value={form.rtr_status} onChange={(e) => setForm({ ...form, rtr_status: e.target.value })}>{["Verified", "Pending"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Deposit received (£)<input style={inp} type="number" placeholder="e.g. 1500" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></label>
            <label style={{ ...fld, justifyContent: "flex-end" }}>Protected under DPS
              <div onClick={() => setForm({ ...form, deposit_protected: !form.deposit_protected })} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ width: 38, height: 22, borderRadius: 11, background: form.deposit_protected ? "var(--brand)" : "var(--line-2)", position: "relative", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: form.deposit_protected ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </span>
                <span style={{ fontSize: 12, color: "var(--txt)" }}>{form.deposit_protected ? "Protected" : "Not protected"}</span>
              </div>
            </label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update tenant" : "Save tenant"} primary /></span></div>
        </div>
      )}

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading tenants…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No tenants yet. Click "Add tenant" to create your first one.</div>
      ) : (
        <Table cols={["", "Tenant", "Property", "Tenancy starts", "Tenancy ends", "Rent (pcm)", "Rent status", "Right to Rent", ""]}>
          {rows.map((t, i) => {
            const isOpen = expandedId === (t.id || i);
            const pid = t.property_id;
            const sameProp = (x) => pid && String(x.property_id) === String(pid);
            const propName = propLabel(properties, pid) || t.property || "—";
            const tComp = related.comp.filter(sameProp);
            const tMaint = related.maint.filter(sameProp);
            const tPays = related.pays.filter((x) => sameProp(x) || (t.name && (x.tenant || "").toLowerCase() === t.name.toLowerCase()));
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return (
              <React.Fragment key={t.id || i}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (t.id || i))}>
                  <Td><i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 15, color: "var(--txt-3)" }} /></Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{(t.name || "?").split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                    </div>
                  </Td>
                  <Td color="var(--txt-2)">{propName}</Td>
                  <Td color="var(--txt-2)">{t.tenancy_start || "—"}</Td>
                  <Td color="var(--txt-2)">{t.tenancy_end || "—"}</Td>
                  <Td>{t.rent ? gbp(t.rent) : "—"}</Td>
                  <Td><Pill text={t.rent_status || "—"} tone={t.rent_status === "Overdue" ? "red" : "green"} /></Td>
                  <Td><Pill text={t.rtr_status || "Pending"} tone={t.rtr_status === "Verified" ? "green" : "amber"} /></Td>
                  <Td>{t.id && DB_READY ? <span style={{ display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(t)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(t.id)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                        <DetailBox title="Contact" icon="ti-address-book">
                          <DetailRow main={t.email || "No email"} sub="Email" />
                          <DetailRow main={t.phone || "No phone"} sub="Phone" />
                          <DetailRow main={propName} sub="Property" pill={t.rent ? gbp(t.rent) + " pcm" : ""} tone="blue" />
                          {(t.deposit_amount || t.deposit_protected) && <DetailRow main={t.deposit_amount ? gbp(t.deposit_amount) : "—"} sub="Deposit" pill={t.deposit_protected ? "DPS protected" : "Not protected"} tone={t.deposit_protected ? "green" : "amber"} />}
                        </DetailBox>
                        <DetailBox title="Payments" icon="ti-coin" empty={tPays.length === 0} emptyText="No payments linked." onClick={() => go && go("finance")}>
                          {tPays.map((x, j) => <DetailRow key={j} main={gbp(x.amount || 0)} sub={x.due_date || ""} pill={x.status} tone={x.status === "Paid" ? "green" : x.status === "Overdue" ? "red" : "amber"} />)}
                        </DetailBox>
                        <DetailBox title="Property Compliance" icon="ti-shield-check" empty={tComp.length === 0} emptyText={pid ? "No certificates on this property." : "Link a property to see its certificates."} onClick={() => go && go("compliance")}>
                          {tComp.map((c, j) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; const tone = d === null ? "blue" : d <= 7 ? "red" : d <= 30 ? "amber" : "green"; return <DetailRow key={j} main={c.type} sub={c.expiry_date ? `expires ${c.expiry_date}` : ""} pill={d === null ? "—" : d < 0 ? "expired" : d + "d"} tone={tone} />; })}
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
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAINTENANCE (kanban)                                              */
/* ================================================================== */
function MaintenancePage({ user, go }) {
  const stages = ["Reported", "Assigned", "In Progress", "Completed"];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const properties = usePropertyList();
  const blank = { title: "", property_id: "", priority: "Medium", contractor: "", status: "Reported" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows(DEMO.maintenance.map((m) => ({ title: m.title, property: m.prop, priority: m.priority, contractor: m.contractor, status: m.status }))); return; }
    db.from("prop_maintenance").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_maintenance").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (j) => { setForm({ title: j.title || "", property_id: j.property_id || "", priority: j.priority || "Medium", contractor: j.contractor || "", status: j.status || "Reported" }); setEditId(j.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.title.trim()) { setErr("Job title is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    let error;
    if (editId) ({ error } = await db.from("prop_maintenance").update(payload).eq("id", editId));
    else ({ error } = await db.from("prop_maintenance").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const remove = async (id) => { if (id && DB_READY) { await db.from("prop_maintenance").delete().eq("id", id); refresh(); } };

  const move = async (j, dir) => {
    const idx = stages.indexOf(j.status);
    const next = stages[idx + dir];
    if (!next || !j.id || !DB_READY) return;
    await db.from("prop_maintenance").update({ status: next }).eq("id", j.id);
    refresh();
  };

  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const moveTo = async (j, status) => {
    if (!j || !status || j.status === status || !j.id || !DB_READY) return;
    await db.from("prop_maintenance").update({ status }).eq("id", j.id);
    refresh();
  };

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
  const open = (rows || []).filter((m) => m.status !== "Completed").length;

  return (
    <div className="fade-in">
      <PageHead title="Maintenance" sub={rows ? `${open} open job${open === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "New job"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit job" : "New maintenance job"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <label style={fld}>Issue / job title<input style={inp} placeholder="e.g. Boiler not firing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Contractor<input style={inp} placeholder="e.g. GasPro Ltd" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></label>
            <label style={fld}>Priority<select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{stages.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update job" : "Save job"} primary /></span></div>
        </div>
      )}

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading jobs…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 11 }}>
          {stages.map((s) => {
            const jobs = (rows || []).filter((m) => m.status === s);
            return (
              <div key={s}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
                onDragLeave={() => setDragOver((v) => v === s ? null : v)}
                onDrop={(e) => { e.preventDefault(); const j = (rows || []).find((x) => String(x.id) === String(dragId)); moveTo(j, s); setDragId(null); setDragOver(null); }}
                style={{ borderRadius: 10, padding: 4, background: dragOver === s ? "var(--brand-soft)" : "transparent", transition: "background .15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, padding: "0 2px" }}>
                  <span style={{ fontSize: 11, letterSpacing: 0.5, color: "var(--txt-2)", textTransform: "uppercase" }}>{s}</span>
                  <span style={{ fontSize: 11, color: "var(--txt-3)" }}>{jobs.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 80 }}>
                  {jobs.map((j, i) => (
                    <div key={j.id || i}
                      draggable={!!(j.id && DB_READY)}
                      onDragStart={() => setDragId(j.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 13px", cursor: j.id && DB_READY ? "grab" : "default", opacity: String(dragId) === String(j.id) ? 0.5 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{j.title}</span>
                        <Pill text={j.priority} tone={toneFor[j.priority] || "blue"} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 6 }}>{propLabel(properties, j.property_id) || j.property || j.prop || "—"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--txt-2)", marginBottom: j.id && DB_READY ? 9 : 0 }}>
                        <i className="ti ti-user-cog" style={{ fontSize: 13 }} />{j.contractor || "Unassigned"}
                      </div>
                      {j.id && DB_READY && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "0.5px solid var(--line)", paddingTop: 8 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            {stages.indexOf(j.status) > 0 && <i className="ti ti-arrow-left" onClick={() => move(j, -1)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Move back" />}
                            {stages.indexOf(j.status) < stages.length - 1 && <i className="ti ti-arrow-right" onClick={() => move(j, 1)} style={{ fontSize: 14, color: "var(--brand)", cursor: "pointer" }} title="Move forward" />}
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <i className="ti ti-pencil" onClick={() => openEdit(j)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" />
                            <i className="ti ti-trash" onClick={() => remove(j.id)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" />
                            <i className="ti ti-folder" onClick={() => go && go("documents")} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="View documents" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {jobs.length === 0 && <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center", padding: "16px 0", border: "1px dashed var(--line)", borderRadius: 10 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  FINANCE                                                           */
/* ================================================================== */
function FinancePage({ user, go }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], comp: [], maint: [] });
  const properties = usePropertyList();
  const blank = { tenant: "", property_id: "", amount: "", due_date: "", billing_date: "", invoice_no: "", status: "Pending" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows(DEMO.payments.map((p) => ({ tenant: p.tenant, property: p.prop, amount: p.amount, due_date: p.due, status: p.status }))); return; }
    db.from("prop_payments").select("*").order("due_date", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
    Promise.all([
      db.from("prop_tenants").select("*"), db.from("prop_compliance").select("*"), db.from("prop_maintenance").select("*"),
    ]).then(([t, c, m]) => setRelated({ tenants: t.data || [], comp: c.data || [], maint: m.data || [] }));
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_payments").select("*").order("due_date", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (p) => { setForm({ tenant: p.tenant || "", property_id: p.property_id || "", amount: p.amount || "", due_date: p.due_date || "", billing_date: p.billing_date || "", invoice_no: p.invoice_no || "", status: p.status || "Pending" }); setEditId(p.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.tenant.trim()) { setErr("Tenant is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const invoiceNo = form.invoice_no || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const payload = { ...form, amount: form.amount === "" ? 0 : +form.amount, property_id: form.property_id || null, property: propLabel(properties, form.property_id), invoice_no: invoiceNo };
    if (!payload.due_date) delete payload.due_date;
    if (!payload.billing_date) delete payload.billing_date;
    let error;
    if (editId) ({ error } = await db.from("prop_payments").update(payload).eq("id", editId));
    else ({ error } = await db.from("prop_payments").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const markReceived = async (p) => { if (p.id && DB_READY) { await db.from("prop_payments").update({ status: "Paid" }).eq("id", p.id); refresh(); } };

  const remove = async (id) => { if (id && DB_READY) { await db.from("prop_payments").delete().eq("id", id); refresh(); } };

  const data = rows || [];
  const collected = data.filter((p) => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
  const overdue = data.filter((p) => p.status === "Overdue").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = data.filter((p) => p.status === "Pending").reduce((s, p) => s + (p.amount || 0), 0);
  const expected = collected + overdue + pending;
  const rate = expected ? Math.round((collected / expected) * 100) : 0;
  const paidCount = data.filter((p) => p.status === "Paid").length;
  const overdueCount = data.filter((p) => p.status === "Overdue").length;

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };

  return (
    <div className="fade-in">
      <PageHead title="Finance" sub={rows ? `${data.length} payment${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add payment"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Expected" value={gbp(expected)} sub={`${data.length} payment${data.length === 1 ? "" : "s"}`} color="var(--txt)" />
        <Metric label="Collected" value={gbp(collected)} sub={`${paidCount} paid`} color="var(--green)" />
        <Metric label="Arrears" value={gbp(overdue)} sub={`${overdueCount} overdue`} color="var(--red)" />
        <Metric label="Collection rate" value={rate + "%"} sub="Paid vs expected" color="var(--blue)" />
      </div>

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit payment" : "New payment"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Tenant<select style={inp} value={form.tenant} onChange={(e) => setForm({ ...form, tenant: e.target.value })}><option value="">— select tenant —</option>{related.tenants.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Amount (£)<input style={inp} type="number" placeholder="e.g. 1250" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label style={fld}>Billing date (optional)<input style={inp} type="date" value={form.billing_date} onChange={(e) => setForm({ ...form, billing_date: e.target.value })} /></label>
            <label style={fld}>Due date<input style={inp} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Pending", "Paid", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 8 }}>An invoice number is generated automatically. "Pending" invoices count toward Expected; use "Mark received" in the ledger when paid.</div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update payment" : "Save payment"} primary /></span></div>
        </div>
      )}

      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Payment ledger</div>
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading payments…</div>
      ) : data.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No payments yet. Click "Add payment" to log your first one.</div>
      ) : (
        <Table cols={["", "Tenant", "Property", "Amount", "Due date", "Status", ""]}>
          {data.map((p, i) => {
            const isOpen = expandedId === (p.id || i);
            const pid = p.property_id;
            const same = (x) => pid && String(x.property_id) === String(pid);
            const propName = propLabel(properties, pid) || p.property || p.prop || "—";
            const pT = related.tenants.filter(same);
            const pC = related.comp.filter(same);
            const pM = related.maint.filter(same);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return (
              <React.Fragment key={p.id || i}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (p.id || i))}>
                  <Td><i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 15, color: "var(--txt-3)" }} /></Td>
                  <Td><span style={{ fontWeight: 500 }}>{p.tenant}</span></Td>
                  <Td color="var(--txt-2)">{propName}</Td>
                  <Td>{gbp(p.amount || 0)}</Td>
                  <Td color="var(--txt-2)">{p.due_date || p.due || "—"}</Td>
                  <Td><Pill text={p.status} tone={p.status === "Paid" ? "green" : p.status === "Overdue" ? "red" : "amber"} /></Td>
                  <Td>{p.id && DB_READY ? <span style={{ display: "flex", gap: 12, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>{(p.status === "Pending" || p.status === "Overdue") && <i className="ti ti-circle-check" onClick={() => markReceived(p)} style={{ fontSize: 16, color: "var(--green)", cursor: "pointer" }} title="Mark received" />}<i className="ti ti-pencil" onClick={() => openEdit(p)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(p.id)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                          <DetailBox title="Tenant(s)" icon="ti-users" empty={pT.length === 0} emptyText={pid ? "No tenants on this property." : "No property linked."} onClick={() => go && go("tenants")}>
                            {pT.map((t, j) => <DetailRow key={j} main={t.name} sub={t.rent ? gbp(t.rent) + " pcm" : ""} pill={t.rent_status} tone={t.rent_status === "Overdue" ? "red" : "green"} />)}
                          </DetailBox>
                          <DetailBox title="Compliance" icon="ti-shield-check" empty={pC.length === 0} emptyText={pid ? "No certificates." : "No property linked."} onClick={() => go && go("compliance")}>
                            {pC.map((c, j) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; const tone = d === null ? "blue" : d <= 7 ? "red" : d <= 30 ? "amber" : "green"; return <DetailRow key={j} main={c.type} sub={c.expiry_date ? `expires ${c.expiry_date}` : ""} pill={d === null ? "—" : d < 0 ? "expired" : d + "d"} tone={tone} />; })}
                          </DetailBox>
                          <DetailBox title="Maintenance" icon="ti-tools" empty={pM.length === 0} emptyText={pid ? "No jobs." : "No property linked."} onClick={() => go && go("maintenance")}>
                            {pM.map((m, j) => <DetailRow key={j} main={m.title} sub={m.contractor || ""} pill={m.status} tone={m.status === "Completed" ? "green" : m.priority === "High" ? "red" : "amber"} />)}
                          </DetailBox>
                        </div>
                        <div style={{ marginTop: 12 }}><span onClick={() => go && go("documents")}><Btn icon="ti-folder" label="View documents" /></span></div>
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

/* ================================================================== */
/*  DOCUMENTS                                                         */
/* ================================================================== */
function DocumentsPage({ user }) {
  const cats = ["All", "Agreements", "Certificates", "Right to Rent", "Notices", "Invoices", "Other"];
  const catIcon = { Agreements: "ti-file-text", Certificates: "ti-certificate", "Right to Rent": "ti-id", Notices: "ti-mail", Invoices: "ti-receipt", Other: "ti-file" };
  const catTone = { Agreements: "blue", Certificates: "red", "Right to Rent": "green", Notices: "blue", Invoices: "green", Other: "amber" };
  const [cat, setCat] = useState("All");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pickCat, setPickCat] = useState("Certificates");
  const [pickProp, setPickProp] = useState("");
  const properties = usePropertyList();
  const [preview, setPreview] = useState(null);
  const fileRef = React.useRef(null);

  useEffect(() => {
    if (!DB_READY) { setRows(DEMO.documents.map((d) => ({ name: d.name, category: d.cat, size_kb: 0, file_path: null }))); return; }
    db.from("prop_documents").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_documents").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const onPick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!DB_READY) { setErr("Add your Supabase keys to upload."); return; }
    setErr(""); setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await db.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await db.from("prop_documents").insert([{ name: file.name, category: pickCat, file_path: path, size_kb: Math.round(file.size / 1024), property_id: pickProp || null, property: propLabel(properties, pickProp), user_id: user.id }]);
      if (dbErr) throw dbErr;
      await refresh();
    } catch (e2) { setErr(e2.message || "Upload failed"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const download = async (d) => {
    if (!d.file_path || !DB_READY) return;
    const { data, error } = await db.storage.from("documents").createSignedUrl(d.file_path, 60);
    if (error) { setErr(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const openPreview = async (d) => {
    if (!d.file_path || !DB_READY) { setErr("No file to preview."); return; }
    setErr("");
    const { data, error } = await db.storage.from("documents").createSignedUrl(d.file_path, 300);
    if (error) { setErr(error.message); return; }
    const ext = (d.name.split(".").pop() || "").toLowerCase();
    const kind = ["pdf"].includes(ext) ? "pdf" : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? "image" : "other";
    setPreview({ ...d, url: data.signedUrl, kind });
  };

  const remove = async (d) => {
    if (!d.id || !DB_READY) return;
    if (d.file_path) await db.storage.from("documents").remove([d.file_path]);
    await db.from("prop_documents").delete().eq("id", d.id);
    refresh();
  };

  const data = (rows || []).filter((d) => cat === "All" || d.category === cat);
  const fmtSize = (kb) => !kb ? "" : kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";

  return (
    <div className="fade-in">
      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onPick} />
      <PageHead title="Documents" sub="Secure legal document vault — private to your account." right={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={pickCat} onChange={(e) => setPickCat(e.target.value)} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" }}>
            {cats.slice(1).map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={pickProp} onChange={(e) => setPickProp(e.target.value)} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" }}>
            <option value="">— no property —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
          </select>
          <span onClick={() => !uploading && fileRef.current && fileRef.current.click()}><Btn icon={uploading ? "ti-loader" : "ti-upload"} label={uploading ? "Uploading…" : "Upload"} primary /></span>
        </div>
      } />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {cats.map((c) => (
          <span key={c} onClick={() => setCat(c)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 12px", borderRadius: 7, color: c === cat ? "var(--txt)" : "var(--txt-2)", background: c === cat ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (c === cat ? "var(--line)" : "transparent") }}>{c}</span>
        ))}
      </div>

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading documents…</div>
      ) : data.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No documents yet. Pick a category and click "Upload" to add one.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 11 }}>
          {data.map((d, i) => {
            const t = toneVar(catTone[d.category] || "amber");
            return (
              <div key={d.id || i} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "13px 15px", display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 38, height: 38, borderRadius: 9, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${catIcon[d.category] || "ti-file"}`} style={{ fontSize: 18 }} /></span>
                <div onClick={() => d.file_path && DB_READY && openPreview(d)} style={{ minWidth: 0, flex: 1, cursor: d.file_path && DB_READY ? "pointer" : "default" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{d.category}{d.size_kb ? " · " + fmtSize(d.size_kb) : ""}{(propLabel(properties, d.property_id) || d.property) ? " · " + (propLabel(properties, d.property_id) || d.property) : ""}</div>
                </div>
                {d.file_path && DB_READY && <i className="ti ti-eye" onClick={() => openPreview(d)} style={{ fontSize: 16, color: "var(--txt-3)", cursor: "pointer" }} title="Preview" />}
                {d.file_path && DB_READY && <i className="ti ti-download" onClick={() => download(d)} style={{ fontSize: 16, color: "var(--txt-3)", cursor: "pointer" }} title="Download" />}
                {d.id && DB_READY && <i className="ti ti-trash" onClick={() => remove(d)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" />}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: 820, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid var(--line)" }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview.name}</div><div style={{ fontSize: 11, color: "var(--txt-3)" }}>{preview.category}</div></div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <i className="ti ti-download" onClick={() => download(preview)} style={{ fontSize: 17, color: "var(--txt-2)", cursor: "pointer" }} title="Download" />
                <i className="ti ti-x" onClick={() => setPreview(null)} style={{ fontSize: 19, color: "var(--txt-2)", cursor: "pointer" }} />
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
              {preview.kind === "pdf" ? (
                <iframe src={preview.url} title="preview" style={{ width: "100%", height: "75vh", border: "none" }} />
              ) : preview.kind === "image" ? (
                <img src={preview.url} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }} />
              ) : (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <i className="ti ti-file-unknown" style={{ fontSize: 40, color: "var(--txt-3)" }} />
                  <div style={{ fontSize: 13, color: "var(--txt-2)", margin: "12px 0" }}>This file type can't be previewed in-browser.</div>
                  <span onClick={() => download(preview)}><Btn icon="ti-download" label="Download to view" primary /></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  REPORTS  (+ click-to-preview)                                     */
/* ================================================================== */
function downloadCSV(filename, cols, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Build a report's columns + rows from live data. Returns null if not yet wired.
function buildReport(name, d) {
  const gbpc = (n) => "£" + (n || 0).toLocaleString("en-GB");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  switch (name) {
    case "Rent statement":
    case "Landlord statement":
      return { cols: ["Tenant", "Property", "Amount", "Due date", "Status"], rows: d.pays.map((p) => [p.tenant, p.property, gbpc(p.amount), p.due_date || "—", p.status]) };
    case "Arrears report":
      return { cols: ["Tenant", "Property", "Amount", "Due date"], rows: d.pays.filter((p) => p.status === "Overdue").map((p) => [p.tenant, p.property, gbpc(p.amount), p.due_date || "—"]) };
    case "Profit & loss":
    case "Tax-year summary": {
      const collected = d.pays.filter((p) => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
      const due = d.pays.reduce((s, p) => s + (p.amount || 0), 0);
      return { cols: ["Line", "Amount"], rows: [["Rent collected", gbpc(collected)], ["Rent due (all)", gbpc(due)], ["Outstanding", gbpc(due - collected)], ["Properties", d.props.length]] };
    }
    case "Compliance audit":
      return { cols: ["Type", "Property", "Reference", "Expiry date"], rows: d.comp.map((c) => [c.type, c.property || "—", c.reference || "—", c.expiry_date || "—"]) };
    case "Expiring certificates":
      return { cols: ["Type", "Property", "Expiry date", "Days left"], rows: d.comp.map((c) => ({ ...c, dd: c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null })).filter((c) => c.dd !== null && c.dd <= 90).sort((a, b) => a.dd - b.dd).map((c) => [c.type, c.property || "—", c.expiry_date, c.dd]) };
    case "Overdue & at-risk":
      return { cols: ["Type", "Property", "Expiry date", "Status"], rows: d.comp.map((c) => ({ ...c, dd: c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null })).filter((c) => c.dd !== null && c.dd <= 30).map((c) => [c.type, c.property || "—", c.expiry_date, c.dd < 0 ? "Expired" : c.dd <= 7 ? "Urgent" : "Due soon"]) };
    case "Occupancy report":
      return { cols: ["Property", "Area", "Type", "Status", "Rent"], rows: d.props.map((p) => [p.address || p.addr, p.area || "—", p.type || "—", p.status, gbpc(p.rent)]) };
    case "Tenancy renewals":
      return { cols: ["Tenant", "Property", "Tenancy ends"], rows: d.tenants.map((t) => [t.name, t.property || "—", t.tenancy_end || "—"]) };
    case "Maintenance summary":
      return { cols: ["Job", "Property", "Priority", "Status", "Contractor"], rows: d.maint.map((m) => [m.title, m.property || "—", m.priority, m.status, m.contractor || "—"]) };
    case "Contractor performance": {
      const byc = {};
      d.maint.forEach((m) => { const c = m.contractor || "Unassigned"; byc[c] = (byc[c] || 0) + 1; });
      return { cols: ["Contractor", "Jobs"], rows: Object.entries(byc).map(([c, n]) => [c, n]) };
    }
    default:
      return null; // not yet wired
  }
}

function ReportPreview({ report, onClose }) {
  const empty = report.rows.length === 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "82vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "0.5px solid var(--line)", position: "sticky", top: 0, background: "var(--panel)" }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>{report.name}</div><div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>{report.wired ? `${report.rows.length} row${report.rows.length === 1 ? "" : "s"} · ${report.period || "All time"} · your live data` : "Preview · coming soon"}</div></div>
          <i className="ti ti-x" onClick={onClose} style={{ fontSize: 19, color: "var(--txt-2)", cursor: "pointer" }} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: "var(--txt-2)", marginBottom: 16, lineHeight: 1.6 }}>{report.desc}</div>
          {empty ? (
            <div style={{ fontSize: 12.5, color: "var(--txt-3)", padding: "20px 0", textAlign: "center" }}>{report.wired ? "No data for this report yet — add some in the relevant section first." : "This report isn't wired to live data yet."}</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: "0.5px solid var(--line)" }}>{report.cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--txt-3)" }}>{c}</th>)}</tr></thead>
              <tbody>{report.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} style={{ padding: "9px 10px", borderBottom: "0.5px solid var(--line)", color: j === 0 ? "var(--txt)" : "var(--txt-2)" }}>{cell}</td>)}</tr>)}</tbody>
            </table>
          )}
          {report.wired && !empty && (
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <span onClick={() => downloadCSV(report.name.replace(/\s+/g, "_") + ".csv", report.cols, report.rows)}><Btn icon="ti-file-type-csv" label="Download CSV" primary /></span>
            </div>
          )}
          {!report.wired && <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 12 }}>This report is on the roadmap — the data it needs isn't captured yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ReportsPage({ user }) {
  const [period, setPeriod] = useState("All time");
  const [preview, setPreview] = useState(null);
  const [d, setD] = useState(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const periods = ["All time", "This Month", "Quarter", "Tax Year", "Custom"];

  useEffect(() => {
    if (!DB_READY) { setD({ props: [], comp: [], pays: [], maint: [], tenants: [] }); return; }
    Promise.all([
      db.from("prop_properties").select("*"), db.from("prop_compliance").select("*"),
      db.from("prop_payments").select("*"), db.from("prop_maintenance").select("*"),
      db.from("prop_tenants").select("*"),
    ]).then(([p, c, pay, mt, tn]) => setD({ props: p.data || [], comp: c.data || [], pays: pay.data || [], maint: mt.data || [], tenants: tn.data || [] }));
  }, []);

  const periodRange = (label) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (label === "This Month") return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)];
    if (label === "Quarter") { const qm = Math.floor(now.getMonth() / 3) * 3; return [new Date(now.getFullYear(), qm, 1), new Date(now.getFullYear(), qm + 3, 0)]; }
    if (label === "Tax Year") { const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return [new Date(y, 3, 6), new Date(y + 1, 3, 5)]; } // UK tax year 6 Apr–5 Apr
    if (label === "Custom") {
      if (!customFrom && !customTo) return null;
      const start = customFrom ? new Date(customFrom) : new Date(1900, 0, 1);
      const end = customTo ? new Date(customTo) : new Date(3000, 0, 1);
      return [start, end];
    }
    return null; // All time
  };

  const filterByPeriod = (data, label) => {
    const range = periodRange(label);
    if (!range || !data) return data;
    const [start, end] = range;
    const inRange = (dateStr) => { if (!dateStr) return false; const dt = new Date(dateStr); return dt >= start && dt <= end; };
    return {
      ...data,
      pays: data.pays.filter((p) => inRange(p.due_date)),
      comp: data.comp.filter((c) => inRange(c.expiry_date)),
    };
  };

  const periodLabel = () => {
    if (period !== "Custom") return period;
    if (!customFrom && !customTo) return "Custom (no dates set)";
    return `${customFrom || "earliest"} → ${customTo || "latest"}`;
  };

  const openReport = (r) => {
    const scoped = d ? filterByPeriod(d, period) : null;
    const built = scoped ? buildReport(r.name, scoped) : null;
    const lbl = periodLabel();
    if (built) setPreview({ ...r, ...built, wired: true, period: lbl });
    else setPreview({ ...r, cols: ["Info"], rows: [], wired: false, period: lbl });
  };

  return (
    <div className="fade-in" style={{ position: "relative" }}>
      <PageHead title="Reports" sub="Generate, preview and export reports from your live data."
        right={<div style={{ display: "flex", gap: 5, fontSize: 12 }}>{periods.map((p) => <span key={p} onClick={() => setPeriod(p)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: p === period ? "var(--txt)" : "var(--txt-2)", background: p === period ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (p === period ? "var(--line)" : "transparent") }}>{p}</span>)}</div>} />
      {period === "Custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
          <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>From</span>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" }} />
          <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>To</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none" }} />
          {(customFrom || customTo) && <span onClick={() => { setCustomFrom(""); setCustomTo(""); }} style={{ fontSize: 11.5, color: "var(--brand)", cursor: "pointer" }}>Clear</span>}
          <span style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: "auto" }}>Open any report to apply this range</span>
        </div>
      )}
      {!d && <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 14 }}>Loading your data…</div>}
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
                <div key={ri} onClick={() => openReport(r)} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
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
function SettingsPage({ user }) {
  const [org, setOrg] = useState({ company_name: "", vat_number: "" });
  const [notif, setNotif] = useState({ notify_compliance: true, notify_rent: true, reminder_lead: "30 / 7 days before expiry" });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const currentPlan = "Enterprise"; // shown as current; real billing is future Stripe work

  useEffect(() => {
    if (!DB_READY) { setLoaded(true); return; }
    db.from("prop_settings").select("*").eq("user_id", user.id)
      .then(({ data, error }) => {
        const row = !error && data && data.length ? data[0] : null;
        if (row) {
          setOrg({ company_name: row.company_name || "", vat_number: row.vat_number || "" });
          setNotif({
            notify_compliance: row.notify_compliance !== false,
            notify_rent: row.notify_rent !== false,
            reminder_lead: row.reminder_lead || "30 / 7 days before expiry",
          });
        } else if (user.user_metadata && user.user_metadata.company_name) {
          setOrg((o) => ({ ...o, company_name: user.user_metadata.company_name }));
        }
        setLoaded(true);
      });
  }, []);

  const saveOrg = async () => {
    if (!DB_READY) { setErr("Add your Supabase keys to save."); return; }
    setErr(""); setSaving(true); setSaved(false);
    const record = { user_id: user.id, company_name: org.company_name, vat_number: org.vat_number, notify_compliance: notif.notify_compliance, notify_rent: notif.notify_rent, reminder_lead: notif.reminder_lead, updated_at: new Date().toISOString() };
    // upsert, then read back to confirm it actually persisted
    const { error: upErr } = await db.from("prop_settings").upsert(record, { onConflict: "user_id" });
    if (upErr) { setSaving(false); setErr("Couldn't save: " + upErr.message); return; }
    const { data: check, error: readErr } = await db.from("prop_settings").select("company_name,vat_number").eq("user_id", user.id);
    setSaving(false);
    if (readErr) { setErr("Saved, but couldn't confirm: " + readErr.message); return; }
    const row = check && check.length ? check[0] : null;
    if (!row) { setErr("Save didn't persist — this usually means the prop_settings table or its security policy is missing. Re-run the settings SQL in Supabase."); return; }
    setOrg({ company_name: row.company_name || "", vat_number: row.vat_number || "" });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const tiers = [
    { name: "Starter", price: 35, sub: "per month", best: "Up to 5 properties", features: ["Up to 5 properties", "Compliance tracking", "Tenant & rent records", "Document vault", "Email support"] },
    { name: "Professional", price: 65, sub: "per month", best: "Up to 25 properties", features: ["Everything in Starter", "Up to 25 properties", "Automated reminders", "Custom reports & exports", "Priority support"] },
    { name: "Enterprise", price: 120, sub: "per month", best: "Unlimited", features: ["Everything in Professional", "Unlimited properties", "Team roles & permissions", "API & integrations", "Dedicated account manager"] },
  ];

  const inp = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
  const card = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "15px 18px" };
  const head = (icon, title) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
      <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${icon}`} style={{ fontSize: 15 }} /></span>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
    </div>
  );

  return (
    <div className="fade-in">
      <PageHead title="Settings" sub="Manage your organisation, team and subscription." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 12 }}>
        {/* Organisation — editable */}
        <div style={card}>
          {head("ti-building", "Organisation")}
          {!loaded ? <div style={{ fontSize: 12, color: "var(--txt-3)" }}>Loading…</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={fld}>Company name<input style={inp} placeholder="e.g. Alzaro Property Co." value={org.company_name} onChange={(e) => setOrg({ ...org, company_name: e.target.value })} /></label>
              <label style={fld}>VAT number<input style={inp} placeholder="e.g. GB 123 4567 89" value={org.vat_number} onChange={(e) => setOrg({ ...org, vat_number: e.target.value })} /></label>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingTop: 4 }}><span style={{ color: "var(--txt-2)" }}>Current plan</span><span style={{ fontWeight: 600, color: "var(--brand)" }}>{currentPlan}</span></div>
              {err && <div style={{ fontSize: 11.5, color: "var(--red)" }}>{err}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span onClick={saveOrg}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : "Save changes"} primary /></span>
                {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
              </div>
            </div>
          )}
        </div>

        {/* Team & roles */}
        <div style={card}>
          {head("ti-users", "Team & roles")}
          {[["You", user ? user.email : "—", "Admin"], ["Invite teammates", "Coming soon", ""]].map((r, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: j === 0 ? "0.5px solid var(--line)" : "none", fontSize: 12.5 }}>
              <span style={{ color: "var(--txt-2)" }}>{r[0]}{r[1] && r[1] !== "Coming soon" ? ` · ${r[1]}` : ""}{r[1] === "Coming soon" ? ` · ${r[1]}` : ""}</span><span style={{ fontWeight: 500, color: r[2] === "Admin" ? "var(--brand)" : "var(--txt)" }}>{r[2]}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 8 }}>Multi-user teams arrive with the Enterprise plan.</div>
        </div>
      </div>

      {/* Notifications — editable */}
      <div style={{ ...card, marginBottom: 18 }}>
        {head("ti-bell", "Notifications")}
        {(() => {
          const Toggle = ({ on, onClick }) => (
            <span onClick={onClick} style={{ width: 38, height: 22, borderRadius: 11, background: on ? "var(--brand)" : "var(--line-2)", position: "relative", cursor: "pointer", transition: "background .15s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
            </span>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--line)" }}>
                <div><div style={{ fontSize: 12.5, color: "var(--txt)" }}>Compliance reminders</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>Alerts when certificates are due to expire</div></div>
                <Toggle on={notif.notify_compliance} onClick={() => setNotif({ ...notif, notify_compliance: !notif.notify_compliance })} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--line)" }}>
                <div><div style={{ fontSize: 12.5, color: "var(--txt)" }}>Rent overdue alerts</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>Alerts when a payment becomes overdue</div></div>
                <Toggle on={notif.notify_rent} onClick={() => setNotif({ ...notif, notify_rent: !notif.notify_rent })} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 12.5, color: "var(--txt)" }}>Reminder lead time</div>
                <select value={notif.reminder_lead} onChange={(e) => setNotif({ ...notif, reminder_lead: e.target.value })} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "7px 10px", color: "var(--txt)", fontSize: 12, fontFamily: "Inter", outline: "none" }}>
                  {["60 / 30 / 7 days before expiry", "30 / 7 days before expiry", "14 / 1 days before expiry", "7 days before expiry"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 6 }}>Changes save with the "Save changes" button above. Email delivery of these reminders is coming soon — alerts currently show in the app.</div>
            </div>
          );
        })()}
      </div>

      {/* Subscription */}
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Subscription &amp; plans</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {tiers.map((t) => {
          const isCurrent = t.name === currentPlan;
          return (
            <div key={t.name} style={{ background: "var(--panel-2)", border: isCurrent ? "1.5px solid var(--brand)" : "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "18px 18px", position: "relative" }}>
              {isCurrent && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--brand)", padding: "3px 9px", borderRadius: 6 }}>CURRENT</span>}
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 12 }}>{t.best}</div>
              <div style={{ marginBottom: 14 }}><span style={{ fontSize: 26, fontWeight: 700 }}>£{t.price}</span><span style={{ fontSize: 12, color: "var(--txt-3)" }}> /{t.sub.replace("per ", "")}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                {t.features.map((f, k) => (
                  <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5, color: "var(--txt-2)" }}>
                    <i className="ti ti-check" style={{ fontSize: 13, color: "var(--green)", marginTop: 1, flexShrink: 0 }} />{f}
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--txt-3)", padding: "9px", border: "0.5px solid var(--line)", borderRadius: 8 }}>Your current plan</div>
              ) : (
                <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--brand)", padding: "9px", border: "1px solid var(--brand)", borderRadius: 8, cursor: "pointer" }} title="Billing coming soon">{t.price > tiers.find((x) => x.name === currentPlan).price ? "Upgrade" : "Switch"} to {t.name}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 12 }}>Plan changes and billing are handled by our payments provider — secure checkout is coming soon. Contact support to change your plan in the meantime.</div>
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
  const [light, setLight] = useState(() => {
    try { return localStorage.getItem("propops_theme") === "light"; } catch (e) { return false; }
  });
  const [allData, setAllData] = useState(null);
  const [query, setQuery] = useState("");
  const [showNotif, setShowNotif] = useState(false);

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
          <div style={{ flex: 1, position: "relative" }}>
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
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320, background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.4)", zIndex: 40, overflow: "hidden" }}>
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

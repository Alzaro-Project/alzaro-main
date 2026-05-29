const { useState, useEffect } = React;

/* ================================================================== */
/*  DEMO DATA  — replace with Supabase queries in phase 2             */
/* ================================================================== */
const DEMO = {
  user: { name: "Dave R.", email: "dave@alzaro.co.uk", tier: "PRO" },
  metrics: { revenue: 18450, outstanding: 3960, jobsToday: 6, jobsWeek: 23, quotesOpen: 8, quoteValue: 12400, certsDue: 3, customers: 64 },
  certificates: [
    { type: "Gas Safety (CP12)", ref: "Landlord cert", addr: "14 Oak St", days: 4, icon: "ti-flame", tone: "red" },
    { type: "EICR", ref: "Electrical report", addr: "9 Mill Lane Flat 2", days: 16, icon: "ti-bolt", tone: "amber" },
    { type: "Boiler Service", ref: "Annual service", addr: "22 Bridge Rd", days: 33, icon: "ti-flame-off", tone: "blue" },
    { type: "PAT Testing", ref: "Appliance test", addr: "5 King's Court", days: 48, icon: "ti-plug", tone: "blue" },
  ],
  activity: [
    { text: "Invoice paid · INV-1042 · £540", time: "9 min ago", tone: "green" },
    { text: "Job completed · Boiler swap, Flat 4", time: "1 hr ago", tone: "blue" },
    { text: "Quote approved · QUO-218 · £1,850", time: "2 hrs ago", tone: "green" },
    { text: "New emergency call-out · 31 Park View", time: "3 hrs ago", tone: "amber" },
  ],
  customers: [
    { name: "Sarah Connor", area: "Manchester", contact: "07700 900123", type: "Landlord", site: "14 Oak Street", jobs: 5, spend: 4250, tone: "green" },
    { name: "Mill Lane Lettings", area: "Leeds", contact: "07700 900456", type: "Agency", site: "9 Mill Lane", jobs: 12, spend: 9800, tone: "green" },
    { name: "Aisha Khan", area: "Manchester", contact: "07700 900789", type: "Homeowner", site: "22 Bridge Road", jobs: 2, spend: 680, tone: "green" },
    { name: "King's Court Mgmt", area: "Liverpool", contact: "07700 900222", type: "Commercial", site: "5 King's Court", jobs: 9, spend: 7400, tone: "green" },
    { name: "David Lowe", area: "Sheffield", contact: "07700 900333", type: "Homeowner", site: "8 Vale Road", jobs: 1, spend: 320, tone: "amber" },
  ],
  quotes: [
    { ref: "QUO-218", customer: "Mill Lane Lettings", desc: "Full bathroom refit", amount: 1850, status: "Approved", date: "2026-05-20" },
    { ref: "QUO-219", customer: "Sarah Connor", desc: "Boiler replacement + flush", amount: 2400, status: "Sent", date: "2026-05-24" },
    { ref: "QUO-220", customer: "Aisha Khan", desc: "Consumer unit upgrade", amount: 680, status: "Sent", date: "2026-05-26" },
    { ref: "QUO-221", customer: "David Lowe", desc: "Outdoor tap install", amount: 145, status: "Draft", date: "2026-05-28" },
    { ref: "QUO-222", customer: "King's Court Mgmt", desc: "Communal lighting LED swap", amount: 3200, status: "Rejected", date: "2026-05-12" },
  ],
  jobs: [
    { title: "Boiler not firing", customer: "Mill Lane Lettings", site: "9 Mill Lane Flat 2", engineer: "Dave R.", priority: "High", status: "In Progress", value: 280 },
    { title: "Leaking kitchen tap", customer: "Sarah Connor", site: "14 Oak Street", engineer: "Mike T.", priority: "Medium", status: "Scheduled", value: 90 },
    { title: "Consumer unit upgrade", customer: "Aisha Khan", site: "22 Bridge Road", engineer: "Unassigned", priority: "Low", status: "New", value: 680 },
    { title: "Annual gas service x6", customer: "King's Court Mgmt", site: "5 King's Court", engineer: "Dave R.", priority: "Medium", status: "Completed", value: 540 },
    { title: "Emergency — no hot water", customer: "David Lowe", site: "8 Vale Road", engineer: "Mike T.", priority: "High", status: "Invoiced", value: 165 },
    { title: "Radiator replacement", customer: "Sarah Connor", site: "14 Oak Street", engineer: "Dave R.", priority: "Medium", status: "Scheduled", value: 320 },
  ],
  invoices: [
    { ref: "INV-1042", customer: "King's Court Mgmt", amount: 540, due: "2026-05-15", status: "Paid" },
    { ref: "INV-1043", customer: "Aisha Khan", amount: 680, due: "2026-06-01", status: "Sent" },
    { ref: "INV-1044", customer: "Sarah Connor", amount: 90, due: "2026-06-04", status: "Sent" },
    { ref: "INV-1041", customer: "Mill Lane Lettings", amount: 1850, due: "2026-05-10", status: "Overdue" },
    { ref: "INV-1040", customer: "David Lowe", amount: 165, due: "2026-05-08", status: "Overdue" },
  ],
  documents: [
    { name: "CP12 — 9 Mill Lane.pdf", cat: "Certificates", size: "180 KB", date: "01 Feb 2026", icon: "ti-flame", tone: "red" },
    { name: "EICR Report — 22 Bridge Rd.pdf", cat: "Certificates", size: "1.2 MB", date: "18 Jan 2026", icon: "ti-bolt", tone: "amber" },
    { name: "Quote QUO-218 — Mill Lane.pdf", cat: "Quotes", size: "96 KB", date: "20 May 2026", icon: "ti-file-dollar", tone: "blue" },
    { name: "Invoice INV-1042 — King's Court.pdf", cat: "Invoices", size: "120 KB", date: "15 May 2026", icon: "ti-receipt", tone: "green" },
    { name: "Completion Cert — Boiler swap.pdf", cat: "Certificates", size: "85 KB", date: "22 May 2026", icon: "ti-circle-check", tone: "green" },
    { name: "Site photos — Flat 2 damp.pdf", cat: "Job Photos", size: "2.4 MB", date: "19 May 2026", icon: "ti-photo", tone: "blue" },
  ],
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
  { id: "customers", label: "Customers", icon: "ti-users" },
  { id: "quotes", label: "Quotes", icon: "ti-file-dollar" },
  { id: "jobs", label: "Jobs", icon: "ti-briefcase" },
  { id: "diary", label: "Diary", icon: "ti-calendar" },
  { id: "invoicing", label: "Invoicing", icon: "ti-receipt" },
  { id: "certificates", label: "Certificates", icon: "ti-shield-check" },
  { id: "documents", label: "Documents", icon: "ti-folder" },
  { id: "reports", label: "Reports", icon: "ti-chart-bar" },
  { id: "settings", label: "Settings", icon: "ti-settings" },
];

const REPORTS = [
  { cat: "Financial", tone: "green", icon: "ti-coin", items: [
    { name: "Sales report", desc: "Invoiced revenue by period, customer and job type.", icon: "ti-chart-line" },
    { name: "Outstanding invoices", desc: "Every unpaid and overdue invoice, with days late.", icon: "ti-alert-triangle" },
    { name: "Job profitability", desc: "Revenue vs materials and labour for each job.", icon: "ti-businessplan" },
    { name: "VAT report", desc: "Output and input VAT for the quarter — MTD ready.", icon: "ti-building-bank" },
    { name: "Monthly revenue", desc: "Revenue trend across the year, month by month.", icon: "ti-calendar-stats" },
  ]},
  { cat: "Compliance", tone: "red", icon: "ti-shield-check", items: [
    { name: "Certificate register", desc: "Every CP12, EICR and service cert, status and expiry.", icon: "ti-clipboard-check" },
    { name: "Expiring certificates", desc: "Gas, electrical and service certs due in 30/60/90 days.", icon: "ti-calendar-due" },
    { name: "Completion certificates", desc: "Signed-off jobs with customer e-signature on file.", icon: "ti-circle-check" },
  ]},
  { cat: "Jobs & quoting", tone: "blue", icon: "ti-briefcase", items: [
    { name: "Quote conversion", desc: "Quotes sent vs approved, and average value.", icon: "ti-arrows-up-down" },
    { name: "Job status summary", desc: "Open vs completed jobs and average turnaround.", icon: "ti-progress" },
    { name: "Engineer utilisation", desc: "Jobs and hours per engineer across the week.", icon: "ti-user-cog" },
  ]},
  { cat: "Customers", tone: "amber", icon: "ti-users", items: [
    { name: "Customer spend", desc: "Lifetime spend and job count per customer.", icon: "ti-coin" },
    { name: "Repeat business", desc: "Returning customers vs one-off jobs.", icon: "ti-repeat" },
    { name: "Source breakdown", desc: "Where new customers came from.", icon: "ti-chart-pie" },
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
            {cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "11px 16px", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--txt-3)", fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const Td = ({ children, color }) => <td style={{ padding: "12px 16px", color: color || "var(--txt)", borderBottom: "0.5px solid var(--line)" }}>{children}</td>;

const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
const formCard = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 };
const demoBanner = { fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 };
const errBanner = { fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 };
const emptyCard = { color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" };
const rowActions = (DB, onEdit, onDel) => DB ? <span style={{ display: "flex", gap: 12 }}><i className="ti ti-pencil" onClick={onEdit} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={onDel} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null;

/* ================================================================== */
/*  DASHBOARD                                                         */
/* ================================================================== */
function DashboardPage({ range, go }) {
  const m = DEMO.metrics;
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>Good morning, Dave</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{m.jobsToday} jobs today · 2 invoices overdue · {range}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Revenue (Month)" value={gbp(m.revenue)} sub="+8.4% vs last month" color="var(--brand)" subColor="var(--green)" />
        <Metric label="Outstanding" value={gbp(m.outstanding)} sub="2 invoices overdue" color="var(--red)" />
        <Metric label="Jobs Today" value={m.jobsToday} sub={`${m.jobsWeek} this week`} color="var(--blue)" />
        <Metric label="Open Quotes" value={m.quotesOpen} sub={`${gbp(m.quoteValue)} potential`} color="var(--amber)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Certificates Due" action="View all" onAction={() => go("certificates")}>
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
        <Metric label="Jobs This Week" value={m.jobsWeek} sub="4 awaiting invoice" color="var(--blue)" />
        <Metric label="Certificates Due" value={m.certsDue} sub="Next 30 days" color="var(--amber)" />
        <Metric label="Active Customers" value={m.customers} sub="+5 this month" color="var(--txt)" subColor="var(--green)" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  CUSTOMERS                                                         */
/* ================================================================== */
function CustomersPage({ user }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { name: "", area: "", contact: "", email: "", type: "Homeowner", site: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_customers").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data || []); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_customers").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (c) => { setForm({ name: c.name || "", area: c.area || "", contact: c.contact || "", email: c.email || "", type: c.type || "Homeowner", site: c.site || "" }); setEditId(c.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("Customer name is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys in supabase.js to save for real."); return; }
    setErr("");
    let error;
    if (editId) ({ error } = await db.from("svc_customers").update(form).eq("id", editId));
    else ({ error } = await db.from("svc_customers").insert([{ ...form, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_customers").delete().eq("id", id); refresh(); } };

  const list = (rows || []).filter((c) => ((c.name || "") + (c.area || "") + (c.site || "") + (c.type || "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fade-in">
      <PageHead title="Customers" sub={rows ? `${list.length} ${DB_READY ? "" : "(demo) "}customers` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-user-plus"} label={adding ? "Cancel" : "Add customer"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit customer" : "New customer"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Customer name<input style={inp} placeholder="e.g. Sarah Connor" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label style={fld}>Type<select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["Homeowner", "Landlord", "Agency", "Commercial"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Area<input style={inp} placeholder="e.g. Manchester" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
            <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
            <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label style={fld}>Site address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update customer" : "Save customer"} primary /></span></div>
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, area, site or type…" style={{ ...inp, marginBottom: 14 }} />
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading customers…</div>
      ) : list.length === 0 ? (
        <div style={emptyCard}>No customers yet. Click "Add customer" to create your first one.</div>
      ) : (
        <Table cols={["Customer", "Type", "Area", "Phone", "Site", "Jobs", "Spend", ""]}>
          {list.map((c, i) => (
            <tr key={c.id || i}>
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{(c.name || "?").split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                </div>
              </Td>
              <Td><Pill text={c.type || "—"} tone={c.type === "Commercial" ? "blue" : c.type === "Agency" ? "amber" : "green"} /></Td>
              <Td color="var(--txt-2)">{c.area || "—"}</Td>
              <Td color="var(--txt-2)">{c.contact || "—"}</Td>
              <Td color="var(--txt-2)">{c.site || "—"}</Td>
              <Td color="var(--txt-2)">{c.jobs != null ? c.jobs : "—"}</Td>
              <Td>{c.spend != null ? gbp(c.spend) : "—"}</Td>
              <Td>{c.id && rowActions(DB_READY, () => openEdit(c), () => remove(c.id))}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ================================================================== */
/*  QUOTES                                                            */
/* ================================================================== */
function QuotesPage({ user }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { ref: "", customer: "", description: "", amount: "", status: "Draft", quote_date: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_quotes").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_quotes").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (q) => { setForm({ ref: q.ref || "", customer: q.customer || "", description: q.description || "", amount: q.amount || "", status: q.status || "Draft", quote_date: q.quote_date || "" }); setEditId(q.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.customer.trim()) { setErr("Customer is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, amount: form.amount === "" ? 0 : +form.amount };
    if (!payload.quote_date) delete payload.quote_date;
    let error;
    if (editId) ({ error } = await db.from("svc_quotes").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_quotes").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_quotes").delete().eq("id", id); refresh(); } };

  const data = rows || [];
  const open = data.filter((q) => q.status === "Sent" || q.status === "Draft");
  const openVal = open.reduce((s, q) => s + (q.amount || 0), 0);
  const approved = data.filter((q) => q.status === "Approved").length;
  const toneFor = { Approved: "green", Sent: "blue", Draft: "amber", Rejected: "red" };

  return (
    <div className="fade-in">
      <PageHead title="Quotes" sub={rows ? `${data.length} quote${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "New quote"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Total quotes" value={data.length} sub="All time" color="var(--txt)" />
        <Metric label="Open" value={open.length} sub="Sent + draft" color="var(--blue)" />
        <Metric label="Open value" value={gbp(openVal)} sub="Potential revenue" color="var(--amber)" />
        <Metric label="Approved" value={approved} sub="Ready to convert" color="var(--green)" />
      </div>
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit quote" : "New quote"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Reference<input style={inp} placeholder="e.g. QUO-223" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></label>
            <label style={fld}>Customer<input style={inp} placeholder="e.g. Sarah Connor" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></label>
            <label style={fld}>Amount (£)<input style={inp} type="number" placeholder="e.g. 1850" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label style={{ ...fld, gridColumn: "span 2" }}>Description<input style={inp} placeholder="e.g. Full bathroom refit" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Draft", "Sent", "Approved", "Rejected"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Quote date<input style={inp} type="date" value={form.quote_date} onChange={(e) => setForm({ ...form, quote_date: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update quote" : "Save quote"} primary /></span></div>
        </div>
      )}
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading quotes…</div>
      ) : data.length === 0 ? (
        <div style={emptyCard}>No quotes yet. Click "New quote" to create your first one.</div>
      ) : (
        <Table cols={["Ref", "Customer", "Description", "Amount", "Date", "Status", ""]}>
          {data.map((q, i) => (
            <tr key={q.id || i}>
              <Td><span style={{ fontWeight: 500, fontFamily: "monospace" }}>{q.ref || "—"}</span></Td>
              <Td>{q.customer}</Td>
              <Td color="var(--txt-2)">{q.description || "—"}</Td>
              <Td>{gbp(q.amount || 0)}</Td>
              <Td color="var(--txt-2)">{q.quote_date || "—"}</Td>
              <Td><Pill text={q.status || "Draft"} tone={toneFor[q.status] || "amber"} /></Td>
              <Td>{q.id && rowActions(DB_READY, () => openEdit(q), () => remove(q.id))}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ================================================================== */
/*  JOBS  (kanban)                                                    */
/* ================================================================== */
function JobsPage({ user }) {
  const stages = ["New", "Scheduled", "In Progress", "Completed", "Invoiced"];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { title: "", customer: "", site: "", engineer: "", priority: "Medium", value: "", status: "New" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_jobs").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_jobs").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (j) => { setForm({ title: j.title || "", customer: j.customer || "", site: j.site || "", engineer: j.engineer || "", priority: j.priority || "Medium", value: j.value || "", status: j.status || "New" }); setEditId(j.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.title.trim()) { setErr("Job title is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, value: form.value === "" ? 0 : +form.value };
    let error;
    if (editId) ({ error } = await db.from("svc_jobs").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_jobs").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_jobs").delete().eq("id", id); refresh(); } };
  const move = async (j, dir) => {
    const idx = stages.indexOf(j.status); const next = stages[idx + dir];
    if (!next || !j.id || !DB_READY) return;
    await db.from("svc_jobs").update({ status: next }).eq("id", j.id); refresh();
  };

  const open = (rows || []).filter((m) => m.status !== "Completed" && m.status !== "Invoiced").length;

  return (
    <div className="fade-in">
      <PageHead title="Jobs" sub={rows ? `${open} open job${open === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "New job"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit job" : "New job"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Job title<input style={inp} placeholder="e.g. Boiler not firing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label style={fld}>Customer<input style={inp} placeholder="e.g. Mill Lane Lettings" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></label>
            <label style={fld}>Site<input style={inp} placeholder="e.g. 9 Mill Lane Flat 2" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></label>
            <label style={fld}>Engineer<input style={inp} placeholder="e.g. Dave R." value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} /></label>
            <label style={fld}>Priority<select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Value (£)<input style={inp} type="number" placeholder="e.g. 280" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{stages.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update job" : "Save job"} primary /></span></div>
        </div>
      )}
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading jobs…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 11 }}>
          {stages.map((s) => {
            const jobs = (rows || []).filter((m) => m.status === s);
            return (
              <div key={s}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, padding: "0 2px" }}>
                  <span style={{ fontSize: 11, letterSpacing: 0.5, color: "var(--txt-2)", textTransform: "uppercase" }}>{s}</span>
                  <span style={{ fontSize: 11, color: "var(--txt-3)" }}>{jobs.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 80 }}>
                  {jobs.map((j, i) => (
                    <div key={j.id || i} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 13px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{j.title}</span>
                        <Pill text={j.priority} tone={toneFor[j.priority] || "blue"} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 4 }}>{j.customer || "—"}</div>
                      <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginBottom: 6 }}>{j.site || ""}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--txt-2)", marginBottom: j.id && DB_READY ? 9 : 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i className="ti ti-user-cog" style={{ fontSize: 13 }} />{j.engineer || "Unassigned"}</span>
                        {j.value ? <span style={{ fontWeight: 600, color: "var(--txt)" }}>{gbp(j.value)}</span> : null}
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
/*  DIARY  (week view)                                                */
/* ================================================================== */
function DiaryPage() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const engineers = [
    { name: "Dave R.", tone: "brand" },
    { name: "Mike T.", tone: "blue" },
  ];
  const slots = {
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [],
  };
  return (
    <div className="fade-in">
      <PageHead title="Diary" sub="This week · 2 engineers · drag-and-drop scheduling arrives with the backend."
        right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>{engineers.map((e) => <span key={e.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--txt-2)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: `var(--${e.tone})` }} />{e.name}</span>)}<span><Btn icon="ti-plus" label="New booking" primary /></span></div>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
        {days.map((d) => (
          <div key={d}>
            <div style={{ fontSize: 11, letterSpacing: 0.5, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 9, textAlign: "center" }}>{d}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 120 }}>
              {(slots[d] || []).map((s, i) => {
                const t = toneVar(s.tone);
                return (
                  <div key={i} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderLeft: `2px solid ${t.color}`, borderRadius: 8, padding: "9px 10px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.color, fontFamily: "monospace" }}>{s.time}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, margin: "3px 0", lineHeight: 1.3 }}>{s.job}</div>
                    <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{s.cust}</div>
                    <div style={{ fontSize: 10, color: "var(--txt-2)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><i className="ti ti-user-cog" style={{ fontSize: 11 }} />{s.eng}</div>
                  </div>
                );
              })}
              {(slots[d] || []).length === 0 && <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center", padding: "16px 0", border: "1px dashed var(--line)", borderRadius: 8 }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  INVOICING                                                         */
/* ================================================================== */
function InvoicingPage({ user }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { ref: "", customer: "", amount: "", due_date: "", status: "Draft" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_invoices").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_invoices").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (v) => { setForm({ ref: v.ref || "", customer: v.customer || "", amount: v.amount || "", due_date: v.due_date || "", status: v.status || "Draft" }); setEditId(v.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.customer.trim()) { setErr("Customer is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, amount: form.amount === "" ? 0 : +form.amount };
    if (!payload.due_date) delete payload.due_date;
    let error;
    if (editId) ({ error } = await db.from("svc_invoices").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_invoices").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_invoices").delete().eq("id", id); refresh(); } };

  const data = rows || [];
  const collected = data.filter((v) => v.status === "Paid").reduce((s, v) => s + (v.amount || 0), 0);
  const overdue = data.filter((v) => v.status === "Overdue").reduce((s, v) => s + (v.amount || 0), 0);
  const sent = data.filter((v) => v.status === "Sent").reduce((s, v) => s + (v.amount || 0), 0);
  const outstanding = sent + overdue;
  const vat = Math.round(collected * 0.2);

  return (
    <div className="fade-in">
      <PageHead title="Invoicing" sub={rows ? `${data.length} invoice${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "New invoice"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Collected" value={gbp(collected)} sub="Paid invoices" color="var(--green)" />
        <Metric label="Outstanding" value={gbp(outstanding)} sub="Sent + overdue" color="var(--amber)" />
        <Metric label="Overdue" value={gbp(overdue)} sub={`${data.filter((v) => v.status === "Overdue").length} invoices`} color="var(--red)" />
        <Metric label="VAT due (est.)" value={gbp(vat)} sub="20% on collected" color="var(--blue)" />
      </div>
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit invoice" : "New invoice"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Reference<input style={inp} placeholder="e.g. INV-1045" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></label>
            <label style={fld}>Customer<input style={inp} placeholder="e.g. King's Court Mgmt" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></label>
            <label style={fld}>Amount (£)<input style={inp} type="number" placeholder="e.g. 540" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label style={fld}>Due date<input style={inp} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Draft", "Sent", "Paid", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update invoice" : "Save invoice"} primary /></span></div>
        </div>
      )}
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Invoice ledger</div>
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading invoices…</div>
      ) : data.length === 0 ? (
        <div style={emptyCard}>No invoices yet. Click "New invoice" to raise your first one.</div>
      ) : (
        <Table cols={["Ref", "Customer", "Amount", "Due date", "Status", ""]}>
          {data.map((v, i) => (
            <tr key={v.id || i}>
              <Td><span style={{ fontWeight: 500, fontFamily: "monospace" }}>{v.ref || "—"}</span></Td>
              <Td>{v.customer}</Td>
              <Td>{gbp(v.amount || 0)}</Td>
              <Td color="var(--txt-2)">{v.due_date || "—"}</Td>
              <Td><Pill text={v.status} tone={v.status === "Paid" ? "green" : v.status === "Overdue" ? "red" : v.status === "Sent" ? "blue" : "amber"} /></Td>
              <Td>{v.id && rowActions(DB_READY, () => openEdit(v), () => remove(v.id))}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ================================================================== */
/*  CERTIFICATES                                                      */
/* ================================================================== */
function CertificatesPage() {
  const all = [];
  const urgent = all.filter((c) => c.days <= 7).length;
  const soon = all.filter((c) => c.days > 7 && c.days <= 30).length;
  return (
    <div className="fade-in">
      <PageHead title="Certificates" sub="Track every gas, electrical and completion certificate across your jobs." right={<Btn icon="ti-upload" label="Upload certificate" primary />} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Tracked items" value={all.length} sub="Across all sites" color="var(--blue)" />
        <Metric label="Urgent (≤7 days)" value={urgent} sub="Renew now" color="var(--red)" />
        <Metric label="Due soon (≤30 days)" value={soon} sub="Schedule renewal" color="var(--amber)" />
        <Metric label="Valid" value={all.length - urgent - soon} sub="In date" color="var(--green)" />
      </div>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Certificate timeline — soonest first</div>
      {all.length === 0 ? (
        <div style={emptyCard}>No certificates yet. Click "Upload certificate" to add your first one.</div>
      ) : (
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
      )}
    </div>
  );
}

/* ================================================================== */
/*  DOCUMENTS                                                         */
/* ================================================================== */
function DocumentsPage() {
  const [cat, setCat] = useState("All");
  const cats = ["All", "Quotes", "Invoices", "Certificates", "Job Photos"];
  const list = DEMO.documents.filter((d) => cat === "All" || d.cat === cat);
  return (
    <div className="fade-in">
      <PageHead title="Documents" sub="Quotes, invoices, certificates and job photos — all in one vault." right={<Btn icon="ti-upload" label="Upload" primary />} />
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
  cols: ["Customer", "Detail", "Value", "Status"],
  rows: [
    ["King's Court Mgmt", "INV-1042", "£540", "Paid"],
    ["Aisha Khan", "INV-1043", "£680", "Sent"],
    ["Sarah Connor", "INV-1044", "£90", "Sent"],
    ["Mill Lane Lettings", "INV-1041", "£1,850", "Overdue"],
    ["David Lowe", "INV-1040", "£165", "Overdue"],
  ],
};

function ReportsPage() {
  const [period, setPeriod] = useState("This Month");
  const [preview, setPreview] = useState(null);
  const periods = ["This Month", "Quarter", "VAT Quarter", "Custom"];
  return (
    <div className="fade-in" style={{ position: "relative" }}>
      <PageHead title="Reports" sub="Generate, preview and export any report across your business."
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
    { title: "Business", icon: "ti-building", rows: [["Trading name", "Alzaro Trade Services"], ["VAT number", "GB 123 4567 89"], ["Plan", "Pro"]] },
    { title: "Team & engineers", icon: "ti-users", rows: [["Dave R.", "Admin / Engineer"], ["Mike T.", "Engineer"], ["Sub — DryWall Co", "Subcontractor"]] },
    { title: "Notifications", icon: "ti-bell", rows: [["Certificate reminders", "Email + SMS"], ["Invoice overdue", "Email"], ["Job booked", "SMS to customer"]] },
    { title: "Integrations", icon: "ti-plug", rows: [["Xero", "Not connected"], ["Stripe", "Not connected"], ["GoCardless", "Not connected"]] },
  ];
  return (
    <div className="fade-in">
      <PageHead title="Settings" sub="Manage your business, team, notifications and integrations." />
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
  const [tab, setTab] = useState(wantsSignup ? "register" : "login");
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
  };

  const doRegister = async () => {
    reset();
    if (!company.trim() || !email.trim() || !pw.trim()) return setMsg("Please fill all fields.");
    if (pw.length < 6) return setMsg("Password must be at least 6 characters.");
    if (!DB_READY) return setMsg("Database not connected. Add your keys in supabase.js.");
    setBusy(true);
    const { error } = await db.auth.signUp({ email, password: pw, options: { data: { company_name: company.trim(), product: "serviceops" } } });
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
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/serviceops/login` });
    setBusy(false);
    if (error) setMsg(error.message);
    else setOk("Password reset link sent! Check your inbox (and spam folder).");
  };

  const authInp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "Inter", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "Inter", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(139,127,232,.3)" };
  const Banner = ({ text, good }) => (
    <div style={{ background: good ? "var(--green-soft)" : "var(--red-soft)", border: "1px solid " + (good ? "var(--green)" : "var(--red)"), borderRadius: 8, padding: "11px 14px", fontSize: 13, color: good ? "var(--green)" : "var(--red)", marginBottom: 14, lineHeight: 1.4 }}>{good ? "✓ " : ""}{text}</div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 20 }}>
      <div className="fade-in" style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "40px 36px", width: 440, maxWidth: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 28, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>ServiceOps</span></div>
          <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4 }}>Field Service Operations Infrastructure</div>
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
              <input style={authInp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doForgot()} />
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
                <input style={authInp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                <input style={authInp} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                <button onClick={doLogin} disabled={busy} style={primaryBtn}>{busy ? "Signing in…" : "Sign in →"}</button>
                <button onClick={() => { setForgot(true); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "Inter" }}>Forgot password?</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--brand-soft)", border: "1px solid rgba(139,127,232,.25)", borderRadius: 8, padding: "11px 14px", fontSize: 12, color: "var(--brand)", textAlign: "center", fontWeight: 500 }}>
                  🔧 Start your <strong>14-day free trial</strong> — full access, no card required
                </div>
                <input style={authInp} placeholder="Business name *" value={company} onChange={(e) => setCompany(e.target.value)} />
                <input style={authInp} type="email" placeholder="Email address *" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input style={authInp} type="password" placeholder="Password (min 6 characters) *" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRegister()} />
                <button onClick={doRegister} disabled={busy} style={primaryBtn}>{busy ? "Creating account…" : "Start free trial →"}</button>
                <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center", fontFamily: "monospace", letterSpacing: 0.3 }}>No credit card · Cancel anytime · UK-based support</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "monospace", letterSpacing: 0.5 }}>Alzaro ServiceOps · Built for UK tradespeople · v1.0</div>
    </div>
  );
}

/* ================================================================== */
/*  APP SHELL                                                         */
/* ================================================================== */
const PAGES = {
  customers: CustomersPage, quotes: QuotesPage, jobs: JobsPage, diary: DiaryPage,
  invoicing: InvoicingPage, certificates: CertificatesPage, documents: DocumentsPage,
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
        <div className="brand" style={{ fontSize: 18, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>ServiceOps</span></div>
        <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 20 }}>Field Service Pro</div>
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
            <input placeholder="Search customers, jobs, invoices…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter" }} />
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
  const [session, setSession] = useState(undefined);

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

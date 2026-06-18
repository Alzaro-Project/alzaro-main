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
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard", tint: "brand" },
  { id: "customers", label: "Customers", icon: "ti-users", tint: "blue" },
  { id: "properties", label: "Properties", icon: "ti-home", tint: "teal" },
  { id: "quotes", label: "Quotes", icon: "ti-file-dollar", tint: "amber" },
  { id: "jobs", label: "Jobs", icon: "ti-briefcase", tint: "purple" },
  { id: "diary", label: "Diary", icon: "ti-calendar", tint: "blue" },
  { id: "invoicing", label: "Invoicing", icon: "ti-receipt", tint: "brand" },
  { id: "certificates", label: "Certificates", icon: "ti-shield-check", tint: "red" },
  { id: "documents", label: "Documents", icon: "ti-folder", tint: "amber" },
  { id: "reports", label: "Reports", icon: "ti-chart-bar", tint: "teal" },
  { id: "settings", label: "Settings", icon: "ti-settings", tint: "blue" },
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

const RANGES = ["Today", "This Week", "This Month", "Quarter", "This Year", "Custom"];
const gbp = (n) => "£" + n.toLocaleString("en-GB");
const toneVar = (t) => ({ color: `var(--${t})`, soft: `var(--${t}-soft)` });

/* ================================================================== */
/*  SHARED COMPONENTS                                                 */
/* ================================================================== */
function PageHead({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 className="font-head" style={{ fontSize: 27, fontWeight: 700 }}>{title}</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 2 }}>{sub}</div>
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

function Metric({ label, value, sub, color, subColor, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "16px 18px", cursor: onClick ? "pointer" : "default", transition: "border-color .15s", borderColor: hover && onClick ? color : "var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: ".8px", color: "var(--txt-2)", textTransform: "uppercase" }}>{label}</span>
        {onClick && <span style={{ fontSize: 13, color, opacity: hover ? 1 : 0.35, transform: hover ? "translateX(2px)" : "none", transition: "all .2s" }}>→</span>}
      </div>
      <div className="mono" style={{ fontSize: 25, fontWeight: 500, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: subColor || "var(--txt-3)", marginTop: 4 }}>{sub}</div>
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
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: cols.length > 4 ? 640 : 0, borderCollapse: "collapse", fontSize: 12.5 }}>
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

const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none", width: "100%" };
const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
const formCard = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 };
const demoBanner = { fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 };
const errBanner = { fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 };
const emptyCard = { color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" };
const rowActions = (DB, onEdit, onDel) => DB ? <span style={{ display: "flex", gap: 12 }}><i className="ti ti-pencil" onClick={onEdit} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={onDel} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null;

/* Shared confirm dialog. useConfirm() returns [confirmNode, ask].
   ask(message, onConfirm) opens the dialog; on confirm it runs onConfirm. */
function useConfirm() {
  const [state, setState] = useState(null); // { message, onConfirm }
  const ask = (message, onConfirm) => setState({ message, onConfirm });
  const node = state ? (
    <div onClick={() => setState(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, padding: 22, width: 420, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 16 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--red-soft)", color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-alert-triangle" style={{ fontSize: 18 }} /></span>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--txt)" }}>{state.message}</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <span onClick={() => setState(null)}><Btn icon="ti-x" label="Cancel" /></span>
          <span onClick={() => { const f = state.onConfirm; setState(null); f && f(); }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: "var(--red)", color: "#fff", border: "0.5px solid var(--red)" }}><i className="ti ti-trash" style={{ fontSize: 15 }} />Delete</span>
          </span>
        </div>
      </div>
    </div>
  ) : null;
  return [node, ask];
}

/* Shared: is the viewport phone-sized? */
function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const f = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}

/* Shared: load the customer list once, for dropdowns across pages */
function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const reload = () => { if (DB_READY) db.from("svc_customers").select("id,name,site").order("name", { ascending: true }).then(({ data }) => setCustomers(data || [])); };
  useEffect(reload, []);
  return [customers, reload];
}

/* Shared: load all properties (with their customer_id) */
function useProperties() {
  const [properties, setProperties] = useState([]);
  const reload = () => { if (DB_READY) db.from("svc_properties").select("*").order("address", { ascending: true }).then(({ data }) => setProperties(data || [])); };
  useEffect(reload, []);
  return [properties, reload];
}

/* Quick "add customer" inline popup */
function QuickAddCustomer({ user, onAdded, onClose }) {
  const [f, setF] = useState({ name: "", type: "Homeowner", area: "", contact: "", email: "", site: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.name.trim()) { setErr("Name required."); return; }
    if (!f.contact.trim() && !f.email.trim()) { setErr("Add a phone or email for this customer."); return; }
    setBusy(true);
    const { data, error } = await db.from("svc_customers").insert([{ ...f, name: f.name.trim(), user_id: user.id }]).select().single();
    if (!error && data && f.site.trim()) {
      await db.from("svc_properties").insert([{ customer_id: data.id, customer: data.name, address: f.site.trim(), prop_type: f.type === "Commercial" ? "Commercial" : "House", user_id: user.id }]);
    }
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onAdded(data); onClose();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, padding: 20, width: 520, maxWidth: "100%" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New customer</div>
        {err && <div style={errBanner}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={fld}>Customer name<input style={inp} placeholder="e.g. Sarah Connor" value={f.name} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label style={fld}>Type<select style={inp} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Homeowner", "Landlord", "Agency", "Commercial"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label style={fld}>Region<input style={inp} placeholder="e.g. Manchester" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></label>
          <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
          <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label style={fld}>Site address<input style={inp} placeholder="e.g. 14 Oak Street" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}><span onClick={save}><Btn icon="ti-device-floppy" label={busy ? "Saving…" : "Add customer"} primary /></span><span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span></div>
      </div>
    </div>
  );
}

/* Quick "add property" inline popup, tied to a customer */
function QuickAddProperty({ user, customerId, customerName, onAdded, onClose }) {
  const [address, setAddress] = useState(""); const [postcode, setPostcode] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!address.trim()) { setErr("Address required."); return; }
    setBusy(true);
    const { data, error } = await db.from("svc_properties").insert([{ address: address.trim(), postcode: postcode.trim(), customer_id: customerId, customer: customerName, user_id: user.id }]).select().single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onAdded(data); onClose();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, padding: 20, width: 380 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New property for {customerName}</div>
        {err && <div style={errBanner}>{err}</div>}
        <input style={{ ...inp, marginBottom: 8 }} placeholder="Address (e.g. 14 Oak Street)" value={address} autoFocus onChange={(e) => setAddress(e.target.value)} />
        <input style={inp} placeholder="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={busy ? "Saving…" : "Add"} primary /></span><span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span></div>
      </div>
    </div>
  );
}

/* Shared: customer + property cascade picker.
   form needs: customer_id, customer, property_id, site
   onSet(patch) merges fields into the form. */
function CustomerPropertyPicker({ user, customers, properties, reloadCustomers, reloadProperties, form, onSet }) {
  const [addCust, setAddCust] = useState(false);
  const [addProp, setAddProp] = useState(false);
  const custProps = properties.filter((p) => String(p.customer_id) === String(form.customer_id));

  return (
    <>
      <label style={fld}>Customer
        <select style={inp} value={form.customer_id || ""} onChange={(e) => {
          if (e.target.value === "__add") { setAddCust(true); return; }
          const c = customers.find((x) => String(x.id) === e.target.value);
          onSet({ customer_id: e.target.value ? +e.target.value : "", customer: c ? c.name : "", property_id: "", site: "" });
        }}>
          <option value="">— Select customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="__add">+ Add new customer…</option>
        </select>
      </label>
      <label style={fld}>Property
        <select style={inp} value={form.property_id || ""} disabled={!form.customer_id} onChange={(e) => {
          if (e.target.value === "__add") { setAddProp(true); return; }
          const p = custProps.find((x) => String(x.id) === e.target.value);
          onSet({ property_id: e.target.value ? +e.target.value : "", site: p ? [p.address, p.postcode].filter(Boolean).join(", ") : form.site });
        }}>
          <option value="">{form.customer_id ? (custProps.length ? "— Select property —" : "No properties yet") : "Select customer first"}</option>
          {custProps.map((p) => <option key={p.id} value={p.id}>{p.address}{p.postcode ? `, ${p.postcode}` : ""}</option>)}
          {form.customer_id && <option value="__add">+ Add new property…</option>}
        </select>
      </label>
      {addCust && <QuickAddCustomer user={user} onClose={() => setAddCust(false)} onAdded={(c) => { reloadCustomers(); onSet({ customer_id: c.id, customer: c.name, property_id: "", site: "" }); }} />}
      {addProp && form.customer_id && <QuickAddProperty user={user} customerId={form.customer_id} customerName={form.customer} onClose={() => setAddProp(false)} onAdded={(p) => { reloadProperties(); onSet({ property_id: p.id, site: [p.address, p.postcode].filter(Boolean).join(", ") }); }} />}
    </>
  );
}

/* ================================================================== */
/*  DASHBOARD                                                         */
/* ================================================================== */
function DashboardPage({ range, go, user }) {
  const [d, setD] = useState(null); // { customers, quotes, jobs, invoices }

  useEffect(() => {
    if (!DB_READY) { setD({ customers: [], quotes: [], jobs: [], invoices: [], certs: [] }); return; }
    Promise.all([
      db.from("svc_customers").select("*"),
      db.from("svc_quotes").select("*"),
      db.from("svc_jobs").select("*"),
      db.from("svc_invoices").select("*"),
      db.from("svc_certificates").select("*"),
    ]).then(([c, q, j, i, ce]) => setD({
      customers: c.data || [], quotes: q.data || [], jobs: j.data || [], invoices: i.data || [], certs: ce.data || [],
    }));
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = user ? user.email.split("@")[0].split(/[._]/)[0].replace(/^\w/, (x) => x.toUpperCase()) : "there";

  if (!d) return <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading dashboard…</div>;

  const today = new Date().toISOString().slice(0, 10);
  const openJobs = d.jobs.filter((j) => j.status !== "Completed" && j.status !== "Invoiced");
  const jobsToday = d.jobs.filter((j) => (j.created_at || "").slice(0, 10) === today).length;
  const collected = d.invoices.filter((v) => v.status === "Paid").reduce((s, v) => s + (+v.amount || 0), 0);
  const outstanding = d.invoices.filter((v) => v.status === "Sent" || v.status === "Overdue").reduce((s, v) => s + (+v.amount || 0), 0);
  const overdueCount = d.invoices.filter((v) => v.status === "Overdue").length;
  const openQuotes = d.quotes.filter((q) => q.status === "Sent" || q.status === "Draft");
  const quoteValue = openQuotes.reduce((s, q) => s + (+q.amount || 0), 0);
  const awaitingInvoice = d.jobs.filter((j) => j.status === "Completed").length;

  // 6-month revenue: collected (paid) vs outstanding (sent+overdue) per month
  const months = [];
  for (let k = 5; k >= 0; k--) { const dt = new Date(); dt.setMonth(dt.getMonth() - k); months.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, label: dt.toLocaleDateString("en-GB", { month: "short" }) }); }
  const series = months.map((m) => {
    let coll = 0, out = 0;
    d.invoices.forEach((v) => {
      const k = (v.created_at || v.due_date || "").slice(0, 7);
      if (k !== m.key) return;
      if (v.status === "Paid") coll += +v.amount || 0;
      else if (v.status === "Sent" || v.status === "Overdue") out += +v.amount || 0;
    });
    return { ...m, coll, out };
  });
  const maxVal = Math.max(1, ...series.map((s) => Math.max(s.coll, s.out)));
  // certs expiring within 90 days, soonest first
  const expiring = (d.certs || []).map((c) => ({ ...c, days: c.expiry_date ? Math.ceil((new Date(c.expiry_date + "T00:00:00") - new Date()) / 86400000) : 9999 })).filter((c) => c.days <= 90).sort((a, b) => a.days - b.days).slice(0, 5);

  // recent activity — newest records across tables
  const acts = [];
  d.invoices.forEach((v) => acts.push({ when: v.created_at, text: `Invoice ${v.status === "Paid" ? "paid" : "raised"} · ${v.ref || "—"} · ${gbp(+v.amount || 0)}`, tone: v.status === "Paid" ? "green" : v.status === "Overdue" ? "red" : "blue" }));
  d.quotes.forEach((q) => acts.push({ when: q.created_at, text: `Quote ${q.status?.toLowerCase() || "added"} · ${q.ref || "—"} · ${gbp(+q.amount || 0)}`, tone: q.status === "Approved" ? "green" : "amber" }));
  d.jobs.forEach((j) => acts.push({ when: j.created_at, text: `Job ${j.status?.toLowerCase() || "added"} · ${j.title}`, tone: j.status === "Completed" ? "green" : "blue" }));
  d.customers.forEach((c) => acts.push({ when: c.created_at, text: `New customer · ${c.name}`, tone: "brand" }));
  const recent = acts.filter((a) => a.when).sort((a, b) => new Date(b.when) - new Date(a.when)).slice(0, 5);
  const ago = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " hr ago";
    return Math.floor(s / 86400) + " days ago";
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <h2 className="font-head" style={{ fontSize: 30, fontWeight: 700 }}>Dashboard</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 2 }}>{greet}, {name} · {openJobs.length} open job{openJobs.length === 1 ? "" : "s"} · {overdueCount} overdue · {range}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Collected" value={gbp(collected)} sub="Paid invoices" color="var(--brand)" subColor="var(--green)" onClick={() => go("invoicing")} />
        <Metric label="Outstanding" value={gbp(outstanding)} sub={`${overdueCount} overdue`} color="var(--red)" onClick={() => go("invoicing")} />
        <Metric label="Open Jobs" value={openJobs.length} sub={`${jobsToday} added today`} color="var(--blue)" onClick={() => go("jobs")} />
        <Metric label="Open Quotes" value={openQuotes.length} sub={`${gbp(quoteValue)} potential`} color="var(--amber)" onClick={() => go("quotes")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Revenue — last 6 months" action="View invoices →" onAction={() => go("invoicing")}>
          <svg viewBox="0 0 380 140" style={{ width: "100%", height: 120 }}>
            <line x1="0" y1="108" x2="380" y2="108" stroke="var(--line)" strokeWidth="1" />
            {series.map((s, i) => {
              const x = 24 + i * 60; const ch = Math.round((s.coll / maxVal) * 80); const oh = Math.round((s.out / maxVal) * 80);
              return (
                <g key={s.key}>
                  <rect x={x} y={108 - ch} width="16" height={ch} rx="2" fill="var(--brand)" />
                  <rect x={x + 18} y={108 - oh} width="16" height={oh} rx="2" fill="var(--amber)" />
                  <text x={x + 17} y="124" fontSize="9" fill="var(--txt-3)" textAnchor="middle">{s.label}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
            <span style={{ fontSize: 10.5, color: "var(--txt-2)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--brand)" }} />Collected</span>
            <span style={{ fontSize: 10.5, color: "var(--txt-2)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--amber)" }} />Outstanding</span>
          </div>
        </Panel>
        <Panel title="Certificates expiring" action="View all" onAction={() => go("certificates")}>
          {expiring.length === 0 ? <div style={{ fontSize: 12, color: "var(--txt-3)" }}>No certificates due in the next 90 days.</div> : expiring.map((c, i) => {
            const tone = c.days <= 7 ? "red" : c.days <= 30 ? "amber" : "blue";
            return (
              <div key={c.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < expiring.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 11.5 }}>{c.cert_type}{c.site ? ` · ${c.site}` : ""}</span>
                <Pill text={c.days < 0 ? "expired" : `${c.days}d`} tone={tone} />
              </div>
            );
          })}
        </Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Jobs by Stage" action="View all" onAction={() => go("jobs")}>
          {["New", "Scheduled", "In Progress", "Completed", "Invoiced"].map((s, i, arr) => {
            const n = d.jobs.filter((j) => j.status === s).length;
            const tone = s === "Completed" ? "green" : s === "In Progress" ? "amber" : s === "Invoiced" ? "brand" : "blue";
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < arr.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 12.5 }}>{s}</span>
                <Pill text={String(n)} tone={tone} />
              </div>
            );
          })}
        </Panel>
        <Panel title="Recent Activity">
          {recent.length === 0 ? <div style={{ fontSize: 12, color: "var(--txt-3)" }}>No activity yet. Add a customer, quote or job to get started.</div> : recent.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < recent.length - 1 ? 13 : 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${a.tone})`, marginTop: 5, flexShrink: 0 }} />
              <div><div style={{ fontSize: 11.5 }}>{a.text}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{ago(a.when)}</div></div>
            </div>
          ))}
        </Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Metric label="Awaiting Invoice" value={awaitingInvoice} sub="Completed jobs" color="var(--blue)" />
        <Metric label="Total Quotes" value={d.quotes.length} sub={`${d.quotes.filter((q) => q.status === "Approved").length} approved`} color="var(--amber)" />
        <Metric label="Active Customers" value={d.customers.length} sub="In your database" color="var(--txt)" subColor="var(--green)" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  CUSTOMERS                                                         */
/* ================================================================== */
function CustomersPage({ user, openCustomerId, clearOpen, go }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmNode, ask] = useConfirm();
  const blank = { name: "", area: "", contact: "", email: "", type: "Homeowner", site: "", postcode: "", prop_type: "House" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_customers").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data || []); });
  }, []);

  // open a specific customer's detail when arriving from search
  useEffect(() => {
    if (openCustomerId && rows) {
      const c = rows.find((x) => String(x.id) === String(openCustomerId));
      if (c) { setDetail(c); if (clearOpen) clearOpen(); }
    }
  }, [openCustomerId, rows]);

  const refresh = async () => { const { data } = await db.from("svc_customers").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (c) => { setForm({ name: c.name || "", area: c.area || "", contact: c.contact || "", email: c.email || "", type: c.type || "Homeowner", site: c.site || "", postcode: "", prop_type: "House" }); setEditId(c.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.name.trim()) { setErr("Customer name is required."); return; }
    if (!form.contact.trim() && !form.email.trim()) { setErr("Please add a phone number or email so you can contact this customer."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys in supabase.js to save for real."); return; }
    setErr("");
    // only the customer's own columns go to svc_customers
    const custFields = { name: form.name, area: form.area, contact: form.contact, email: form.email, type: form.type, site: form.site };
    if (editId) {
      const { error } = await db.from("svc_customers").update(custFields).eq("id", editId);
      if (error) { setErr(error.message); return; }
    } else {
      const { data: newCust, error: cErr } = await db.from("svc_customers").insert([{ ...custFields, user_id: user.id }]).select().single();
      if (cErr) { setErr(cErr.message); return; }
      // auto-create their first property from the address fields
      if (newCust && form.site.trim()) {
        const { error: pErr } = await db.from("svc_properties").insert([{ customer_id: newCust.id, customer: newCust.name, address: form.site.trim(), postcode: form.postcode.trim(), prop_type: form.prop_type, user_id: user.id }]);
        if (pErr) { setErr("Customer saved, but property wasn't created: " + pErr.message); return; }
      }
    }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const askDelete = (c) => {
    if (!c.id || !DB_READY) return;
    db.from("svc_properties").select("id").eq("customer_id", c.id).then(({ data }) => {
      const n = (data || []).length;
      const msg = <span>Delete customer <strong>{c.name}</strong>?{n > 0 ? <> This will also delete their <strong>{n} propert{n === 1 ? "y" : "ies"}</strong>.</> : ""} Their quotes, jobs and invoices will remain but won't be linked to a customer. This can't be undone.</span>;
      ask(msg, async () => {
        await db.from("svc_properties").delete().eq("customer_id", c.id);
        await db.from("svc_customers").delete().eq("id", c.id);
        refresh();
      });
    });
  };

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
            <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
            <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          {!editId && (
            <>
              <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", margin: "16px 0 10px" }}>First property <span style={{ textTransform: "none", color: "var(--txt-3)" }}>(optional — adds to Properties, add more later)</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <label style={fld}>Address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></label>
                <label style={fld}>Postcode<input style={inp} placeholder="e.g. M1 2AB" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></label>
                <label style={fld}>Property type<select style={inp} value={form.prop_type} onChange={(e) => setForm({ ...form, prop_type: e.target.value })}>{["House", "Flat", "Bungalow", "Commercial", "HMO", "Other"].map((x) => <option key={x}>{x}</option>)}</select></label>
              </div>
            </>
          )}
          {editId && (
            <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 14 }}>Manage this customer's addresses in the <strong>Properties</strong> tab.</div>
          )}
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update customer" : "Save customer"} primary /></span></div>
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, area, site or type…" style={{ ...inp, marginBottom: 14 }} />
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading customers…</div>
      ) : list.length === 0 ? (
        <div style={emptyCard}>No customers yet. Click "Add customer" to create your first one.</div>
      ) : (
        <Table cols={["Customer", "Type", "Region", "Phone", "Site", "Jobs", "Spend", ""]}>
          {list.map((c, i) => (
            <tr key={c.id || i}>
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{(c.name || "?").split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                  <span onClick={() => setDetail(c)} style={{ fontWeight: 500, cursor: "pointer", color: "var(--brand)" }}>{c.name}</span>
                </div>
              </Td>
              <Td><Pill text={c.type || "—"} tone={c.type === "Commercial" ? "blue" : c.type === "Agency" ? "amber" : "green"} /></Td>
              <Td color="var(--txt-2)">{c.area || "—"}</Td>
              <Td color="var(--txt-2)">{c.contact || "—"}</Td>
              <Td color="var(--txt-2)">{c.site || "—"}</Td>
              <Td color="var(--txt-2)">{c.jobs != null ? c.jobs : "—"}</Td>
              <Td>{c.spend != null ? gbp(c.spend) : "—"}</Td>
              <Td>{c.id && rowActions(DB_READY, () => openEdit(c), () => askDelete(c))}</Td>
            </tr>
          ))}
        </Table>
      )}
      {detail && <CustomerDetail customer={detail} onClose={() => setDetail(null)} go={go} />}
      {confirmNode}
    </div>
  );
}

/* Customer detail — shows everything linked to one customer */
function CustomerDetail({ customer, onClose, go }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    if (!DB_READY) { setData({ quotes: [], jobs: [], invoices: [], certs: [], bookings: [], documents: [], properties: [] }); return () => window.removeEventListener("keydown", onKey); }
    Promise.all([
      db.from("svc_quotes").select("*").eq("customer_id", customer.id),
      db.from("svc_jobs").select("*").eq("customer_id", customer.id),
      db.from("svc_invoices").select("*").eq("customer_id", customer.id),
      db.from("svc_certificates").select("*").eq("customer_id", customer.id),
      db.from("svc_bookings").select("*").eq("customer_id", customer.id),
      db.from("svc_documents").select("*").eq("customer_id", customer.id),
      db.from("svc_properties").select("*").eq("customer_id", customer.id),
    ]).then(([q, j, i, c, b, dc, p]) => setData({ quotes: q.data || [], jobs: j.data || [], invoices: i.data || [], certs: c.data || [], bookings: b.data || [], documents: dc.data || [], properties: p.data || [] }));
    return () => window.removeEventListener("keydown", onKey);
  }, [customer.id]);

  const nav = (page) => { onClose(); if (go) go(page); };

  const Section = ({ title, items, render }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 8 }}>{title} ({items.length})</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: "var(--txt-3)" }}>None yet.</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{items.map(render)}</div>}
    </div>
  );
  const line = (left, right, tone, onClick) => (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>{onClick && <i className="ti ti-arrow-up-right" style={{ fontSize: 13, color: "var(--brand)" }} />}{left}</span>{right && <Pill text={right} tone={tone || "blue"} />}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "0.5px solid var(--line)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="font-head" style={{ fontSize: 18, fontWeight: 700 }}>{customer.name}</div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 3 }}>{[customer.type, customer.area, customer.site].filter(Boolean).join(" · ")}</div>
            <div style={{ fontSize: 12, color: "var(--txt-2)", marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
              {customer.contact && <span><i className="ti ti-phone" style={{ fontSize: 13, marginRight: 4 }} />{customer.contact}</span>}
              {customer.email && <span><i className="ti ti-mail" style={{ fontSize: 13, marginRight: 4 }} />{customer.email}</span>}
            </div>
          </div>
          <button onClick={onClose} title="Close (Esc)" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--line)", background: "var(--panel-2)", color: "var(--txt-2)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
          {!data ? <div style={{ color: "var(--txt-3)", fontSize: 13 }}>Loading…</div> : (
            <>
              <Section title="Properties" items={data.properties} render={(p) => <div key={p.id}>{line(p.address, p.postcode || "", "brand", () => nav("properties"))}</div>} />
              <Section title="Quotes" items={data.quotes} render={(q) => <div key={q.id}>{line(`${q.ref || "—"} · ${q.description || ""}`, gbp(+q.amount || 0), "amber", () => nav("quotes"))}</div>} />
              <Section title="Jobs" items={data.jobs} render={(j) => <div key={j.id}>{line(j.title, j.status, j.status === "Completed" ? "green" : "blue", () => nav("jobs"))}</div>} />
              <Section title="Invoices" items={data.invoices} render={(v) => <div key={v.id}>{line(`${v.ref || "—"} · ${gbp(+v.amount || 0)}`, v.status, v.status === "Paid" ? "green" : v.status === "Overdue" ? "red" : "blue", () => nav("invoicing"))}</div>} />
              <Section title="Bookings" items={data.bookings} render={(b) => <div key={b.id}>{line(`${b.booking_date || ""} ${b.booking_time || ""} · ${b.title}`, b.engineer || "Unassigned", "brand", () => nav("diary"))}</div>} />
              <Section title="Certificates" items={data.certs} render={(c) => <div key={c.id}>{line(`${c.cert_type} · ${c.site || ""}`, c.expiry_date ? `exp ${c.expiry_date}` : "—", "green", () => nav("certificates"))}</div>} />
              <Section title="Documents" items={data.documents} render={(dc) => <div key={dc.id}>{line(dc.name, dc.cat, "blue", () => nav("documents"))}</div>} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
/* ================================================================== */
/*  PROPERTIES                                                        */
/* ================================================================== */
function PropertiesPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [confirmNode, ask] = useConfirm();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { customer_id: "", customer: "", address: "", postcode: "", prop_type: "House", notes: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_properties").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data || []); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_properties").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (p) => { setForm({ customer_id: p.customer_id || "", customer: p.customer || "", address: p.address || "", postcode: p.postcode || "", prop_type: p.prop_type || "House", notes: p.notes || "" }); setEditId(p.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.address.trim()) { setErr("Address is required."); return; }
    if (!form.customer_id) { setErr("Please choose which customer this property belongs to."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, customer_id: form.customer_id || null };
    let error;
    if (editId) ({ error } = await db.from("svc_properties").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_properties").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const askDelete = (p) => {
    if (!p.id || !DB_READY) return;
    const finishProp = async () => { await db.from("svc_properties").delete().eq("id", p.id); refresh(); };
    if (!p.customer_id) {
      ask(<span>Delete property <strong>{p.address}</strong>? This can't be undone.</span>, finishProp);
      return;
    }
    db.from("svc_properties").select("id").eq("customer_id", p.customer_id).then(({ data }) => {
      const others = (data || []).filter((x) => String(x.id) !== String(p.id)).length;
      if (others > 0) {
        ask(<span>Delete property <strong>{p.address}</strong>? <strong>{p.customer}</strong> has {others} other propert{others === 1 ? "y" : "ies"}, which will be kept. This can't be undone.</span>, finishProp);
      } else {
        ask(<span>This is <strong>{p.customer}</strong>'s only property. Delete the property <strong>and the customer</strong>? Their quotes, jobs and invoices will remain but won't be linked to a customer. This can't be undone.</span>, async () => {
          await db.from("svc_properties").delete().eq("id", p.id);
          await db.from("svc_customers").delete().eq("id", p.customer_id);
          refresh();
        });
      }
    });
  };

  const data = rows || [];
  const list = data.filter((p) => ((p.address || "") + (p.postcode || "") + (p.customer || "") + (p.prop_type || "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fade-in">
      <PageHead title="Properties" sub={rows ? `${data.length} ${DB_READY ? "" : "(demo) "}propert${data.length === 1 ? "y" : "ies"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add property"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit property" : "New property"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Belongs to customer
              <select style={inp} value={form.customer_id || ""} onChange={(e) => { const c = customers.find((x) => String(x.id) === e.target.value); setForm({ ...form, customer_id: e.target.value ? +e.target.value : "", customer: c ? c.name : "" }); }}>
                <option value="">— Select customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={fld}>Address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label style={fld}>Postcode<input style={inp} placeholder="e.g. M1 2AB" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></label>
            <label style={fld}>Type<select style={inp} value={form.prop_type} onChange={(e) => setForm({ ...form, prop_type: e.target.value })}>{["House", "Flat", "Bungalow", "Commercial", "HMO", "Other"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={{ ...fld, gridColumn: "span 2" }}>Notes<input style={inp} placeholder="e.g. Access via rear, boiler in loft" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update property" : "Save property"} primary /></span></div>
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by address, postcode, customer or type…" style={{ ...inp, marginBottom: 14 }} />
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading properties…</div>
      ) : list.length === 0 ? (
        <div style={emptyCard}>No properties yet. Add a customer first, then add their property here (or use "+ Add new property" inside any customer dropdown).</div>
      ) : (
        <Table cols={["Address", "Postcode", "Type", "Customer", ""]}>
          {list.map((p) => (
            <tr key={p.id}>
              <Td><span style={{ fontWeight: 500 }}>{p.address}</span>{p.notes ? <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{p.notes}</div> : null}</Td>
              <Td color="var(--txt-2)">{p.postcode || "—"}</Td>
              <Td><Pill text={p.prop_type || "—"} tone={p.prop_type === "Commercial" || p.prop_type === "HMO" ? "blue" : "green"} /></Td>
              <Td color="var(--txt-2)">{p.customer || "—"}</Td>
              <Td>{p.id && rowActions(DB_READY, () => openEdit(p), () => askDelete(p))}</Td>
            </tr>
          ))}
        </Table>
      )}
      {confirmNode}
    </div>
  );
}

/* ================================================================== */
function QuotesPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { ref: "", customer_id: "", customer: "", property_id: "", site: "", description: "", amount: "", status: "Draft", quote_date: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_quotes").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_quotes").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (q) => { setForm({ ref: q.ref || "", customer_id: q.customer_id || "", customer: q.customer || "", property_id: q.property_id || "", site: q.site || "", description: q.description || "", amount: q.amount || "", status: q.status || "Draft", quote_date: q.quote_date || "" }); setEditId(q.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.customer.trim()) { setErr("Please select a customer."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, amount: form.amount === "" ? 0 : +form.amount, customer_id: form.customer_id || null, property_id: form.property_id || null };
    if (!payload.quote_date) delete payload.quote_date;
    let error;
    if (editId) ({ error } = await db.from("svc_quotes").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_quotes").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_quotes").delete().eq("id", id); refresh(); } };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (q) => ask(<span>Delete quote <strong>{q.ref || "(no ref)"}</strong> for <strong>{q.customer || "—"}</strong>? This can't be undone.</span>, () => remove(q.id));

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
            <CustomerPropertyPicker user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} form={form} onSet={(patch) => setForm({ ...form, ...patch })} />
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
              <Td>{q.id && rowActions(DB_READY, () => openEdit(q), () => askDelete(q))}</Td>
            </tr>
          ))}
        </Table>
      )}
      {confirmNode}
    </div>
  );
}

/* ================================================================== */
/*  JOBS  (kanban)                                                    */
/* ================================================================== */

/* Dialog: raise an invoice against a job (Deposit / Part / Final / Full) */
function CreateInvoiceForJob({ user, job, alreadyInvoiced, onClose, onDone }) {
  const total = +job.value || 0;
  const outstanding = Math.max(0, total - alreadyInvoiced);
  const [invType, setInvType] = useState(alreadyInvoiced > 0 ? "Final" : "Full");
  const [mode, setMode] = useState("amount"); // amount | percent (for deposit)
  const [amount, setAmount] = useState(outstanding ? String(outstanding) : "");
  const [percent, setPercent] = useState("30");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  // when switching to Deposit default to percent mode; Final/Full default to outstanding
  const pickType = (t) => {
    setInvType(t);
    if (t === "Deposit") { setMode("percent"); }
    else if (t === "Final" || t === "Full") { setMode("amount"); setAmount(String(outstanding)); }
  };
  const computedAmount = mode === "percent" ? Math.round(total * (+percent || 0)) / 100 : (+amount || 0);

  const save = async () => {
    if (!DB_READY) { setErr("Database not connected."); return; }
    if (computedAmount <= 0) { setErr("Enter an amount greater than zero."); return; }
    setBusy(true); setErr("");
    const prefix = { Deposit: "DEP", Part: "PRT", Final: "INV", Full: "INV" }[invType] || "INV";
    const payload = {
      ref: ref.trim() || `${prefix}-${Date.now().toString().slice(-5)}`,
      customer_id: job.customer_id || null, customer: job.customer || "",
      property_id: job.property_id || null, site: job.site || "",
      job_id: job.id, inv_type: invType,
      amount: computedAmount, status: "Sent", user_id: user.id,
    };
    const { error } = await db.from("svc_invoices").insert([payload]);
    if (error) { setErr(error.message); setBusy(false); return; }
    // if this invoice clears the balance, mark job Invoiced
    if (alreadyInvoiced + computedAmount >= total && total > 0) await db.from("svc_jobs").update({ status: "Invoiced" }).eq("id", job.id);
    setBusy(false); onDone();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, padding: 20, width: 460, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invoice for: {job.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginBottom: 14 }}>{job.customer || "—"}{job.site ? ` · ${job.site}` : ""}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}><div style={{ fontSize: 9.5, letterSpacing: 1, color: "var(--txt-3)", textTransform: "uppercase" }}>Job total</div><div style={{ fontSize: 15, fontWeight: 600 }}>{gbp(total)}</div></div>
          <div style={{ flex: 1, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}><div style={{ fontSize: 9.5, letterSpacing: 1, color: "var(--txt-3)", textTransform: "uppercase" }}>Invoiced</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--blue)" }}>{gbp(alreadyInvoiced)}</div></div>
          <div style={{ flex: 1, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 11px" }}><div style={{ fontSize: 9.5, letterSpacing: 1, color: "var(--txt-3)", textTransform: "uppercase" }}>Outstanding</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--amber)" }}>{gbp(outstanding)}</div></div>
        </div>
        {err && <div style={errBanner}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={fld}>Invoice type<select style={inp} value={invType} onChange={(e) => pickType(e.target.value)}>{["Full", "Deposit", "Part", "Final"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label style={fld}>Reference (optional)<input style={inp} placeholder="auto-generated" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
        </div>
        <div style={{ marginTop: 10 }}>
          {invType === "Deposit" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <span onClick={() => setMode("percent")} style={{ cursor: "pointer", fontSize: 11.5, padding: "5px 11px", borderRadius: 7, background: mode === "percent" ? "var(--brand)" : "var(--panel-2)", color: mode === "percent" ? "#fff" : "var(--txt-2)", border: "0.5px solid var(--line)" }}>Percentage</span>
              <span onClick={() => setMode("amount")} style={{ cursor: "pointer", fontSize: 11.5, padding: "5px 11px", borderRadius: 7, background: mode === "amount" ? "var(--brand)" : "var(--panel-2)", color: mode === "amount" ? "#fff" : "var(--txt-2)", border: "0.5px solid var(--line)" }}>Fixed amount</span>
            </div>
          )}
          {mode === "percent" ? (
            <label style={fld}>Deposit percentage of job total
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input style={{ ...inp, width: 100 }} type="number" value={percent} onChange={(e) => setPercent(e.target.value)} /><span style={{ fontSize: 13, color: "var(--txt-2)" }}>% = <strong style={{ color: "var(--txt)" }}>{gbp(computedAmount)}</strong></span>
              </div>
            </label>
          ) : (
            <label style={fld}>Amount (£)<input style={inp} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span>
          <span onClick={save}><Btn icon="ti-send" label={busy ? "Creating…" : `Raise ${invType} invoice`} primary /></span>
        </div>
      </div>
    </div>
  );
}

function JobsPage({ user }) {
  const stages = ["New", "Scheduled", "In Progress", "Completed", "Invoiced"];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoiceFor, setInvoiceFor] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { title: "", customer_id: "", customer: "", property_id: "", site: "", engineer: "", priority: "Medium", value: "", status: "New" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_jobs").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
    db.from("svc_invoices").select("job_id,amount").then(({ data }) => setInvoices(data || []));
  }, []);

  const invoicedForJob = (jobId) => invoices.filter((v) => String(v.job_id) === String(jobId)).reduce((s, v) => s + (+v.amount || 0), 0);
  const reloadInvoices = () => db.from("svc_invoices").select("job_id,amount").then(({ data }) => setInvoices(data || []));

  const refresh = async () => { const { data } = await db.from("svc_jobs").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (j) => { setForm({ title: j.title || "", customer_id: j.customer_id || "", customer: j.customer || "", property_id: j.property_id || "", site: j.site || "", engineer: j.engineer || "", priority: j.priority || "Medium", value: j.value || "", status: j.status || "New" }); setEditId(j.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.title.trim()) { setErr("Job title is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, value: form.value === "" ? 0 : +form.value, customer_id: form.customer_id || null, property_id: form.property_id || null };
    let error;
    if (editId) ({ error } = await db.from("svc_jobs").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_jobs").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_jobs").delete().eq("id", id); refresh(); } };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (j) => ask(<span>Delete job <strong>{j.title}</strong>{j.customer ? <> for <strong>{j.customer}</strong></> : ""}? This can't be undone.</span>, () => remove(j.id));
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
            <CustomerPropertyPicker user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} form={form} onSet={(patch) => setForm({ ...form, ...patch })} />
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--txt-2)", marginBottom: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><i className="ti ti-user-cog" style={{ fontSize: 13 }} />{j.engineer || "Unassigned"}</span>
                        {j.value ? <span style={{ fontWeight: 600, color: "var(--txt)" }}>{gbp(j.value)}</span> : null}
                      </div>
                      {j.id && (+j.value || 0) > 0 && (() => {
                        const inv = invoicedForJob(j.id); const out = Math.max(0, (+j.value || 0) - inv);
                        return inv > 0 ? (
                          <div style={{ fontSize: 10, color: "var(--txt-3)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                            <span>Invoiced {gbp(inv)}</span>
                            <span style={{ color: out > 0 ? "var(--amber)" : "var(--green)" }}>{out > 0 ? `${gbp(out)} left` : "Paid in full"}</span>
                          </div>
                        ) : null;
                      })()}
                      {j.id && DB_READY && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "0.5px solid var(--line)", paddingTop: 8 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            {stages.indexOf(j.status) > 0 && <i className="ti ti-arrow-left" onClick={() => move(j, -1)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Move back" />}
                            {stages.indexOf(j.status) < stages.length - 1 && <i className="ti ti-arrow-right" onClick={() => move(j, 1)} style={{ fontSize: 14, color: "var(--brand)", cursor: "pointer" }} title="Move forward" />}
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <i className="ti ti-receipt" onClick={() => setInvoiceFor(j)} style={{ fontSize: 14, color: "var(--green)", cursor: "pointer" }} title="Create invoice" />
                            <i className="ti ti-pencil" onClick={() => openEdit(j)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" />
                            <i className="ti ti-trash" onClick={() => askDelete(j)} style={{ fontSize: 14, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" />
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
      {invoiceFor && <CreateInvoiceForJob user={user} job={invoiceFor} alreadyInvoiced={invoicedForJob(invoiceFor.id)} onClose={() => setInvoiceFor(null)} onDone={() => { setInvoiceFor(null); refresh(); reloadInvoices(); }} />}
      {confirmNode}
    </div>
  );
}

/* ================================================================== */
/*  DIARY  (week view)                                                */
/* ================================================================== */
function DiaryPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { title: "", customer_id: "", customer: "", property_id: "", site: "", engineer: "", booking_date: "", booking_time: "", priority: "Medium" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_bookings").select("*").order("booking_date", { ascending: true })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_bookings").select("*").order("booking_date", { ascending: true }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (b) => { setForm({ title: b.title || "", customer_id: b.customer_id || "", customer: b.customer || "", property_id: b.property_id || "", site: b.site || "", engineer: b.engineer || "", booking_date: b.booking_date || "", booking_time: b.booking_time || "", priority: b.priority || "Medium" }); setEditId(b.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.title.trim()) { setErr("Booking title is required."); return; }
    if (!form.booking_date) { setErr("Please choose a date."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, customer_id: form.customer_id || null, property_id: form.property_id || null };
    if (!payload.booking_time) delete payload.booking_time;
    let error;
    if (editId) ({ error } = await db.from("svc_bookings").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_bookings").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_bookings").delete().eq("id", id); refresh(); } };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (b) => ask(<span>Delete booking <strong>{b.title}</strong>{b.booking_date ? <> on <strong>{b.booking_date}</strong></> : ""}? This can't be undone.</span>, () => remove(b.id));

  const data = rows || [];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  // group by date
  const byDate = {};
  data.forEach((b) => { const k = b.booking_date || "No date"; (byDate[k] = byDate[k] || []).push(b); });
  const dates = Object.keys(byDate).sort();
  const fmtDay = (iso) => iso === "No date" ? "No date" : new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fade-in">
      <PageHead title="Diary" sub={rows ? `${data.length} booking${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "New booking"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit booking" : "New booking"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Booking title<input style={inp} placeholder="e.g. Boiler service" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label style={fld}>Date<input style={inp} type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></label>
            <label style={fld}>Time<input style={inp} type="time" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} /></label>
            <CustomerPropertyPicker user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} form={form} onSet={(patch) => setForm({ ...form, ...patch })} />
            <label style={fld}>Engineer<input style={inp} placeholder="e.g. Dave R." value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} /></label>
            <label style={fld}>Priority<select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update booking" : "Save booking"} primary /></span></div>
        </div>
      )}
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading diary…</div>
      ) : data.length === 0 ? (
        <div style={emptyCard}>No bookings yet. Click "New booking" to schedule your first job.</div>
      ) : (
        dates.map((dk) => (
          <div key={dk} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 9 }}>{fmtDay(dk)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byDate[dk].sort((a, b) => (a.booking_time || "").localeCompare(b.booking_time || "")).map((b) => {
                const t = toneVar(toneFor[b.priority] || "blue");
                return (
                  <div key={b.id} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderLeft: `2px solid ${t.color}`, borderRadius: 8, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.color, fontFamily: "monospace", minWidth: 46 }}>{b.booking_time || "—"}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{b.title}</div>
                        <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{b.customer || "—"}{b.site ? ` · ${b.site}` : ""}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 11, color: "var(--txt-2)", display: "flex", alignItems: "center", gap: 5 }}><i className="ti ti-user-cog" style={{ fontSize: 13 }} />{b.engineer || "Unassigned"}</span>
                      {rowActions(DB_READY, () => openEdit(b), () => askDelete(b))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      {confirmNode}
    </div>
  );
}

/* ================================================================== */
/*  INVOICING                                                         */
/* ================================================================== */
function InvoicingPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { ref: "", customer_id: "", customer: "", property_id: "", site: "", amount: "", due_date: "", status: "Draft" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_invoices").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_invoices").select("*").order("created_at", { ascending: false }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (v) => { setForm({ ref: v.ref || "", customer_id: v.customer_id || "", customer: v.customer || "", property_id: v.property_id || "", site: v.site || "", amount: v.amount || "", due_date: v.due_date || "", status: v.status || "Draft" }); setEditId(v.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.customer.trim()) { setErr("Please select a customer."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, amount: form.amount === "" ? 0 : +form.amount, customer_id: form.customer_id || null, property_id: form.property_id || null };
    if (!payload.due_date) delete payload.due_date;
    let error;
    if (editId) ({ error } = await db.from("svc_invoices").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_invoices").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_invoices").delete().eq("id", id); refresh(); } };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (v) => ask(<span>Delete invoice <strong>{v.ref || "(no ref)"}</strong> for <strong>{v.customer || "—"}</strong> ({gbp(+v.amount || 0)})? This can't be undone.</span>, () => remove(v.id));

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
            <CustomerPropertyPicker user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} form={form} onSet={(patch) => setForm({ ...form, ...patch })} />
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
        <Table cols={["Ref", "Type", "Customer", "Amount", "Due date", "Status", ""]}>
          {data.map((v, i) => (
            <tr key={v.id || i}>
              <Td><span style={{ fontWeight: 500, fontFamily: "monospace" }}>{v.ref || "—"}</span></Td>
              <Td>{v.inv_type ? <Pill text={v.inv_type} tone={v.inv_type === "Deposit" ? "amber" : v.inv_type === "Part" ? "blue" : "green"} /> : <span style={{ color: "var(--txt-3)" }}>—</span>}</Td>
              <Td>{v.customer}</Td>
              <Td>{gbp(v.amount || 0)}</Td>
              <Td color="var(--txt-2)">{v.due_date || "—"}</Td>
              <Td><Pill text={v.status} tone={v.status === "Paid" ? "green" : v.status === "Overdue" ? "red" : v.status === "Sent" ? "blue" : "amber"} /></Td>
              <Td>{v.id && rowActions(DB_READY, () => openEdit(v), () => askDelete(v))}</Td>
            </tr>
          ))}
        </Table>
      )}
      {confirmNode}
    </div>
  );
}

/* ================================================================== */
/*  CERTIFICATES                                                      */
/* ================================================================== */
function CertificatesPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const TYPES = ["Gas Safety (CP12)", "EICR", "EIC (Installation)", "Boiler Service", "PAT Testing", "Completion Certificate", "Other"];
  const blank = { cert_type: "Gas Safety (CP12)", customer_id: "", customer: "", property_id: "", site: "", ref: "", issue_date: "", expiry_date: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_certificates").select("*").order("expiry_date", { ascending: true })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_certificates").select("*").order("expiry_date", { ascending: true }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (c) => { setForm({ cert_type: c.cert_type || "Other", customer_id: c.customer_id || "", customer: c.customer || "", property_id: c.property_id || "", site: c.site || "", ref: c.ref || "", issue_date: c.issue_date || "", expiry_date: c.expiry_date || "" }); setEditId(c.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.expiry_date) { setErr("Please set an expiry date."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, customer_id: form.customer_id || null, property_id: form.property_id || null };
    if (!payload.issue_date) delete payload.issue_date;
    let error;
    if (editId) ({ error } = await db.from("svc_certificates").update(payload).eq("id", editId));
    else ({ error } = await db.from("svc_certificates").insert([{ ...payload, user_id: user.id }]));
    if (error) { setErr(error.message); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };
  const remove = async (id) => { if (id && DB_READY) { await db.from("svc_certificates").delete().eq("id", id); refresh(); } };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (c) => ask(<span>Delete <strong>{c.cert_type}</strong>{c.customer || c.site ? <> for <strong>{c.customer || c.site}</strong></> : ""}? This can't be undone.</span>, () => remove(c.id));

  const iconForType = (ty) => /gas|cp12|boiler/i.test(ty) ? "ti-flame" : /eicr|eic|pat|electric/i.test(ty) ? "ti-bolt" : /completion/i.test(ty) ? "ti-circle-check" : "ti-shield-check";
  const daysLeft = (iso) => Math.ceil((new Date(iso + "T00:00:00") - new Date()) / 86400000);
  const data = (rows || []).map((c) => ({ ...c, days: c.expiry_date ? daysLeft(c.expiry_date) : 9999 })).sort((a, b) => a.days - b.days);
  const urgent = data.filter((c) => c.days <= 7).length;
  const soon = data.filter((c) => c.days > 7 && c.days <= 30).length;

  return (
    <div className="fade-in">
      <PageHead title="Certificates" sub={rows ? `${data.length} certificate${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add certificate"} primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Tracked items" value={data.length} sub="Across all sites" color="var(--blue)" />
        <Metric label="Urgent (≤7 days)" value={urgent} sub="Renew now" color="var(--red)" />
        <Metric label="Due soon (≤30 days)" value={soon} sub="Schedule renewal" color="var(--amber)" />
        <Metric label="Valid" value={data.length - urgent - soon} sub="In date" color="var(--green)" />
      </div>
      {adding && (
        <div style={formCard}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit certificate" : "New certificate"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Type<select style={inp} value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <CustomerPropertyPicker user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} form={form} onSet={(patch) => setForm({ ...form, ...patch })} />
            <label style={fld}>Issue date<input style={inp} type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></label>
            <label style={fld}>Expiry date<input style={inp} type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></label>
            <label style={fld}>Site / address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></label>
            <label style={{ ...fld, gridColumn: "span 2" }}>Reference / notes<input style={inp} placeholder="e.g. Landlord gas safety record" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update certificate" : "Save certificate"} primary /></span></div>
        </div>
      )}
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Certificate timeline — soonest first</div>
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading certificates…</div>
      ) : data.length === 0 ? (
        <div style={emptyCard}>No certificates yet. Click "Add certificate" to track your first one.</div>
      ) : (
      <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "6px 18px" }}>
        {data.map((c, i) => {
          const tone = c.days <= 7 ? "red" : c.days <= 30 ? "amber" : "green";
          const t = toneVar(tone);
          const status = c.days <= 7 ? "Urgent" : c.days <= 30 ? "Due soon" : "Valid";
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < data.length - 1 ? "0.5px solid var(--line)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${iconForType(c.cert_type)}`} style={{ fontSize: 16 }} /></span>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{c.cert_type}</div><div style={{ fontSize: 11, color: "var(--txt-3)" }}>{[c.customer, c.site, c.ref].filter(Boolean).join(" · ") || "—"}</div></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{c.days < 0 ? `expired ${-c.days}d ago` : `in ${c.days} days`}</span>
                <Pill text={status} tone={tone} />
                {rowActions(DB_READY, () => openEdit(c), () => askDelete(c))}
              </div>
            </div>
          );
        })}
      </div>
      )}
      {confirmNode}
    </div>
  );
}

/* ================================================================== */
/*  DOCUMENTS                                                         */
/* ================================================================== */
const DOC_BUCKET = "svc-documents";
const fmtSize = (b) => b == null ? "—" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
const iconFor = (cat, name) => {
  const n = (name || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(n)) return { icon: "ti-photo", tone: "blue" };
  if (cat === "Certificates") return { icon: "ti-shield-check", tone: "green" };
  if (cat === "Invoices") return { icon: "ti-receipt", tone: "amber" };
  if (cat === "Quotes") return { icon: "ti-file-dollar", tone: "brand" };
  return { icon: "ti-file", tone: "blue" };
};
const isImage = (name) => /\.(png|jpe?g|gif|webp|heic)$/i.test(name || "");
const isPdf = (name) => /\.pdf$/i.test(name || "");

function DocViewer({ doc, url, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30, zIndex: 60 }}>
      <button onClick={onClose} title="Close (Esc)" style={{ position: "fixed", top: 18, right: 22, zIndex: 70, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-x" /></button>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: 900, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "0.5px solid var(--line)", flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
            <a href={url} download={doc.name}><i className="ti ti-download" style={{ fontSize: 18, color: "var(--txt-2)", cursor: "pointer" }} title="Download" /></a>
            <a href={url} target="_blank" rel="noreferrer"><i className="ti ti-external-link" style={{ fontSize: 18, color: "var(--txt-2)", cursor: "pointer" }} title="Open in new tab" /></a>
            <i className="ti ti-x" onClick={onClose} style={{ fontSize: 20, color: "var(--txt-2)", cursor: "pointer" }} title="Close" />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: "#0d0d10", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {url == null ? <div style={{ color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>
            : isImage(doc.name) ? <img src={url} alt={doc.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : isPdf(doc.name) ? <iframe src={url} title={doc.name} style={{ width: "100%", height: "100%", border: "none" }} />
            : <div style={{ textAlign: "center", color: "var(--txt-2)", fontSize: 13 }}><i className="ti ti-file" style={{ fontSize: 40, display: "block", marginBottom: 10 }} />Preview not available for this file type.<br /><a href={url} download={doc.name} style={{ color: "var(--brand)" }}>Download instead</a></div>}
        </div>
      </div>
    </div>
  );
}

function DocumentsPage({ user }) {
  const [customers] = useCustomers();
  const cats = ["All", "Quotes", "Invoices", "Certificates", "Job Photos"];
  const [cat, setCat] = useState("All");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadCat, setUploadCat] = useState("Certificates");
  const [uploadCust, setUploadCust] = useState({ id: "", name: "" });
  const [viewer, setViewer] = useState(null); // { doc, url }

  const load = () => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_documents").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data || []); });
  };
  useEffect(load, []);

  const doUpload = async (file, category, cust, replaceDoc) => {
    if (!file) return;
    if (!DB_READY) { setErr("Database not connected."); return; }
    setErr(""); setBusy(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await db.storage.from(DOC_BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      if (replaceDoc) {
        // delete old file, point row at new one (keep its customer + category)
        await db.storage.from(DOC_BUCKET).remove([replaceDoc.path]);
        const { error } = await db.from("svc_documents").update({ path, name: file.name, size: file.size, cat: replaceDoc.cat }).eq("id", replaceDoc.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("svc_documents").insert([{ user_id: user.id, name: file.name, path, size: file.size, cat: category, customer_id: cust && cust.id ? cust.id : null, customer: cust ? cust.name : null }]);
        if (error) throw error;
      }
      load();
    } catch (e) { setErr(e.message || "Upload failed."); }
    setBusy(false);
  };

  const openView = async (d) => {
    setViewer({ doc: d, url: null });
    const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUrl(d.path, 3600);
    if (error) { setErr(error.message); setViewer(null); return; }
    setViewer({ doc: d, url: data.signedUrl });
  };

  const remove = async (d) => {
    if (!DB_READY) return;
    await db.storage.from(DOC_BUCKET).remove([d.path]);
    await db.from("svc_documents").delete().eq("id", d.id);
    load();
  };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (d) => ask(<span>Delete document <strong>{d.name}</strong>? The file will be permanently removed from storage. This can't be undone.</span>, () => remove(d));

  const pickFile = (onPick) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx";
    inp.onchange = () => inp.files[0] && onPick(inp.files[0]);
    inp.click();
  };

  const data = rows || [];
  const list = data.filter((d) => cat === "All" || d.cat === cat);

  return (
    <div className="fade-in">
      <PageHead title="Documents" sub={rows ? `${data.length} file${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={uploadCust.id} onChange={(e) => { const c = customers.find((x) => String(x.id) === e.target.value); setUploadCust({ id: e.target.value, name: c ? c.name : "" }); }} style={{ ...inp, width: "auto", padding: "8px 10px" }}>
            <option value="">No customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 10px" }}>{cats.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}</select>
          <span onClick={() => !busy && pickFile((f) => doUpload(f, uploadCat, uploadCust, null))}><Btn icon={busy ? "ti-loader" : "ti-upload"} label={busy ? "Uploading…" : "Upload"} primary /></span>
        </span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {cats.map((c) => (
          <span key={c} onClick={() => setCat(c)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 12px", borderRadius: 7, color: c === cat ? "var(--txt)" : "var(--txt-2)", background: c === cat ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (c === cat ? "var(--line)" : "transparent") }}>{c}</span>
        ))}
      </div>
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading documents…</div>
      ) : list.length === 0 ? (
        <div style={emptyCard}>No documents yet. Pick a category and click "Upload" to add your first file.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 11 }}>
          {list.map((d) => {
            const meta = iconFor(d.cat, d.name);
            const t = toneVar(meta.tone);
            const when = d.created_at ? new Date(d.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
            return (
              <div key={d.id} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "13px 15px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${meta.icon}`} style={{ fontSize: 18 }} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{d.customer ? `${d.customer} · ` : ""}{d.cat} · {fmtSize(d.size)} · {when}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, borderTop: "0.5px solid var(--line)", paddingTop: 10 }}>
                  <span onClick={() => openView(d)} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--brand)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><i className="ti ti-eye" style={{ fontSize: 15 }} />View</span>
                  <span onClick={() => !busy && pickFile((f) => doUpload(f, d.cat, null, d))} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--txt-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><i className="ti ti-replace" style={{ fontSize: 15 }} />Replace</span>
                  <span onClick={() => askDelete(d)} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--red)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><i className="ti ti-trash" style={{ fontSize: 15 }} />Delete</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewer && <DocViewer doc={viewer.doc} url={viewer.url} onClose={() => setViewer(null)} />}
      {confirmNode}
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const periods = ["This Month", "Quarter", "VAT Year", "Custom"];
  const periodLabel = period === "Custom" ? (from && to ? `${from} → ${to}` : "Custom range — pick dates") : period;
  return (
    <div className="fade-in" style={{ position: "relative" }}>
      <PageHead title="Reports" sub={`Showing: ${periodLabel}`}
        right={<div style={{ display: "flex", gap: 5, fontSize: 12 }}>{periods.map((p) => <span key={p} onClick={() => setPeriod(p)} style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 7, fontWeight: p === period ? 600 : 500, color: p === period ? "var(--txt)" : "var(--txt-2)", background: p === period ? "var(--surface3)" : "transparent", border: "0.5px solid " + (p === period ? "var(--line)" : "transparent") }}>{p}</span>)}</div>} />
      {period === "Custom" && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 18, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 14 }}>
          <label style={fld}>From<input style={{ ...inp, width: 170 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label style={fld}>To<input style={{ ...inp, width: 170 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <span style={{ fontSize: 11.5, color: "var(--txt-3)", paddingBottom: 9 }}>Reports below will use this date range.</span>
        </div>
      )}
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
  const wantsSignup = typeof window !== "undefined" && (window.location.hash === "#signup" || window.location.hash === "#register" || window.location.pathname.endsWith("/register"));
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
    const { data, error } = await db.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/confirmed?product=serviceops`, data: { company_name: company.trim(), product: "serviceops" } } });
    // an existing Alzaro account (from another Ops product) shows up as an error
    // or as a signUp result with no identities — handle both
    const alreadyExists = (error && /already/i.test(error.message)) ||
      (!error && data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
    if (alreadyExists) {
      // sign them in with their existing Alzaro password and activate ServiceOps on it
      const { data: si, error: siErr } = await db.auth.signInWithPassword({ email, password: pw });
      if (siErr) {
        setBusy(false);
        return setMsg("An Alzaro account with this email already exists (from another Alzaro product). Enter that account's password here to activate ServiceOps on it — the password you entered didn't match.");
      }
      await db.from("product_members").insert([{ user_id: si.user.id, email: si.user.email, product: "serviceops", company_name: company.trim() }]); // duplicate-safe: errors ignored
      setBusy(false);
      window.location.href = "/serviceops/login"; // fresh load → straight into the app
      return;
    }
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

  const authInp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(34,197,94,.3)" };
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
            <button onClick={() => { setForgot(false); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>← Back to login</button>
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
                <button onClick={() => { setForgot(true); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Forgot password?</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--brand-soft)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 8, padding: "11px 14px", fontSize: 12, color: "var(--brand)", textAlign: "center", fontWeight: 500 }}>
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
/*  ADMIN  (only visible to accounts in svc_admins)                   */
/* ================================================================== */
function AdminPage() {
  const TIERS = ["Sole Trader", "Team", "Firm"];
  const FEES = { "Sole Trader": 29, "Team": 69, "Firm": 129 };
  const STATUSES = ["Trial", "Active", "Suspended"];
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    if (!DB_READY) { setErr("Database not connected."); return; }
    db.rpc("svc_admin_overview").then(({ data, error }) => {
      if (error) { setErr(error.message); return; }
      setData(typeof data === "string" ? JSON.parse(data) : data);
    });
  };
  useEffect(load, []);

  const users = (data && data.users) || [];
  const now = new Date();
  const daysUntil = (d) => d ? Math.ceil((new Date(d + "T00:00:00") - now) / 86400000) : null;
  const fee = (u) => u.status === "Active" ? (FEES[u.tier] || 0) : 0;
  const mrr = users.reduce((s, u) => s + fee(u), 0);
  const onTrial = users.filter((u) => u.status === "Trial").length;
  const active = users.filter((u) => u.status === "Active").length;
  const suspended = users.filter((u) => u.status === "Suspended").length;
  const expiringSoon = users.filter((u) => u.status === "Trial" && daysUntil(u.trial_ends) !== null && daysUntil(u.trial_ends) <= 7).length;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const setLicence = async (u, patch) => {
    const next = { tier: u.tier, status: u.status, trial_ends: u.trial_ends, ...patch };
    const { error } = await db.rpc("svc_admin_set_licence", { target: u.id, new_tier: next.tier, new_status: next.status, new_trial_ends: next.trial_ends });
    if (error) { setErr(error.message); return; }
    load();
  };

  const statCard = (label, value, sub, color) => (
    <div style={{ flex: 1, background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--txt-3)", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "var(--txt)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
  const statusBox = (label, value, color, bg) => (
    <div style={{ flex: 1, background: bg, border: "0.5px solid var(--line)", borderRadius: 10, padding: "18px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--txt-2)", marginTop: 2 }}>{label}</div>
    </div>
  );
  const selStyle = { ...inp, padding: "6px 8px", fontSize: 12, width: "auto" };

  return (
    <div className="fade-in">
      <PageHead title="Admin — Licence Manager" sub={data ? `${users.length} registered user${users.length === 1 ? "" : "s"} on ServiceOps` : "Loading platform data…"}
        right={<span onClick={load}><Btn icon="ti-refresh" label="Refresh" /></span>} />
      {err && <div style={errBanner}>{err.includes("Not authorised") ? "Your account isn't an admin." : err}</div>}
      {data && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            {statCard("Total users", users.length, `${onTrial} on trial`, "var(--brand)")}
            {statCard("Monthly revenue", gbp(mrr), "MRR from active", "var(--green)")}
            {statCard("Active subscriptions", active, `${suspended} suspended`, "var(--blue)")}
            {statCard("Trials expiring soon", expiringSoon, "within 7 days", expiringSoon > 0 ? "var(--red)" : "var(--txt)")}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
            <div style={{ flex: 1, background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 18 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--txt-3)", textTransform: "uppercase", marginBottom: 12 }}>Tier breakdown</div>
              {TIERS.map((t) => {
                const n = users.filter((u) => u.tier === t).length;
                const rev = users.filter((u) => u.tier === t && u.status === "Active").length * FEES[t];
                const pct = users.length ? (n / users.length) * 100 : 0;
                return (
                  <div key={t} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{t}</span>
                      <span style={{ color: "var(--txt-2)" }}>{n} · {gbp(rev)}/mo</span>
                    </div>
                    <div style={{ height: 5, background: "var(--panel-2)", borderRadius: 3 }}><div style={{ width: pct + "%", height: "100%", background: "var(--brand)", borderRadius: 3 }} /></div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "0.5px solid var(--line)", paddingTop: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>Total MRR</span><span style={{ fontWeight: 700, color: "var(--green)" }}>{gbp(mrr)}/mo</span>
              </div>
            </div>
            <div style={{ flex: 1.4, background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 18 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--txt-3)", textTransform: "uppercase", marginBottom: 12 }}>Status overview</div>
              <div style={{ display: "flex", gap: 12 }}>
                {statusBox("Active", active, "var(--green)", "var(--green-soft)")}
                {statusBox("Trial", onTrial, "var(--amber)", "var(--amber-soft)")}
                {statusBox("Suspended", suspended, "var(--red)", "var(--red-soft)")}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 10 }}>All users — newest first</div>
          <Table cols={["User", "Joined", "Tier", "Status", "Trial ends", "Fee/mo", "Usage"]}>
            {users.map((u) => {
              const left = daysUntil(u.trial_ends);
              return (
                <tr key={u.id}>
                  <Td><span style={{ fontWeight: 500 }}>{u.email}</span></Td>
                  <Td color="var(--txt-2)">{fmtDate(u.created_at)}</Td>
                  <Td><select style={selStyle} value={u.tier} onChange={(e) => setLicence(u, { tier: e.target.value })}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></Td>
                  <Td><select style={selStyle} value={u.status} onChange={(e) => setLicence(u, { status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Td>
                  <Td>{u.status === "Trial" ? <span>{fmtDate(u.trial_ends)}{left !== null && <div style={{ fontSize: 10.5, color: left <= 3 ? "var(--red)" : left <= 7 ? "var(--amber)" : "var(--txt-3)" }}>{left < 0 ? "expired" : left + " days left"}</div>}</span> : <span style={{ color: "var(--txt-3)" }}>—</span>}</Td>
                  <Td>{u.status === "Active" ? <span style={{ fontWeight: 600, color: "var(--green)" }}>{gbp(FEES[u.tier] || 0)}</span> : <span style={{ color: "var(--txt-3)" }}>—</span>}</Td>
                  <Td color="var(--txt-2)"><span style={{ fontSize: 11.5 }}>{u.customers} customers · {u.jobs} jobs · {u.invoices} inv</span></Td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  APP SHELL                                                         */
/* ================================================================== */
const PAGES = {
  customers: CustomersPage, properties: PropertiesPage, quotes: QuotesPage, jobs: JobsPage, diary: DiaryPage,
  invoicing: InvoicingPage, certificates: CertificatesPage, documents: DocumentsPage,
  reports: ReportsPage, settings: SettingsPage, admin: AdminPage,
};

function Dashboard({ user, signOut }) {
  const pageFromUrl = () => {
    const seg = (window.location.pathname.split("/serviceops/")[1] || "").replace(/\/$/, "");
    const known = ["dashboard", "customers", "properties", "quotes", "jobs", "diary", "invoicing", "certificates", "documents", "reports", "settings", "admin"];
    return known.includes(seg) ? seg : "dashboard";
  };
  const [active, setActive] = useState(pageFromUrl);
  const [isAdmin, setIsAdmin] = useState(false);
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  // ---- business identity for the sidebar (real DB data, not email) ----
  // Reads company_name + tier from product_members; falls back to auth
  // metadata, then email prefix. Defaults tier to PRO if none stored.
  const [biz, setBiz] = useState({ name: "", tier: "", loaded: false });
  useEffect(() => {
    if (!DB_READY || !user) { setBiz({ name: DEMO.user.name, tier: DEMO.user.tier, loaded: true }); return; }
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
  const displayName = biz.loaded ? (biz.name || (user ? (user.email || "").split("@")[0] : DEMO.user.name)) : "…";
  const tierLabel = (biz.tier || DEMO.user.tier || "PRO").toUpperCase();

  // is this account an admin? (svc_admins row visible only to its owner)
  useEffect(() => {
    if (!DB_READY || !user) return;
    db.from("svc_admins").select("user_id").eq("user_id", user.id)
      .then(({ data }) => setIsAdmin((data || []).length > 0));
  }, [user]);

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

  const navItems = isAdmin ? [...NAV, { id: "admin", label: "Admin", icon: "ti-shield-lock" }] : NAV;
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
      db.from("svc_customers").select("id,name,site,area,type,contact,email").or(`name.ilike.${like},site.ilike.${like},area.ilike.${like}`).limit(8),
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
  if (active === "dashboard") body = <DashboardPage range={range === "Custom" && rangeFrom && rangeTo ? `${rangeFrom} → ${rangeTo}` : range} go={goTo} user={user} />;
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
          <div className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "var(--brand-soft)", color: "var(--brand)", border: "1px solid var(--brand)", textTransform: "uppercase" }}><i className="ti ti-crown" style={{ fontSize: 12 }} />{tierLabel}</div>
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
            return (
              <div key={n.id} onClick={() => goTo(n.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", margin: "2px 8px", borderRadius: 8, cursor: "pointer", background: on ? "var(--surface3)" : "transparent", color: on ? "var(--txt)" : "var(--txt-2)", fontWeight: on ? 600 : 500, flexShrink: 0, transition: "background .12s" }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                <i className={`ti ${n.icon}`} style={{ fontSize: 18, width: 20, textAlign: "center", flexShrink: 0, color: on ? "var(--brand)" : "var(--txt-2)" }} />
                <span style={{ fontSize: 13.5, flex: 1 }}>{n.label}</span>
              </div>
            );
          })}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user ? user.email : DEMO.user.email}</div>
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

function SearchGroup({ title, rows, goLabel, onGo }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase" }}>{title} ({rows.length})</span>
        <span onClick={onGo} style={{ fontSize: 11.5, color: "var(--brand)", cursor: "pointer" }}>Go to {goLabel}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => <div key={i} onClick={r.onClick} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "10px 13px", fontSize: 12.5, cursor: "pointer" }}>{r.label}</div>)}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  ROOT — decides: login screen or dashboard                         */
/* ================================================================== */
/* Shown to Alzaro accounts from other products that don't have ServiceOps yet */
function ActivateScreen({ user, signOut }) {
  const [company, setCompany] = useState(user?.user_metadata?.company_name || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const doJoin = async () => {
    setMsg("");
    if (!company.trim()) return setMsg("Please enter your company name.");
    setBusy(true);
    const { error } = await db.from("product_members").insert([{
      user_id: user.id,
      email: user.email,
      product: "serviceops",
      company_name: company.trim(),
    }]);
    setBusy(false);
    if (error) return setMsg(error.message || "Could not set up your ServiceOps account.");
    window.location.href = "/serviceops/login"; // fresh load → straight into the app
  };

  const inp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(34,197,94,.3)" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 20 }}>
      <div className="fade-in" style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 16, padding: "36px 32px", width: 440, maxWidth: "100%", boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div className="brand" style={{ fontSize: 22, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>ServiceOps</span></div>
        </div>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", margin: "18px auto 16px" }}><i className="ti ti-rocket" style={{ fontSize: 26 }} /></div>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>You're already with Alzaro</div>
          <div style={{ fontSize: 13, color: "var(--txt-2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--txt)" }}>{user.email}</strong> is registered to another
            Alzaro product. Start a separate <strong style={{ color: "var(--brand)" }}>14-day
            ServiceOps trial</strong> on this same login? Your other products and their data
            stay completely separate.
          </div>
        </div>

        {msg && (
          <div style={{ background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "var(--red)", marginBottom: 14 }}>{msg}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inp} placeholder="Business name for ServiceOps *" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doJoin()} autoFocus />
          <button onClick={doJoin} disabled={busy} style={primaryBtn}>{busy ? "Setting up…" : "Start ServiceOps Trial →"}</button>
          <button onClick={signOut} disabled={busy} style={{ background: "none", border: "none", color: "var(--txt-3)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Not now — sign me out</button>
          <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center" }}>Separate trial · Separate subscription · No card required</div>
        </div>
      </div>
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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

import { useState, useEffect } from 'react'
import { db, DB_READY } from '../lib/db.js'
import { REPORTS, gbp, toneVar, inp, fld, formCard, demoBanner, errBanner, emptyCard } from '../lib/helpers.js'
import { PageHead, Btn, Metric, Panel, Pill, rowActions, useConfirm, useCustomers, useProperties, CustomerPropertyPicker } from '../components/UI.jsx'

// ---- Dashboard ----
function WelcomeBanner({ d, go, user }) {
  const SUCCESS = "#22c55e";
  const key = user ? `svc_welcome_dismissed_${user.id}` : "svc_welcome_dismissed";
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === "1"; } catch (e) { return false; }
  });
  const dismiss = () => {
    try { localStorage.setItem(key, "1"); } catch (e) {}
    setDismissed(true);
  };

  const steps = [
    { id: "settings", label: "Set up your business details", done: false, page: "settings" },
    { id: "customer", label: "Add your first customer", done: (d.customers || []).length > 0, page: "customers" },
    { id: "quote", label: "Create your first quote", done: (d.quotes || []).length > 0, page: "quotes" },
    { id: "invoice", label: "Raise your first invoice", done: (d.invoices || []).length > 0, page: "invoicing" },
  ];
  // "Settings" ticks once any other step is done (no single settings flag exists).
  steps[0].done = steps.slice(1).some((s) => s.done);

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  if (dismissed || allDone) return null;

  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "20px 22px", marginBottom: 14, position: "relative" }}>
      <button onClick={dismiss} title="Dismiss" style={{ position: "absolute", top: 12, right: 14, background: "transparent", border: "none", color: "var(--txt-3)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>

      <div style={{ marginBottom: 14 }}>
        <h3 className="font-head" style={{ color: "var(--brand)", fontSize: 19, fontWeight: 700, margin: "0 0 3px 0" }}>👋 Welcome to ServiceOps</h3>
        <div style={{ color: "var(--txt-2)", fontSize: 13 }}>Let's get you set up — {completed} of {total} complete</div>
      </div>

      <div style={{ height: 6, background: "var(--line-2)", borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${(completed / total) * 100}%`, background: "var(--brand)", transition: "width .3s ease" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step) => (
          <div key={step.id} onClick={() => go(step.page)}
            style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--panel)", border: `0.5px solid ${step.done ? SUCCESS : "var(--line)"}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", transition: "border-color .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = step.done ? SUCCESS : "var(--line)")}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: step.done ? SUCCESS : "transparent", border: step.done ? "none" : "2px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 13, fontWeight: 700 }}>{step.done ? "✓" : ""}</div>
            <span style={{ color: step.done ? "var(--txt-3)" : "var(--txt)", fontSize: 13.5, textDecoration: step.done ? "line-through" : "none", flex: 1 }}>{step.label}</span>
            <span style={{ color: "var(--txt-3)", fontSize: 14 }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <WelcomeBanner d={d} go={go} user={user} />
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

// CUSTOMERS

// ---- Certificates ----
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

// DOCUMENTS

// ---- Documents ----
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

// REPORTS  (+ click-to-preview)

// ---- Reports ----
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
            <tbody>{report.rows.length ? report.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} style={{ padding: "9px 10px", borderBottom: "0.5px solid var(--line)", color: j === 0 ? "var(--txt)" : "var(--txt-2)" }}>{cell}</td>)}</tr>) : <tr><td colSpan={report.cols.length} style={{ padding: "28px 10px", textAlign: "center", color: "var(--txt-3)", fontSize: 12 }}>No data yet — this report will populate once you add live records.</td></tr>}</tbody>
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
  rows: [],
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

// SETTINGS

// ---- Settings ----
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

// AUTH SCREEN  (login + sign up)

export { DashboardPage, CertificatesPage, DocumentsPage, ReportsPage, SettingsPage };

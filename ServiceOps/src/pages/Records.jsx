import { useState, useEffect } from 'react'
import { db, DB_READY } from '../lib/db.js'
import { REPORTS, gbp, toneVar, inp, fld, formCard, demoBanner, errBanner, emptyCard } from '../lib/helpers.js'
import { PageHead, Btn, Metric, Panel, Pill, rowActions, useConfirm, useCustomers, useProperties, CustomerPropertyPicker, useIsMobile } from '../components/UI.jsx'

// Shared storage bucket (same one the old Documents page used).
const DOC_BUCKET = "svc-documents";

// Default any new-record date field to today (YYYY-MM-DD). User can change it.
const todayStr = () => new Date().toISOString().slice(0, 10);

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
  const [d, setD] = useState(null);

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
  const expiring = (d.certs || []).map((c) => ({ ...c, days: c.expiry_date ? Math.ceil((new Date(c.expiry_date + "T00:00:00") - new Date()) / 86400000) : 9999 })).filter((c) => c.days <= 90).sort((a, b) => a.days - b.days).slice(0, 5);

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
        <Metric label="Open Jobs" value={openJobs.length} sub={`${jobsToday} added today`} color="var(--blue)" onClick={() => go("quotes")} />
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
        <Panel title="Jobs by Stage" action="View all" onAction={() => go("quotes")}>
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

// ---- shared file helpers (used by Certificates + Documents) ----
const isImage = (name) => /\.(png|jpe?g|gif|webp|heic)$/i.test(name || "");
const isPdf = (name) => /\.pdf$/i.test(name || "");
const fmtSize = (b) => b == null ? "—" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";

function FileViewer({ name, url, onClose }) {
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
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
            <a href={url} download={name}><i className="ti ti-download" style={{ fontSize: 18, color: "var(--txt-2)", cursor: "pointer" }} title="Download" /></a>
            <a href={url} target="_blank" rel="noreferrer"><i className="ti ti-external-link" style={{ fontSize: 18, color: "var(--txt-2)", cursor: "pointer" }} title="Open in new tab" /></a>
            <i className="ti ti-x" onClick={onClose} style={{ fontSize: 20, color: "var(--txt-2)", cursor: "pointer" }} title="Close" />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: "#0d0d10", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {url == null ? <div style={{ color: "var(--txt-3)", fontSize: 13 }}>Loading…</div>
            : isImage(name) ? <img src={url} alt={name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : isPdf(name) ? <iframe src={url} title={name} style={{ width: "100%", height: "100%", border: "none" }} />
            : <div style={{ textAlign: "center", color: "var(--txt-2)", fontSize: 13 }}><i className="ti ti-file" style={{ fontSize: 40, display: "block", marginBottom: 10 }} />Preview not available for this file type.<br /><a href={url} download={name} style={{ color: "var(--brand)" }}>Download instead</a></div>}
        </div>
      </div>
    </div>
  );
}

// ---- Certificates (now with PDF/photo upload) ----
function CertificatesPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [busyId, setBusyId] = useState(null); // cert id currently uploading
  const [viewer, setViewer] = useState(null); // { name, url }
  const TYPES = ["Gas Safety (CP12)", "EICR", "EIC (Installation)", "Boiler Service", "PAT Testing", "Completion Certificate", "Other"];
  const blank = { cert_type: "Gas Safety (CP12)", customer_id: "", customer: "", property_id: "", site: "", ref: "", issue_date: todayStr(), expiry_date: todayStr() };
  const [form, setForm] = useState(blank);
  // a file chosen in the add/edit form, uploaded on save
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("svc_certificates").select("*").order("expiry_date", { ascending: true })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => { const { data } = await db.from("svc_certificates").select("*").order("expiry_date", { ascending: true }); setRows(data || []); };
  const openAdd = () => { setForm(blank); setEditId(null); setPendingFile(null); setAdding(!adding); setErr(""); };
  const openEdit = (c) => { setForm({ cert_type: c.cert_type || "Other", customer_id: c.customer_id || "", customer: c.customer || "", property_id: c.property_id || "", site: c.site || "", ref: c.ref || "", issue_date: c.issue_date || "", expiry_date: c.expiry_date || "" }); setEditId(c.id); setPendingFile(null); setAdding(true); setErr(""); };

  // low-level: push a File to storage, return its path
  const uploadToBucket = async (file) => {
    const path = `${user.id}/certs/${Date.now()}_${file.name}`;
    const { error: upErr } = await db.storage.from(DOC_BUCKET).upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    return path;
  };

  const save = async () => {
    if (!form.expiry_date) { setErr("Please set an expiry date."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    try {
      const payload = { ...form, customer_id: form.customer_id || null, property_id: form.property_id || null };
      if (!payload.issue_date) delete payload.issue_date;
      // attach a freshly-chosen file, if any
      if (pendingFile) {
        const path = await uploadToBucket(pendingFile);
        payload.file_path = path;
        payload.file_name = pendingFile.name;
      }
      let error;
      if (editId) ({ error } = await db.from("svc_certificates").update(payload).eq("id", editId));
      else ({ error } = await db.from("svc_certificates").insert([{ ...payload, user_id: user.id }]));
      if (error) throw error;
      setForm(blank); setPendingFile(null); setAdding(false); setEditId(null); refresh();
    } catch (e) { setErr(e.message || "Couldn't save certificate."); }
  };

  const remove = async (c) => {
    if (!c.id || !DB_READY) return;
    if (c.file_path) { try { await db.storage.from(DOC_BUCKET).remove([c.file_path]); } catch (e) { /* ignore */ } }
    await db.from("svc_certificates").delete().eq("id", c.id);
    refresh();
  };
  const [confirmNode, ask] = useConfirm();
  const askDelete = (c) => ask(<span>Delete <strong>{c.cert_type}</strong>{c.customer || c.site ? <> for <strong>{c.customer || c.site}</strong></> : ""}?{c.file_path ? " Its attached file will also be removed." : ""} This can't be undone.</span>, () => remove(c));

  // pick + upload a file straight onto an existing cert row (inline button)
  const pickFor = (c) => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp";
    el.onchange = async () => {
      const file = el.files[0];
      if (!file) return;
      setBusyId(c.id); setErr("");
      try {
        // remove the old file first if replacing
        if (c.file_path) { try { await db.storage.from(DOC_BUCKET).remove([c.file_path]); } catch (e) { /* ignore */ } }
        const path = await uploadToBucket(file);
        const { error } = await db.from("svc_certificates").update({ file_path: path, file_name: file.name }).eq("id", c.id);
        if (error) throw error;
        refresh();
      } catch (e) { setErr(e.message || "Upload failed."); }
      setBusyId(null);
    };
    el.click();
  };

  const openFile = async (c) => {
    if (!c.file_path) return;
    setViewer({ name: c.file_name || "file", url: null });
    const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUrl(c.file_path, 3600);
    if (error) { setErr(error.message); setViewer(null); return; }
    setViewer({ name: c.file_name || "file", url: data.signedUrl });
  };

  // file chooser for the add/edit form (defers upload to save)
  const pickPending = () => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp";
    el.onchange = () => { if (el.files[0]) setPendingFile(el.files[0]); };
    el.click();
  };

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
          {/* file attach row */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span onClick={pickPending}><Btn icon="ti-paperclip" label={pendingFile ? "Change file" : "Attach PDF / photo"} /></span>
            {pendingFile && <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{pendingFile.name} · {fmtSize(pendingFile.size)}</span>}
            {!pendingFile && editId && <span style={{ fontSize: 11, color: "var(--txt-3)" }}>Leave empty to keep the existing file.</span>}
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
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${iconForType(c.cert_type)}`} style={{ fontSize: 16 }} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.cert_type}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[c.customer, c.site, c.ref].filter(Boolean).join(" · ") || "—"}</div>
                  {c.file_name && <div onClick={() => openFile(c)} style={{ fontSize: 10.5, color: "var(--brand)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}><i className="ti ti-paperclip" style={{ fontSize: 12 }} />{c.file_name}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <span style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{c.days < 0 ? `expired ${-c.days}d ago` : `in ${c.days} days`}</span>
                <Pill text={status} tone={tone} />
                {DB_READY && (
                  c.file_path
                    ? <i className="ti ti-eye" onClick={() => openFile(c)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="View attached file" />
                    : <i className={`ti ${busyId === c.id ? "ti-loader" : "ti-upload"}`} onClick={() => busyId !== c.id && pickFor(c)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Attach a file" />
                )}
                {rowActions(DB_READY, () => openEdit(c), () => askDelete(c))}
              </div>
            </div>
          );
        })}
      </div>
      )}
      {viewer && <FileViewer name={viewer.name} url={viewer.url} onClose={() => setViewer(null)} />}
      {confirmNode}
    </div>
  );
}

// ---- Documents (retained, no longer in nav; kept so App.jsx import resolves) ----
const iconFor = (cat, name) => {
  const n = (name || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(n)) return { icon: "ti-photo", tone: "blue" };
  if (cat === "Certificates") return { icon: "ti-shield-check", tone: "green" };
  if (cat === "Invoices") return { icon: "ti-receipt", tone: "amber" };
  if (cat === "Quotes") return { icon: "ti-file-dollar", tone: "brand" };
  return { icon: "ti-file", tone: "blue" };
};

function DocumentsPage({ user }) {
  const [customers] = useCustomers();
  const cats = ["All", "Quotes", "Invoices", "Certificates", "Job Photos"];
  const [cat, setCat] = useState("All");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadCat, setUploadCat] = useState("Certificates");
  const [uploadCust, setUploadCust] = useState({ id: "", name: "" });
  const [viewer, setViewer] = useState(null);

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
    setViewer({ name: d.name, url: null });
    const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUrl(d.path, 3600);
    if (error) { setErr(error.message); setViewer(null); return; }
    setViewer({ name: d.name, url: data.signedUrl });
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
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx";
    el.onchange = () => el.files[0] && onPick(el.files[0]);
    el.click();
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
      {viewer && <FileViewer name={viewer.name} url={viewer.url} onClose={() => setViewer(null)} />}
      {confirmNode}
    </div>
  );
}

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

// ---- Settings ----
function SettingsPage({ user }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("business");
  const [biz, setBiz] = useState({ trading_name: "", vat_number: "" });
  const [notif, setNotif] = useState({ notify_certificate: true, notify_invoice: true, notify_job: true, reminder_lead: "30 / 7 days before expiry" });
  const [email, setEmail] = useState({ smtp_provider: "custom", smtp_host: "", smtp_port: 587, smtp_secure: false, smtp_user: "", smtp_pass: "", smtp_from_name: "", smtp_from_email: "", smtp_reply_to: "" });
  const [vat, setVat] = useState({ vat_scheme: "standard", vat_number: "", flat_rate: 16.5 });
  const [showPass, setShowPass] = useState(false);
  const [smtpTest, setSmtpTest] = useState(null);
  const [smtpTestMsg, setSmtpTestMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [currentTier, setCurrentTier] = useState("basic");
  const [memberId, setMemberId] = useState(null);
  const [changingTier, setChangingTier] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!DB_READY || !user) return;
    // Load the product_members row: its `id` is the webhook's PATCH key, and
    // tier/plan is the source of truth for the current plan.
    db.from("product_members").select("id,tier").eq("user_id", user.id).eq("product", "serviceops").maybeSingle()
      .then(({ data }) => {
        if (data?.id) setMemberId(data.id);
        const t = (data && (data.tier || data.plan) || "bronze").toLowerCase();
        setCurrentTier(["basic", "bronze", "silver", "gold"].includes(t) ? t : "basic");
      })
      .catch(() => {});
  }, [user]);

  // Returning from Stripe Checkout: the webhook has already updated
  // product_members and the effect above re-reads the tier on load — just tidy
  // the URL so the ?billing= param doesn't linger.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Current Supabase access token for authenticating API calls.
  const authHeaders = async () => {
    const { data: { session } } = await db.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  // Start a real Stripe Checkout for the chosen tier, then redirect to it.
  // `garageId` carries the product_members row id (the webhook's PATCH key).
  const startCheckout = async (newTier) => {
    if (!memberId || !user?.email) {
      alert("Your account is still loading — please try again in a moment.");
      return;
    }
    setChangingTier(newTier);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          email: user.email,
          garageId: memberId,
          product: "serviceops",
          tier: newTier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      alert(e.message || "Could not start checkout");
      setChangingTier(null);
    }
  };

  // Open the Stripe Billing Portal to update payment details or cancel.
  const openPortal = async () => {
    if (!memberId) {
      alert("Your account is still loading — please try again in a moment.");
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ garageId: memberId, product: "serviceops" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open billing portal");
      window.location.href = data.url;
    } catch (e) {
      alert(e.message || "Could not open billing portal");
      setPortalLoading(false);
    }
  };

  const TABS = [
    { key: "business", label: "Business", icon: "ti-building" },
    { key: "notifications", label: "Notifications", icon: "ti-bell" },
    { key: "email", label: "Email", icon: "ti-mail" },
    { key: "vat", label: "VAT", icon: "ti-receipt" },
    { key: "subscription", label: "Subscription", icon: "ti-credit-card" },
  ];

  const SMTP_PRESETS = {
    custom:   { host: "",                      port: 587, secure: false },
    gmail:    { host: "smtp.gmail.com",        port: 587, secure: false },
    outlook:  { host: "smtp-mail.outlook.com", port: 587, secure: false },
    office365:{ host: "smtp.office365.com",    port: 587, secure: false },
    zoho:     { host: "smtp.zoho.eu",          port: 587, secure: false },
    ionos:    { host: "smtp.ionos.co.uk",      port: 587, secure: false },
    resend:   { host: "smtp.resend.com",       port: 587, secure: false },
    sendgrid: { host: "smtp.sendgrid.net",     port: 587, secure: false },
  };

  useEffect(() => {
    if (!DB_READY) { setLoaded(true); return; }
    db.from("svc_settings").select("*").eq("user_id", user.id)
      .then(({ data, error }) => {
        const row = !error && data && data.length ? data[0] : null;
        if (row) {
          setBiz({ trading_name: row.trading_name || "", vat_number: row.vat_number || "" });
          setNotif({
            notify_certificate: row.notify_certificate !== false,
            notify_invoice: row.notify_invoice !== false,
            notify_job: row.notify_job !== false,
            reminder_lead: row.reminder_lead || "30 / 7 days before expiry",
          });
          setEmail({
            smtp_provider: row.smtp_provider || "custom",
            smtp_host: row.smtp_host || "",
            smtp_port: row.smtp_port || 587,
            smtp_secure: row.smtp_secure === true,
            smtp_user: row.smtp_user || "",
            smtp_pass: row.smtp_pass || "",
            smtp_from_name: row.smtp_from_name || "",
            smtp_from_email: row.smtp_from_email || "",
            smtp_reply_to: row.smtp_reply_to || "",
          });
          setVat({
            vat_scheme: row.vat_scheme || "standard",
            vat_number: row.vat_number || "",
            flat_rate: row.flat_rate != null ? row.flat_rate : 16.5,
          });
        } else if (user.user_metadata && user.user_metadata.company_name) {
          setBiz((b) => ({ ...b, trading_name: user.user_metadata.company_name }));
        }
        setLoaded(true);
      });
  }, []);

  const saveAll = async () => {
    if (!DB_READY) { setErr("Add your Supabase keys to save."); return; }
    setErr(""); setSaving(true); setSaved(false);
    const record = {
      user_id: user.id,
      trading_name: biz.trading_name,
      vat_number: vat.vat_number || biz.vat_number,
      notify_certificate: notif.notify_certificate, notify_invoice: notif.notify_invoice, notify_job: notif.notify_job, reminder_lead: notif.reminder_lead,
      smtp_provider: email.smtp_provider, smtp_host: email.smtp_host, smtp_port: email.smtp_port, smtp_secure: email.smtp_secure,
      smtp_user: email.smtp_user, smtp_pass: email.smtp_pass, smtp_from_name: email.smtp_from_name, smtp_from_email: email.smtp_from_email, smtp_reply_to: email.smtp_reply_to,
      vat_scheme: vat.vat_scheme, flat_rate: vat.flat_rate,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await db.from("svc_settings").upsert(record, { onConflict: "user_id" });
    if (upErr) { setSaving(false); setErr("Couldn't save: " + upErr.message); return; }
    const { data: check, error: readErr } = await db.from("svc_settings").select("trading_name,vat_number").eq("user_id", user.id);
    setSaving(false);
    if (readErr) { setErr("Saved, but couldn't confirm: " + readErr.message); return; }
    const row = check && check.length ? check[0] : null;
    if (!row) { setErr("Save didn't persist — the svc_settings table is likely missing the new columns. Re-run the settings SQL in Supabase."); return; }
    setBiz({ trading_name: row.trading_name || "", vat_number: row.vat_number || "" });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const pickProvider = (p) => {
    const preset = SMTP_PRESETS[p];
    setEmail({ ...email, smtp_provider: p, ...(preset ? { smtp_host: preset.host, smtp_port: preset.port, smtp_secure: preset.secure } : {}) });
  };

  const testSmtp = async () => {
    if (!email.smtp_host || !email.smtp_user || !email.smtp_pass) {
      setSmtpTest("error"); setSmtpTestMsg("Fill in the SMTP host, username and password first.");
      return;
    }
    setSmtpTest("testing"); setSmtpTestMsg("");
    try {
      const res = await fetch("/api/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: email.smtp_host, port: email.smtp_port || 587, secure: !!email.smtp_secure, user: email.smtp_user, pass: email.smtp_pass, fromName: email.smtp_from_name || biz.trading_name || "" }),
      });
      let data = {}; try { data = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server responded with status ${res.status}`);
      setSmtpTest("success"); setSmtpTestMsg(""); setTimeout(() => setSmtpTest(null), 8000);
    } catch (e) {
      setSmtpTest("error");
      if (e.message === "Failed to fetch") setSmtpTestMsg("Could not reach /api/test-smtp — the function may not be deployed yet.");
      else setSmtpTestMsg(e.message);
    }
  };

  const tiers = [
    { name: "Basic", key: "basic", price: 8.99, sub: "per month", best: "Getting started", features: ["Customers & properties", "Quotes & invoices", "Email support", "1 user"] },
    { name: "Bronze", key: "bronze", price: 14.99, sub: "per month", best: "Solo traders", features: ["Customers & properties", "Quotes & invoices", "Jobs management", "Email support"] },
    { name: "Silver", key: "silver", price: 18.99, sub: "per month", best: "Growing firms", features: ["Everything in Bronze", "Engineer scheduling & diary", "Reports & insights", "Automated reminders", "Priority support"] },
    { name: "Gold", key: "gold", price: 28.99, sub: "per month", best: "Full operation", features: ["Everything in Silver", "Certificate vault", "Document store", "Advanced reporting & export", "Dedicated support"] },
  ];

  const sInp = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none", width: "100%" };
  const sFld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
  const lbl = { fontSize: 10.5, fontWeight: 600, color: "var(--txt-3)", display: "block", marginBottom: 5 };
  const card = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "15px 18px" };
  const head = (icon, title) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
      <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${icon}`} style={{ fontSize: 15 }} /></span>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
    </div>
  );
  const Toggle = ({ on, onClick }) => (
    <span onClick={onClick} style={{ width: 38, height: 22, borderRadius: 11, background: on ? "var(--brand)" : "var(--line-2)", position: "relative", cursor: "pointer", transition: "background .15s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </span>
  );
  const SaveRow = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
      <span onClick={saveAll}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : "Save changes"} primary /></span>
      {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
    </div>
  );

  return (
    <div className="fade-in">
      <PageHead title="Settings" sub="Manage your business, team and subscription." />

      <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 12, padding: 5, marginBottom: 18, width: isMobile ? "100%" : "fit-content", overflowX: "auto" }}>
        {TABS.map((t) => (
          <div key={t.key} onClick={() => setTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: isMobile ? "9px 12px" : "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", background: tab === t.key ? "var(--brand)" : "transparent", color: tab === t.key ? "#fff" : "var(--txt-2)" }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />{t.label}
          </div>
        ))}
      </div>

      {tab === "business" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
          <div style={card}>
            {head("ti-building", "Business")}
            {!loaded ? <div style={{ fontSize: 12, color: "var(--txt-3)" }}>Loading…</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={sFld}>Trading name<input style={sInp} placeholder="e.g. Alzaro Trade Services" value={biz.trading_name} onChange={(e) => setBiz({ ...biz, trading_name: e.target.value })} /></label>
                <label style={sFld}>VAT number<input style={sInp} placeholder="e.g. GB 123 4567 89" value={biz.vat_number} onChange={(e) => setBiz({ ...biz, vat_number: e.target.value })} /></label>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingTop: 4 }}><span style={{ color: "var(--txt-2)" }}>Current plan</span><span style={{ fontWeight: 600, color: "var(--brand)" }}>{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}</span></div>
                {err && <div style={{ fontSize: 11.5, color: "var(--red)" }}>{err}</div>}
                <SaveRow />
              </div>
            )}
          </div>

          <div style={card}>
            {head("ti-users", "Team & engineers")}
            {[["You", user ? user.email : "—", "Admin"], ["Invite engineers", "Coming soon", ""]].map((r, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: j === 0 ? "0.5px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span style={{ color: "var(--txt-2)" }}>{r[0]}{r[1] ? ` · ${r[1]}` : ""}</span><span style={{ fontWeight: 500, color: r[2] === "Admin" ? "var(--brand)" : "var(--txt)" }}>{r[2]}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 8 }}>Add engineers and subcontractors on the Business plan.</div>
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div style={{ ...card, maxWidth: 760 }}>
          {head("ti-bell", "Notifications")}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--line)" }}>
              <div><div style={{ fontSize: 12.5, color: "var(--txt)" }}>Certificate reminders</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>Alerts when certificates are due to expire</div></div>
              <Toggle on={notif.notify_certificate} onClick={() => setNotif({ ...notif, notify_certificate: !notif.notify_certificate })} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--line)" }}>
              <div><div style={{ fontSize: 12.5, color: "var(--txt)" }}>Invoice overdue alerts</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>Alerts when an invoice becomes overdue</div></div>
              <Toggle on={notif.notify_invoice} onClick={() => setNotif({ ...notif, notify_invoice: !notif.notify_invoice })} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid var(--line)" }}>
              <div><div style={{ fontSize: 12.5, color: "var(--txt)" }}>Job booked confirmations</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>Notify the customer when a job is booked in</div></div>
              <Toggle on={notif.notify_job} onClick={() => setNotif({ ...notif, notify_job: !notif.notify_job })} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 12.5, color: "var(--txt)" }}>Reminder lead time</div>
              <select value={notif.reminder_lead} onChange={(e) => setNotif({ ...notif, reminder_lead: e.target.value })} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "7px 10px", color: "var(--txt)", fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none" }}>
                {["60 / 30 / 7 days before expiry", "30 / 7 days before expiry", "14 / 1 days before expiry", "7 days before expiry"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>
          {err && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 10 }}>{err}</div>}
          <SaveRow />
          <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 8 }}>Email delivery of these reminders is coming soon — alerts currently show in the app.</div>
        </div>
      )}

      {tab === "email" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
          <div style={card}>
            {head("ti-mail", "Email & SMTP")}
            <p style={{ fontSize: 11.5, color: "var(--txt-2)", marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>Send certificate reminders, invoice alerts and job confirmations straight from your own domain. Pick a provider to auto-fill the server settings.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Email provider</label>
              <select style={sInp} value={email.smtp_provider} onChange={(e) => pickProvider(e.target.value)}>
                <option value="custom">Custom SMTP server</option>
                <option value="gmail">Gmail / Google Workspace</option>
                <option value="outlook">Outlook / Hotmail</option>
                <option value="office365">Microsoft 365</option>
                <option value="zoho">Zoho Mail</option>
                <option value="ionos">IONOS</option>
                <option value="resend">Resend</option>
                <option value="sendgrid">SendGrid</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>SMTP host</label><input style={sInp} value={email.smtp_host} onChange={(e) => setEmail({ ...email, smtp_host: e.target.value })} placeholder="smtp.resend.com" /></div>
              <div><label style={lbl}>Port</label><input style={sInp} type="number" value={email.smtp_port} onChange={(e) => setEmail({ ...email, smtp_port: parseInt(e.target.value) || 587 })} placeholder="587" /></div>
              <div><label style={lbl}>Security</label>
                <select style={sInp} value={email.smtp_secure ? "ssl" : "tls"} onChange={(e) => setEmail({ ...email, smtp_secure: e.target.value === "ssl" })}>
                  <option value="tls">TLS (587)</option>
                  <option value="ssl">SSL (465)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Username / Email</label><input style={sInp} value={email.smtp_user} onChange={(e) => setEmail({ ...email, smtp_user: e.target.value })} placeholder="you@yourdomain.com" /></div>
              <div><label style={lbl}>Password / API key</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...sInp, paddingRight: 38 }} type={showPass ? "text" : "password"} value={email.smtp_pass} onChange={(e) => setEmail({ ...email, smtp_pass: e.target.value })} placeholder="••••••••••••" />
                  <span onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--txt-3)", fontSize: 13 }}><i className={`ti ${showPass ? "ti-eye-off" : "ti-eye"}`} /></span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>From name</label><input style={sInp} value={email.smtp_from_name} onChange={(e) => setEmail({ ...email, smtp_from_name: e.target.value })} placeholder={biz.trading_name || "Alzaro ServiceOps"} /></div>
              <div><label style={lbl}>From email</label><input style={sInp} type="email" value={email.smtp_from_email} onChange={(e) => setEmail({ ...email, smtp_from_email: e.target.value })} placeholder="noreply@yourdomain.com" /></div>
            </div>

            <div style={{ marginBottom: 16 }}><label style={lbl}>Reply-to email (optional)</label><input style={sInp} type="email" value={email.smtp_reply_to} onChange={(e) => setEmail({ ...email, smtp_reply_to: e.target.value })} placeholder="support@yourdomain.com" /></div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span onClick={smtpTest === "testing" ? undefined : testSmtp}>
                <Btn icon="ti-plug" label={smtpTest === "testing" ? "Connecting…" : smtpTest === "success" ? "✓ Connected!" : smtpTest === "error" ? "✗ Failed — retry" : "Test connection"} />
              </span>
              <span style={{ fontSize: 10.5, color: "var(--txt-3)" }}>Sends a test email from {email.smtp_user || "your address"} to itself.</span>
            </div>

            {smtpTest === "success" && (
              <div style={{ marginTop: 12, background: "var(--green-soft)", border: "0.5px solid var(--green)", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "var(--green)" }}>✓ Connected. A test email was sent from {email.smtp_user} — check that inbox, then Save changes below to keep these details.</div>
            )}
            {smtpTest === "error" && smtpTestMsg && (
              <div style={{ marginTop: 12, background: "var(--red-soft)", border: "0.5px solid var(--red)", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "var(--red)" }}>✗ {smtpTestMsg}</div>
            )}

            {err && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 12 }}>{err}</div>}
            <SaveRow />
          </div>
        </div>
      )}

      {tab === "vat" && (
        <div style={{ ...card, maxWidth: 760 }}>
          {head("ti-receipt", "VAT")}
          <p style={{ fontSize: 11.5, color: "var(--txt-2)", marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>Set your VAT scheme and registration details. These flow through to your quotes and invoices.</p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div><label style={lbl}>VAT scheme</label>
              <select style={sInp} value={vat.vat_scheme} onChange={(e) => setVat({ ...vat, vat_scheme: e.target.value })}>
                <option value="standard">Standard rate (20%)</option>
                <option value="flatrate">Flat rate scheme</option>
                <option value="exempt">Not VAT registered</option>
              </select>
            </div>
            <div><label style={lbl}>VAT number</label><input style={sInp} value={vat.vat_number} onChange={(e) => setVat({ ...vat, vat_number: e.target.value })} placeholder="GB 123 4567 89" /></div>
            {vat.vat_scheme === "flatrate" && (
              <div><label style={lbl}>Flat rate %</label><input style={sInp} type="number" step="0.1" value={vat.flat_rate} onChange={(e) => setVat({ ...vat, flat_rate: parseFloat(e.target.value) })} placeholder="9.5" /><div style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 4 }}>Check HMRC for your trade's flat rate.</div></div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            {vat.vat_scheme === "standard" && (
              <div style={{ background: "var(--brand-soft)", border: "0.5px solid var(--line)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--brand)", marginBottom: 5 }}>Standard rate (20%)</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.5 }}>Charge 20% VAT on invoices and reclaim VAT on materials and purchases. Most trade businesses use this.</div>
              </div>
            )}
            {vat.vat_scheme === "flatrate" && (
              <div style={{ background: "var(--amber-soft)", border: "0.5px solid var(--line)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--amber)", marginBottom: 5 }}>Flat rate scheme</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.5 }}>Pay a fixed percentage of gross turnover to HMRC. Simpler bookkeeping, but you can't reclaim VAT on most purchases.</div>
              </div>
            )}
            {vat.vat_scheme === "exempt" && (
              <div style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 5 }}>Not VAT registered</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.5 }}>Quotes and invoices will not include VAT charges.</div>
              </div>
            )}
          </div>

          {err && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 14 }}>{err}</div>}
          <SaveRow />
        </div>
      )}

      {tab === "subscription" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Subscription &amp; plans</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 12 }}>
            {tiers.map((t) => {
              const isCurrent = t.key === currentTier;
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
                    <div onClick={() => { if (!changingTier) startCheckout(t.key); }} style={{ textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--brand)", padding: "9px", border: "1px solid var(--brand)", borderRadius: 8, cursor: changingTier ? "default" : "pointer", opacity: changingTier && changingTier !== t.key ? 0.6 : 1 }}>{changingTier === t.key ? "Starting checkout…" : `${t.price > (tiers.find((x) => x.key === currentTier) || tiers[0]).price ? "Upgrade" : "Switch"} to ${t.name}`}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <span onClick={portalLoading ? undefined : openPortal} style={{ cursor: portalLoading ? "default" : "pointer", opacity: portalLoading ? 0.6 : 1 }}>
              <Btn icon="ti-credit-card" label={portalLoading ? "Opening…" : "Manage subscription"} />
            </span>
            <span style={{ fontSize: 11, color: "var(--txt-3)" }}>Update payment details or cancel anytime via the secure billing portal.</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { DashboardPage, CertificatesPage, DocumentsPage, ReportsPage, SettingsPage };

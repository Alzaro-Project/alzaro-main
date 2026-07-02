import React, { useState, useEffect } from "react";
import { Btn, DetailBox, DetailRow, Metric, PageHead, Pill, ReportPreview, Table, Td } from "../components/UI.jsx";
import { REPORTS, buildReport, gbp, ukDate, propLabel, toneVar, usePropertyList, useIsMobile } from "../lib/helpers.js";
import { DB_READY, db } from "../lib/supabase.js";

export function MaintenancePage({ user, go }) {
  const isMobile = useIsMobile();
  const stages = ["Reported", "Assigned", "In Progress", "Completed"];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const properties = usePropertyList();
  const blank = { title: "", property_id: "", priority: "Medium", contractor: "", status: "Reported", cost: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_maintenance").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_maintenance").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (j) => { setForm({ title: j.title || "", property_id: j.property_id || "", priority: j.priority || "Medium", contractor: j.contractor || "", status: j.status || "Reported", cost: j.cost ?? "" }); setEditId(j.id); setAdding(true); setErr(""); };

  const save = async () => {
    if (!form.title.trim()) { setErr("Job title is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const payload = { ...form, cost: form.cost === "" ? null : +form.cost, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
            <label style={fld}>Issue / job title<input style={inp} placeholder="e.g. Boiler not firing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Contractor<input style={inp} placeholder="e.g. GasPro Ltd" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></label>
            <label style={fld}>Priority<select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Cost (£)<input style={inp} type="number" step="0.01" placeholder="e.g. 120.00" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{stages.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update job" : "Save job"} primary /></span></div>
        </div>
      )}

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading jobs…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 11 }}>
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
                        {(j.cost !== null && j.cost !== undefined && j.cost !== "") ? <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--txt)" }}>{gbp(j.cost)}</span> : null}
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


// Email preview modal — review the rent/invoice email, then send via Resend (/api/send-email)
function PaymentEmailModal({ payment, tenant, propName, user, onClose, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bizName, setBizName] = useState("Alzaro PropertyOps");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const build = async () => {
      let biz = "Alzaro PropertyOps";
      if (DB_READY) {
        const { data: s } = await db.from("prop_settings").select("company_name").eq("user_id", user.id);
        if (s && s.length && s[0].company_name) biz = s[0].company_name;
      }
      setBizName(biz);
      const tName = tenant?.name || payment.tenant || "there";
      const ref = payment.invoice_no || "your invoice";
      const amount = gbp(payment.amount || 0);
      const due = payment.due_date ? ` by ${ukDate(payment.due_date)}` : "";
      const propLine = propName && propName !== "—" ? ` for ${propName}` : "";
      setTo(tenant?.email || "");
      setSubject(`Invoice ${payment.invoice_no || ""} from ${biz}`.trim());
      setBody(
`Hi ${tName},

Please find your invoice ${ref}${propLine} for the amount of ${amount}.

Payment is due${due}. If you have any questions, just reply to this email.

Thank you,
${biz}`
      );
      setLoading(false);
    };
    build();
  }, []);

  const send = async () => {
    if (!to.trim()) { setStatus("error"); setMsg("Add a recipient email address first."); return; }
    setStatus("sending"); setMsg("");
    try {
      const { data: sess } = await db.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setStatus("error"); setMsg("You need to be signed in to send."); return; }
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${body.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>`;
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: to.trim(), subject, html, text: body, fromName: bizName }),
      });
      let data = {}; try { data = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server responded with status ${res.status}`);
      setStatus("success");
      setTimeout(() => { onSent && onSent(); onClose(); }, 1400);
    } catch (e) {
      setStatus("error");
      setMsg(e.message === "Failed to fetch" ? "Could not reach the email service — it may not be deployed yet." : e.message);
    }
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(15,16,22,.55)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const panel = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: 24, width: 540, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.28)" };
  const labelTiny = { fontSize: 10, fontWeight: 700, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 };
  const field = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "10px 12px", color: "var(--txt)", fontSize: 13, fontFamily: "Inter", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget && status !== "sending") onClose(); }}>
      <div style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-mail" style={{ fontSize: 15 }} /></span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Email preview</span>
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: "var(--txt-3)", fontSize: 16 }}><i className="ti ti-x" /></span>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--txt-3)", padding: "20px 0" }}>Preparing preview…</div>
        ) : status === "success" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><i className="ti ti-check" style={{ fontSize: 22 }} /></span>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--green)", marginBottom: 4 }}>Email sent</div>
            <div style={{ fontSize: 12, color: "var(--txt-2)" }}>Sent to {to}</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={labelTiny}>To</div>
              <input style={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="tenant@email.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelTiny}>Subject</div>
              <input style={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelTiny}>Message</div>
              <textarea style={{ ...field, minHeight: 130, maxHeight: 200, resize: "vertical", lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>

            {status === "error" && msg && (
              <div style={{ marginBottom: 14, background: "var(--red-soft)", border: "0.5px solid var(--red)", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "var(--red)" }}>✗ {msg}</div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span onClick={status === "sending" ? undefined : send}><Btn icon="ti-send" label={status === "sending" ? "Sending…" : "Send invoice"} primary /></span>
              <span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span>
              <span style={{ fontSize: 10.5, color: "var(--txt-3)", marginLeft: "auto" }}>Sends via Alzaro (invoices@alzaro.co.uk)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function FinancePage({ user, go }) {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], comp: [], maint: [] });
  const properties = usePropertyList();
  const blank = { tenant: "", property_id: "", amount: "", due_date: "", billing_date: "", invoice_no: "", status: "Pending" };
  const [form, setForm] = useState(blank);
  const [emailPayment, setEmailPayment] = useState(null);
  const [filter, setFilter] = useState("All");
  const [fullProps, setFullProps] = useState([]);
  const [raising, setRaising] = useState(null);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_payments").select("*").order("due_date", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(error.message); setRows([]); } else setRows(data); });
    Promise.all([
      db.from("prop_tenants").select("*"), db.from("prop_compliance").select("*"), db.from("prop_maintenance").select("*"),
    ]).then(([t, c, m]) => setRelated({ tenants: t.data || [], comp: c.data || [], maint: m.data || [] }));
    db.from("prop_properties").select("*").then(({ data }) => setFullProps(data || []));
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_payments").select("*").order("due_date", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (p) => { const ns = String(p.status || "").toLowerCase(); const status = ns === "paid" ? "Paid" : ns === "overdue" ? "Overdue" : ns === "sent" ? "Sent" : "Pending"; setForm({ tenant: p.tenant || "", property_id: p.property_id || "", amount: p.amount || "", due_date: p.due_date || "", billing_date: p.billing_date || "", invoice_no: p.invoice_no || "", status }); setEditId(p.id); setAdding(true); setErr(""); };

  // Rent for a property (from the full property rows, which include rent).
  const rentForProp = (pid) => { const p = fullProps.find((x) => String(x.id) === String(pid)); return p && p.rent ? p.rent : ""; };
  const propIdForTenant = (name) => { const t = related.tenants.find((x) => x.name === name); return t ? (t.property_id || "") : ""; };
  const tenantForProp = (pid) => { const t = related.tenants.find((x) => String(x.property_id) === String(pid)); return t ? t.name : ""; };

  // Strict binding: pick a tenant → their property + rent. Amount always follows the property.
  const onPickTenant = (name) => {
    const pid = propIdForTenant(name);
    setForm((f) => ({ ...f, tenant: name, property_id: pid || f.property_id, amount: pid ? (rentForProp(pid) || f.amount) : f.amount }));
  };
  // Pick a property → its tenant + rent. Amount always follows.
  const onPickProperty = (pid) => {
    setForm((f) => ({ ...f, property_id: pid, tenant: pid ? (tenantForProp(pid) || f.tenant) : f.tenant, amount: pid ? (rentForProp(pid) || f.amount) : f.amount }));
  };

  // Safety net: once rent data has loaded, fill amount if a property is chosen but amount is still blank.
  useEffect(() => {
    if (adding && form.property_id && !form.amount) {
      const r = rentForProp(form.property_id);
      if (r) setForm((f) => (f.amount ? f : { ...f, amount: r }));
    }
  }, [form.property_id, fullProps, adding]);

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

  // Build forward projection of rent invoices from Let properties' rent + invoice_day
  const buildProjection = () => {
    const out = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    // months already raised, keyed property_id + YYYY-MM
    const raised = new Set((rows || []).map((r) => `${r.property_id}|${(r.due_date || "").slice(0, 7)}`));
    fullProps.filter((p) => p.status === "Let" && p.rent && p.invoice_day).forEach((p) => {
      const wantDay = Math.min(31, Math.max(1, +p.invoice_day));
      for (let m = 0; m < 12; m++) {
        const yr = now.getFullYear(), mo = now.getMonth() + m;
        const lastDay = new Date(yr, mo + 1, 0).getDate(); // last calendar day of this month
        const day = Math.min(wantDay, lastDay);            // 31 → 28/29/30 as appropriate
        const d = new Date(yr, mo, day);
        if (d < now) continue;
        const key = `${p.id}|${ym(d)}`;
        if (raised.has(key)) continue;
        const tenant = related.tenants.find((t) => String(t.property_id) === String(p.id));
        out.push({
          property_id: p.id,
          property: p.address,
          tenant: tenant ? tenant.name : "",
          tenant_email: tenant ? tenant.email : "",
          amount: p.rent,
          due_date: d.toISOString().slice(0, 10),
          month: ym(d),
        });
      }
    });
    return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
  };

  const raiseInvoice = async (proj) => {
    if (!DB_READY) return;
    setRaising(proj.property_id + proj.month);
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error } = await db.from("prop_payments").insert([{
      tenant: proj.tenant, property_id: proj.property_id, property: proj.property,
      amount: proj.amount, due_date: proj.due_date, invoice_no: invoiceNo,
      status: "Sent", user_id: user.id,
    }]);
    setRaising(null);
    if (error) { setErr(error.message); return; }
    refresh();
  };

  const remove = async (id) => { if (id && DB_READY) { await db.from("prop_payments").delete().eq("id", id); refresh(); } };

const data = rows || [];
  // Stored statuses are inconsistent (older raised invoices saved lowercase
  // "sent") — normalise for every comparison/display so nothing vanishes.
  const normStatus = (s) => {
    const x = String(s || "").toLowerCase();
    return x === "paid" ? "Paid" : x === "overdue" ? "Overdue" : x === "sent" ? "Sent" : "Pending";
  };
  const collected = data.filter((p) => normStatus(p.status) === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
  const overdue = data.filter((p) => normStatus(p.status) === "Overdue").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = data.filter((p) => ["Pending", "Sent"].includes(normStatus(p.status))).reduce((s, p) => s + (p.amount || 0), 0);
  const expected = collected + overdue + pending;
  const rate = expected ? Math.round((collected / expected) * 100) : 0;
  const paidCount = data.filter((p) => normStatus(p.status) === "Paid").length;
  const overdueCount = data.filter((p) => normStatus(p.status) === "Overdue").length;

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };

  // Stored amount is treated as the gross total; VAT (20%) is worked backward from it.
  const vatBreakdown = (total) => { const t = +total || 0; const sub = t / 1.2; return { sub, vat: t - sub, total: t }; };
  const money = (n) => "£" + (Math.round((+n || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ActionBtn = ({ icon, title, onClick, tone }) => {
    const bg = tone === "green" ? "var(--green-soft)" : tone === "red" ? "var(--red-soft)" : tone === "brand" ? "var(--brand-soft)" : "var(--panel-2)";
    const col = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : tone === "brand" ? "var(--brand)" : "var(--txt-3)";
    return <span onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, cursor: "pointer", color: col, background: bg, border: "0.5px solid var(--line)" }}><i className={`ti ${icon}`} style={{ fontSize: 14 }} /></span>;
  };

  return (
    <div className="fade-in">
      <PageHead title="Finance" sub={rows ? `${data.length} payment${data.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "Add payment"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Expected" value={gbp(expected)} sub={`${data.length} payment${data.length === 1 ? "" : "s"}`} color="var(--txt)" />
        <Metric label="Collected" value={gbp(collected)} sub={`${paidCount} paid`} color="var(--green)" />
        <Metric label="Arrears" value={gbp(overdue)} sub={`${overdueCount} overdue`} color="var(--red)" />
        <Metric label="Collection rate" value={rate + "%"} sub="Paid vs expected" color="var(--blue)" />
      </div>

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit payment" : "New payment"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Tenant<select style={inp} value={form.tenant} onChange={(e) => onPickTenant(e.target.value)}><option value="">— select tenant —</option>{related.tenants.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => onPickProperty(e.target.value)}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Amount (£)<input style={inp} type="number" placeholder="auto-fills from rent — editable" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label style={fld}>Billing date (optional)<input style={inp} type="date" value={form.billing_date} onChange={(e) => setForm({ ...form, billing_date: e.target.value })} /></label>
            <label style={fld}>Due date<input style={inp} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Pending", "Sent", "Paid", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 8 }}>An invoice number is generated automatically. "Pending" invoices count toward Expected; use "Mark received" in the ledger when paid.</div>
          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update payment" : "Save payment"} primary /></span></div>
        </div>
      )}

     {/* Filter tabs */}
      {rows && (
        <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: 4, marginBottom: 14, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
          {["All", "Pending", "Sent", "Paid", "Overdue", "Future"].map((f) => (
            <div key={f} onClick={() => setFilter(f)} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", background: filter === f ? "var(--brand)" : "transparent", color: filter === f ? "#fff" : "var(--txt-2)" }}>{f}</div>
          ))}
        </div>
      )}

      {/* FUTURE — projected recurring invoices, not yet raised */}
      {filter === "Future" && (() => {
        const proj = buildProjection();
        if (proj.length === 0) return <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No upcoming invoices. Set a rent and invoice day on your Let properties to project recurring invoices here.</div>;
        return (
          <Table cols={["Property", "Tenant", "Amount", "Invoice date", ""]}>
            {proj.map((r, i) => (
              <tr key={i}>
                <Td><span style={{ fontWeight: 500 }}>{r.property}</span></Td>
                <Td color="var(--txt-2)">{r.tenant || "—"}</Td>
                <Td>{gbp(r.amount)}</Td>
                <Td color="var(--txt-2)">{ukDate(r.due_date)}</Td>
                <Td>{DB_READY ? <span onClick={() => raiseInvoice(r)}><Btn icon="ti-file-plus" label={raising === r.property_id + r.month ? "Raising…" : "Raise"} primary /></span> : null}</Td>
              </tr>
            ))}
          </Table>
        );
      })()}

      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Payment ledger</div>
      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading payments…</div>
      ) : data.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No payments yet. Click "Add payment" to log your first one.</div>
      ) : (() => {
        const shown = filter === "All" ? data : data.filter((p) => normStatus(p.status) === filter);
        if (shown.length === 0) return <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No {filter.toLowerCase()} payments.</div>;
        return (
        <Table cols={["", "Tenant", "Property", "Subtotal", "VAT", "Total", "Due date", "Status", "Actions"]}>
          {shown.map((p, i) => {
            const isOpen = expandedId === (p.id || i);
            const pid = p.property_id;
            const same = (x) => pid && String(x.property_id) === String(pid);
            const propName = propLabel(properties, pid) || p.property || p.prop || "—";
            const pT = related.tenants.filter(same);
            const pC = related.comp.filter(same);
            const pM = related.maint.filter(same);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const b = vatBreakdown(p.amount);
            return (
              <React.Fragment key={p.id || i}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : (p.id || i))}>
                  <Td><i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 15, color: "var(--txt-3)" }} /></Td>
                  <Td><span style={{ fontWeight: 500 }}>{p.tenant}</span></Td>
                  <Td color="var(--txt-2)">{propName}</Td>
                  <Td color="var(--txt-2)">{money(b.sub)}</Td>
                  <Td color="var(--txt-2)">{money(b.vat)}</Td>
                  <Td><span style={{ fontWeight: 600 }}>{money(b.total)}</span></Td>
                  <Td color="var(--txt-2)">{ukDate(p.due_date || p.due)}</Td>
                  <Td><Pill text={normStatus(p.status)} tone={normStatus(p.status) === "Paid" ? "green" : normStatus(p.status) === "Overdue" ? "red" : normStatus(p.status) === "Sent" ? "blue" : "amber"} /></Td>
                  <Td>{p.id && DB_READY ? (
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      <ActionBtn icon="ti-send" title="Preview & send email" tone="brand" onClick={() => setEmailPayment(p)} />
                      <ActionBtn icon="ti-pencil" title="Edit" onClick={() => openEdit(p)} />
                      {["Pending", "Sent", "Overdue"].includes(normStatus(p.status)) && <ActionBtn icon="ti-check" title="Mark received" tone="green" onClick={() => markReceived(p)} />}
                      <ActionBtn icon="ti-trash" title="Delete" tone="red" onClick={() => remove(p.id)} />
                    </div>
                  ) : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 14 }}>
                          <DetailBox title="Tenant(s)" icon="ti-users" empty={pT.length === 0} emptyText={pid ? "No tenants on this property." : "No property linked."} onClick={() => go && go("tenants")}>
                            {pT.map((t, j) => <DetailRow key={j} main={t.name} sub={t.rent ? gbp(t.rent) + " pcm" : ""} pill={t.rent_status} tone={t.rent_status === "Overdue" ? "red" : "green"} />)}
                          </DetailBox>
                          <DetailBox title="Compliance" icon="ti-shield-check" empty={pC.length === 0} emptyText={pid ? "No certificates." : "No property linked."} onClick={() => go && go("compliance")}>
                            {pC.map((c, j) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; const tone = d === null ? "blue" : d <= 7 ? "red" : d <= 30 ? "amber" : "green"; return <DetailRow key={j} main={c.type} sub={c.expiry_date ? `expires ${ukDate(c.expiry_date)}` : ""} pill={d === null ? "—" : d < 0 ? "expired" : d + "d"} tone={tone} />; })}
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
        );
      })()}
      {emailPayment && (
        <PaymentEmailModal
          payment={emailPayment}
          tenant={related.tenants.find((t) => t.name === emailPayment.tenant)}
          propName={propLabel(properties, emailPayment.property_id) || emailPayment.property || "—"}
          user={user}
          onClose={() => setEmailPayment(null)}
          onSent={async () => {
            // Emailing the invoice moves it Pending -> Sent (Paid/Overdue stay as they are).
            if (emailPayment.id && DB_READY && normStatus(emailPayment.status) === "Pending") {
              await db.from("prop_payments").update({ status: "Sent" }).eq("id", emailPayment.id);
            }
            refresh();
          }}
        />
      )}
    </div>
  );
}


export function DocumentsPage({ user }) {
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
    if (!DB_READY) { setRows([]); return; }
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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


export function ReportsPage({ user }) {
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
        right={<div style={{ display: "flex", gap: 5, fontSize: 12, flexWrap: "wrap" }}>{periods.map((p) => <span key={p} onClick={() => setPeriod(p)} style={{ cursor: "pointer", padding: "7px 13px", borderRadius: 7, color: p === period ? "var(--txt)" : "var(--txt-2)", background: p === period ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (p === period ? "var(--line)" : "transparent") }}>{p}</span>)}</div>} />
      {period === "Custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
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


export function SettingsPage({ user }) {
  const isMobile = useIsMobile();
  const validTabs = ["organisation", "notifications", "email", "vat", "subscription"];
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.replace("#", "");
      if (validTabs.includes(h)) return h;
    }
    return "organisation";
  });
  // Open the right tab when arriving via a hash link (e.g. "View plans" → #subscription).
  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.replace("#", "");
      if (validTabs.includes(h)) setTab(h);
    };
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);
  const [org, setOrg] = useState({ company_name: "", vat_number: "", address: "", city: "", postcode: "", phone: "", business_email: "", website: "", logo_url: "" });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [notif, setNotif] = useState({ notify_compliance: true, notify_rent: true, reminder_lead: "30 / 7 days before expiry" });
  const [email, setEmail] = useState({ smtp_provider: "custom", smtp_host: "", smtp_port: 587, smtp_secure: false, smtp_user: "", smtp_pass: "", smtp_from_name: "", smtp_from_email: "", smtp_reply_to: "" });
  const [vat, setVat] = useState({ vat_scheme: "standard", vat_number: "", flat_rate: 16.5 });
  const [showPass, setShowPass] = useState(false);
  const [smtpTest, setSmtpTest] = useState(null); // null | 'testing' | 'success' | 'error'
  const [smtpTestMsg, setSmtpTestMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [memberId, setMemberId] = useState(null);
  const [currentTier, setCurrentTier] = useState("basic"); // billing key, from product_members (source of truth)
  const [changingTier, setChangingTier] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // product_members is the source of truth for the paid tier (kept in sync by
  // the Stripe webhook). Load the row id (the webhook's PATCH key) + tier.
  // PropertyOps uses the same standardised tier keys as the other verticals
  // (basic/bronze/silver/gold), so the key goes straight to checkout.
  useEffect(() => {
    if (!DB_READY || !user) return;
    db.from("product_members").select("id,tier").eq("user_id", user.id).eq("product", "propertyops").maybeSingle()
      .then(({ data }) => {
        if (data?.id) setMemberId(data.id);
        const key = (data && (data.tier || data.plan) || "basic").toLowerCase();
        setCurrentTier(["basic", "bronze", "silver", "gold"].includes(key) ? key : "basic");
      })
      .catch(() => {});
  }, [user]);

  // Tidy the ?billing= param after returning from Stripe Checkout (the effect
  // above already re-reads the tier on this fresh page load).
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

  // Start a real Stripe Checkout for the chosen plan, then redirect to it.
  // `garageId` carries the product_members row id (the webhook's PATCH key);
  // `tier` is the standardised billing key.
  const startCheckout = async (tierKey) => {
    if (!memberId || !user?.email || !tierKey) {
      alert("Your account is still loading — please try again in a moment.");
      return;
    }
    setChangingTier(tierKey);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          email: user.email,
          garageId: memberId,
          product: "propertyops",
          tier: tierKey,
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
        body: JSON.stringify({ garageId: memberId, product: "propertyops" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open billing portal");
      window.location.href = data.url;
    } catch (e) {
      alert(e.message || "Could not open billing portal");
      setPortalLoading(false);
    }
  };

  // SMTP provider presets — picking one fills in host/port/security
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

  const TABS = [
    { key: "organisation", label: "Organisation", icon: "ti-building" },
    { key: "notifications", label: "Notifications", icon: "ti-bell" },
    { key: "email", label: "Email", icon: "ti-mail" },
    { key: "vat", label: "VAT", icon: "ti-receipt" },
    { key: "subscription", label: "Subscription", icon: "ti-credit-card" },
  ];

  useEffect(() => {
    if (!DB_READY) { setLoaded(true); return; }
    db.from("prop_settings").select("*").eq("user_id", user.id)
      .then(({ data, error }) => {
        const row = !error && data && data.length ? data[0] : null;
        if (row) {
          setOrg({ company_name: row.company_name || "", vat_number: row.vat_number || "", address: row.address || "", city: row.city || "", postcode: row.postcode || "", phone: row.phone || "", business_email: row.business_email || "", website: row.website || "", logo_url: row.logo_url || "" });
          setNotif({
            notify_compliance: row.notify_compliance !== false,
            notify_rent: row.notify_rent !== false,
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
          setOrg((o) => ({ ...o, company_name: user.user_metadata.company_name }));
        }
        setLoaded(true);
      });
  }, []);

  const saveOrg = async () => {
    if (!DB_READY) { setErr("Add your Supabase keys to save."); return; }
    setErr(""); setSaving(true); setSaved(false);
    const record = {
      user_id: user.id,
      company_name: org.company_name,
      vat_number: vat.vat_number || org.vat_number,
      address: org.address, city: org.city, postcode: org.postcode,
      phone: org.phone, business_email: org.business_email, website: org.website,
      logo_url: org.logo_url,
      notify_compliance: notif.notify_compliance, notify_rent: notif.notify_rent, reminder_lead: notif.reminder_lead,
      smtp_provider: email.smtp_provider, smtp_host: email.smtp_host, smtp_port: email.smtp_port, smtp_secure: email.smtp_secure,
      smtp_user: email.smtp_user, smtp_pass: email.smtp_pass, smtp_from_name: email.smtp_from_name, smtp_from_email: email.smtp_from_email, smtp_reply_to: email.smtp_reply_to,
      vat_scheme: vat.vat_scheme, flat_rate: vat.flat_rate,
      updated_at: new Date().toISOString(),
    };
    // upsert, then read back to confirm it actually persisted
    const { error: upErr } = await db.from("prop_settings").upsert(record, { onConflict: "user_id" });
    if (upErr) { setSaving(false); setErr("Couldn't save: " + upErr.message); return; }
    const { data: check, error: readErr } = await db.from("prop_settings").select("company_name,vat_number,address,city,postcode,phone,business_email,website,logo_url").eq("user_id", user.id);
    setSaving(false);
    if (readErr) { setErr("Saved, but couldn't confirm: " + readErr.message); return; }
    const row = check && check.length ? check[0] : null;
    if (!row) { setErr("Save didn't persist — this usually means the prop_settings table is missing the new columns. Re-run the settings SQL in Supabase."); return; }
    setOrg({ company_name: row.company_name || "", vat_number: row.vat_number || "", address: row.address || "", city: row.city || "", postcode: row.postcode || "", phone: row.phone || "", business_email: row.business_email || "", website: row.website || "", logo_url: row.logo_url || "" });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // Upload a company logo to the Supabase "logos" bucket, keyed by user id.
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");
    if (!file.type.startsWith("image/")) { setLogoError("Please choose an image file (PNG or JPG)."); return; }
    if (file.size > 2 * 1024 * 1024) { setLogoError("Logo must be under 2MB."); return; }
    if (!DB_READY) { setLogoError("Add your Supabase keys to upload."); return; }
    setLogoUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}.${ext}`;
      const { error: upErr } = await db.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = db.storage.from("logos").getPublicUrl(path);
      setOrg((o) => ({ ...o, logo_url: `${data.publicUrl}?v=${Date.now()}` }));
    } catch (err) {
      setLogoError("Upload failed: " + (err.message || "unknown error"));
    }
    setLogoUploading(false);
  };

  // Picking a provider preset fills host/port/security
  const pickProvider = (p) => {
    const preset = SMTP_PRESETS[p];
    setEmail({ ...email, smtp_provider: p, ...(preset ? { smtp_host: preset.host, smtp_port: preset.port, smtp_secure: preset.secure } : {}) });
  };

  // Tests the SMTP details for real against the shared /api/test-smtp endpoint
  const testSmtp = async () => {
    if (!email.smtp_host || !email.smtp_user || !email.smtp_pass) {
      setSmtpTest("error"); setSmtpTestMsg("Fill in the SMTP host, username and password first.");
      return;
    }
    setSmtpTest("testing"); setSmtpTestMsg("");
    try {
      const res = await fetch("/api/test-smtp", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ host: email.smtp_host, port: email.smtp_port || 587, secure: !!email.smtp_secure, user: email.smtp_user, pass: email.smtp_pass, fromName: email.smtp_from_name || org.company_name || "" }),
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

  // Standardised four-tier plan, consistent with the other verticals. Prices
  // match the shared Stripe prices (api/_billing-config.js): the tier key is
  // sent straight to checkout.
  const tiers = [
    { key: "basic",  name: "Basic",  icon: "⚪", price: 12.99, sub: "per month", best: "Getting started",     features: ["Up to 5 properties", "Tenant & rent records", "Dashboard overview", "1 user"] },
    { key: "bronze", name: "Bronze", icon: "🥉", price: 18.99, sub: "per month", best: "Small portfolios",     features: ["Everything in Basic", "Up to 15 properties", "Maintenance tracking", "Contractor jobs", "1 user"] },
    { key: "silver", name: "Silver", icon: "🥈", price: 28.99, sub: "per month", best: "Growing portfolios",   features: ["Everything in Bronze", "Unlimited properties", "Compliance & certificates", "Reports & insights", "Finance tracking", "2 users"] },
    { key: "gold",   name: "Gold",   icon: "🥇", price: 39.99, sub: "per month", best: "Full operation",       features: ["Everything in Silver", "Document vault", "Advanced reporting & export", "Priority support", "Unlimited users"] },
  ];

  const inp = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
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

  return (
    <div className="fade-in">
      <PageHead title="Settings" sub="Manage your organisation, team and subscription." />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 12, padding: 5, marginBottom: 18, width: isMobile ? "100%" : "fit-content", overflowX: "auto" }}>
        {TABS.map((t) => (
          <div key={t.key} onClick={() => setTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: isMobile ? "9px 12px" : "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", background: tab === t.key ? "var(--brand)" : "transparent", color: tab === t.key ? "#fff" : "var(--txt-2)" }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />{t.label}
          </div>
        ))}
      </div>

      {/* ORGANISATION */}
      {tab === "organisation" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
          <div style={card}>
            {head("ti-building", "Organisation")}
            {!loaded ? <div style={{ fontSize: 12, color: "var(--txt-3)" }}>Loading…</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={fld}>Company name<input style={inp} placeholder="e.g. Alzaro Property Co." value={org.company_name} onChange={(e) => setOrg({ ...org, company_name: e.target.value })} /></label>
                <label style={fld}>Address<input style={inp} placeholder="123 High Street" value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} /></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={fld}>City<input style={inp} placeholder="Bradford" value={org.city} onChange={(e) => setOrg({ ...org, city: e.target.value })} /></label>
                  <label style={fld}>Postcode<input style={inp} placeholder="BD1 1AA" value={org.postcode} onChange={(e) => setOrg({ ...org, postcode: e.target.value })} /></label>
                </div>
                <label style={fld}>Phone<input style={inp} placeholder="01274 123456" value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} /></label>
                <label style={fld}>Business email<input style={inp} placeholder="info@yourcompany.co.uk" value={org.business_email} onChange={(e) => setOrg({ ...org, business_email: e.target.value })} /></label>
                <label style={fld}>Website<input style={inp} placeholder="www.yourcompany.co.uk" value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} /></label>
                <label style={fld}>VAT number<input style={inp} placeholder="e.g. GB 123 4567 89" value={org.vat_number} onChange={(e) => setOrg({ ...org, vat_number: e.target.value })} /></label>
                <div style={{ ...fld, gap: 8 }}>
                  <span>Company logo</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 10, border: "0.5px solid var(--line)", background: "var(--panel-2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {org.logo_url ? <img src={org.logo_url} alt="Company logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <i className="ti ti-photo" style={{ fontSize: 22, color: "var(--txt-3)" }} />}
                    </div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: logoUploading ? "default" : "pointer", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 13px", fontSize: 12, color: "var(--txt-2)" }}>
                      <i className={`ti ${logoUploading ? "ti-loader" : "ti-upload"}`} style={{ fontSize: 14 }} />
                      {logoUploading ? "Uploading…" : org.logo_url ? "Replace logo" : "Upload logo"}
                      <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} disabled={logoUploading} style={{ display: "none" }} />
                    </label>
                    {org.logo_url && <span onClick={() => setOrg({ ...org, logo_url: "" })} style={{ fontSize: 12, color: "var(--red)", cursor: "pointer" }}>Remove</span>}
                  </div>
                  {logoError && <span style={{ fontSize: 11.5, color: "var(--red)" }}>{logoError}</span>}
                  <span style={{ fontSize: 11, color: "var(--txt-3)" }}>PNG or JPG, under 2MB. Remember to Save changes.</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingTop: 4 }}><span style={{ color: "var(--txt-2)" }}>Current plan</span><span style={{ fontWeight: 600, color: "var(--brand)" }}>{(tiers.find((t) => t.key === currentTier) || {}).name || "Basic"}</span></div>
                {err && <div style={{ fontSize: 11.5, color: "var(--red)" }}>{err}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span onClick={saveOrg}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : "Save changes"} primary /></span>
                  {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
                </div>
              </div>
            )}
          </div>

          <div style={card}>
            {head("ti-users", "Team & roles")}
            {[["You", user ? user.email : "—", "Admin"], ["Invite teammates", "Coming soon", ""]].map((r, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: j === 0 ? "0.5px solid var(--line)" : "none", fontSize: 12.5 }}>
                <span style={{ color: "var(--txt-2)" }}>{r[0]}{r[1] && r[1] !== "Coming soon" ? ` · ${r[1]}` : ""}{r[1] === "Coming soon" ? ` · ${r[1]}` : ""}</span><span style={{ fontWeight: 500, color: r[2] === "Admin" ? "var(--brand)" : "var(--txt)" }}>{r[2]}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 8 }}>Multi-user teams arrive with the Silver and Gold plans.</div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div style={card}>
          {head("ti-bell", "Notifications")}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <span onClick={saveOrg}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : "Save changes"} primary /></span>
              {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 8 }}>Email delivery of these reminders is coming soon — alerts currently show in the app.</div>
          </div>
        </div>
      )}

      {/* EMAIL */}
      {tab === "email" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
          <div style={card}>
            {head("ti-mail", "Email & SMTP")}
            <p style={{ fontSize: 11.5, color: "var(--txt-2)", marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>Send compliance reminders, rent alerts and invoices straight from your own domain. Pick a provider to auto-fill the server settings.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Email provider</label>
              <select style={inp} value={email.smtp_provider} onChange={(e) => pickProvider(e.target.value)}>
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
              <div><label style={lbl}>SMTP host</label><input style={inp} value={email.smtp_host} onChange={(e) => setEmail({ ...email, smtp_host: e.target.value })} placeholder="smtp.resend.com" /></div>
              <div><label style={lbl}>Port</label><input style={inp} type="number" value={email.smtp_port} onChange={(e) => setEmail({ ...email, smtp_port: parseInt(e.target.value) || 587 })} placeholder="587" /></div>
              <div><label style={lbl}>Security</label>
                <select style={inp} value={email.smtp_secure ? "ssl" : "tls"} onChange={(e) => setEmail({ ...email, smtp_secure: e.target.value === "ssl" })}>
                  <option value="tls">TLS (587)</option>
                  <option value="ssl">SSL (465)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Username / Email</label><input style={inp} value={email.smtp_user} onChange={(e) => setEmail({ ...email, smtp_user: e.target.value })} placeholder="you@yourdomain.com" /></div>
              <div><label style={lbl}>Password / API key</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...inp, paddingRight: 38 }} type={showPass ? "text" : "password"} value={email.smtp_pass} onChange={(e) => setEmail({ ...email, smtp_pass: e.target.value })} placeholder="••••••••••••" />
                  <span onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--txt-3)", fontSize: 13 }}><i className={`ti ${showPass ? "ti-eye-off" : "ti-eye"}`} /></span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>From name</label><input style={inp} value={email.smtp_from_name} onChange={(e) => setEmail({ ...email, smtp_from_name: e.target.value })} placeholder={org.company_name || "Alzaro PropertyOps"} /></div>
              <div><label style={lbl}>From email</label><input style={inp} type="email" value={email.smtp_from_email} onChange={(e) => setEmail({ ...email, smtp_from_email: e.target.value })} placeholder="noreply@yourdomain.com" /></div>
            </div>

            <div style={{ marginBottom: 16 }}><label style={lbl}>Reply-to email (optional)</label><input style={inp} type="email" value={email.smtp_reply_to} onChange={(e) => setEmail({ ...email, smtp_reply_to: e.target.value })} placeholder="support@yourdomain.com" /></div>

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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
              <span onClick={saveOrg}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : "Save changes"} primary /></span>
              {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
            </div>
          </div>
        </div>
      )}

      {/* VAT */}
      {tab === "vat" && (
        <div style={{ ...card, maxWidth: 760 }}>
          {head("ti-receipt", "VAT")}
          <p style={{ fontSize: 11.5, color: "var(--txt-2)", marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>Set your VAT scheme and registration details. These flow through to your invoices and reports.</p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div><label style={lbl}>VAT scheme</label>
              <select style={inp} value={vat.vat_scheme} onChange={(e) => setVat({ ...vat, vat_scheme: e.target.value })}>
                <option value="standard">Standard rate (20%)</option>
                <option value="flatrate">Flat rate scheme</option>
                <option value="exempt">Not VAT registered</option>
              </select>
            </div>
            <div><label style={lbl}>VAT number</label><input style={inp} value={vat.vat_number} onChange={(e) => setVat({ ...vat, vat_number: e.target.value })} placeholder="GB 123 4567 89" /></div>
            {vat.vat_scheme === "flatrate" && (
              <div><label style={lbl}>Flat rate %</label><input style={inp} type="number" step="0.1" value={vat.flat_rate} onChange={(e) => setVat({ ...vat, flat_rate: parseFloat(e.target.value) })} placeholder="16.5" /><div style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 4 }}>Check HMRC for your sector's flat rate.</div></div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            {vat.vat_scheme === "standard" && (
              <div style={{ background: "var(--brand-soft)", border: "0.5px solid var(--line)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--brand)", marginBottom: 5 }}>Standard rate (20%)</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.5 }}>Charge 20% VAT on invoices and reclaim VAT on purchases. Most landlords and agencies use this.</div>
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
                <div style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.5 }}>Invoices will not include VAT charges.</div>
              </div>
            )}
          </div>

          {err && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 14 }}>{err}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
            <span onClick={saveOrg}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : "Save changes"} primary /></span>
            {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
          </div>
        </div>
      )}

      {/* SUBSCRIPTION */}
      {tab === "subscription" && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 11 }}>Subscription &amp; plans</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,1fr)", gap: 12 }}>
            {tiers.map((t) => {
              const isCurrent = t.key === currentTier;
              return (
                <div key={t.key} style={{ background: "var(--panel-2)", border: isCurrent ? "1.5px solid var(--brand)" : "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "18px 18px", position: "relative" }}>
                  {isCurrent && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--brand)", padding: "3px 9px", borderRadius: 6 }}>CURRENT</span>}
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.icon} {t.name}</div>
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
                    <div onClick={() => { if (!changingTier) startCheckout(t.key); }} style={{ textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--brand)", padding: "9px", border: "1px solid var(--brand)", borderRadius: 8, cursor: changingTier ? "default" : "pointer", opacity: changingTier && changingTier !== t.key ? 0.6 : 1 }}>{changingTier === t.key ? "Starting checkout…" : `${t.price > ((tiers.find((x) => x.key === currentTier) || {}).price || 0) ? "Upgrade" : "Switch"} to ${t.name}`}</div>
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

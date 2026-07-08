import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Btn, ConfirmDialog, DetailBox, DetailRow, Metric, PageHead, Pill, ReportPreview, Table, Td, useConfirm } from "../components/UI.jsx";
import { REPORTS, buildReport, gbp, ukDate, propLabel, toneVar, usePropertyList, useIsMobile, effectiveStatus, friendlyError } from "../lib/helpers.js";
import { DB_READY, db } from "../lib/supabase.js";

// Reusable centered popup for quick-add forms (tenant/property in Finance).
// Locks the page scroll behind it and centres on desktop / bottom-sheet on
// mobile so the form is always in view instead of pushing the page down.
function QuickAddModal({ title, icon, onClose, children }) {
  const isMobile = useIsMobile();
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, []);
  return createPortal((
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 14 : "40px 20px", zIndex: 3000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: isMobile ? "100%" : 620, maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", borderBottom: "0.5px solid var(--line)", position: "sticky", top: 0, background: "var(--panel)", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><i className={`ti ${icon}`} style={{ fontSize: 17, color: "var(--brand)" }} /><span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span></div>
          <i className="ti ti-x" onClick={onClose} style={{ fontSize: 19, color: "var(--txt-2)", cursor: "pointer" }} />
        </div>
        <div style={{ padding: isMobile ? 16 : 20 }}>{children}</div>
      </div>
    </div>
  ), document.body);
}

export function MaintenancePage({ user, go }) {
  const isMobile = useIsMobile();
  const stages = ["Reported", "Assigned", "In Progress", "Completed"];
  const toneFor = { High: "red", Medium: "amber", Low: "blue" };
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const formRef = useRef(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  // Bring the edit/add form into view — clicking Edit on a row far down the
  // list renders the form at the top, which would otherwise be off-screen.
  const scrollToForm = () => { setTimeout(() => { try { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }, 60); };
  const properties = usePropertyList();
  const blank = { title: "", property_id: "", priority: "Medium", contractor: "", status: "Reported", cost: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_maintenance").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(friendlyError(error, "loading data")); setRows([]); } else setRows(data); });
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_maintenance").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (j) => { setForm({ title: j.title || "", property_id: j.property_id || "", priority: j.priority || "Medium", contractor: j.contractor || "", status: j.status || "Reported", cost: j.cost ?? "" }); setEditId(j.id); setAdding(true); setErr(""); scrollToForm(); };

  const save = async () => {
    if (savingRef.current) return; // guard against double-click double-insert
    if (!form.title.trim()) { setErr("Job title is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    savingRef.current = true; setSaving(true);
    const payload = { ...form, cost: form.cost === "" ? null : +form.cost, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    let error;
    if (editId) ({ error } = await db.from("prop_maintenance").update(payload).eq("id", editId));
    else ({ error } = await db.from("prop_maintenance").insert([{ ...payload, user_id: user.id }]));
    savingRef.current = false; setSaving(false);
    if (error) { setErr(friendlyError(error)); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const confirm = useConfirm();
  const doRemove = async (id) => { if (id && DB_READY) { await db.from("prop_maintenance").delete().eq("id", id); refresh(); } };
  const remove = (id) => confirm.ask({ title: "Delete this job?", message: "This maintenance job will be permanently deleted. This can't be undone.", onConfirm: () => doRemove(id) });

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
      <ConfirmDialog {...confirm.props} />
      <PageHead title="Maintenance" sub={rows ? `${open} open job${open === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}` : "Loading…"}
        right={<span onClick={openAdd}><Btn icon={adding ? "ti-x" : "ti-plus"} label={adding ? "Cancel" : "New job"} primary /></span>} />

      {!DB_READY && <div style={{ fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

      {adding && (
        <div ref={formRef} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit job" : "New maintenance job"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
            <label style={fld}>Issue / job title<input style={inp} placeholder="e.g. Boiler not firing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Contractor<input style={inp} placeholder="e.g. GasPro Ltd" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></label>
            <label style={fld}>Priority<select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Cost (£)<input style={inp} type="number" step="0.01" placeholder="e.g. 120.00" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{stages.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{ marginTop: 12 }}><span onClick={saving ? undefined : save} style={{ opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : (editId ? "Update job" : "Save job")} primary /></span></div>
        </div>
      )}

      {rows && rows.length > 0 && DB_READY && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--txt-3)", marginBottom: 12 }}>
          <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
          <span>Hold and drag a card between columns to update its stage{isMobile ? ", or use the ← → arrows on each card" : ""}.</span>
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
                      {j.id && DB_READY && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, color: "var(--txt-3)" }}>
                          <i className="ti ti-grip-vertical" style={{ fontSize: 13 }} />
                          <span style={{ fontSize: 9.5, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600 }}>Hold to drag</span>
                        </div>
                      )}
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
  const [smtp, setSmtp] = useState(null); // user's own SMTP, or null = use Alzaro
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const build = async () => {
      let biz = "Alzaro PropertyOps";
      if (DB_READY) {
        // NOTE: we deliberately do NOT read smtp_pass into the browser. The
        // password stays server-side; /api/send-email resolves it from
        // prop_settings by the authenticated user_id. Here we only need the
        // non-secret fields to know email is configured and to show the sender.
        const { data: s } = await db.from("prop_settings").select("company_name, smtp_host, smtp_user, smtp_from_email, smtp_reply_to").eq("user_id", user.id);
        if (s && s.length) {
          if (s[0].company_name) biz = s[0].company_name;
          // Treat SMTP as configured when host + user are present (the server
          // verifies the stored password exists at send time).
          const r = s[0];
          if (r.smtp_host && r.smtp_user) {
            setSmtp({ user: r.smtp_user, fromEmail: r.smtp_from_email || r.smtp_user, replyTo: r.smtp_reply_to || "" });
          }
        }
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
    if (!smtp) { setStatus("error"); setMsg("Set up your business email in Settings → Email before sending invoices. This keeps your invoices coming from your own company address."); return; }
    if (!to.trim()) { setStatus("error"); setMsg("Add a recipient email address first."); return; }
    setStatus("sending"); setMsg("");
    try {
      const { data: sess } = await db.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setStatus("error"); setMsg("You need to be signed in to send."); return; }
      // Escape &, <, > (order matters: & first) before turning newlines into
      // <br>, so names like "Barker & Sons" don't become broken HTML entities.
      const esc = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${esc.replace(/\n/g, "<br>")}</div>`;
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // No SMTP credentials in the body — the server resolves them from
        // prop_settings by our authenticated user_id. product tells it which.
        body: JSON.stringify({ to: to.trim(), subject, html, text: body, fromName: bizName, replyTo: smtp?.replyTo || undefined, product: "propertyops", requireSmtp: true }),
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
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--txt-3)" }}>
              <i className={smtp ? "ti ti-mail-check" : "ti ti-alert-triangle"} style={{ fontSize: 13, color: smtp ? "var(--green)" : "var(--amber)" }} />
              {smtp
                ? <span>Sending from <b style={{ color: "var(--txt-2)" }}>{smtp.fromEmail}</b> (your email). Replies go to you.</span>
                : <span style={{ color: "var(--amber)" }}>Set up your business email in <b>Settings → Email</b> before sending, so invoices come from your company — not from Alzaro.</span>}
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span onClick={status === "sending" || !smtp ? undefined : send} style={{ opacity: smtp ? 1 : 0.5, cursor: smtp ? "pointer" : "not-allowed" }}><Btn icon="ti-send" label={status === "sending" ? "Sending…" : "Send invoice"} primary /></span>
              <span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span>
              {smtp
                ? <span style={{ fontSize: 10.5, color: "var(--txt-3)", marginLeft: "auto" }}>Sends from {smtp.fromEmail}</span>
                : <span style={{ fontSize: 10.5, color: "var(--amber)", marginLeft: "auto" }}>Email setup required — Settings → Email</span>}
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
  const formRef = useRef(null);
  // Bring the edit/add form into view when editing a row far down the list.
  const scrollToForm = () => { setTimeout(() => { try { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }, 60); };
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], comp: [], maint: [] });
  // Locally-managed, refreshable property list so inline "Add property" below
  // updates the dropdown immediately (usePropertyList has no refresh).
  const [properties, setProperties] = useState([]);
  // Inline "quick add" forms so the user can create a tenant or property
  // without leaving Finance and losing the half-filled payment.
  const tBlank = { name: "", property_id: "", email: "", phone: "", tenancy_start: "", tenancy_end: "", deposit_amount: "", deposit_protected: false, rent_status: "Up to date", rtr_status: "Pending", co_tenant_name: "", co_tenant_email: "", co_tenant_phone: "" };
  const pBlank = { address: "", area: "", type: "House", status: "Let", rent: "", invoice_day: "" };
  const [addTenant, setAddTenant] = useState(false);
  const [addProperty, setAddProperty] = useState(false);
  const [tForm, setTForm] = useState(tBlank);
  const [pForm, setPForm] = useState(pBlank);
  const [tErr, setTErr] = useState("");
  const [pErr, setPErr] = useState("");
  const tSavingRef = useRef(false);
  const pSavingRef = useRef(false);
  const [tSaving, setTSaving] = useState(false);
  const [pSaving, setPSaving] = useState(false);
  const blank = { tenant: "", property_id: "", amount: "", due_date: "", billing_date: "", invoice_no: "", status: "Pending" };
  const [form, setForm] = useState(blank);
  const [emailPayment, setEmailPayment] = useState(null);
  const [filter, setFilter] = useState("All");
  // Payment-ledger sort. Click a column header to sort; click again to flip
  // direction. Default: due date, soonest first.
  const [sort, setSort] = useState({ key: "due_date", dir: "asc" });
  const onSort = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const [fullProps, setFullProps] = useState([]);
  const [raising, setRaising] = useState(null);
  const raisingRef = useRef(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [raisedMsg, setRaisedMsg] = useState("");
  // Company VAT scheme drives how the ledger splits amounts (see vatBreakdown).
  // Defaults to "exempt" (no VAT) until settings load — safer than assuming 20%.
  const [vatScheme, setVatScheme] = useState("exempt");

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_payments").select("*").order("due_date", { ascending: false })
      .then(({ data, error }) => { if (error) { setErr(friendlyError(error, "loading data")); setRows([]); } else setRows(data); });
    Promise.all([
      db.from("prop_tenants").select("*"), db.from("prop_compliance").select("*"), db.from("prop_maintenance").select("*"),
    ]).then(([t, c, m]) => setRelated({ tenants: t.data || [], comp: c.data || [], maint: m.data || [] }));
    db.from("prop_properties").select("*").then(({ data }) => { setFullProps(data || []); setProperties(data || []); });
    db.from("prop_settings").select("vat_scheme").eq("user_id", user.id)
      .then(({ data }) => { if (data && data[0] && data[0].vat_scheme) setVatScheme(data[0].vat_scheme); });
  }, []);

  const refresh = async () => {
    const { data } = await db.from("prop_payments").select("*").order("due_date", { ascending: false });
    setRows(data || []);
  };

  // Reload tenants + properties after an inline quick-add so the dropdowns
  // reflect the new record straight away.
  const refreshTenants = async () => {
    const { data } = await db.from("prop_tenants").select("*");
    setRelated((r) => ({ ...r, tenants: data || [] }));
    return data || [];
  };
  const refreshProperties = async () => {
    const { data } = await db.from("prop_properties").select("*");
    setFullProps(data || []); setProperties(data || []);
    return data || [];
  };

  // Quick-add a tenant from inside Finance, then auto-select them (and their
  // property) on the payment form so the flow continues without a page change.
  const saveTenant = async () => {
    if (tSavingRef.current) return;
    if (!tForm.name.trim()) { setTErr("Tenant name is required."); return; }
    if (!DB_READY) { setTErr("Add your Supabase keys to save for real."); return; }
    setTErr(""); tSavingRef.current = true; setTSaving(true);
    const payload = {
      name: tForm.name.trim(), property_id: tForm.property_id || null,
      email: tForm.email || null, phone: tForm.phone || null,
      tenancy_start: tForm.tenancy_start || null, tenancy_end: tForm.tenancy_end || null,
      deposit_amount: tForm.deposit_amount === "" ? null : +tForm.deposit_amount,
      deposit_protected: !!tForm.deposit_protected,
      rent_status: tForm.rent_status || "Up to date", rtr_status: tForm.rtr_status || "Pending",
      co_tenant_name: tForm.co_tenant_name || null, co_tenant_email: tForm.co_tenant_email || null, co_tenant_phone: tForm.co_tenant_phone || null,
    };
    const { error } = await db.from("prop_tenants").insert([{ ...payload, user_id: user.id }]);
    // If linked to a vacant property, mark it Let to mirror the Tenants page.
    if (!error && tForm.property_id) {
      const { data: prop } = await db.from("prop_properties").select("status").eq("id", tForm.property_id).maybeSingle();
      if (prop && prop.status === "Vacant") await db.from("prop_properties").update({ status: "Let" }).eq("id", tForm.property_id);
    }
    tSavingRef.current = false; setTSaving(false);
    if (error) { setTErr(error.message); return; }
    await refreshTenants(); await refreshProperties();
    // Auto-select the new tenant on the payment form.
    const pid = tForm.property_id || "";
    setForm((f) => ({ ...f, tenant: tForm.name.trim(), property_id: pid || f.property_id, amount: pid ? rentForProp(pid) : f.amount }));
    setTForm(tBlank); setAddTenant(false);
  };

  // Quick-add a property from inside Finance, then auto-select it.
  const saveProperty = async () => {
    if (pSavingRef.current) return;
    if (!pForm.address.trim()) { setPErr("Address is required."); return; }
    if (!DB_READY) { setPErr("Add your Supabase keys to save for real."); return; }
    if (pForm.invoice_day !== "" && pForm.invoice_day != null) {
      const day = Number(pForm.invoice_day);
      if (!Number.isInteger(day) || day < 1 || day > 31) { setPErr("Invoice day needs to be a whole number between 1 and 31."); return; }
    }
    setPErr(""); pSavingRef.current = true; setPSaving(true);
    const payload = { ...pForm, rent: pForm.rent === "" ? 0 : +pForm.rent, invoice_day: pForm.invoice_day === "" ? null : Number(pForm.invoice_day) };
    const { data, error } = await db.from("prop_properties").insert([{ ...payload, score: 100, user_id: user.id }]).select();
    pSavingRef.current = false; setPSaving(false);
    if (error) { setPErr(error.message); return; }
    await refreshProperties();
    const newId = data && data[0] ? data[0].id : "";
    // Auto-select the new property on the payment form and pull its rent.
    setForm((f) => ({ ...f, property_id: newId || f.property_id, amount: newId ? (payload.rent || f.amount) : f.amount }));
    setPForm(pBlank); setAddProperty(false);
  };

  const openAdd = () => { setForm(blank); setEditId(null); setAdding(!adding); setErr(""); };
  const openEdit = (p) => { const ns = String(p.status || "").toLowerCase(); const status = ns === "paid" ? "Paid" : ns === "overdue" ? "Overdue" : ns === "sent" ? "Sent" : "Pending"; setForm({ tenant: p.tenant || "", property_id: p.property_id || "", amount: p.amount || "", due_date: p.due_date || "", billing_date: p.billing_date || "", invoice_no: p.invoice_no || "", status }); setEditId(p.id); setAdding(true); setErr(""); scrollToForm(); };

  // Rent for a property (from the full property rows, which include rent).
  const rentForProp = (pid) => { const p = fullProps.find((x) => String(x.id) === String(pid)); return p && p.rent ? p.rent : ""; };
  const propIdForTenant = (name) => { const t = related.tenants.find((x) => x.name === name); return t ? (t.property_id || "") : ""; };
  const tenantForProp = (pid) => { const t = related.tenants.find((x) => String(x.property_id) === String(pid)); return t ? t.name : ""; };

  // Strict binding: pick a tenant → their property + rent. When a property is
  // resolved, the amount ALWAYS follows that property's rent (even if 0/blank),
  // so switching tenant/property never leaves a stale amount from the previous
  // choice. Only keep the current amount when no property is resolved at all.
  const onPickTenant = (name) => {
    const pid = propIdForTenant(name);
    setForm((f) => ({ ...f, tenant: name, property_id: pid || f.property_id, amount: pid ? rentForProp(pid) : f.amount }));
  };
  // Pick a property → its tenant + rent. Amount always follows the property.
  const onPickProperty = (pid) => {
    setForm((f) => ({ ...f, property_id: pid, tenant: pid ? (tenantForProp(pid) || f.tenant) : f.tenant, amount: pid ? rentForProp(pid) : f.amount }));
  };

  // Safety net: once rent data has loaded, fill amount if a property is chosen but amount is still blank.
  useEffect(() => {
    if (adding && form.property_id && !form.amount) {
      const r = rentForProp(form.property_id);
      if (r) setForm((f) => (f.amount ? f : { ...f, amount: r }));
    }
  }, [form.property_id, fullProps, adding]);

  const save = async () => {
    if (savingRef.current) return; // guard against double-click double-insert
    if (!form.tenant.trim()) { setErr("Tenant is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    savingRef.current = true; setSaving(true);
    const invoiceNo = form.invoice_no || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const payload = { ...form, amount: form.amount === "" ? 0 : +form.amount, property_id: form.property_id || null, property: propLabel(properties, form.property_id), invoice_no: invoiceNo };
    // Empty date → null (not delete), so clearing a date on edit actually clears it.
    payload.due_date = form.due_date || null;
    payload.billing_date = form.billing_date || null;
    let error;
    if (editId) ({ error } = await db.from("prop_payments").update(payload).eq("id", editId));
    else ({ error } = await db.from("prop_payments").insert([{ ...payload, user_id: user.id }]));
    savingRef.current = false; setSaving(false);
    if (error) { setErr(friendlyError(error)); return; }
    setForm(blank); setAdding(false); setEditId(null); refresh();
  };

  const markReceived = async (p) => { if (p.id && DB_READY) { await db.from("prop_payments").update({ status: "Paid" }).eq("id", p.id); refresh(); } };

  // Build forward projection of rent invoices from Let properties' rent + invoice_day
  const buildProjection = () => {
    const out = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    // Format a Date as YYYY-MM-DD from its LOCAL parts. Using toISOString() here
    // shifts to UTC, so in British Summer Time (UTC+1) "1 July" was saved as
    // "2026-06-30" — wrong invoice dates, and the dedupe month landed in the
    // previous month, so the same month got offered again → duplicate invoices.
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // months already raised, keyed property_id + YYYY-MM
    const raised = new Set((rows || []).map((r) => `${r.property_id}|${(r.due_date || "").slice(0, 7)}`));
    fullProps.filter((p) => p.status === "Let" && p.rent && p.invoice_day).forEach((p) => {
      const wantDay = Math.min(31, Math.max(1, +p.invoice_day));
      // Project the next 3 months (the coming quarter). 12 months produced an
      // overwhelming wall of invoices reaching into the next year; 3 is enough
      // to plan ahead without that noise.
      for (let m = 0; m < 3; m++) {
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
          due_date: ymd(d),
          month: ym(d),
        });
      }
    });
    return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
  };

  const raiseInvoice = async (proj) => {
    if (!DB_READY) return;
    if (raisingRef.current) return; // guard against double-click duplicate raise
    raisingRef.current = true;
    setRaising(proj.property_id + proj.month);
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error } = await db.from("prop_payments").insert([{
      tenant: proj.tenant, property_id: proj.property_id, property: proj.property,
      amount: proj.amount, due_date: proj.due_date, invoice_no: invoiceNo,
      status: "Sent", user_id: user.id,
    }]);
    raisingRef.current = false;
    setRaising(null);
    if (error) { setErr(friendlyError(error)); return; }
    // Confirm it landed in the ledger — raising moves a projected invoice into
    // the real payment list (visible under All / Sent), so the row leaving the
    // Future tab is expected, not "nothing happening".
    setRaisedMsg(`Invoice raised for ${proj.property}${proj.tenant ? " · " + proj.tenant : ""} (${ukDate(proj.due_date)}) — now in the ledger under Sent.`);
    setTimeout(() => setRaisedMsg(""), 5000);
    refresh();
  };

  const confirm = useConfirm();
  const doRemove = async (id) => { if (id && DB_READY) { await db.from("prop_payments").delete().eq("id", id); refresh(); } };
  const remove = (id) => confirm.ask({ title: "Delete this invoice?", message: "This invoice/payment record will be permanently deleted. This can't be undone.", onConfirm: () => doRemove(id) });

const data = rows || [];
  // Stored statuses are inconsistent (older raised invoices saved lowercase
  // "sent") — normalise for every comparison/display so nothing vanishes.
  const normStatus = (s) => {
    const x = String(s || "").toLowerCase();
    return x === "paid" ? "Paid" : x === "overdue" ? "Overdue" : x === "sent" ? "Sent" : "Pending";
  };
  const collected = data.filter((p) => effectiveStatus(p) === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
  const overdue = data.filter((p) => effectiveStatus(p) === "Overdue").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = data.filter((p) => ["Pending", "Sent"].includes(effectiveStatus(p))).reduce((s, p) => s + (p.amount || 0), 0);
  const expected = collected + overdue + pending;
  const rate = expected ? Math.round((collected / expected) * 100) : 0;
  const paidCount = data.filter((p) => effectiveStatus(p) === "Paid").length;
  const overdueCount = data.filter((p) => effectiveStatus(p) === "Overdue").length;

  const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "Inter", outline: "none", width: "100%" };
  const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };

  // Split a stored gross amount into subtotal/VAT/total according to the
  // company's VAT scheme:
  //   • exempt / not VAT registered → no VAT (subtotal = total, VAT = 0).
  //     Correct for residential rent, which is VAT-exempt.
  //   • standard / flatrate → invoices show 20% VAT extracted from the gross.
  //     (Flat-rate only affects what you owe HMRC, not what you charge, so the
  //     customer-facing split is still 20%.)
  const vatApplies = vatScheme === "standard" || vatScheme === "flatrate";
  const vatBreakdown = (total) => {
    const t = +total || 0;
    if (!vatApplies) return { sub: t, vat: 0, total: t };
    const sub = t / 1.2;
    return { sub, vat: t - sub, total: t };
  };
  const money = (n) => "£" + (Math.round((+n || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ActionBtn = ({ icon, title, onClick, tone }) => {
    const bg = tone === "green" ? "var(--green-soft)" : tone === "red" ? "var(--red-soft)" : tone === "brand" ? "var(--brand-soft)" : "var(--panel-2)";
    const col = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : tone === "brand" ? "var(--brand)" : "var(--txt-3)";
    const sz = isMobile ? 36 : 28;
    return <span onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: sz, height: sz, borderRadius: 6, cursor: "pointer", color: col, background: bg, border: "0.5px solid var(--line)" }}><i className={`ti ${icon}`} style={{ fontSize: isMobile ? 16 : 14 }} /></span>;
  };

  return (
    <div className="fade-in">
      <ConfirmDialog {...confirm.props} />
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
        <div ref={formRef} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit payment" : "New payment"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Tenant
                <span onClick={() => { setAddTenant((v) => !v); setTErr(""); setTForm(tBlank); }} style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", color: "var(--brand)", fontSize: 10.5, fontWeight: 600 }}><i className={`ti ${addTenant ? "ti-x" : "ti-user-plus"}`} style={{ fontSize: 12 }} />{addTenant ? "Close" : "Add tenant"}</span>
              </span>
              <select style={inp} value={form.tenant} onChange={(e) => onPickTenant(e.target.value)}><option value="">— select tenant —</option>{related.tenants.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
            </label>
            <label style={fld}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>Property
                <span onClick={() => { setAddProperty((v) => !v); setPErr(""); setPForm(pBlank); }} style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", color: "var(--brand)", fontSize: 10.5, fontWeight: 600 }}><i className={`ti ${addProperty ? "ti-x" : "ti-plus"}`} style={{ fontSize: 12 }} />{addProperty ? "Close" : "Add property"}</span>
              </span>
              {form.tenant && form.property_id ? (
              // A tenant is chosen and linked to a property — lock the field to
              // that property instead of listing every property in the system.
              <div style={{ ...inp, display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", color: "var(--txt-2)" }}>
                <i className="ti ti-lock" style={{ fontSize: 13, color: "var(--txt-3)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{propLabel(properties, form.property_id) || "—"}</span>
              </div>
            ) : (
              <select style={inp} value={form.property_id} onChange={(e) => onPickProperty(e.target.value)}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select>
            )}</label>
            <label style={fld}>Amount (£)<input style={inp} type="number" placeholder="auto-fills from rent — editable" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label style={fld}>Billing date (optional, DD/MM/YYYY)<input style={inp} type="date" value={form.billing_date} onChange={(e) => setForm({ ...form, billing_date: e.target.value })} /></label>
            <label style={fld}>Due date (DD/MM/YYYY)<input style={inp} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
            <label style={fld}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Pending", "Sent", "Paid", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>

          <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 8 }}>An invoice number is generated automatically. "Pending" invoices count toward Expected; use "Mark received" in the ledger when paid.</div>
          <div style={{ marginTop: 12 }}><span onClick={saving ? undefined : save} style={{ opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={saving ? "Saving…" : (editId ? "Update payment" : "Save payment")} primary /></span></div>
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
      {filter === "Future" && raisedMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--green)", background: "var(--green-soft)", border: "0.5px solid var(--green)", padding: "10px 14px", borderRadius: 8, marginBottom: 12 }}>
          <i className="ti ti-circle-check" style={{ fontSize: 15 }} />{raisedMsg}
        </div>
      )}
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
                <Td>{DB_READY ? <span onClick={raising === r.property_id + r.month ? undefined : () => raiseInvoice(r)} style={{ opacity: raising === r.property_id + r.month ? 0.6 : 1 }}><Btn icon="ti-file-plus" label={raising === r.property_id + r.month ? "Raising…" : "Raise"} primary /></span> : null}</Td>
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
        const base = filter === "All" ? data : data.filter((p) => effectiveStatus(p) === filter);
        if (base.length === 0) return <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No {filter.toLowerCase()} payments.</div>;
        // Sort a copy so the underlying data order is untouched. Text sorts
        // case-insensitively; numbers and dates sort numerically; blanks sink
        // to the bottom regardless of direction.
        const val = (p) => {
          switch (sort.key) {
            case "tenant": return (p.tenant || "").toLowerCase();
            case "property": return (propLabel(properties, p.property_id) || p.property || p.prop || "").toLowerCase();
            case "subtotal": return vatBreakdown(p.amount).sub;
            case "vat": return vatBreakdown(p.amount).vat;
            case "total": return vatBreakdown(p.amount).total;
            case "due_date": return p.due_date || p.due || "";
            case "status": return effectiveStatus(p);
            default: return "";
          }
        };
        const isNum = ["subtotal", "vat", "total"].includes(sort.key);
        const shown = [...base].sort((a, b) => {
          const av = val(a), bv = val(b);
          const aEmpty = av === "" || av === null || av === undefined;
          const bEmpty = bv === "" || bv === null || bv === undefined;
          if (aEmpty && bEmpty) return 0;
          if (aEmpty) return 1;   // blanks always last
          if (bEmpty) return -1;
          let cmp = isNum ? (av - bv) : String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
          return sort.dir === "asc" ? cmp : -cmp;
        });
        return (
        <Table sort={sort} onSort={onSort} cols={["", { label: "Tenant", sortKey: "tenant" }, { label: "Property", sortKey: "property" }, { label: "Subtotal", sortKey: "subtotal" }, { label: "VAT", sortKey: "vat" }, { label: "Total", sortKey: "total" }, { label: "Due date", sortKey: "due_date" }, { label: "Status", sortKey: "status" }, "Actions"]}>
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
                  <Td color="var(--txt-2)">{vatApplies ? money(b.sub) : money(b.total)}</Td>
                  <Td color="var(--txt-2)">{vatApplies ? money(b.vat) : "—"}</Td>
                  <Td><span style={{ fontWeight: 600 }}>{money(b.total)}</span></Td>
                  <Td color="var(--txt-2)">{ukDate(p.due_date || p.due)}</Td>
                  <Td><Pill text={effectiveStatus(p)} tone={effectiveStatus(p) === "Paid" ? "green" : effectiveStatus(p) === "Overdue" ? "red" : effectiveStatus(p) === "Sent" ? "blue" : "amber"} /></Td>
                  <Td>{p.id && DB_READY ? (
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      <ActionBtn icon="ti-send" title="Preview & send email" tone="brand" onClick={() => setEmailPayment(p)} />
                      <ActionBtn icon="ti-pencil" title="Edit" onClick={() => openEdit(p)} />
                      {["Pending", "Sent", "Overdue"].includes(effectiveStatus(p)) && <ActionBtn icon="ti-check" title="Mark received" tone="green" onClick={() => markReceived(p)} />}
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

      {/* Quick-add TENANT — popup so it doesn't push the payment form down. */}
      {addTenant && (
        <QuickAddModal title="New tenant" icon="ti-user-plus" onClose={() => { setAddTenant(false); setTErr(""); }}>
          {tErr && <div style={{ fontSize: 11, color: "var(--red)", background: "var(--red-soft)", padding: "7px 11px", borderRadius: 8, marginBottom: 12 }}>{tErr}</div>}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            <label style={fld}>Tenant name<input style={inp} placeholder="e.g. Sarah Connor" value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={tForm.property_id} onChange={(e) => setTForm({ ...tForm, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={tForm.email} onChange={(e) => setTForm({ ...tForm, email: e.target.value })} /></label>
            <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={tForm.phone} onChange={(e) => setTForm({ ...tForm, phone: e.target.value })} /></label>
            <label style={fld}>Tenancy start date (DD/MM/YYYY)<input style={inp} type="date" value={tForm.tenancy_start} onChange={(e) => setTForm({ ...tForm, tenancy_start: e.target.value })} /></label>
            <label style={fld}>Tenancy end date (DD/MM/YYYY)<input style={inp} type="date" value={tForm.tenancy_end} onChange={(e) => setTForm({ ...tForm, tenancy_end: e.target.value })} /></label>
            <label style={fld}>Rent status<select style={inp} value={tForm.rent_status} onChange={(e) => setTForm({ ...tForm, rent_status: e.target.value })}>{["Up to date", "Overdue"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Right to Rent<select style={inp} value={tForm.rtr_status} onChange={(e) => setTForm({ ...tForm, rtr_status: e.target.value })}>{["Verified", "Pending"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Deposit received (£)<input style={inp} type="number" min="0" placeholder="e.g. 1500" value={tForm.deposit_amount} onChange={(e) => setTForm({ ...tForm, deposit_amount: e.target.value })} /></label>
            <label style={{ ...fld, justifyContent: "flex-end" }}>Protected under DPS
              <div onClick={() => setTForm({ ...tForm, deposit_protected: !tForm.deposit_protected })} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ width: 38, height: 22, borderRadius: 11, background: tForm.deposit_protected ? "var(--brand)" : "var(--line-2)", position: "relative", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: tForm.deposit_protected ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </span>
                <span style={{ fontSize: 12, color: "var(--txt)" }}>{tForm.deposit_protected ? "Protected" : "Not protected"}</span>
              </div>
            </label>
          </div>
          {(() => {
            const tp = (properties.find((p) => String(p.id) === String(tForm.property_id)) || {}).type;
            const multi = tp === "HMO" || tp === "Block";
            if (tForm.property_id && !multi) return (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px dashed var(--line)" }}>
                <div style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 4, fontWeight: 500 }}>Co-tenant (optional)</div>
                <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginBottom: 10, lineHeight: 1.5 }}>For a joint tenancy — e.g. a couple sharing one agreement. Counts as one tenancy.</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                  <label style={fld}>Co-tenant name<input style={inp} placeholder="e.g. James Connor" value={tForm.co_tenant_name} onChange={(e) => setTForm({ ...tForm, co_tenant_name: e.target.value })} /></label>
                  <label style={fld}>Co-tenant email<input style={inp} type="email" placeholder="e.g. james@email.com" value={tForm.co_tenant_email} onChange={(e) => setTForm({ ...tForm, co_tenant_email: e.target.value })} /></label>
                  <label style={fld}>Co-tenant phone<input style={inp} placeholder="e.g. 07700 900124" value={tForm.co_tenant_phone} onChange={(e) => setTForm({ ...tForm, co_tenant_phone: e.target.value })} /></label>
                </div>
              </div>
            );
            if (tForm.property_id && multi) return <div style={{ marginTop: 12, fontSize: 10.5, color: "var(--txt-3)" }}>{tp} — add separate tenants individually.</div>;
            return null;
          })()}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <span onClick={tSaving ? undefined : saveTenant} style={{ opacity: tSaving ? 0.6 : 1, cursor: tSaving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={tSaving ? "Saving…" : "Save tenant"} primary /></span>
            <span onClick={() => { setAddTenant(false); setTErr(""); }}><Btn icon="ti-x" label="Cancel" /></span>
          </div>
        </QuickAddModal>
      )}

      {/* Quick-add PROPERTY — popup so it doesn't push the payment form down. */}
      {addProperty && (
        <QuickAddModal title="New property" icon="ti-home-plus" onClose={() => { setAddProperty(false); setPErr(""); }}>
          {pErr && <div style={{ fontSize: 11, color: "var(--red)", background: "var(--red-soft)", padding: "7px 11px", borderRadius: 8, marginBottom: 12 }}>{pErr}</div>}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            <label style={fld}>Address<input style={inp} placeholder="e.g. 12 Baker Street" value={pForm.address} onChange={(e) => setPForm({ ...pForm, address: e.target.value })} /></label>
            <label style={fld}>Area / town<input style={inp} placeholder="e.g. Bradford" value={pForm.area} onChange={(e) => setPForm({ ...pForm, area: e.target.value })} /></label>
            <label style={fld}>Type<select style={inp} value={pForm.type} onChange={(e) => setPForm({ ...pForm, type: e.target.value })}>{["House", "Flat", "Bungalow", "HMO", "Block", "Commercial"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Status<select style={inp} value={pForm.status} onChange={(e) => setPForm({ ...pForm, status: e.target.value })}>{["Let", "Vacant", "Sale agreed"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={fld}>Monthly rent (£)<input style={inp} type="number" min="0" placeholder="e.g. 1200" value={pForm.rent} onChange={(e) => setPForm({ ...pForm, rent: e.target.value })} /></label>
            <label style={fld}>Invoice day (1–31, optional)<input style={inp} type="number" min="1" max="31" placeholder="e.g. 1" value={pForm.invoice_day} onChange={(e) => setPForm({ ...pForm, invoice_day: e.target.value })} /></label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <span onClick={pSaving ? undefined : saveProperty} style={{ opacity: pSaving ? 0.6 : 1, cursor: pSaving ? "default" : "pointer" }}><Btn icon="ti-device-floppy" label={pSaving ? "Saving…" : "Save property"} primary /></span>
            <span onClick={() => { setAddProperty(false); setPErr(""); }}><Btn icon="ti-x" label="Cancel" /></span>
          </div>
        </QuickAddModal>
      )}
    </div>
  );
}


export function DocumentsPage({ user }) {
  const cats = ["All", "Agreements", "Certificates", "Right to Rent", "Notices", "Invoices", "Other"];
  const catIcon = { Agreements: "ti-file-text", Certificates: "ti-certificate", "Right to Rent": "ti-id", Notices: "ti-mail", Invoices: "ti-receipt", Other: "ti-file" };
  const catTone = { Agreements: "blue", Certificates: "red", "Right to Rent": "green", Notices: "blue", Invoices: "green", Other: "amber" };
  const [cat, setCat] = useState("All");
  const [propFilter, setPropFilter] = useState("All");
  const isMobile = useIsMobile();
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
      .then(({ data, error }) => { if (error) { setErr(friendlyError(error, "loading data")); setRows([]); } else setRows(data); });
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
      const { error: dbErr } = await db.from("prop_documents").insert([{ name: file.name, category: pickCat, file_path: path, size_kb: Math.round(file.size / 1024), property_id: pickProp || null, user_id: user.id }]);
      if (dbErr) throw dbErr;
      await refresh();
    } catch (e2) { setErr(friendlyError(e2, "uploading the file")); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const download = async (d) => {
    if (!d.file_path || !DB_READY) return;
    const { data, error } = await db.storage.from("documents").createSignedUrl(d.file_path, 60);
    if (error) { setErr(friendlyError(error)); return; }
    window.open(data.signedUrl, "_blank");
  };

  const openPreview = async (d) => {
    if (!d.file_path || !DB_READY) { setErr("No file to preview."); return; }
    setErr("");
    const { data, error } = await db.storage.from("documents").createSignedUrl(d.file_path, 300);
    if (error) { setErr(friendlyError(error)); return; }
    const ext = (d.name.split(".").pop() || "").toLowerCase();
    const kind = ["pdf"].includes(ext) ? "pdf" : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ? "image" : "other";
    setPreview({ ...d, url: data.signedUrl, kind });
  };

  const confirm = useConfirm();
  const doRemove = async (d) => {
    if (!d.id || !DB_READY) return;
    if (d.file_path) await db.storage.from("documents").remove([d.file_path]);
    await db.from("prop_documents").delete().eq("id", d.id);
    refresh();
  };
  const remove = (d) => confirm.ask({ title: "Delete this document?", message: `"${d.name || "This document"}" will be permanently deleted, including the uploaded file. This can't be undone.`, onConfirm: () => doRemove(d) });

  const data = (rows || []).filter((d) => (cat === "All" || d.category === cat) && (propFilter === "All" || (propFilter === "none" ? !d.property_id : String(d.property_id) === String(propFilter))));
  const fmtSize = (kb) => !kb ? "" : kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";

  return (
    <div className="fade-in">
      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onPick} />
      <ConfirmDialog {...confirm.props} />
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

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map((c) => (
            <span key={c} onClick={() => setCat(c)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 12px", borderRadius: 7, color: c === cat ? "var(--txt)" : "var(--txt-2)", background: c === cat ? "var(--panel-2)" : "transparent", border: "0.5px solid " + (c === cat ? "var(--line)" : "transparent") }}>{c}</span>
          ))}
        </div>
        {/* Filter documents by which property they belong to. */}
        <select value={propFilter} onChange={(e) => setPropFilter(e.target.value)} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: isMobile ? "9px 11px" : "7px 10px", color: "var(--txt)", fontSize: isMobile ? 16 : 12, fontFamily: "Inter", outline: "none", marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto" }}>
          <option value="All">All properties</option>
          <option value="none">No property</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
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
                  <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{d.category}{d.size_kb ? " · " + fmtSize(d.size_kb) : ""}</div>
                  {(() => {
                    const pname = propLabel(properties, d.property_id) || d.property;
                    return (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: pname ? "var(--brand-soft, rgba(139,127,232,.14))" : "var(--panel)", color: pname ? "var(--brand)" : "var(--txt-3)", border: "0.5px solid var(--line)", maxWidth: "100%" }}>
                        <i className={`ti ${pname ? "ti-home" : "ti-home-off"}`} style={{ fontSize: 12, flexShrink: 0 }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pname || "No property"}</span>
                      </div>
                    );
                  })()}
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
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview.name}</div><div style={{ fontSize: 11, color: "var(--txt-3)" }}>{preview.category}{(propLabel(properties, preview.property_id) || preview.property) ? " · " + (propLabel(properties, preview.property_id) || preview.property) : ""}</div></div>
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
      // Maintenance has no user-entered date, so scope by when the job was
      // logged (created_at). Without this, period P&L / Tax-year summaries
      // deducted all-time maintenance cost against a single month's rent.
      maint: data.maint.filter((m) => inRange(m.created_at)),
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
      // Returning from Stripe Checkout/Portal lands with ?billing=... — always
      // reopen the Subscription tab, not the default Organisation tab.
      const params = new URLSearchParams(window.location.search);
      if (params.get("billing")) return "subscription";
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
  const [passSaveState, setPassSaveState] = useState(null); // null | 'saving' | 'saved' | 'error'
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
  // above already re-reads the tier on this fresh page load). Also make sure
  // the Subscription tab is the one showing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing")) {
      setTab("subscription");
      window.history.replaceState({}, "", window.location.pathname + "#subscription");
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

  // Per-provider guidance for the Password field. Gmail/Outlook reject normal
  // login passwords over SMTP — users must generate an "app password". This is
  // the single most common setup mistake, so we spell it out with a link.
  const PASS_HELP = {
    gmail:    { text: "Gmail needs an App Password, not your normal password. Turn on 2-Step Verification first, then create one here:", url: "https://myaccount.google.com/apppasswords", label: "Google App Passwords" },
    outlook:  { text: "Outlook/Hotmail needs an App Password (with 2-step verification on), not your normal password. Create one here:", url: "https://account.live.com/proofs/AppPassword", label: "Microsoft App Passwords" },
    office365:{ text: "Microsoft 365 needs an App Password (with 2-step verification on), not your normal password. Create one here:", url: "https://account.microsoft.com/security", label: "Microsoft Security" },
    zoho:     { text: "Zoho Mail needs an App-Specific Password, not your normal password. Create one here:", url: "https://accounts.zoho.eu/home#security/app_password", label: "Zoho App Passwords" },
    resend:   { text: "Use your Resend API key as the password. Create one in your Resend dashboard:", url: "https://resend.com/api-keys", label: "Resend API Keys" },
    sendgrid: { text: "Use an API key as the password (username is literally 'apikey'). Create one here:", url: "https://app.sendgrid.com/settings/api_keys", label: "SendGrid API Keys" },
    ionos:    { text: "Use your normal IONOS mailbox password here. If it's rejected, check the mailbox is enabled for SMTP in your IONOS webmail settings.", url: "", label: "" },
    custom:   { text: "For Gmail, Outlook and most providers, this is an “app password”, not your normal login password. Pick your provider above for a direct link.", url: "", label: "" },
  };

  const TABS = [
    { key: "organisation", label: "Organisation", icon: "ti-building" },
    { key: "notifications", label: "Notifications", icon: "ti-bell" },
    { key: "email", label: "Email", icon: "ti-mail" },
    { key: "vat", label: "VAT", icon: "ti-receipt" },
    { key: "subscription", label: "Subscription", icon: "ti-credit-card" },
  ];

  // Apply a loaded settings row to the form state. Kept as a helper so both the
  // strict-select and the resilient fallback path populate identically.
  const applySettingsRow = (row) => {
    setOrg({ company_name: row.company_name || "", vat_number: row.vat_number || "", address: row.address || "", city: row.city || "", postcode: row.postcode || "", phone: row.phone || "", business_email: row.business_email || "", website: row.website || "", logo_url: row.logo_url || "" });
    setNotif({
      notify_compliance: row.notify_compliance !== false,
      notify_rent: row.notify_rent !== false,
      reminder_lead: row.reminder_lead || "30 / 7 days before expiry",
    });
    setEmail((f) => ({
      smtp_provider: row.smtp_provider || "custom",
      smtp_host: row.smtp_host || "",
      smtp_port: row.smtp_port || 587,
      smtp_secure: row.smtp_secure === true,
      smtp_user: row.smtp_user || "",
      smtp_pass: f.smtp_pass || "", // filled separately by the decrypt RPC (visible-password setting); preserve it whichever loads first
      smtp_from_name: row.smtp_from_name || "",
      smtp_from_email: row.smtp_from_email || "",
      smtp_reply_to: row.smtp_reply_to || "",
    }));
    setVat({
      vat_scheme: row.vat_scheme || "standard",
      vat_number: row.vat_number || "",
      flat_rate: row.flat_rate != null ? row.flat_rate : 16.5,
    });
  };

  useEffect(() => {
    if (!DB_READY) { setLoaded(true); return; }
    // Explicit column list that OMITS smtp_pass — the SMTP password must never
    // be sent back to the browser. It stays server-side (see /api/send-email).
    db.from("prop_settings").select("company_name,vat_number,address,city,postcode,phone,business_email,website,logo_url,notify_compliance,notify_rent,reminder_lead,smtp_provider,smtp_host,smtp_port,smtp_secure,smtp_user,smtp_from_name,smtp_from_email,smtp_reply_to,vat_scheme,flat_rate").eq("user_id", user.id)
      .then(async ({ data, error }) => {
        let row = !error && data && data.length ? data[0] : null;
        // Resilience: if the strict select failed (e.g. a column the app expects
        // isn't in the table), don't blank the whole form — fall back to select
        // all columns and populate from whatever exists. We drop smtp_pass so the
        // password still never lives in the browser.
        if (error) {
          try { console.warn("[PropertyOps] settings strict select failed, falling back:", error.message); } catch (e) {}
          const res = await db.from("prop_settings").select("*").eq("user_id", user.id);
          if (!res.error && res.data && res.data.length) { row = res.data[0]; if (row) delete row.smtp_pass; }
        }
        if (row) {
          applySettingsRow(row);
        } else if (user.user_metadata && user.user_metadata.company_name) {
          setOrg((o) => ({ ...o, company_name: user.user_metadata.company_name }));
        }
        setLoaded(true);
      });
  }, []);

  // Load the stored SMTP password into the form so it is VISIBLE in Settings
  // (owner's choice — replaces the earlier write-only design). The decrypt RPC
  // returns ONLY the calling user's own password (scoped to auth.uid()), so no
  // other account's password can ever be read. It remains encrypted at rest;
  // the field is masked by default with the eye icon to reveal.
  useEffect(() => {
    if (!DB_READY) return;
    try {
      db.rpc("prop_smtp_secret")
        .then(({ data, error }) => {
          if (!error && typeof data === "string" && data) setEmail((f) => ({ ...f, smtp_pass: f.smtp_pass || data }));
        })
        .catch(() => {});
    } catch (e) { /* demo-mode stub has no rpc() */ }
  }, []);

  // Save ONLY the SMTP password — a dedicated, unambiguous action so the
  // password can't be lost by navigating away before pressing the big Save.
  // Writes just this one field, reads it straight back to CONFIRM it landed in
  // the database (not just the form), and reports true success/failure.
  const savePasswordOnly = async () => {
    if (!DB_READY) { setPassSaveState("error"); setErr("Database not connected."); return; }
    const typed = (email.smtp_pass || "").trim();
    const clean = email.smtp_provider === "gmail" ? typed.replace(/\s+/g, "") : typed;
    if (!clean) { setPassSaveState("error"); setErr("Enter the password first."); return; }
    setErr("");
    setPassSaveState("saving");
    // Write ONLY the password column, scoped to this user's existing row, so we
    // don't depend on upsert/onConflict or touch other fields. The BEFORE trigger
    // encrypts smtp_pass into smtp_pass_enc and nulls the plaintext.
    const { data: upData, error: upErr } = await db
      .from("prop_settings")
      .update({ smtp_pass: clean, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .select("user_id");
    if (upErr) {
      setPassSaveState("error");
      setErr("Save failed: " + upErr.message + (upErr.hint ? " (" + upErr.hint + ")" : ""));
      return;
    }
    if (!upData || upData.length === 0) {
      // No existing row to update — create one, then the trigger encrypts it.
      const { error: insErr } = await db.from("prop_settings").insert({
        user_id: user.id, smtp_pass: clean,
        smtp_provider: email.smtp_provider, smtp_host: email.smtp_host, smtp_user: email.smtp_user,
        updated_at: new Date().toISOString(),
      });
      if (insErr) { setPassSaveState("error"); setErr("Save failed (insert): " + insErr.message); return; }
    }
    // Verify the encrypted password now exists for this user (boolean check —
    // tolerant of any decrypt/timing quirks in the exact-match approach).
    const { data: chk, error: chkErr } = await db
      .from("prop_settings")
      .select("smtp_pass_enc")
      .eq("user_id", user.id)
      .maybeSingle();
    if (chkErr) { setPassSaveState("error"); setErr("Saved, but couldn't verify: " + chkErr.message); return; }
    if (chk && chk.smtp_pass_enc) {
      setEmail((f) => ({ ...f, smtp_pass: clean }));
      setPassSaveState("saved");
      setTimeout(() => setPassSaveState(null), 4000);
    } else {
      setPassSaveState("error");
      setErr("The write succeeded but no encrypted password was stored — the encryption trigger (migration 03) may not be active on this database.");
    }
  };

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
      smtp_user: email.smtp_user, smtp_from_name: email.smtp_from_name, smtp_from_email: email.smtp_from_email, smtp_reply_to: email.smtp_reply_to,
      vat_scheme: vat.vat_scheme, flat_rate: vat.flat_rate,
      updated_at: new Date().toISOString(),
    };
    // The password field is write-only: blank means "keep the stored password"
    // (we never load it into the browser), so only write it when the user
    // actually typed a new one — otherwise an omitted key preserves the old value.
    // Normalise before saving: trim stray whitespace, and for Gmail strip ALL
    // spaces — Google displays App Passwords as "xxxx xxxx xxxx xxxx" but the
    // real password is the 16 characters only; saving the spaces makes Gmail
    // reject the login (EAUTH 535) with no obvious reason why.
    const typedPass = (email.smtp_pass || "").trim();
    const cleanPass = email.smtp_provider === "gmail" ? typedPass.replace(/\s+/g, "") : typedPass;
    if (cleanPass) record.smtp_pass = cleanPass;
    // upsert, then read back to confirm it actually persisted
    const { error: upErr } = await db.from("prop_settings").upsert(record, { onConflict: "user_id" });
    if (upErr) { setSaving(false); setErr("Couldn't save: " + upErr.message); return; }
    const { data: check, error: readErr } = await db.from("prop_settings").select("company_name,vat_number,address,city,postcode,phone,business_email,website,logo_url").eq("user_id", user.id);
    setSaving(false);
    if (readErr) { setErr("Saved, but couldn't confirm: " + readErr.message); return; }
    const row = check && check.length ? check[0] : null;
    if (!row) { setErr("Save didn't persist — this usually means the prop_settings table is missing the new columns. Re-run the settings SQL in Supabase."); return; }
    setOrg({ company_name: row.company_name || "", vat_number: row.vat_number || "", address: row.address || "", city: row.city || "", postcode: row.postcode || "", phone: row.phone || "", business_email: row.business_email || "", website: row.website || "", logo_url: row.logo_url || "" });
    // Reflect the normalised (space-stripped) password back into the field so
    // what the user sees is exactly what was stored.
    if (record.smtp_pass) setEmail((f) => ({ ...f, smtp_pass: record.smtp_pass }));
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
      setSmtpTest("error"); setSmtpTestMsg("Enter the SMTP host, username and password to run a test. (For security the saved password isn't shown — re-enter it here to test.)");
      return;
    }
    setSmtpTest("testing"); setSmtpTestMsg("");
    try {
      const res = await fetch("/api/test-smtp", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ host: email.smtp_host, port: email.smtp_port || 587, secure: !!email.smtp_secure, user: email.smtp_user, pass: (email.smtp_provider === "gmail" ? email.smtp_pass.replace(/\s+/g, "") : email.smtp_pass.trim()), fromName: email.smtp_from_name || org.company_name || "" }),
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
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 7 : 12, padding: "10px 0" }}>
              <div style={{ fontSize: 12.5, color: "var(--txt)", whiteSpace: "nowrap" }}>Reminder lead time</div>
              <select value={notif.reminder_lead} onChange={(e) => setNotif({ ...notif, reminder_lead: e.target.value })} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: isMobile ? "10px 12px" : "7px 10px", color: "var(--txt)", fontSize: isMobile ? 16 : 12, fontFamily: "Inter", outline: "none", width: isMobile ? "100%" : "auto" }}>
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
              <div><label style={lbl}>Username / Email</label><input style={inp} value={email.smtp_user} onChange={(e) => setEmail({ ...email, smtp_user: e.target.value })} placeholder="you@yourdomain.com" autoComplete="off" name="alzaro-smtp-user" data-lpignore="true" data-1p-ignore="true" data-form-type="other" /></div>
              <div><label style={lbl}>Password / API key</label>
                <div style={{ position: "relative" }}>
                  {/* Deliberately type="text" masked via CSS (-webkit-text-security), NOT
                      type="password": Chrome force-autofills saved site passwords into
                      password inputs (ignoring autocomplete hints), silently replacing
                      the typed App Password with the user's login password. A masked
                      text input gets no autofill and no "Update password?" prompts. */}
                  <input style={{ ...inp, paddingRight: 38, WebkitTextSecurity: showPass ? "none" : "disc" }} type="text" spellCheck={false} autoCorrect="off" autoCapitalize="off" value={email.smtp_pass} onChange={(e) => setEmail({ ...email, smtp_pass: e.target.value })} placeholder="Your SMTP password / App Password" autoComplete="off" name="alzaro-smtp-secret" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
                  <span onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--txt-3)", fontSize: 13 }}><i className={`ti ${showPass ? "ti-eye-off" : "ti-eye"}`} /></span>
                </div>
                {/* Dedicated one-click password save. Saves ONLY this field and
                    confirms it landed in the database, so the password can't be
                    lost by navigating away before the main Save. */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={savePasswordOnly} disabled={passSaveState === "saving"} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: passSaveState === "saving" ? "default" : "pointer", opacity: passSaveState === "saving" ? 0.7 : 1 }}>
                    <i className="ti ti-device-floppy" style={{ fontSize: 13 }} />{passSaveState === "saving" ? "Saving…" : "Save email password"}
                  </button>
                  {passSaveState === "saved" && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--green)" }}><i className="ti ti-circle-check" style={{ fontSize: 13 }} />Password saved &amp; confirmed</span>}
                  {passSaveState === "error" && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--red, #e5484d)" }}><i className="ti ti-alert-triangle" style={{ fontSize: 13 }} />Not saved — see message above</span>}
                </div>
                {(() => { const h = PASS_HELP[email.smtp_provider] || PASS_HELP.custom; return (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, fontSize: 11, color: "var(--txt-3)", lineHeight: 1.45 }}>
                    <i className="ti ti-info-circle" style={{ fontSize: 12.5, marginTop: 1, flexShrink: 0, color: "var(--brand)" }} />
                    <span>{h.text}{h.url && <> <a href={h.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "underline" }}>{h.label} ↗</a></>}</span>
                  </div>
                ); })()}
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

import { useState, useEffect } from 'react'
import { db, DB_READY } from '../lib/db.js'
import { gbp, toneVar, inp, fld, formCard, demoBanner, errBanner, emptyCard } from '../lib/helpers.js'
import { PageHead, Btn, Metric, Pill, Table, Td, rowActions, useConfirm, useCustomers, useProperties, CustomerPropertyPicker } from '../components/UI.jsx'

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

// JOBS  (kanban)

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

// DIARY  (week view)
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

// INVOICING
// Email preview modal — review the invoice email, then send via Resend (/api/send-email)
function InvoiceEmailModal({ invoice, user, onClose, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bizName, setBizName] = useState("Alzaro ServiceOps");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const build = async () => {
      // Pull the customer's email + the business name to compose a sensible default
      let custEmail = "", custName = invoice.customer || "there", biz = "Alzaro ServiceOps";
      if (DB_READY) {
        if (invoice.customer_id) {
          const { data: c } = await db.from("svc_customers").select("name,email").eq("id", invoice.customer_id);
          if (c && c.length) { custEmail = c[0].email || ""; custName = c[0].name || custName; }
        }
        const { data: s } = await db.from("svc_settings").select("trading_name").eq("user_id", user.id);
        if (s && s.length && s[0].trading_name) biz = s[0].trading_name;
      }
      setBizName(biz);
      const ref = invoice.ref || "your invoice";
      const amount = gbp(invoice.amount || 0);
      const due = invoice.due_date ? ` by ${invoice.due_date}` : "";
      setTo(custEmail);
      setSubject(`Invoice ${invoice.ref || ""} from ${biz}`.trim());
      setBody(
`Hi ${custName},

Please find your invoice ${ref} for the amount of ${amount}.

Payment is due${due}. If you have any questions about this invoice, just reply to this email.

Thank you for your business.

Kind regards,
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
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;white-space:pre-wrap">${body.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>`;
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: to.trim(), subject, html, text: body, fromName: bizName }),
      });
      let data = {}; try { data = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server responded with status ${res.status}`);
      setStatus("success");
      // Mark the invoice as Sent (only bump up from Draft)
      if (DB_READY && invoice.id && invoice.status === "Draft") {
        await db.from("svc_invoices").update({ status: "Sent" }).eq("id", invoice.id);
      }
      setTimeout(() => { onSent && onSent(); onClose(); }, 1400);
    } catch (e) {
      setStatus("error");
      setMsg(e.message === "Failed to fetch" ? "Could not reach the email service — it may not be deployed yet." : e.message);
    }
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const panel = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 22, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" };
  const labelTiny = { fontSize: 10, fontWeight: 700, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
  const field = { background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none", width: "100%" };

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
            <div style={{ fontSize: 12, color: "var(--txt-2)" }}>Invoice {invoice.ref || ""} sent to {to}</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={labelTiny}>To</div>
              <input style={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@email.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelTiny}>Subject</div>
              <input style={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelTiny}>Message</div>
              <textarea style={{ ...field, minHeight: 200, resize: "vertical", lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} />
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

function InvoicingPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { ref: "", customer_id: "", customer: "", property_id: "", site: "", amount: "", due_date: "", status: "Draft" };
  const [form, setForm] = useState(blank);
  const [emailInvoice, setEmailInvoice] = useState(null);

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
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  {v.id && DB_READY && (
                    <span onClick={() => setEmailInvoice(v)} title="Preview & send email" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, cursor: "pointer", color: "var(--brand)", background: "var(--brand-soft)" }}>
                      <i className="ti ti-send" style={{ fontSize: 14 }} />
                    </span>
                  )}
                  {v.id && rowActions(DB_READY, () => openEdit(v), () => askDelete(v))}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {confirmNode}
      {emailInvoice && (
        <InvoiceEmailModal invoice={emailInvoice} user={user} onClose={() => setEmailInvoice(null)} onSent={refresh} />
      )}
    </div>
  );
}


export { QuotesPage, CreateInvoiceForJob, JobsPage, DiaryPage, InvoicingPage };

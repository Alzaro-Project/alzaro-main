import { useState, useEffect } from 'react'
import { db, DB_READY } from '../lib/db.js'
import { gbp, inp, fld, formCard, demoBanner, errBanner, emptyCard } from '../lib/helpers.js'
import { PageHead, Btn, Pill, Table, Td, rowActions, useConfirm, useCustomers } from '../components/UI.jsx'

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
            <label style={fld}>Region<input style={inp} placeholder="e.g. Manchester" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
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
// PROPERTIES
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


export { CustomersPage, CustomerDetail, PropertiesPage };

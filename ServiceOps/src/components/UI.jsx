import { useState, useEffect } from 'react'
import { db, DB_READY } from '../lib/db.js'
import { gbp, toneVar, inp, fld, errBanner } from '../lib/helpers.js'

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

const rowActions = (DB, onEdit, onDel) => DB ? <span style={{ display: "flex", gap: 12 }}><i className="ti ti-pencil" onClick={onEdit} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={onDel} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null;

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

// DASHBOARD
// WELCOME / ONBOARDING BANNER

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

// ROOT — decides: login screen or dashboard

export { PageHead, Btn, Metric, Panel, Pill, Table, Td, rowActions, useConfirm, useIsMobile, useCustomers, useProperties, QuickAddCustomer, QuickAddProperty, CustomerPropertyPicker, SearchGroup };

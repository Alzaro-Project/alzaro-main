import React, { useState, useEffect } from "react";
import { Btn, DetailBox, DetailRow, Metric, PageHead, Panel, Pill, Table, Td, WelcomeBanner } from "../components/UI.jsx";
import { gbp, propLabel, toneVar, usePropertyList, useIsMobile } from "../lib/helpers.js";
import { DB_READY, db } from "../lib/supabase.js";

export function DashboardPage({ range, go, user }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!DB_READY) { setData({ props: [], comp: [], pays: [], maint: [], tenants: [] }); return; }
    Promise.all([
      db.from("prop_properties").select("*"),
      db.from("prop_compliance").select("*"),
      db.from("prop_payments").select("*"),
      db.from("prop_maintenance").select("*"),
      db.from("prop_tenants").select("*"),
    ]).then(([p, c, pay, mt, tn]) => setData({ props: p.data || [], comp: c.data || [], pays: pay.data || [], maint: mt.data || [], tenants: tn.data || [] }));
  }, []);

  if (!data) return <div className="fade-in" style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading your portfolio…</div>;

  const { props, comp, pays, maint, tenants = [] } = data;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // properties / occupancy
  const totalProps = props.length;
  const letProps = props.filter((p) => p.status === "Let").length;
  const occupancy = totalProps ? Math.round((letProps / totalProps) * 1000) / 10 : 0;
  const income = props.filter((p) => p.status === "Let").reduce((s, p) => s + (p.rent || 0), 0);

  // compliance
  const certs = comp.map((c) => { const d = c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null; return { ...c, days: d }; });
  const valid = certs.filter((c) => c.days !== null && c.days > 30).length;
  const hasCerts = certs.length > 0;
  const score = hasCerts ? Math.max(0, Math.round((valid / certs.length) * 100)) : null;
  const attention = certs.filter((c) => c.days !== null && c.days <= 30).length;

  // finance
  const arrears = pays.filter((p) => p.status === "Overdue").reduce((s, p) => s + (p.amount || 0), 0);
  const arrearsCount = pays.filter((p) => p.status === "Overdue").length;

  // maintenance
  const openMaint = maint.filter((m) => m.status !== "Completed").length;
  const highPri = maint.filter((m) => m.status !== "Completed" && m.priority === "High").length;

  const toneFor = { "Gas Safety": "ti-flame", "EICR": "ti-bolt", "EPC": "ti-leaf", "Smoke Alarm": "ti-bell-ringing", "Carbon Monoxide": "ti-cloud", "Legionella Risk": "ti-droplet", "PAT Testing": "ti-plug", "Buildings Insurance": "ti-umbrella", "HMO Licence": "ti-license", "Fire Risk Assessment": "ti-fire-extinguisher" };
  const certTone = (d) => d < 0 || d <= 7 ? "red" : d <= 30 ? "amber" : "blue";

  // Combined "Expiring Soon" — certificates AND tenancy end dates, within 60 days (or already passed).
  const certItems = certs
    .filter((c) => c.days !== null && c.days <= 60)
    .map((c) => ({ kind: "cert", id: "c" + c.id, label: c.type, sub: c.property || c.reference || "—", days: c.days, icon: toneFor[c.type] || "ti-shield-check", page: "compliance" }));
  const tenancyItems = (tenants || [])
    .filter((t) => t.tenancy_end)
    .map((t) => ({ kind: "tenancy", id: "t" + t.id, days: Math.round((new Date(t.tenancy_end) - today) / 864e5), label: "Tenancy ends · " + (t.name || "Tenant"), sub: t.property || "—", icon: "ti-calendar-event", page: "tenants" }))
    .filter((t) => t.days <= 60);
  const expiringSoon = [...certItems, ...tenancyItems].sort((a, b) => a.days - b.days).slice(0, 6);
  const name = user ? user.email.split("@")[0] : "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-in">
      <WelcomeBanner data={data} go={go} user={user} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <Metric label="Compliance Score" value={<>{hasCerts ? score : 0}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub={!hasCerts ? "No certificates tracked yet" : score >= 90 ? "Portfolio healthy" : score >= 60 ? "Needs attention" : "At risk"} color={!hasCerts ? "var(--txt-3)" : score >= 90 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"} />
        <Metric label="Rent Arrears" value={gbp(arrears)} sub={`${arrearsCount} overdue`} color={arrears ? "var(--red)" : "var(--green)"} />
        <Metric label="Occupancy" value={occupancy + "%"} sub={`${letProps} of ${totalProps} let`} color="var(--blue)" />
        <Metric label="Monthly Income" value={gbp(income)} sub="From let properties" color="var(--brand)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <Panel title="Expiring Soon" action="View all" onAction={() => go("compliance")}>
          {expiringSoon.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--txt-3)", padding: "8px 0" }}>Nothing expiring in the next 60 days. {(certs.length === 0 && (tenants || []).length === 0) && "Add certificates and tenants to track renewals here."}</div>
          ) : expiringSoon.map((c, i) => {
            const t = toneVar(certTone(c.days));
            return (
              <div key={c.id || i} onClick={() => go(c.page)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < expiringSoon.length - 1 ? "0.5px solid var(--line)" : "none", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: t.soft, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}><i className={`ti ${c.icon}`} style={{ fontSize: 16 }} /></span>
                  <div><div style={{ fontSize: 12.5 }}>{c.label}{c.sub && c.sub !== "—" ? " · " + c.sub : ""}</div><div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{c.kind === "tenancy" ? "Tenancy end date" : "Certificate"}</div></div>
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
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
        <span style={{ cursor: "pointer" }} onClick={() => go("maintenance")}><Metric label="Open Maintenance" value={openMaint} sub={`${highPri} high priority`} color="var(--amber)" /></span>
        <span style={{ cursor: "pointer" }} onClick={() => go("compliance")}><Metric label="Urgent Compliance" value={certs.filter((c) => c.days !== null && c.days <= 7).length} sub="Within 7 days" color="var(--red)" /></span>
        <span style={{ cursor: "pointer" }} onClick={() => go("properties")}><Metric label="Properties" value={totalProps} sub={score >= 90 ? "Portfolio healthy ✓" : "Check compliance"} color="var(--txt)" subColor={score >= 90 ? "var(--green)" : "var(--amber)"} /></span>
      </div>
    </div>
  );
}


export function PropertiesPage({ user, go }) {
  const isMobile = useIsMobile();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);   // null = loading
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ tenants: [], comp: [], maint: [], pays: [] });
  const blank = { address: "", area: "", type: "House", status: "Let", rent: "", invoice_day: "" };
  const [form, setForm] = useState(blank);

  React.useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
    db.from("prop_properties").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows([]); }
        else setRows(data || []);
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
  const openEdit = (p) => { setForm({ address: p.address || "", area: p.area || "", type: p.type || "House", status: p.status || "Let", rent: p.rent || "", invoice_day: p.invoice_day || "" }); setEditId(p.id); setAdding(true); setErr(""); };
  const save = async () => {
    if (!form.address.trim()) { setErr("Address is required."); return; }
    if (!DB_READY) { setErr("Add your Supabase keys in supabase.js to save for real."); return; }
    setErr("");
    const payload = { ...form, rent: form.rent === "" ? 0 : +form.rent, invoice_day: form.invoice_day === "" ? null : Math.min(28, Math.max(1, +form.invoice_day)) };
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Address<input style={inp} placeholder="e.g. 14 Oak Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Area<input style={inp} placeholder="e.g. Manchester" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Type<select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["House", "Flat", "HMO", "Block"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Status<select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["Let", "Vacant"].map((x) => <option key={x}>{x}</option>)}</select></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Rent (£ pcm)<input style={inp} type="number" placeholder="e.g. 1250" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" }}>Invoice day (1–28)<input style={inp} type="number" min="1" max="28" placeholder="e.g. 1" value={form.invoice_day} onChange={(e) => setForm({ ...form, invoice_day: e.target.value })} /><span style={{ fontSize: 9.5, color: "var(--txt-3)" }}>Day each month rent is invoiced</span></label>
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
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 14 }}>
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


export function CompliancePage({ user, go }) {
  const TYPES = {
    "Gas Safety": "ti-flame", "EICR": "ti-bolt", "EPC": "ti-leaf", "Smoke Alarm": "ti-bell-ringing",
    "Carbon Monoxide": "ti-cloud", "Legionella Risk": "ti-droplet", "PAT Testing": "ti-plug",
    "Buildings Insurance": "ti-umbrella", "HMO Licence": "ti-license", "Fire Risk Assessment": "ti-fire-extinguisher",
  };
  const isMobile = useIsMobile();
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
      setRows([]);
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

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <Metric label="Compliance Score" value={<>{score}<span style={{ fontSize: 13, color: "var(--txt-3)" }}>/100</span></>} sub={score >= 90 ? "Portfolio healthy" : score >= 60 ? "Needs attention" : "At risk"} color={score >= 90 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)"} />
        <Metric label="Urgent (≤7 days)" value={urgent} sub="Act now" color="var(--red)" />
        <Metric label="Due Soon (≤30 days)" value={soon} sub="Schedule renewal" color="var(--amber)" />
        <Metric label="Tracked Items" value={items.length} sub="Certificates" color="var(--blue)" />
      </div>

      {adding && (
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--txt-2)", marginBottom: 12, fontWeight: 500 }}>{editId ? "Edit certificate" : "New certificate"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
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


export function TenantsPage({ user, go, tier }) {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [related, setRelated] = useState({ comp: [], maint: [], pays: [] });
  const properties = usePropertyList();
  const blank = { name: "", property_id: "", email: "", phone: "", tenancy_start: "", tenancy_end: "", deposit_amount: "", deposit_protected: false, rent_status: "Up to date", rtr_status: "Pending", co_tenant_name: "", co_tenant_email: "", co_tenant_phone: "" };
  const [form, setForm] = useState(blank);

  // HMO / Block multi-tenant limits by subscription tier.
  const HMO_LIMIT = { basic: 1, bronze: 2, silver: 3, gold: 5 };
  const hmoCap = HMO_LIMIT[(tier || "basic").toLowerCase()] || 1;
  // House / Flat = one joint tenancy (a couple share one agreement). HMO / Block = multiple separate tenants.
  const propTypeOf = (pid) => { const p = properties.find((x) => String(x.id) === String(pid)); return p ? (p.type || "House") : null; };
  const isMultiType = (t) => t === "HMO" || t === "Block";

  useEffect(() => {
    if (!DB_READY) { setRows([]); return; }
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
  const openEdit = (t) => { setForm({ name: t.name || "", property_id: t.property_id || "", email: t.email || "", phone: t.phone || "", tenancy_start: t.tenancy_start || "", tenancy_end: t.tenancy_end || "", deposit_amount: t.deposit_amount || "", deposit_protected: !!t.deposit_protected, rent_status: t.rent_status || "Up to date", rtr_status: t.rtr_status || "Pending", co_tenant_name: t.co_tenant_name || "", co_tenant_email: t.co_tenant_email || "", co_tenant_phone: t.co_tenant_phone || "" }); setEditId(t.id); setAdding(true); setErr(""); };
  const save = async () => {
    if (!form.name.trim()) { setErr("Tenant name is required."); return; }
    if (form.tenancy_end) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const end = new Date(form.tenancy_end); end.setHours(0, 0, 0, 0);
      if (end < today) { setErr("Tenancy end date can't be in the past. Pick today or a future date."); return; }
      if (form.tenancy_start) {
        const start = new Date(form.tenancy_start); start.setHours(0, 0, 0, 0);
        if (end < start) { setErr("Tenancy end date can't be before the start date."); return; }
      }
    }
    // Per-property tenant limits.
    if (form.property_id) {
      const ptype = propTypeOf(form.property_id);
      const existing = (rows || []).filter((t) => String(t.property_id) === String(form.property_id) && t.id !== editId);
      if (!isMultiType(ptype)) {
        // House / Flat: only one tenancy record (the second person goes in the co-tenant section).
        if (existing.length >= 1) { setErr(`A ${ptype} holds one tenancy. To add a partner, edit the existing tenant and use "Add co-tenant" — a joint agreement counts as one tenancy.`); return; }
      } else {
        // HMO / Block: multiple separate tenants, capped by tier.
        if (existing.length >= hmoCap) { setErr(`Your ${(tier || "basic")} plan allows up to ${hmoCap} tenant${hmoCap === 1 ? "" : "s"} per ${ptype}. Upgrade to add more.`); return; }
      }
    }
    if (!DB_READY) { setErr("Add your Supabase keys to save for real."); return; }
    setErr("");
    const multi = isMultiType(propTypeOf(form.property_id));
    const payload = { ...form, deposit_amount: form.deposit_amount === "" ? null : +form.deposit_amount, property_id: form.property_id || null, property: propLabel(properties, form.property_id) };
    // Co-tenant only applies to a joint House/Flat tenancy — clear it on HMO/Block.
    if (multi) { payload.co_tenant_name = ""; payload.co_tenant_email = ""; payload.co_tenant_phone = ""; }
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <label style={fld}>Tenant name<input style={inp} placeholder="e.g. Sarah Connor" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label style={fld}>Property<select style={inp} value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}><option value="">— none —</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select></label>
            <label style={fld}>Email<input style={inp} type="email" placeholder="e.g. sarah@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label style={fld}>Phone<input style={inp} placeholder="e.g. 07700 900123" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
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

          {form.property_id && !isMultiType(propTypeOf(form.property_id)) && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px dashed var(--line)" }}>
              <div style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 4, fontWeight: 500 }}>Co-tenant (optional)</div>
              <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginBottom: 10, lineHeight: 1.5 }}>For a joint tenancy — e.g. a couple sharing one agreement. Counts as one tenancy.</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                <label style={fld}>Co-tenant name<input style={inp} placeholder="e.g. James Connor" value={form.co_tenant_name} onChange={(e) => setForm({ ...form, co_tenant_name: e.target.value })} /></label>
                <label style={fld}>Co-tenant email<input style={inp} type="email" placeholder="e.g. james@email.com" value={form.co_tenant_email} onChange={(e) => setForm({ ...form, co_tenant_email: e.target.value })} /></label>
                <label style={fld}>Co-tenant phone<input style={inp} placeholder="e.g. 07700 900124" value={form.co_tenant_phone} onChange={(e) => setForm({ ...form, co_tenant_phone: e.target.value })} /></label>
              </div>
            </div>
          )}
          {form.property_id && isMultiType(propTypeOf(form.property_id)) && (
            <div style={{ marginTop: 12, fontSize: 10.5, color: "var(--txt-3)" }}>{propTypeOf(form.property_id)} — add separate tenants individually (up to {hmoCap} on your {(tier || "basic")} plan).</div>
          )}

          <div style={{ marginTop: 12 }}><span onClick={save}><Btn icon="ti-device-floppy" label={editId ? "Update tenant" : "Save tenant"} primary /></span></div>
        </div>
      )}

      {rows === null ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 20 }}>Loading tenants…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" }}>No tenants yet. Click "Add tenant" to create your first one.</div>
      ) : (
        <Table cols={["", "Tenant", "Property", "Tenancy starts", "Tenancy ends", "Rent status", "Right to Rent", ""]}>
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
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500 }}>{t.name}</span>
                        {t.co_tenant_name ? <span style={{ fontSize: 10.5, color: "var(--txt-3)" }}>+ {t.co_tenant_name} (joint)</span> : null}
                      </span>
                    </div>
                  </Td>
                  <Td color="var(--txt-2)">{propName}</Td>
                  <Td color="var(--txt-2)">{t.tenancy_start || "—"}</Td>
                  <Td color="var(--txt-2)">{t.tenancy_end || "—"}</Td>
                  <Td><Pill text={t.rent_status || "—"} tone={t.rent_status === "Overdue" ? "red" : "green"} /></Td>
                  <Td><Pill text={t.rtr_status || "Pending"} tone={t.rtr_status === "Verified" ? "green" : "amber"} /></Td>
                  <Td>{t.id && DB_READY ? <span style={{ display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}><i className="ti ti-pencil" onClick={() => openEdit(t)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Edit" /><i className="ti ti-trash" onClick={() => remove(t.id)} style={{ fontSize: 15, color: "var(--txt-3)", cursor: "pointer" }} title="Delete" /></span> : null}</Td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0, borderBottom: "0.5px solid var(--line)" }}>
                      <div className="fade-in" style={{ background: "var(--bg)", padding: "16px 20px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 14 }}>
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

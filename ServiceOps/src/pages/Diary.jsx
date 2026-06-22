import { useState, useMemo, useEffect } from 'react'
import { db, DB_READY } from '../lib/db.js'
import { gbp, toneVar, inp, fld, formCard, demoBanner, errBanner, emptyCard } from '../lib/helpers.js'
import { PageHead, Btn, Pill, useConfirm, useCustomers, useProperties, CustomerPropertyPicker } from '../components/UI.jsx'

// Next free INV-### across existing invoices (mirrors the Invoicing page).
const nextInvRef = (rows) => {
  const re = /^INV-(\d+)$/i;
  let max = 0;
  (rows || []).forEach((r) => { const m = (r.ref || "").trim().match(re); if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; } });
  return `INV-${String(max + 1).padStart(3, "0")}`;
};

/* ==================================================================
   ServiceOps DIARY — calendar + list, modelled on GarageOps Calendar.
   Merges three sources onto one calendar:
     • svc_bookings          (tone: blue)  — has a time, slots into grid
     • svc_quotes (scheduled) (tone: amber) — scheduled_date, all-day
     • svc_invoices (scheduled)(tone: green) — scheduled_date, all-day
   Bookings are editable here; quotes/invoices are read-only links.
   A booking can spawn an invoice (simple amount dialog).
   ================================================================== */

const SRC_TONE = { booking: "blue", quote: "amber", invoice: "green" };
const SRC_LABEL = { booking: "Booking", quote: "Quote", invoice: "Invoice" };

const VIEWS = [
  { key: "month", label: "Month", icon: "ti-calendar" },
  { key: "week",  label: "Week",  icon: "ti-calendar-week" },
  { key: "day",   label: "Day",   icon: "ti-calendar-event" },
  { key: "list",  label: "List",  icon: "ti-list" },
];

// ---------- date helpers ----------
const fmtDate = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; };
const fmtTime = (t) => t ? String(t).slice(0, 5) : "";
const sameDate = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const out = [];
  for (let i = firstDow; i > 0; i--) out.push({ d: prevDays - i + 1, monthOffset: -1 });
  for (let d = 1; d <= daysInMonth; d++) out.push({ d, monthOffset: 0 });
  while (out.length < 42) out.push({ d: out.length - daysInMonth - firstDow + 1, monthOffset: 1 });
  return out.map((c) => {
    const date = c.monthOffset === 0 ? new Date(year, month, c.d) : c.monthOffset === -1 ? new Date(year, month - 1, c.d) : new Date(year, month + 1, c.d);
    return { ...c, date, dateStr: fmtDate(date) };
  });
}
function getWeekDays(refDate) {
  const d = new Date(refDate); d.setHours(0, 0, 0, 0);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
}
const DAY_SLOTS = Array.from({ length: 12 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`); // 07:00–18:00

// turn raw rows into one normalised event list
function normalise(bookings, quotes, invoices) {
  const ev = [];
  bookings.forEach((b) => ev.push({
    src: "booking", id: `b-${b.id}`, raw: b, rawId: b.id,
    date: b.booking_date, time: b.booking_time || "", title: b.title || "Booking",
    customer: b.customer || "", site: b.site || "", sub: b.engineer || "Unassigned",
  }));
  quotes.forEach((q) => { if (q.scheduled_date) ev.push({
    src: "quote", id: `q-${q.id}`, raw: q, rawId: q.id,
    date: q.scheduled_date, time: q.scheduled_time || "", title: q.description || q.ref || "Quote",
    customer: q.customer || "", site: q.site || "", sub: gbp(+q.amount || 0),
  }); });
  invoices.forEach((v) => { if (v.scheduled_date) ev.push({
    src: "invoice", id: `i-${v.id}`, raw: v, rawId: v.id,
    date: v.scheduled_date, time: v.scheduled_time || "", title: v.ref || "Invoice",
    customer: v.customer || "", site: v.site || "", sub: gbp(+v.amount || 0),
  }); });
  return ev;
}

export default function DiaryPage({ user }) {
  const [customers, reloadCustomers] = useCustomers();
  const [properties, reloadProperties] = useProperties();
  const [bookings, setBookings] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [view, setView] = useState("month");
  const [refDate, setRefDate] = useState(new Date());
  const [selected, setSelected] = useState(null);     // event detail modal
  const [formMode, setFormMode] = useState(null);     // null | 'create' | 'edit'
  const [formInitial, setFormInitial] = useState({});
  const [invoiceBooking, setInvoiceBooking] = useState(null); // booking → invoice dialog
  const [confirmNode, ask] = useConfirm();

  const load = () => {
    if (!DB_READY) { setBookings([]); setQuotes([]); setInvoices([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      db.from("svc_bookings").select("*"),
      db.from("svc_quotes").select("*"),
      db.from("svc_invoices").select("*"),
    ]).then(([b, q, v]) => {
      if (b.error) setErr(b.error.message);
      setBookings(b.data || []); setQuotes(q.data || []); setInvoices(v.data || []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const events = useMemo(() => normalise(bookings, quotes, invoices), [bookings, quotes, invoices]);
  const byDate = useMemo(() => {
    const map = {};
    events.forEach((e) => { if (!e.date) return; (map[e.date] = map[e.date] || []).push(e); });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.time || "99").localeCompare(b.time || "99")));
    return map;
  }, [events]);

  // ---- booking CRUD ----
  const openCreate = (prefill = {}) => { setFormInitial({ booking_date: prefill.booking_date || fmtDate(refDate), booking_time: prefill.booking_time || "" }); setFormMode("create"); };
  const openEdit = (b) => { setFormInitial(b); setFormMode("edit"); setSelected(null); };
  const saveBooking = async (data) => {
    const payload = { ...data, customer_id: data.customer_id || null, property_id: data.property_id || null };
    if (!payload.booking_time) delete payload.booking_time;
    delete payload.id;
    let error;
    if (data.id) ({ error } = await db.from("svc_bookings").update(payload).eq("id", data.id));
    else ({ error } = await db.from("svc_bookings").insert([{ ...payload, user_id: user.id }]));
    if (error) throw error;
    setFormMode(null); load();
  };
  const deleteBooking = (b) => ask(<span>Delete booking <strong>{b.title}</strong>{b.booking_date ? <> on <strong>{b.booking_date}</strong></> : ""}? This can't be undone.</span>, async () => {
    await db.from("svc_bookings").delete().eq("id", b.id); setSelected(null); load();
  });

  // ---- nav ----
  const navPrev = () => { const d = new Date(refDate); if (view === "month") d.setMonth(d.getMonth() - 1); else if (view === "week") d.setDate(d.getDate() - 7); else d.setDate(d.getDate() - 1); setRefDate(d); };
  const navNext = () => { const d = new Date(refDate); if (view === "month") d.setMonth(d.getMonth() + 1); else if (view === "week") d.setDate(d.getDate() + 7); else d.setDate(d.getDate() + 1); setRefDate(d); };
  const navToday = () => setRefDate(new Date());

  const headerLabel = useMemo(() => {
    if (view === "month") return refDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (view === "week") { const days = getWeekDays(refDate); return `${days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`; }
    if (view === "day") return refDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return "All scheduled items";
  }, [view, refDate]);

  const iconBtn = { width: 32, height: 32, background: "var(--panel-2)", border: "0.5px solid var(--line)", color: "var(--txt-2)", borderRadius: 7, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 };

  return (
    <div className="fade-in">
      <PageHead title="Diary" sub={loading ? "Loading…" : `${events.length} scheduled item${events.length === 1 ? "" : "s"}${DB_READY ? "" : " (demo)"}`}
        right={<span onClick={() => openCreate()}><Btn icon="ti-plus" label="New booking" primary /></span>} />
      {!DB_READY && <div style={demoBanner}>Demo mode — add your keys in supabase.js to use the live database.</div>}
      {err && <div style={errBanner}>{err}</div>}

      {/* Toolbar */}
      <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--panel)", borderRadius: 8, padding: 3, border: "0.5px solid var(--line)" }}>
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: view === v.key ? 600 : 500, color: view === v.key ? "#fff" : "var(--txt-2)", background: view === v.key ? "var(--brand)" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i className={`ti ${v.icon}`} style={{ fontSize: 13 }} />{v.label}
            </button>
          ))}
        </div>
        {/* legend */}
        <div style={{ display: "flex", gap: 12, marginLeft: 6 }}>
          {Object.keys(SRC_TONE).map((k) => (
            <span key={k} style={{ fontSize: 10.5, color: "var(--txt-2)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--${SRC_TONE[k]})` }} />{SRC_LABEL[k]}</span>
          ))}
        </div>
        {view !== "list" && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <button onClick={navPrev} style={iconBtn}><i className="ti ti-chevron-left" /></button>
            <button onClick={navToday} style={{ background: "var(--panel)", color: "var(--txt)", border: "0.5px solid var(--line)", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Today</button>
            <button onClick={navNext} style={iconBtn}><i className="ti ti-chevron-right" /></button>
          </div>
        )}
        <div style={{ fontSize: 13.5, fontWeight: 500, minWidth: 160, textAlign: "right", marginLeft: view === "list" ? "auto" : 0 }}>{headerLabel}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, alignItems: "start" }} className="diary-layout">
        <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--txt-3)", fontSize: 13 }}>Loading diary…</div>
          ) : (
            <>
              {view === "month" && <MonthView refDate={refDate} byDate={byDate} onEvent={setSelected} onDay={(d) => { setRefDate(d); setView("day"); }} />}
              {view === "week"  && <WeekView  refDate={refDate} byDate={byDate} onEvent={setSelected} onSlot={(d, t) => openCreate({ booking_date: fmtDate(d), booking_time: t })} />}
              {view === "day"   && <DayView   refDate={refDate} byDate={byDate} onEvent={setSelected} onSlot={(t) => openCreate({ booking_date: fmtDate(refDate), booking_time: t })} />}
              {view === "list"  && <ListView  byDate={byDate} onEvent={setSelected} />}
            </>
          )}
        </div>

        <TodayPanel byDate={byDate} onEvent={setSelected} onAdd={() => openCreate({ booking_date: fmtDate(new Date()) })} user={user} />
      </div>

      <style>{`@media (max-width:860px){ .diary-layout{ grid-template-columns:1fr !important; } }`}</style>

      {!loading && events.length === 0 && (
        <div style={{ marginTop: 14, padding: 14, background: "var(--panel-2)", borderRadius: 10, textAlign: "center", fontSize: 12, color: "var(--txt-2)" }}>
          Nothing scheduled yet. Tap <strong style={{ color: "var(--txt)" }}>New booking</strong>, or set a scheduled date on a quote or invoice to see it here.
        </div>
      )}

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} onEdit={openEdit} onDelete={deleteBooking} onInvoice={(b) => { setSelected(null); setInvoiceBooking(b); }} />}
      {formMode && <BookingForm mode={formMode} initial={formInitial} user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} onClose={() => setFormMode(null)} onSave={saveBooking} />}
      {invoiceBooking && <BookingInvoice booking={invoiceBooking} user={user} onClose={() => setInvoiceBooking(null)} onDone={() => { setInvoiceBooking(null); load(); }} />}
      {confirmNode}
    </div>
  );
}

// ---------- shared event chip ----------
function Chip({ ev, onClick, dense }) {
  const t = toneVar(SRC_TONE[ev.src]);
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(ev); }} title={`${SRC_LABEL[ev.src]} · ${ev.customer || ""}`}
      style={{ background: t.soft, borderLeft: `2px solid ${t.color}`, padding: dense ? "2px 5px" : "3px 6px", borderRadius: 3, fontSize: dense ? 10 : 11, color: "var(--txt)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", marginBottom: 2 }}>
      {ev.time && <span style={{ fontFamily: "monospace", color: "var(--txt-2)" }}>{fmtTime(ev.time)} </span>}
      {ev.customer || ev.title}
    </div>
  );
}

// ---------- MONTH ----------
function MonthView({ refDate, byDate, onEvent, onDay }) {
  const grid = getMonthGrid(refDate.getFullYear(), refDate.getMonth());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "0.5px solid var(--line)" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, color: "var(--txt-3)", fontFamily: "monospace", letterSpacing: ".8px", textTransform: "uppercase" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "1fr", minHeight: 480 }}>
        {grid.map((c, i) => {
          const isToday = sameDate(c.date, today);
          const inMonth = c.monthOffset === 0;
          const evs = byDate[c.dateStr] || [];
          return (
            <div key={i} onClick={() => inMonth && onDay(c.date)} style={{ borderRight: i % 7 === 6 ? "none" : "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", padding: "6px 6px 4px", minHeight: 80, opacity: inMonth ? 1 : 0.35, cursor: inMonth ? "pointer" : "default", background: isToday ? "var(--brand-soft)" : "transparent", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: isToday ? "var(--brand)" : "var(--txt-2)", fontWeight: isToday ? 700 : 500 }}>{c.d}</span>
                {evs.length > 0 && <span style={{ fontSize: 9, color: "var(--txt-3)", fontFamily: "monospace" }}>{evs.length}</span>}
              </div>
              {evs.slice(0, 3).map((ev) => <Chip key={ev.id} ev={ev} onClick={onEvent} dense />)}
              {evs.length > 3 && <div style={{ fontSize: 9, color: "var(--txt-3)", fontFamily: "monospace", textAlign: "center" }}>+{evs.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- WEEK ----------
function WeekView({ refDate, byDate, onEvent, onSlot }) {
  const days = getWeekDays(refDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", minHeight: 480 }}>
      <div style={{ borderRight: "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)" }} />
      {days.map((d, i) => {
        const isToday = sameDate(d, today);
        return (
          <div key={i} style={{ borderRight: i === 6 ? "none" : "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", padding: "8px", textAlign: "center", background: isToday ? "var(--brand-soft)" : "transparent" }}>
            <div style={{ fontSize: 10, color: "var(--txt-3)", fontFamily: "monospace", textTransform: "uppercase" }}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
            <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--brand)" : "var(--txt)", marginTop: 2 }}>{d.getDate()}</div>
          </div>
        );
      })}
      {/* all-day row (events without a time, e.g. scheduled quotes/invoices) */}
      <div style={{ borderRight: "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", padding: "4px 6px", fontSize: 9, color: "var(--txt-3)", fontFamily: "monospace", textAlign: "right" }}>all-day</div>
      {days.map((d, di) => {
        const all = (byDate[fmtDate(d)] || []).filter((e) => !e.time);
        return <div key={`ad-${di}`} style={{ borderRight: di === 6 ? "none" : "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", minHeight: 30, padding: 2 }}>{all.map((ev) => <Chip key={ev.id} ev={ev} onClick={onEvent} dense />)}</div>;
      })}
      {DAY_SLOTS.map((t, ri) => (
        <div key={`row-${ri}`} style={{ display: "contents" }}>
          <div style={{ borderRight: "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", padding: "4px 6px", fontSize: 10, color: "var(--txt-3)", fontFamily: "monospace", textAlign: "right" }}>{t}</div>
          {days.map((d, di) => {
            const matches = (byDate[fmtDate(d)] || []).filter((e) => e.time && fmtTime(e.time).slice(0, 2) === t.slice(0, 2));
            return (
              <div key={`c-${ri}-${di}`} onClick={() => matches.length === 0 && onSlot(d, t)} style={{ borderRight: di === 6 ? "none" : "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", minHeight: 32, padding: 2, cursor: matches.length === 0 ? "pointer" : "default" }}>
                {matches.map((ev) => <Chip key={ev.id} ev={ev} onClick={onEvent} dense />)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------- DAY ----------
function DayView({ refDate, byDate, onEvent, onSlot }) {
  const dateStr = fmtDate(refDate);
  const all = (byDate[dateStr] || []).filter((e) => !e.time);
  return (
    <div>
      {all.length > 0 && (
        <div style={{ padding: "10px 12px", borderBottom: "0.5px solid var(--line)", display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--txt-3)", fontFamily: "monospace", alignSelf: "center", marginRight: 6 }}>ALL-DAY</span>
          {all.map((ev) => <span key={ev.id} style={{ minWidth: 160 }}><Chip ev={ev} onClick={onEvent} /></span>)}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr" }}>
        {DAY_SLOTS.map((t, i) => {
          const matches = (byDate[dateStr] || []).filter((e) => e.time && fmtTime(e.time).slice(0, 2) === t.slice(0, 2));
          return (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ borderRight: "0.5px solid var(--line)", borderBottom: "0.5px solid var(--line)", padding: "8px 12px", fontSize: 12, color: "var(--txt-3)", fontFamily: "monospace", textAlign: "right" }}>{t}</div>
              <div onClick={() => matches.length === 0 && onSlot(t)} style={{ borderBottom: "0.5px solid var(--line)", minHeight: 44, padding: "4px 8px", display: "flex", flexDirection: "column", gap: 4, cursor: matches.length === 0 ? "pointer" : "default" }}>
                {matches.length === 0 ? <span style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "monospace", opacity: 0.5 }}>＋ Click to add</span>
                  : matches.map((ev) => {
                    const t2 = toneVar(SRC_TONE[ev.src]);
                    return (
                      <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEvent(ev); }} style={{ background: t2.soft, borderLeft: `3px solid ${t2.color}`, padding: "6px 10px", borderRadius: 5, fontSize: 13, color: "var(--txt)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span><strong style={{ fontWeight: 500 }}>{ev.customer || ev.title}</strong>{ev.title && ev.customer && <span style={{ color: "var(--txt-2)", marginLeft: 8, fontSize: 12 }}>· {ev.title}</span>}</span>
                        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--txt-3)" }}>{SRC_LABEL[ev.src]}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- LIST ----------
function ListView({ byDate, onEvent }) {
  const dates = Object.keys(byDate).sort();
  const fmtDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (dates.length === 0) return <div style={{ padding: 30, textAlign: "center", color: "var(--txt-3)", fontSize: 13 }}>Nothing scheduled.</div>;
  return (
    <div style={{ padding: "8px 0" }}>
      {dates.map((dk) => (
        <div key={dk} style={{ padding: "8px 16px" }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--txt-2)", textTransform: "uppercase", marginBottom: 9 }}>{fmtDay(dk)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {byDate[dk].map((ev) => {
              const t = toneVar(SRC_TONE[ev.src]);
              return (
                <div key={ev.id} onClick={() => onEvent(ev)} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderLeft: `2px solid ${t.color}`, borderRadius: 8, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: t.color, fontFamily: "monospace", minWidth: 46 }}>{ev.time ? fmtTime(ev.time) : "—"}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{ev.customer || "—"}{ev.site ? ` · ${ev.site}` : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "var(--txt-2)" }}>{ev.sub}</span>
                    <Pill text={SRC_LABEL[ev.src]} tone={SRC_TONE[ev.src]} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- TODAY PANEL + note ----------
function TodayPanel({ byDate, onEvent, onAdd, user }) {
  const todayStr = fmtDate(new Date());
  const todays = (byDate[todayStr] || []);
  const niceToday = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!DB_READY || !user) return;
    db.from("svc_day_notes").select("note").eq("user_id", user.id).eq("note_date", todayStr).maybeSingle()
      .then(({ data }) => { const n = (data && data.note) || ""; setNote(n); setSavedNote(n); });
  }, [user]);

  const dirty = note !== savedNote;
  const saveNote = async () => {
    if (!DB_READY) return;
    setBusy(true);
    const { error } = await db.from("svc_day_notes").upsert({ user_id: user.id, note_date: todayStr, note: note.trim(), updated_at: new Date().toISOString() }, { onConflict: "user_id,note_date" });
    setBusy(false);
    if (!error) { setSavedNote(note.trim()); setNote(note.trim()); setJustSaved(true); setTimeout(() => setJustSaved(false), 1800); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Today</div>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--txt-3)" }}>{todays.length} item{todays.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 12 }}>{niceToday}</div>
        {todays.length === 0 ? <div style={{ fontSize: 12, color: "var(--txt-3)", padding: "14px 0", textAlign: "center" }}>Nothing scheduled today</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todays.map((ev) => {
                const t = toneVar(SRC_TONE[ev.src]);
                return (
                  <div key={ev.id} onClick={() => onEvent(ev)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, background: "var(--panel)", border: "0.5px solid var(--line)", cursor: "pointer" }}>
                    <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: t.color }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.customer || ev.title}</div>
                      <div style={{ fontSize: 10, color: "var(--txt-2)", fontFamily: "monospace", marginTop: 2 }}>{ev.time ? fmtTime(ev.time) : "all-day"}{ev.site ? ` · ${ev.site}` : ""} · {SRC_LABEL[ev.src]}</div>
                    </div>
                  </div>
                );
              })}
            </div>}
        <button onClick={onAdd} style={{ width: "100%", marginTop: 12, background: "transparent", border: "1px dashed var(--line-2)", color: "var(--txt-2)", borderRadius: 9, padding: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><i className="ti ti-plus" />Add booking for today</button>
      </div>

      <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Note for today</div>
          {justSaved && <span style={{ fontSize: 10, color: "var(--green)", fontFamily: "monospace" }}>✓ Saved</span>}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jot something down — parts on order, reminders…" rows={4} style={{ width: "100%", resize: "vertical", background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        <button onClick={saveNote} disabled={!dirty || busy} style={{ width: "100%", marginTop: 8, background: dirty ? "var(--brand)" : "var(--surface3)", color: dirty ? "#fff" : "var(--txt-3)", border: "none", borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 500, fontFamily: "inherit", cursor: dirty && !busy ? "pointer" : "default", opacity: busy ? 0.7 : 1 }}>{busy ? "Saving…" : dirty ? "Save note" : "Saved"}</button>
      </div>
    </div>
  );
}

// ---------- event detail modal ----------
function EventModal({ event, onClose, onEdit, onDelete, onInvoice }) {
  const t = toneVar(SRC_TONE[event.src]);
  const isBooking = event.src === "booking";
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600, padding: 16 }}>
      <div style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 16, padding: 22, width: 460, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "inline-block", marginBottom: 6 }}><Pill text={SRC_LABEL[event.src]} tone={SRC_TONE[event.src]} /></div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>{event.customer || event.title}</div>
            {event.customer && event.title !== event.customer && <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 2 }}>{event.title}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--txt-3)", fontSize: 22, cursor: "pointer" }}><i className="ti ti-x" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="Date" value={event.date || "—"} />
          <Field label="Time" value={event.time ? fmtTime(event.time) : "All-day"} />
          {event.site && <Field label="Site" value={event.site} />}
          {event.sub && <Field label={isBooking ? "Engineer" : "Amount"} value={event.sub} />}
        </div>
        <div style={{ borderTop: "0.5px solid var(--line)", paddingTop: 14, marginTop: 6, display: "flex", gap: 8, justifyContent: "space-between" }}>
          {isBooking ? (
            <>
              <span onClick={() => onDelete(event.raw)}><Btn icon="ti-trash" label="Delete" /></span>
              <div style={{ display: "flex", gap: 8 }}>
                <span onClick={() => onInvoice(event.raw)}><Btn icon="ti-file-invoice" label="Raise invoice" /></span>
                <span onClick={() => onEdit(event.raw)}><Btn icon="ti-pencil" label="Edit" primary /></span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginLeft: "auto" }}>Edit this from the {SRC_LABEL[event.src]}s page.</div>
          )}
        </div>
      </div>
    </div>
  );
}
const Field = ({ label, value }) => (
  <div><div style={{ fontSize: 10, color: "var(--txt-3)", fontFamily: "monospace", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 13 }}>{value}</div></div>
);

// ---------- booking form (create/edit) ----------
function BookingForm({ mode, initial, user, customers, properties, reloadCustomers, reloadProperties, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: initial.id || null,
    title: initial.title || "",
    customer_id: initial.customer_id || "", customer: initial.customer || "",
    property_id: initial.property_id || "", site: initial.site || "",
    engineer: initial.engineer || "", priority: initial.priority || "Medium",
    booking_date: initial.booking_date || fmtDate(new Date()), booking_time: fmtTime(initial.booking_time) || "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!form.title.trim()) { setError("Booking title is required."); return; }
    if (!form.booking_date) { setError("Please choose a date."); return; }
    if (!DB_READY) { setError("Add your Supabase keys to save."); return; }
    setBusy(true);
    try { await onSave(form); } catch (e) { setError(e.message || "Failed to save"); setBusy(false); }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600, padding: 16 }}>
      <div style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 16, padding: 22, width: 560, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{mode === "edit" ? "Edit booking" : "New booking"}</div>
          <button onClick={onClose} disabled={busy} style={{ background: "none", border: "none", color: "var(--txt-3)", fontSize: 22, cursor: "pointer" }}><i className="ti ti-x" /></button>
        </div>
        {error && <div style={errBanner}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <label style={fld}>Booking title<input style={inp} placeholder="e.g. Boiler inspection" value={form.title} autoFocus onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label style={fld}>Date<input style={inp} type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></label>
          <label style={fld}>Time<input style={inp} type="time" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} /></label>
          <CustomerPropertyPicker user={user} customers={customers} properties={properties} reloadCustomers={reloadCustomers} reloadProperties={reloadProperties} form={form} onSet={(patch) => setForm({ ...form, ...patch })} />
          <label style={fld}>Engineer<input style={inp} placeholder="e.g. Dave R." value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} /></label>
          <label style={fld}>Priority<select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
        <div style={{ borderTop: "0.5px solid var(--line)", paddingTop: 14, marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span>
          <span onClick={submit}><Btn icon="ti-device-floppy" label={busy ? "Saving…" : (mode === "edit" ? "Save changes" : "Create booking")} primary /></span>
        </div>
      </div>
    </div>
  );
}

// ---------- booking → invoice (simple amount) ----------
function BookingInvoice({ booking, user, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("Sent");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!DB_READY) { setErr("Database not connected."); return; }
    if (!(+amount > 0)) { setErr("Enter an amount greater than zero."); return; }
    setBusy(true); setErr("");
    const base = {
      customer_id: booking.customer_id || null, customer: booking.customer || "",
      property_id: booking.property_id || null, site: booking.site || "",
      booking_id: booking.id, amount: +amount, status, user_id: user.id,
    };
    if (booking.booking_date) base.scheduled_date = booking.booking_date;
    if (booking.booking_time) base.scheduled_time = booking.booking_time;

    const manual = ref.trim();
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      let useRef = manual;
      if (!useRef) { const { data } = await db.from("svc_invoices").select("ref"); useRef = nextInvRef(data); }
      const { error } = await db.from("svc_invoices").insert([{ ...base, ref: useRef }]);
      if (!error) { setBusy(false); onDone(); return; }
      lastErr = error;
      const clash = error.code === "23505" || /duplicate|unique/i.test(error.message || "");
      if (!clash || manual) break; // surface manual clashes; retry only auto numbers
    }
    setBusy(false);
    if (lastErr && (lastErr.code === "23505" || /duplicate|unique/i.test(lastErr.message || "")) && manual) setErr(`Invoice number "${manual}" is already used. Clear it to auto-number, or pick another.`);
    else if (lastErr) setErr(lastErr.message);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 620, padding: 16 }}>
      <div style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, padding: 20, width: 420, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invoice from booking</div>
        <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginBottom: 14 }}>{booking.title}{booking.customer ? ` · ${booking.customer}` : ""}{booking.site ? ` · ${booking.site}` : ""}</div>
        {err && <div style={errBanner}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={fld}>Amount (£)<input style={inp} type="number" placeholder="e.g. 90" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} /></label>
          <label style={fld}>Status<select style={inp} value={status} onChange={(e) => setStatus(e.target.value)}>{["Draft", "Sent", "Paid"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label style={{ ...fld, gridColumn: "span 2" }}>Reference (optional)<input style={inp} placeholder="auto-generated" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <span onClick={onClose}><Btn icon="ti-x" label="Cancel" /></span>
          <span onClick={save}><Btn icon="ti-send" label={busy ? "Creating…" : "Raise invoice"} primary /></span>
        </div>
      </div>
    </div>
  );
}

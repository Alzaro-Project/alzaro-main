import { useState, useEffect } from "react";
import { db, DB_READY } from "./supabase.js";

// ===== MOBILE HELPERS =====
// MOBILE HELPERS
export const MOBILE_BP = 880; // below this width = phone/small-tablet layout
export function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= MOBILE_BP);
  useEffect(() => {
    const onR = () => setM(window.innerWidth <= MOBILE_BP);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return m;
}
// Injected once: stops iOS auto-zoom on inputs + lets wide tables scroll smoothly
if (typeof document !== "undefined" && !document.getElementById("propops-mobile-css")) {
  const st = document.createElement("style");
  st.id = "propops-mobile-css";
  st.textContent = `
    @media (max-width: ${MOBILE_BP}px) {
      input, select, textarea { font-size: 16px !important; }
    }
    .tbl-scroll { -webkit-overflow-scrolling: touch; }
  `;
  document.head.appendChild(st);
}


// ===== CONSTANTS =====
export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard", min: "basic" },
  { id: "properties", label: "Properties", icon: "ti-building-estate", min: "basic" },
  { id: "tenants", label: "Tenants", icon: "ti-users", min: "basic" },
  { id: "finance", label: "Finance", icon: "ti-coin", min: "silver" },
  { id: "maintenance", label: "Maintenance", icon: "ti-tools", min: "bronze" },
  { id: "compliance", label: "Compliance", icon: "ti-shield-check", min: "silver" },
  { id: "documents", label: "Documents", icon: "ti-folder", min: "gold" },
  { id: "reports", label: "Reports", icon: "ti-chart-bar", min: "silver" },
  { id: "settings", label: "Settings", icon: "ti-settings", min: "basic" },
];

export const TIER_ORDER = ["basic", "bronze", "silver", "gold"];

export const REPORTS = [
  { cat: "Financial", tone: "green", icon: "ti-coin", items: [
    { name: "Rent statement", desc: "Rent due vs received per property, with running balance.", icon: "ti-receipt" },
    { name: "Arrears report", desc: "Every overdue tenant, amount, and days late.", icon: "ti-alert-triangle" },
    { name: "Landlord statement", desc: "Income, fees and net payout for each landlord.", icon: "ti-file-invoice" },
    { name: "Profit & loss", desc: "Income vs expenses across the portfolio for any period.", icon: "ti-chart-line" },
    { name: "Tax-year summary", desc: "SA105-ready income & allowable expenses for HMRC.", icon: "ti-building-bank" },
  ]},
  { cat: "Compliance", tone: "red", icon: "ti-shield-check", items: [
    { name: "Compliance audit", desc: "Every certificate, status and expiry — your audit trail.", icon: "ti-clipboard-check" },
    { name: "Expiring certificates", desc: "Gas, EICR, EPC, alarms due in the next 30/60/90 days.", icon: "ti-calendar-due" },
    { name: "Overdue & at-risk", desc: "Properties currently out of compliance, ranked by risk.", icon: "ti-flag" },
    { name: "Compliance score history", desc: "How your portfolio score has moved over time.", icon: "ti-trending-up" },
  ]},
  { cat: "Portfolio & tenancy", tone: "blue", icon: "ti-building-estate", items: [
    { name: "Occupancy report", desc: "Let vs vacant units and void periods.", icon: "ti-home-check" },
    { name: "Tenancy renewals", desc: "Tenancies ending soon and renewal status.", icon: "ti-calendar-repeat" },
    { name: "Rent review", desc: "Current rent vs market, properties due a review.", icon: "ti-arrows-up-down" },
  ]},
  { cat: "Operations", tone: "amber", icon: "ti-tools", items: [
    { name: "Maintenance summary", desc: "Open vs closed jobs, average resolution time.", icon: "ti-progress" },
    { name: "Contractor performance", desc: "Jobs, spend and response time per contractor.", icon: "ti-users" },
    { name: "Spend by category", desc: "Where maintenance money went, broken down.", icon: "ti-chart-pie" },
  ]},
];

export const RANGES = ["Today", "This Week", "This Month", "Quarter", "This Year"];
export const gbp = (n) => "£" + n.toLocaleString("en-GB");

// Effective payment status. An unpaid invoice (Pending/Sent) whose due date is
// in the past is treated as Overdue everywhere — without needing anyone to
// manually flip the row. Paid/already-Overdue statuses are returned as-is.
// Case-insensitive: normalises stored values like "sent"/"paid" too.
export const effectiveStatus = (p) => {
  const s = String(p?.status || "").toLowerCase();
  if (s === "paid") return "Paid";
  if (s === "overdue") return "Overdue";
  const base = s === "sent" ? "Sent" : "Pending";
  if (p?.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(p.due_date); due.setHours(0, 0, 0, 0);
    if (!isNaN(due) && due < today) return "Overdue";
  }
  return base;
};

// Format a stored date (ISO YYYY-MM-DD, or any parseable date) as UK DD/MM/YYYY.
// Returns the dash placeholder for empty/invalid values so callers can drop their own "|| '—'".
export const ukDate = (v) => {
  if (!v) return "—";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO date or datetime
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d)) return s; // leave anything unrecognised untouched
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
export const toneVar = (t) => ({ color: `var(--${t})`, soft: `var(--${t}-soft)` });

export const TIER_BADGE = {
  basic: { label: "BASIC", icon: "⚪" },
  bronze: { label: "BRONZE", icon: "🥉" },
  silver: { label: "SILVER", icon: "🥈" },
  gold: { label: "GOLD", icon: "👑" },
};
export const tierBadge = (tier) => TIER_BADGE[(tier || "basic").toLowerCase()] || TIER_BADGE.basic;

// ===== HELPERS =====
export function usePropertyList() {
  const [props, setProps] = useState([]);
  useEffect(() => {
    if (!DB_READY) { setProps([]); return; }
    db.from("prop_properties").select("id,address,type,rent,status").order("created_at", { ascending: false })
      .then(({ data }) => setProps(data || []));
  }, []);
  return props;
}


export const propLabel = (props, id) => { const p = props.find((x) => String(x.id) === String(id)); return p ? p.address : null; };

export function downloadCSV(filename, cols, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


export function buildReport(name, d) {
  const gbpc = (n) => "£" + (n || 0).toLocaleString("en-GB");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  switch (name) {
    case "Rent statement":
    case "Landlord statement":
      return { cols: ["Tenant", "Property", "Amount", "Due date", "Status"], rows: d.pays.map((p) => [p.tenant, p.property, gbpc(p.amount), ukDate(p.due_date), p.status]) };
    case "Arrears report":
      return { cols: ["Tenant", "Property", "Amount", "Due date"], rows: d.pays.filter((p) => effectiveStatus(p) === "Overdue").map((p) => [p.tenant, p.property, gbpc(p.amount), ukDate(p.due_date)]) };
    case "Profit & loss":
    case "Tax-year summary": {
      const collected = d.pays.filter((p) => p.status === "Paid").reduce((s, p) => s + (p.amount || 0), 0);
      const due = d.pays.reduce((s, p) => s + (p.amount || 0), 0);
      const maintCost = d.maint.reduce((s, m) => s + (+m.cost || 0), 0);
      const net = collected - maintCost;
      return { cols: ["Line", "Amount"], rows: [["Rent collected", gbpc(collected)], ["Rent due (all)", gbpc(due)], ["Outstanding", gbpc(due - collected)], ["Maintenance expenses", "-" + gbpc(maintCost)], ["Net (collected − expenses)", gbpc(net)], ["Properties", d.props.length]] };
    }
    case "Compliance audit":
      return { cols: ["Type", "Property", "Reference", "Expiry date"], rows: d.comp.map((c) => [c.type, c.property || "—", c.reference || "—", ukDate(c.expiry_date)]) };
    case "Expiring certificates":
      return { cols: ["Type", "Property", "Expiry date", "Days left"], rows: d.comp.map((c) => ({ ...c, dd: c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null })).filter((c) => c.dd !== null && c.dd <= 90).sort((a, b) => a.dd - b.dd).map((c) => [c.type, c.property || "—", ukDate(c.expiry_date), c.dd]) };
    case "Overdue & at-risk":
      return { cols: ["Type", "Property", "Expiry date", "Status"], rows: d.comp.map((c) => ({ ...c, dd: c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null })).filter((c) => c.dd !== null && c.dd <= 30).map((c) => [c.type, c.property || "—", ukDate(c.expiry_date), c.dd < 0 ? "Expired" : c.dd <= 7 ? "Urgent" : "Due soon"]) };
    case "Occupancy report":
      return { cols: ["Property", "Area", "Type", "Status", "Rent"], rows: d.props.map((p) => [p.address || p.addr, p.area || "—", p.type || "—", p.status, gbpc(p.rent)]) };
    case "Tenancy renewals":
      return { cols: ["Tenant", "Property", "Tenancy ends"], rows: d.tenants.map((t) => [t.name, t.property || "—", ukDate(t.tenancy_end)]) };
    case "Maintenance summary":
      return { cols: ["Job", "Property", "Priority", "Status", "Contractor", "Cost"], rows: d.maint.map((m) => [m.title, m.property || "—", m.priority, m.status, m.contractor || "—", gbpc(+m.cost || 0)]) };
    case "Spend by category": {
      const byp = {};
      d.maint.forEach((m) => { const k = m.property || "Unassigned"; byp[k] = (byp[k] || 0) + (+m.cost || 0); });
      const total = Object.values(byp).reduce((s, n) => s + n, 0);
      const rows = Object.entries(byp).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, gbpc(n)]);
      rows.push(["Total", gbpc(total)]);
      return { cols: ["Property", "Maintenance spend"], rows };
    }
    case "Contractor performance": {
      const byc = {};
      d.maint.forEach((m) => { const c = m.contractor || "Unassigned"; byc[c] = (byc[c] || 0) + 1; });
      return { cols: ["Contractor", "Jobs"], rows: Object.entries(byc).map(([c, n]) => [c, n]) };
    }
    default:
      return null; // not yet wired
  }
}

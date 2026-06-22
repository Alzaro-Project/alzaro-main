// ServiceOps shared helpers — pure utilities, style objects, and static data.
// No React/JSX here (except none). Imported across UI, pages, and shell.

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard", tint: "brand", min: "bronze" },
  { id: "invoicing", label: "Invoicing", icon: "ti-receipt", tint: "brand", min: "bronze" },
  { id: "quotes", label: "Quotes", icon: "ti-file-dollar", tint: "amber", min: "bronze" },
  { id: "customers", label: "Customers", icon: "ti-users", tint: "blue", min: "bronze" },
  { id: "diary", label: "Diary", icon: "ti-calendar", tint: "blue", min: "silver" },
  { id: "certificates", label: "Certificates", icon: "ti-shield-check", tint: "red", min: "gold" },
  { id: "reports", label: "Reports", icon: "ti-chart-bar", tint: "teal", min: "silver" },
  { id: "settings", label: "Settings", icon: "ti-settings", tint: "blue", min: "bronze" },
];

const TIER_ORDER = ["bronze", "silver", "gold"];

const REPORTS = [
  { cat: "Financial", tone: "green", icon: "ti-coin", items: [
    { name: "Sales report", desc: "Invoiced revenue by period, customer and job type.", icon: "ti-chart-line" },
    { name: "Outstanding invoices", desc: "Every unpaid and overdue invoice, with days late.", icon: "ti-alert-triangle" },
    { name: "Job profitability", desc: "Revenue vs materials and labour for each job.", icon: "ti-businessplan" },
    { name: "VAT report", desc: "Output and input VAT for the quarter — MTD ready.", icon: "ti-building-bank" },
    { name: "Monthly revenue", desc: "Revenue trend across the year, month by month.", icon: "ti-calendar-stats" },
  ]},
  { cat: "Compliance", tone: "red", icon: "ti-shield-check", items: [
    { name: "Certificate register", desc: "Every CP12, EICR and service cert, status and expiry.", icon: "ti-clipboard-check" },
    { name: "Expiring certificates", desc: "Gas, electrical and service certs due in 30/60/90 days.", icon: "ti-calendar-due" },
    { name: "Completion certificates", desc: "Signed-off jobs with customer e-signature on file.", icon: "ti-circle-check" },
  ]},
  { cat: "Jobs & quoting", tone: "blue", icon: "ti-briefcase", items: [
    { name: "Quote conversion", desc: "Quotes sent vs approved, and average value.", icon: "ti-arrows-up-down" },
    { name: "Job status summary", desc: "Open vs completed jobs and average turnaround.", icon: "ti-progress" },
    { name: "Engineer utilisation", desc: "Jobs and hours per engineer across the week.", icon: "ti-user-cog" },
  ]},
  { cat: "Customers", tone: "amber", icon: "ti-users", items: [
    { name: "Customer spend", desc: "Lifetime spend and job count per customer.", icon: "ti-coin" },
    { name: "Repeat business", desc: "Returning customers vs one-off jobs.", icon: "ti-repeat" },
    { name: "Source breakdown", desc: "Where new customers came from.", icon: "ti-chart-pie" },
  ]},
];

const RANGES = ["Today", "This Week", "This Month", "Quarter", "This Year", "Custom"];

const gbp = (n) => "£" + n.toLocaleString("en-GB");
const toneVar = (t) => ({ color: `var(--${t})`, soft: `var(--${t}-soft)` });

const inp = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8, padding: "9px 12px", color: "var(--txt)", fontSize: 12.5, fontFamily: "'Plus Jakarta Sans',sans-serif", outline: "none", width: "100%" };
const fld = { display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: "var(--txt-3)" };
const formCard = { background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 };
const demoBanner = { fontSize: 11.5, color: "var(--amber)", background: "var(--amber-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 };
const errBanner = { fontSize: 11.5, color: "var(--red)", background: "var(--red-soft)", padding: "8px 12px", borderRadius: 8, marginBottom: 14 };
const emptyCard = { color: "var(--txt-3)", fontSize: 13, padding: 30, textAlign: "center", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)" };

export { NAV, TIER_ORDER, REPORTS, RANGES, gbp, toneVar, inp, fld, formCard, demoBanner, errBanner, emptyCard };

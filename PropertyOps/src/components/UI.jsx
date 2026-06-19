import { useState } from "react";
import { downloadCSV, toneVar, useIsMobile } from "../lib/helpers.js";

/* ===== SHARED UI COMPONENTS ===== */
export function PageHead({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 600 }}>{title}</h2>
        <div style={{ fontSize: 13, color: "var(--txt-2)" }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

export function Btn({ icon, label, primary }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
      background: primary ? "var(--brand)" : "var(--panel-2)", color: primary ? "#fff" : "var(--txt)", border: "0.5px solid " + (primary ? "var(--brand)" : "var(--line)") }}>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 15 }} />}{label}
    </span>
  );
}

export function Metric({ label, value, sub, color, subColor }) {
  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--txt-3)", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "Sora,sans-serif", color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: subColor || "var(--txt-3)", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

export function Panel({ title, action, children, onAction }) {
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

export function Pill({ text, tone }) {
  const t = toneVar(tone);
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: t.color, background: t.soft, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{text}</span>;
}

export function Table({ cols, children }) {
  const isMobile = useIsMobile();
  return (
    <div className="tbl-scroll" style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: isMobile ? 680 : undefined, borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--line)" }}>
            {cols.map((c, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : "left", padding: "11px 16px", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--txt-3)", fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, color }) => <td style={{ padding: "12px 16px", color: color || "var(--txt)", borderBottom: "0.5px solid var(--line)" }}>{children}</td>;


/* ===== WelcomeBanner ===== */
export function WelcomeBanner({ data, go, user }) {
  const SUCCESS = "#22c55e";
  const key = user ? `prop_welcome_dismissed_${user.id}` : "prop_welcome_dismissed";
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === "1"; } catch (e) { return false; }
  });
  const dismiss = () => {
    try { localStorage.setItem(key, "1"); } catch (e) {}
    setDismissed(true);
  };

  const steps = [
    { id: "settings", label: "Set up your business details", done: false, page: "settings" },
    { id: "property", label: "Add your first property", done: (data.props || []).length > 0, page: "properties" },
    { id: "compliance", label: "Track a compliance certificate", done: (data.comp || []).length > 0, page: "compliance" },
    { id: "tenant", label: "Add your first tenant", done: false, page: "tenants" },
  ];
  // "Add a tenant" ticks once a property is Let; "settings" ticks once any other step is done.
  steps[3].done = (data.props || []).some((p) => p.status === "Let");
  steps[0].done = steps.slice(1).some((s) => s.done);

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  if (dismissed || allDone) return null;

  return (
    <div style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: "var(--radius)", padding: "20px 22px", marginBottom: 14, position: "relative" }}>
      <button onClick={dismiss} title="Dismiss" style={{ position: "absolute", top: 12, right: 14, background: "transparent", border: "none", color: "var(--txt-3)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>

      <div style={{ marginBottom: 14 }}>
        <h3 className="font-head" style={{ color: "var(--brand)", fontSize: 19, fontWeight: 700, margin: "0 0 3px 0" }}>👋 Welcome to PropertyOps</h3>
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

/* ===== Detail helpers ===== */
export function DetailBox({ title, icon, children, empty, emptyText, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 10, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = "var(--brand)")} onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = "var(--line)")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 14, color: "var(--brand)" }} />
          <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--txt-2)" }}>{title}</span>
        </div>
        {onClick && <i className="ti ti-arrow-up-right" style={{ fontSize: 14, color: "var(--txt-3)" }} />}
      </div>
      {empty ? <div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>{emptyText}</div> : children}
    </div>
  );
}

export function DetailRow({ main, sub, pill, tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", gap: 8 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{main}</div>{sub && <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{sub}</div>}</div>
      {pill && <Pill text={pill} tone={tone} />}
    </div>
  );
}

// COMPLIANCE

/* ===== ReportPreview ===== */
export function ReportPreview({ report, onClose }) {
  const empty = report.rows.length === 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--panel)", border: "0.5px solid var(--line-2)", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "82vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "0.5px solid var(--line)", position: "sticky", top: 0, background: "var(--panel)" }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>{report.name}</div><div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>{report.wired ? `${report.rows.length} row${report.rows.length === 1 ? "" : "s"} · ${report.period || "All time"} · your live data` : "Preview · coming soon"}</div></div>
          <i className="ti ti-x" onClick={onClose} style={{ fontSize: 19, color: "var(--txt-2)", cursor: "pointer" }} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12.5, color: "var(--txt-2)", marginBottom: 16, lineHeight: 1.6 }}>{report.desc}</div>
          {empty ? (
            <div style={{ fontSize: 12.5, color: "var(--txt-3)", padding: "20px 0", textAlign: "center" }}>{report.wired ? "No data for this report yet — add some in the relevant section first." : "This report isn't wired to live data yet."}</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: "0.5px solid var(--line)" }}>{report.cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--txt-3)" }}>{c}</th>)}</tr></thead>
              <tbody>{report.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} style={{ padding: "9px 10px", borderBottom: "0.5px solid var(--line)", color: j === 0 ? "var(--txt)" : "var(--txt-2)" }}>{cell}</td>)}</tr>)}</tbody>
            </table>
          )}
          {report.wired && !empty && (
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <span onClick={() => downloadCSV(report.name.replace(/\s+/g, "_") + ".csv", report.cols, report.rows)}><Btn icon="ti-file-type-csv" label="Download CSV" primary /></span>
            </div>
          )}
          {!report.wired && <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 12 }}>This report is on the roadmap — the data it needs isn't captured yet.</div>}
        </div>
      </div>
    </div>
  );
}

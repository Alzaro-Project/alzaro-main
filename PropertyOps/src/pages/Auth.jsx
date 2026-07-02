import { useState, useEffect } from "react";
import { db, DB_READY } from "../lib/supabase.js";

export function AuthScreen() {
  const wantsSignup = typeof window !== "undefined" && (
    window.location.hash === "#signup" || window.location.hash === "#register" ||
    /\/register\/?$/.test(window.location.pathname)
  );
  const [tab, setTab] = useState(wantsSignup ? "register" : "login");   // "login" | "register"
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [company, setCompany] = useState("");
  const [forgot, setForgot] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash;
      const p = window.location.pathname;
      if (h === "#signup" || h === "#register" || /\/register\/?$/.test(p)) setTab("register");
      else if (h === "#login" || /\/login\/?$/.test(p)) setTab("login");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const reset = () => { setMsg(""); setOk(""); };

  const doLogin = async () => {
    reset();
    if (!email.trim() || !pw.trim()) return setMsg("Please enter email and password.");
    if (!DB_READY) return setMsg("Database not connected. Add your keys in supabase.js.");
    setBusy(true);
    const { error } = await db.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setMsg(error.message);
    // success -> App() listener swaps to dashboard
  };

  const doRegister = async () => {
    reset();
    if (!company.trim() || !email.trim() || !pw.trim()) return setMsg("Please fill all fields.");
    if (pw.length < 6) return setMsg("Password must be at least 6 characters.");
    if (!DB_READY) return setMsg("Database not connected. Add your keys in supabase.js.");
    setBusy(true);
    const { error } = await db.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/confirmed?product=propertyops`, data: { company_name: company.trim(), product: "propertyops" } } });
    setBusy(false);
    if (error) return setMsg(error.message);
    setOk("Check your email to confirm your account, then log in.");
    setTab("login"); setCompany(""); setPw("");
  };

  const doForgot = async () => {
    reset();
    if (!email.trim()) return setMsg("Please enter your email address.");
    if (!DB_READY) return setMsg("Database not connected.");
    setBusy(true);
    const siteUrl = `${window.location.protocol}//${window.location.host}`;
    // Lands on the dedicated reset screen (vercel.json already rewrites this
    // route to the app). App.jsx detects the path and shows ResetPasswordScreen.
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/propertyops/reset-password` });
    setBusy(false);
    if (error) setMsg(error.message);
    else setOk("Password reset link sent! Check your inbox (and spam folder).");
  };

  const inp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "Inter", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "Inter", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(139,127,232,.3)" };
  const Banner = ({ text, good }) => (
    <div style={{ background: good ? "var(--green-soft)" : "var(--red-soft)", border: "1px solid " + (good ? "var(--green)" : "var(--red)"), borderRadius: 8, padding: "11px 14px", fontSize: 13, color: good ? "var(--green)" : "var(--red)", marginBottom: 14, lineHeight: 1.4 }}>{good ? "✓ " : ""}{text}</div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 20 }}>
      <div className="fade-in" style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "40px 36px", width: 440, maxWidth: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.4)" }}>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 28, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
          <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4 }}>Property Operations Infrastructure</div>
        </div>

        {forgot ? (
          <>
            <button onClick={() => { setForgot(false); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18, fontFamily: "Inter" }}>← Back to login</button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <i className="ti ti-key" style={{ fontSize: 34, color: "var(--brand)" }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Reset password</div>
              <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 4 }}>Enter your email and we'll send you a reset link</div>
            </div>
            {msg && <Banner text={msg} />}
            {ok && <Banner text={ok} good />}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doForgot()} />
              <button onClick={doForgot} disabled={busy} style={primaryBtn}>{busy ? "Sending…" : "Send reset link"}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, background: "var(--panel-2)", borderRadius: 10, padding: 4, marginBottom: 22 }}>
              {["login", "register"].map((t) => (
                <div key={t} onClick={() => { setTab(t); reset(); }} style={{ flex: 1, padding: 10, textAlign: "center", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === t ? "var(--line-2)" : "transparent", color: tab === t ? "var(--txt)" : "var(--txt-2)", transition: "all .15s" }}>
                  {t === "login" ? "Login" : "Register"}
                </div>
              ))}
            </div>

            {msg && <Banner text={msg} />}
            {ok && <Banner text={ok} good />}

            {tab === "login" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                <input style={inp} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                <button onClick={doLogin} disabled={busy} style={primaryBtn}>{busy ? "Signing in…" : "Sign in →"}</button>
                <button onClick={() => { setForgot(true); reset(); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "Inter" }}>Forgot password?</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--brand-soft)", border: "1px solid rgba(139,127,232,.25)", borderRadius: 8, padding: "11px 14px", fontSize: 12, color: "var(--brand)", textAlign: "center", fontWeight: 500 }}>
                  🏠 Start your <strong>14-day free trial</strong> — full access, no card required
                </div>
                <input style={inp} placeholder="Company name *" value={company} onChange={(e) => setCompany(e.target.value)} />
                <input style={inp} type="email" placeholder="Email address *" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input style={inp} type="password" placeholder="Password (min 6 characters) *" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRegister()} />
                <button onClick={doRegister} disabled={busy} style={primaryBtn}>{busy ? "Creating account…" : "Start free trial →"}</button>
                <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center", fontFamily: "monospace", letterSpacing: 0.3 }}>No credit card · Cancel anytime · UK-based support</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "monospace", letterSpacing: 0.5 }}>Alzaro PropertyOps · Built for UK landlords · v1.0</div>
    </div>
  );
}


/* ===== RESET PASSWORD ===== */
// Shown when the user arrives via the Supabase recovery link
// (/propertyops/reset-password). The link itself signs them into a temporary
// recovery session; this screen lets them set the new password, then signs
// out and returns to login.
export function ResetPasswordScreen() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState(false);
  const [linkOk, setLinkOk] = useState(false);

  // A valid recovery link creates a session — no session means the link is
  // invalid or expired. Give the token exchange a moment to complete first.
  useEffect(() => {
    let cancelled = false;
    let settled = false;
    const finish = (ok) => { if (cancelled || settled) return; settled = true; setLinkOk(ok); setChecked(true); };
    const check = async () => {
      const { data } = await db.auth.getSession();
      if (data?.session) { finish(true); return; }
      // Token may still be exchanging — listen briefly before giving up.
      const { data: sub } = db.auth.onAuthStateChange((_e, s) => { if (s) finish(true); });
      setTimeout(() => { sub.subscription.unsubscribe(); finish(false); }, 3000);
    };
    if (DB_READY) check(); else finish(false);
    return () => { cancelled = true; };
  }, []);

  const doReset = async () => {
    setMsg("");
    if (!pw) return setMsg("Please enter a new password.");
    if (pw.length < 6) return setMsg("Password must be at least 6 characters.");
    if (pw !== pw2) return setMsg("Passwords do not match.");
    setBusy(true);
    const { error } = await db.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(error.message || "Could not update your password.");
    setDone(true);
    // Sign out of the recovery session and return to a clean login.
    setTimeout(async () => {
      try { await db.auth.signOut(); } catch (e) {}
      window.location.href = "/propertyops/login";
    }, 2500);
  };

  const backToLogin = async () => {
    try { await db.auth.signOut(); } catch (e) {}
    window.location.href = "/propertyops/login";
  };

  const inp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "Inter", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "Inter", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(139,127,232,.3)" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 20 }}>
      <div className="fade-in" style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "40px 36px", width: 440, maxWidth: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 28, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
          <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4 }}>Property Operations Infrastructure</div>
        </div>

        {!checked ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--txt-3)", fontSize: 13 }}>Verifying reset link…</div>
        ) : done ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <i className="ti ti-circle-check" style={{ fontSize: 40, color: "var(--green)" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10, color: "var(--green)" }}>Password updated</div>
            <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 6 }}>Taking you to the login screen…</div>
          </div>
        ) : !linkOk ? (
          <div style={{ textAlign: "center", padding: "6px 0" }}>
            <i className="ti ti-link-off" style={{ fontSize: 36, color: "var(--red)" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>Invalid or expired link</div>
            <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 6, lineHeight: 1.5 }}>Reset links only work once and expire after a short time. Request a new one from the login screen.</div>
            <button onClick={backToLogin} style={{ ...primaryBtn, marginTop: 18 }}>← Back to login</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <i className="ti ti-key" style={{ fontSize: 34, color: "var(--brand)" }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Choose a new password</div>
              <div style={{ fontSize: 13, color: "var(--txt-2)", marginTop: 4 }}>Enter your new password below to finish resetting it</div>
            </div>
            {msg && (
              <div style={{ background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "var(--red)", marginBottom: 14, lineHeight: 1.4 }}>{msg}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inp} type="password" placeholder="New password (min 6 characters)" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doReset()} autoFocus />
              <input style={inp} type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doReset()} />
              <button onClick={doReset} disabled={busy} style={primaryBtn}>{busy ? "Updating…" : "Update password"}</button>
              <button onClick={backToLogin} disabled={busy} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "Inter" }}>Cancel — back to login</button>
            </div>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "monospace", letterSpacing: 0.5 }}>Alzaro PropertyOps · Built for UK landlords · v1.0</div>
    </div>
  );
}


/* ===== MEMBERSHIP GATE ===== */
export function JoinScreen({ user, onJoined, signOut }) {
  const [company, setCompany] = useState(user?.user_metadata?.company_name || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const doJoin = async () => {
    setMsg("");
    if (!company.trim()) return setMsg("Please enter your company name.");
    setBusy(true);
    const { error } = await db.rpc("join_product", { p_product: "propertyops", p_garage_name: company.trim() });
    setBusy(false);
    if (error) return setMsg(error.message || "Could not set up your PropertyOps account.");
    onJoined();
  };

  const inp = { width: "100%", background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 9, padding: "13px 16px", color: "var(--txt)", fontSize: 14, fontFamily: "Inter", outline: "none" };
  const primaryBtn = { width: "100%", background: "var(--brand)", color: "#fff", fontWeight: 600, fontSize: 14, padding: 14, borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer", fontFamily: "Inter", opacity: busy ? 0.7 : 1, boxShadow: "0 4px 16px rgba(139,127,232,.3)" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 20 }}>
      <div className="fade-in" style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, padding: "40px 36px", width: 440, maxWidth: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 28, fontWeight: 700 }}>Alzaro<span style={{ color: "var(--brand)" }}>PropOps</span></div>
          <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4 }}>Property Operations Infrastructure</div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>You're already with Alzaro</div>
          <div style={{ fontSize: 13, color: "var(--txt-2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--txt)" }}>{user.email}</strong> is registered to another
            Alzaro product. Start a separate <strong style={{ color: "var(--brand)" }}>14-day
            PropertyOps trial</strong> on this same login? Your other products and their data
            stay completely separate.
          </div>
        </div>

        {msg && (
          <div style={{ background: "var(--red-soft)", border: "1px solid var(--red)", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "var(--red)", marginBottom: 14 }}>{msg}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inp} placeholder="Company name for PropertyOps *" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doJoin()} autoFocus />
          <button onClick={doJoin} disabled={busy} style={primaryBtn}>{busy ? "Setting up…" : "Start PropertyOps Trial →"}</button>
          <button onClick={signOut} disabled={busy} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 12, cursor: "pointer", padding: 8, textAlign: "center", fontFamily: "Inter" }}>Not now — sign me out</button>
          <div style={{ fontSize: 11, color: "var(--txt-3)", textAlign: "center" }}>Separate trial · Separate subscription · No card required</div>
        </div>
      </div>
    </div>
  );
}

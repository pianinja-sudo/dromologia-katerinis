import React, { useState } from "react";
import { auth } from "./storage";
import CarLogo from "./CarLogo";

export default function Login({ initialName, needPassword = true, notice = "", onDone }) {
  const [name, setName] = useState(initialName || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (ev) => {
    ev.preventDefault();
    const n = name.trim();
    if (!n) return setError("Γράψε το όνομά σου (για να φαίνεται στο ιστορικό).");
    if (needPassword && !password) return setError("Γράψε το κλειδί της ομάδας.");
    setBusy(true);
    setError("");
    try {
      if (needPassword) {
        // Δέχεται είτε το κλειδί είτε ολόκληρο το λινκ (…#k=ΚΛΕΙΔΙ)
        const raw = password.trim();
        const m = raw.match(/[#&?]k=([^&\s]+)/);
        await auth.signIn(m ? decodeURIComponent(m[1]) : raw);
      }
      onDone(n);
    } catch (e) {
      setError("Λάθος κλειδί ή πρόβλημα σύνδεσης. Δοκίμασε ξανά.");
      setBusy(false);
    }
  };

  const field = { width: "100%", boxSizing: "border-box", border: "1.5px solid #E6E2D4", background: "#FFFFFF", color: "#23262B", borderRadius: 10, padding: "12px 12px", fontSize: 15 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "linear-gradient(180deg, #E4ECFB 0%, #EEF1F9 45%, #F5F6F8 100%)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 20, padding: "26px 22px", boxShadow: "0 10px 40px rgba(31,36,48,0.12)", border: "1px solid #E6E8EE" }}>
        <div style={{ display: "flex", justifyContent: "center" }}><CarLogo size={84} /></div>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, color: "#23262B", marginTop: 10 }}>Δρομολόγια Μετακινήσεων Κατερίνης</div>
        <div style={{ textAlign: "center", fontSize: 12.5, color: "#8A8578", margin: "4px 0 18px" }}>Γκρουπ Μετακινήσεων 2026–2027</div>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6E75" }}>Το όνομά σου</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="π.χ. Μαρία" style={{ ...field, margin: "4px 0 12px" }} />

        {needPassword && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6E75" }}>Κλειδί ομάδας <span style={{ fontWeight: 400, color: "#8A8578" }}>(ή επικόλλησε όλο το λινκ)</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" style={{ ...field, margin: "4px 0 14px" }} />
          </>
        )}

        {!error && notice && <div style={{ background: "#FBEFD5", color: "#6F4A0B", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{notice}</div>}
        {error && <div style={{ background: "#FCE4E0", color: "#9C3B2E", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={busy} style={{ width: "100%", background: "#2F6FED", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Σύνδεση..." : "Είσοδος"}
        </button>
        <div style={{ fontSize: 11, color: "#B7B2A0", textAlign: "center", marginTop: 12 }}>Θα σε θυμάται αυτή η συσκευή — το κλειδί ζητείται μία φορά.</div>
      </form>
    </div>
  );
}

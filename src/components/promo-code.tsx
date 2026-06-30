"use client";

import { useState } from "react";

/**
 * Promo-code entry — visual stub. No codes are wired yet, so submitting any
 * value shows a quiet "no active codes" note and nothing is applied to totals.
 */
export function PromoCode() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  if (!open) {
    return (
      <button className="cd-promo-toggle" onClick={() => setOpen(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.4z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>
        Add promo code
      </button>
    );
  }

  return (
    <form
      className="cd-promo"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(code.trim() ? "No active promo codes right now." : "");
      }}
    >
      <input
        className="cd-promo-input font-mono"
        placeholder="Promo code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
      />
      <button type="submit" className="cd-promo-apply">Apply</button>
      {msg && <p className="cd-promo-msg">{msg}</p>}
    </form>
  );
}

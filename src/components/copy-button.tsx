"use client";
import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="pill pill-dark" style={{ fontSize: 11, padding: "4px 8px" }}>
      {done ? "✓ Copied" : label}
    </button>
  );
}

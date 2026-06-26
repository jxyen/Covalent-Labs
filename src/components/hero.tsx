"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Flowing emerald helix ribbon — two intertwined sine strands streaming
 * horizontally across the hero on a gentle diagonal, with sparse cross-links
 * and a soft glow underlay. Elegant + light-brand (no beads). Drifts slowly;
 * reduced-motion safe; pauses when hidden; DPR-capped (~30fps).
 */
function HelixCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const cy = h * 0.5;
      const amp = Math.min(h * 0.2, 112);
      const waves = 1.9;
      const k = (Math.PI * 2 * waves) / w;
      const x0 = -w * 0.4;
      const x1 = w * 1.4;

      ctx.save();
      // gentle diagonal flow
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-9 * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);

      // horizontal fade (0 at edges, peak mid) so the helix dissolves at the sides
      const hf = (x: number) => {
        const u = x / w;
        return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
      };

      // backbone path tracer — two mirror sinusoids that cross = the double helix
      const trace = (phase: number) => {
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 4) {
          const y = cy + Math.sin(x * k + t + phase) * amp;
          if (x === x0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      };
      const fade = (rgb: string, mid: number) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(0.5, `rgba(${rgb},${mid})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        return g;
      };

      // 1) base-pair RUNGS — the ladder that reads unmistakably as DNA
      ctx.lineCap = "round";
      for (let x = x0; x <= x1; x += 16) {
        const ph = x * k + t;
        const s = Math.sin(ph);
        const sep = Math.abs(s);              // 0 at a crossing, 1 at widest opening
        const f = hf(x);
        if (f <= 0.02 || sep < 0.14) continue; // skip rungs right at the crossings
        const yA = cy + s * amp;
        const yB = cy - s * amp;
        const depth = (Math.cos(ph) + 1) / 2; // 0 (back) .. 1 (front)
        ctx.beginPath();
        ctx.moveTo(x, yA);
        ctx.lineTo(x, yB);
        ctx.lineWidth = 1.4 + depth * 1.2;
        ctx.strokeStyle = `rgba(24,184,131,${(0.16 + sep * 0.36) * f})`;
        ctx.stroke();
        // nodes where each rung meets a backbone
        for (const y of [yA, yB]) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + depth * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(53,224,160,${(0.3 + depth * 0.55) * f})`;
          ctx.fill();
        }
      }

      // 2) the two backbones — soft glow underlay + crisp strand
      ctx.lineJoin = "round";
      [
        { phase: 0, rgb: "24,184,131" },
        { phase: Math.PI, rgb: "15,99,72" },
      ].forEach(({ phase, rgb }) => {
        trace(phase);
        ctx.lineWidth = 12;
        ctx.strokeStyle = fade(rgb, 0.07);
        ctx.stroke();
        trace(phase);
        ctx.lineWidth = 3;
        ctx.strokeStyle = fade(rgb, 0.64);
        ctx.stroke();
      });

      ctx.restore();
    };

    if (reduce) {
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 30) return;
      last = now;
      t += 0.010;
      draw();
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="k-helix" aria-hidden="true" />;
}

export function Hero() {
  return (
    <section className="k-hero">
      <style>{`
        .k-hero { position: relative; overflow: hidden; background: var(--paper); }
        .k-hero::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(60% 48% at 50% 4%, rgba(24,184,131,0.12), transparent 60%),
            radial-gradient(48% 42% at 86% 32%, rgba(53,224,160,0.10), transparent 64%);
        }
        .k-helix {
          position: absolute; inset: 0; width: 100%; height: 100%;
          z-index: 0; pointer-events: none; opacity: 0.92;
          -webkit-mask-image: linear-gradient(180deg, transparent, #000 16%, #000 84%, transparent);
          mask-image: linear-gradient(180deg, transparent, #000 16%, #000 84%, transparent);
        }
        /* white veil directly behind the copy so type stays crisp over the helix */
        .k-hero-inner::before {
          content: ""; position: absolute; inset: 2% -6% 14%; z-index: -1; pointer-events: none;
          background: radial-gradient(58% 50% at 50% 44%, rgba(250,251,248,0.94) 42%, rgba(250,251,248,0.0) 78%);
        }
        .k-hero-inner {
          position: relative; z-index: 1; text-align: center;
          max-width: 860px; margin: 0 auto;
          padding: clamp(40px, 8vw, 104px) 0 clamp(32px, 6vw, 68px);
        }
        .k-hero-inner > * { max-width: 100%; position: relative; }
        .k-eyebrow { display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase;
          color: var(--emerald); flex-wrap: wrap; justify-content: center; max-width: 100%; }
        .k-eyebrow .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 10px var(--emerald); }
        .k-h1 {
          font-family: var(--font-display); font-weight: 800; text-transform: uppercase;
          letter-spacing: -0.025em; line-height: 0.95; margin: 18px auto 0; max-width: 12ch;
          font-size: clamp(31px, 8.8vw, 76px); color: var(--ink);
          overflow-wrap: break-word;
        }
        .k-h1 .g { color: var(--emerald); }
        .k-sub { margin: 18px auto 0; font-size: clamp(14.5px, 2.1vw, 18px); line-height: 1.55; color: var(--ink-muted); max-width: 416px; }
        .k-cta { margin: 26px auto 0; display: flex; gap: 10px; justify-content: center; max-width: 440px; }
        .k-cta .btn { flex: 1 1 0; min-width: 0; }
        .k-chips { margin: 22px auto 0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 480px; }
        .k-note { margin: 20px 0 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em;
          text-transform: uppercase; color: var(--ink-ghost); }
        @media (max-width: 620px) {
          .k-eyebrow { font-size: 10px; letter-spacing: .1em; }
          .k-chips { gap: 7px; }
          .k-chips .chip { font-size: 10.5px; padding: 7px 11px; }
        }
      `}</style>

      <HelixCanvas />

      <div className="container k-hero-inner">
        <span className="k-eyebrow"><span className="dot" /> Research supply · Shipped from the USA</span>
        <h1 className="k-h1">
          Peptides you can trust,<br />
          <span className="g">verified</span> to the lot.
        </h1>
        <p className="k-sub">
          ≥99% purity, third-party tested, and shipped same-day from the USA — every lot backed by a
          COA you can verify by number.
        </p>
        <div className="k-cta">
          <Link href="/catalog" className="btn btn-emerald" style={{ fontSize: 15, padding: "15px 18px" }}>
            Shop catalog →
          </Link>
          <Link href="/#quality" className="btn btn-ghost" style={{ fontSize: 15, padding: "15px 18px" }}>
            Certificates
          </Link>
        </div>
        <div className="k-chips font-mono">
          {["Ships from the USA", "Same-day dispatch", "≥99% lab-tested", "COA on every lot"].map((t) => (
            <span key={t} className="chip"><b>✓</b> {t}</span>
          ))}
        </div>
        <p className="k-note">For laboratory &amp; research use only · Not for human consumption</p>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";

const SAMPLE_HASH = "7f3a91c2bd84e0f1";
const SPEED_PX_PER_FRAME = 0.3;

export function HashStrip({ hash = SAMPLE_HASH }: { hash?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = trackRef.current;
    if (!el) return;

    let raf = 0;
    let x = 0;
    let halfWidth = el.scrollWidth / 2;
    const updateWidth = () => {
      halfWidth = el.scrollWidth / 2;
    };
    updateWidth();

    const tick = () => {
      x -= SPEED_PX_PER_FRAME;
      if (-x >= halfWidth) x += halfWidth;
      el.style.transform = `translate3d(${x}px, 0, 0)`;
      raf = requestAnimationFrame(tick);
    };

    let running = false;
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start();
          else stop();
        },
        { threshold: 0 },
      );
      io.observe(el);
    } else {
      start();
    }

    const onResize = () => updateWidth();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      io?.disconnect();
      stop();
    };
  }, []);

  // Repeat the chip enough times to fill any viewport, plus duplicates for seamless loop.
  const chip = `Test set ${hash}`;
  const items = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div
      aria-hidden
      className="relative overflow-hidden border-y border-dark-grey/40 bg-black py-5"
    >
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform">
        {items.map((i) => (
          <span
            key={i}
            className="c-small uppercase tracking-[0.45em] text-grey/45 px-8 shrink-0"
          >
            {chip}
            <span aria-hidden className="mx-6 text-grey/25">
              &middot;
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

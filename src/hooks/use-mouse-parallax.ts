"use client";

import { type RefObject, useEffect, useRef } from "react";

interface Options {
  strength?: number;
  invert?: boolean;
  ease?: number;
  restingScale?: number;
  containerRef?: RefObject<HTMLElement | null>;
}

export function useMouseParallax<T extends HTMLElement>(
  ref: RefObject<T | null>,
  {
    strength = 15,
    invert = false,
    ease = 0.08,
    restingScale = 1.05,
    containerRef,
  }: Options = {},
) {
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Honor reduced-motion: skip parallax entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observed = containerRef?.current ?? ref.current;

    let bounds: DOMRect | null = null;
    const updateBounds = () => {
      bounds = (containerRef?.current ?? document.body).getBoundingClientRect();
    };
    updateBounds();

    const onMove = (e: MouseEvent) => {
      if (!bounds) return;
      const nx = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
      const ny = ((e.clientY - bounds.top) / bounds.height) * 2 - 1;
      const dir = invert ? -1 : 1;
      target.current = { x: nx * strength * dir, y: ny * strength * dir };
    };

    const onResize = () => updateBounds();
    const onScroll = () => updateBounds();

    let raf = 0;
    let running = false;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * ease;
      current.current.y += (target.current.y - current.current.y) * ease;
      const node = ref.current;
      if (node) {
        node.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0) scale(${restingScale})`;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };

    let io: IntersectionObserver | null = null;
    if (observed && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start();
          else stop();
        },
        { threshold: 0 },
      );
      io.observe(observed);
    } else {
      start();
    }

    return () => {
      io?.disconnect();
      stop();
    };
  }, [ref, strength, invert, ease, restingScale, containerRef]);
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { DiamondButton } from "@/components/ui/diamond-button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

// ease-out-quad — Structured Money's signature easing for hero cadence
const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

/**
 * Per-letter clip-reveal helper. Each letter sits in an inline-block span and
 * animates `y: 110% → 0%` with a per-letter stagger inside an overflow-hidden
 * line. Mirrors how Structured Money's c-splitted-text component reveals the
 * hero title (50ms per letter at base delay 0.2s).
 */
function SplitLine({
  text,
  baseDelay,
  letterStagger = 0.05,
  duration = 0.6,
  className,
  italic = false,
}: {
  text: string;
  baseDelay: number;
  letterStagger?: number;
  duration?: number;
  className?: string;
  italic?: boolean;
}) {
  const letters = Array.from(text);
  const Wrapper = italic ? motion.em : motion.span;
  return (
    <Wrapper className={cn("block overflow-hidden whitespace-nowrap", className)}>
      {letters.map((char, i) => (
        <motion.span
          key={i}
          className="inline-block align-bottom"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{
            duration,
            delay: baseDelay + i * letterStagger,
            ease: EASE,
          }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </Wrapper>
  );
}

const METRICS = ["F1: 0.79", "·", "Indonesian sentiment"];

export function LandingHero() {
  return (
    <main
      id="main"
      className="relative h-dvh w-full overflow-hidden bg-dust text-black"
    >
      {/* Header — z-40 — items slide in from opposite edges (0–0.5s) */}
      <header className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 sm:px-10">
        <motion.span
          translate="no"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="inline-flex text-black"
          aria-label="AdaptArxiv"
        >
          <Logo className="h-7 w-auto" />
        </motion.span>
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Link
            href="/dashboard"
            className="c-link uppercase tracking-widest text-black hover:text-black/60 transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)]"
          >
            Dashboard
          </Link>
        </motion.div>
      </header>

      {/* Centered hero — z-30 */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-4 -translate-y-[8vh]">
        {/* Title: line 1 letters at t=0.20s, italic line 2 letters at t=0.95s (ceremonial pause) */}
        <h1 className="c-heading-lg c-italic-no-uppercase text-black max-w-[20ch] leading-[1.1]">
          <SplitLine text="Real research," baseDelay={0.2} />
          <SplitLine
            text="structured"
            baseDelay={0.95}
            italic
            className="c-italic-emphasis"
          />
        </h1>

        {/* Metrics row: per-word fade-up (0.20–0.90s) */}
        <div className="mt-7 flex items-center gap-x-5 c-body-sm tracking-[0.18em] uppercase text-black/75 tabular-nums">
          {METRICS.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2 + i * 0.1,
                ease: EASE,
              }}
              className={cn(i === 1 && "text-black/35")}
              aria-hidden={i === 1 || undefined}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* CTA — lands as title finishes its visual heavy beat (0.85–1.45s) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85, ease: EASE }}
          className="mt-9"
        >
          <DiamondButton href="/dashboard" variant="primary">
            open dashboard
          </DiamondButton>
        </motion.div>
      </div>

      {/* Wordmark — slides up from below over 1.0s, delayed 0.35s. Matches Structured's bottom-logo cadence.
          On mobile the wordmark lifts well above the viewport bottom so its top
          can peek above the deeply-pushed books; on desktop it stays anchored
          to the bottom edge as before. */}
      <div
        translate="no"
        className="absolute inset-x-0 bottom-[22%] translate-y-[3%] sm:bottom-[3%] sm:translate-y-[5%] z-10 pointer-events-none"
      >
        <motion.svg
          viewBox="0 0 1440 400"
          preserveAspectRatio="xMidYMax meet"
          initial={{ y: "100%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 1.0, delay: 0.35, ease: EASE }}
          className="block w-full h-auto fill-black overflow-visible"
          aria-label="AdaptArxiv"
        >
          <text
            x="50%"
            y="78%"
            textAnchor="middle"
            textLength="1410"
            lengthAdjust="spacingAndGlyphs"
            fontFamily="var(--font-serif), 'Times New Roman', serif"
            fontSize="310"
            fontWeight="400"
          >
            AdaptArxiv
          </text>
        </motion.svg>
      </div>

      {/* Aged-books composite — fades up after wordmark begins (0.45–1.45s).
          Outer div carries a static translate-y so the books sit past the
          viewport edge. On mobile the shift is large (so the wordmark's top
          peeks above the towers AND the transparent bottom of the source image
          is clipped under the viewport); on desktop the shift is enough to
          drop the towers below the wordmark's top so the leading "A" is
          visible. Framer's y animation lives on the inner motion.div so the
          two transforms don't collide. */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-[42%] translate-y-[36%] sm:translate-y-[32%] pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.45, ease: EASE }}
          className="absolute inset-0"
        >
          <Image
            src="/assets/aged-books.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-top select-none"
            draggable={false}
          />
        </motion.div>
      </div>
    </main>
  );
}

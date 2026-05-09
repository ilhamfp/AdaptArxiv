"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { DiamondButton } from "@/components/ui/diamond-button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { EASE, EASE_OUT_EXPO } from "@/lib/motion";

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

export function LandingHero() {
  const router = useRouter();
  const [arxivUrl, setArxivUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!arxivUrl) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ arxivUrl }),
      });
      if (response.ok) {
        router.push("/dashboard");
        return;
      }
      // Auth required or any other failure → bounce to dashboard with the URL
      // pre-filled so the user can sign in and start there.
      const params = new URLSearchParams({ arxivUrl });
      router.push(`/dashboard?${params.toString()}`);
    } catch {
      const params = new URLSearchParams({ arxivUrl });
      router.push(`/dashboard?${params.toString()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
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

      {/* Centered hero — z-30. Lifted further so the form has air above the wordmark. */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-4 -translate-y-[14vh]">
        {/* Title: line 1 letters at t=0.20s, italic line 2 letters at t=0.95s (ceremonial pause) */}
        <h1 className="c-heading-lg c-italic-no-uppercase text-black max-w-[20ch] leading-[1.1] text-balance">
          <SplitLine text="Real research," baseDelay={0.2} />
          <SplitLine
            text="adapting"
            baseDelay={0.95}
            italic
            className="c-italic-emphasis"
          />
        </h1>

        {/* arXiv form — fades up with section-reveal cadence (out-expo, 0.9s) */}
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.85, ease: EASE_OUT_EXPO }}
          onSubmit={handleSubmit}
          className="mt-10 flex w-full max-w-2xl flex-col items-stretch gap-6 sm:mt-14 sm:flex-row sm:items-end sm:gap-10"
        >
          <Input
            type="url"
            name="arxivUrl"
            autoComplete="url"
            inputMode="url"
            spellCheck={false}
            required
            value={arxivUrl}
            onChange={(event) => setArxivUrl(event.target.value)}
            placeholder="https://arxiv.org/abs/2009.05713"
            aria-label="arXiv paper URL"
            className="h-12 w-full rounded-none border-0 border-b border-dark-grey bg-transparent px-4 pb-3 text-[15px] font-sans text-black placeholder:text-black/45 shadow-none transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)] focus-visible:border-black focus-visible:ring-0 sm:flex-1"
          />
          <DiamondButton
            type="submit"
            variant="primary"
            disabled={submitting || !arxivUrl}
          >
            {submitting ? "starting" : "adapt"}
          </DiamondButton>
        </motion.form>
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
          aria-hidden="true"
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
    </MotionConfig>
  );
}

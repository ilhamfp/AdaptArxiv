"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useMouseParallax } from "@/hooks/use-mouse-parallax";

export function FooterWordmark() {
  const sectionRef = useRef<HTMLElement>(null);
  const compositeRef = useRef<HTMLDivElement>(null);

  useMouseParallax(compositeRef, {
    strength: 8,
    invert: false,
    restingScale: 1.05,
    containerRef: sectionRef,
  });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end end"],
  });

  // Ceremonial pause: almost arrives at 60%, hesitates, then settles.
  const wordmarkY = useTransform(
    scrollYProgress,
    [0, 0.55, 0.85, 1],
    ["100%", "22%", "8%", "0%"],
  );
  const wordmarkScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  return (
    <footer
      ref={sectionRef}
      role="contentinfo"
      className="relative h-[100dvh] w-full overflow-hidden bg-black"
    >
      {/* Wordmark — z-10. SVG with viewBox auto-fits to viewport width. */}
      <motion.div
        style={{ y: wordmarkY, scale: wordmarkScale }}
        translate="no"
        className="absolute inset-x-0 bottom-[38%] z-10 flex items-end justify-center px-[var(--grid-edge)]"
      >
        <svg
          viewBox="0 0 1200 220"
          preserveAspectRatio="xMidYEnd meet"
          className="block h-auto w-[clamp(20rem,82vw,80rem)] fill-grey overflow-visible"
          aria-label="AdaptArxiv"
        >
          <text
            x="50%"
            y="78%"
            textAnchor="middle"
            textLength="1100"
            lengthAdjust="spacingAndGlyphs"
            fontFamily="var(--font-serif), 'Times New Roman', serif"
            fontSize="200"
            fontWeight="400"
          >
            AdaptArxiv
          </text>
        </svg>
      </motion.div>

      {/* Composite — z-20. Occupies bottom 40%; wordmark sits above and dips behind only at the base. */}
      <div
        ref={compositeRef}
        className="absolute inset-x-0 bottom-0 h-[42%] z-20 will-change-transform pointer-events-none"
      >
        <Image
          src="/assets/aged-books.png"
          alt=""
          fill
          priority={false}
          sizes="100vw"
          className="object-cover object-bottom select-none"
          draggable={false}
        />
      </div>

      {/* Top utility row — z-30, semantic <nav> for the link, <p> for the tagline */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-20%" }}
        transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
        className="absolute inset-x-0 top-0 z-30 flex flex-col gap-2 px-[var(--grid-edge)] py-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="c-link uppercase tracking-widest text-grey">
          A research-paper-adjacent product
        </p>
        <nav aria-label="Footer">
          <Link
            href="/dashboard"
            className="c-link uppercase tracking-widest text-grey hover:text-linen transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)]"
          >
            Dashboard
          </Link>
        </nav>
      </motion.div>

      {/* Legal — z-30 */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-20%" }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 px-[var(--grid-edge)] py-5 c-small uppercase tracking-widest text-grey/70 sm:flex-row sm:items-center sm:justify-between"
      >
        <small>&copy; AdaptArxiv {new Date().getFullYear()}</small>
        <small>For research purposes only</small>
      </motion.div>
    </footer>
  );
}

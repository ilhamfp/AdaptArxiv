"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { DiamondButton } from "@/components/ui/diamond-button";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export function LandingHero() {
  return (
    <main
      id="main"
      className="relative h-dvh w-full overflow-hidden bg-dust text-black"
    >
      {/* Header — z-40 */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 sm:px-10"
      >
        <span
          translate="no"
          className="c-heading-xs font-serif text-black"
        >
          AdaptArxiv
        </span>
        <Link
          href="/dashboard"
          className="c-link uppercase tracking-widest text-black hover:text-black/60 transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)]"
        >
          Dashboard
        </Link>
      </motion.header>

      {/* Centered hero — z-30 */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-4 -translate-y-[8vh]">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="c-heading-lg c-italic-no-uppercase text-black max-w-[20ch] leading-[1.05]"
        >
          <span className="block">Real research,</span>
          <em className="block c-italic-emphasis">structured</em>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.65, ease: EASE }}
          className="mt-7 flex items-center gap-x-5 c-body-sm tracking-[0.18em] uppercase text-black/75 tabular-nums"
        >
          <span>F1: 0.79</span>
          <span aria-hidden className="text-black/35">
            ·
          </span>
          <span>Indonesian sentiment</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9, ease: EASE }}
          className="mt-9"
        >
          <DiamondButton href="/dashboard" variant="primary">
            open dashboard
          </DiamondButton>
        </motion.div>
      </div>

      {/* Wordmark — SVG that fits viewport width, slight bottom-edge crop */}
      <motion.div
        translate="no"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.4, ease: EASE }}
        className="absolute inset-x-0 bottom-0 z-10 translate-y-[12%] pointer-events-none"
      >
        <svg
          viewBox="0 0 1440 240"
          preserveAspectRatio="xMidYEnd meet"
          className="block w-full h-auto fill-black overflow-visible"
          aria-label="AdaptArxiv"
        >
          <text
            x="50%"
            y="80%"
            textAnchor="middle"
            textLength="1400"
            lengthAdjust="spacingAndGlyphs"
            fontFamily="var(--font-serif), 'Times New Roman', serif"
            fontSize="220"
            fontWeight="400"
          >
            AdaptArxiv
          </text>
        </svg>
      </motion.div>

      {/* Aged-books composite — anchored to TOP of source image (tower tips with inkwell/lens visible) */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.5, ease: EASE }}
        className="absolute inset-x-0 bottom-0 z-20 h-[42%] pointer-events-none"
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
    </main>
  );
}

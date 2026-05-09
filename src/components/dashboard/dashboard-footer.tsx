"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";

export function DashboardFooter() {
  return (
    <footer className="relative w-full overflow-hidden border-t border-dark-grey/20 bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[280px] translate-y-[28%] sm:h-[340px]"
      >
        <Image
          src="/assets/aged-books.png"
          alt=""
          fill
          sizes="100vw"
          className="select-none object-cover object-top opacity-25"
          draggable={false}
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-5 pt-16 pb-24 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pt-20 sm:pb-32"
      >
        <p className="c-heading-md font-heading uppercase leading-none text-grey">
          Adapt<em className="c-italic-emphasis">arxiv</em>
        </p>
        <Link
          href="/"
          className="c-link uppercase tracking-[0.18em] text-grey/70 transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)] hover:text-linen"
        >
          ← Back to landing
        </Link>
      </motion.div>
    </footer>
  );
}

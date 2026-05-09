"use client";

import { motion } from "framer-motion";
import { SectionEyebrow } from "./section-eyebrow";

export function ThesisSection() {
  return (
    <section
      aria-labelledby="thesis-heading"
      className="relative overflow-hidden bg-black py-[18vh]"
    >
      {/* §11.4 soft-light glow followers — atmospheric depth, not decoration */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[18%] top-1/3 h-40 w-40 rounded-full bg-[#E7E5E4] opacity-[0.04] blur-3xl mix-blend-soft-light"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[14%] bottom-1/4 h-32 w-32 rounded-full bg-[#E8D9A8] opacity-[0.06] blur-3xl mix-blend-soft-light"
      />

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
        className="relative mx-auto flex max-w-[34rem] flex-col items-center gap-7 px-[var(--grid-edge)] text-center"
      >
        <SectionEyebrow index="01">Thesis</SectionEyebrow>
        <h2
          id="thesis-heading"
          className="c-heading-lg c-italic-no-uppercase text-grey"
        >
          Citations, <em className="c-italic-emphasis">actually</em> verified
        </h2>
        <p className="c-body text-grey/80 max-w-[44ch] text-pretty">
          Most papers don&rsquo;t replicate. AdaptArxiv runs the original
          experiment and an adapted variant on the same test set, so you can
          see the F1 a paper really earns &mdash; not the one its abstract
          claims.
        </p>
      </motion.div>

      {/* Marginalia — pull-quote anchored to the section's right grid edge, desktop only */}
      <aside
        aria-hidden
        className="hidden lg:block absolute top-1/2 right-16 -translate-y-1/2 max-w-[16ch] text-right z-10"
      >
        <span className="block c-body-sm font-serif italic text-grey/65 leading-snug">
          &ldquo;on the same
          <br />
          test set&rdquo;
        </span>
      </aside>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { DiamondButton } from "@/components/ui/diamond-button";

const LINE1 = ["Real", "research,"];
const STAGGER = 0.06;
const LINE_DELAY = 0.1;
const ITALIC_EXTRA_DELAY = 0.25;
const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex min-h-[90dvh] items-center justify-center overflow-hidden bg-black"
    >
      <div className="flex flex-col items-center gap-10 px-[var(--grid-edge)] text-center">
        <h1
          id="hero-heading"
          className="c-heading-xl c-italic-no-uppercase text-grey max-w-[18ch]"
        >
          <span className="block">
            {LINE1.map((word, i) => (
              <span
                key={word}
                className="inline-block overflow-hidden align-bottom"
              >
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{
                    duration: 0.85,
                    delay: LINE_DELAY + i * STAGGER,
                    ease: EASE,
                  }}
                >
                  {word}
                  {i < LINE1.length - 1 ? " " : ""}
                </motion.span>
              </span>
            ))}
          </span>
          <span className="block overflow-hidden">
            <motion.em
              className="inline-block c-italic-emphasis"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{
                duration: 1.05,
                delay:
                  LINE_DELAY + LINE1.length * STAGGER + ITALIC_EXTRA_DELAY,
                ease: EASE,
              }}
            >
              structured
            </motion.em>
          </span>
        </h1>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.8,
            delay: 1.2,
            ease: EASE,
          }}
          className="c-body max-w-[360px] text-grey/75 text-pretty"
        >
          Reproduce the experiments behind any paper.
          See whether they replicate &mdash; for real.
        </motion.p>

        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.7,
            delay: 1.4,
            ease: EASE,
          }}
        >
          <DiamondButton href="/dashboard" variant="light">
            open dashboard
          </DiamondButton>
        </motion.div>
      </div>
    </section>
  );
}

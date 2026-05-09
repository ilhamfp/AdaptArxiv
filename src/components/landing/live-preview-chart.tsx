"use client";

import { motion } from "framer-motion";
import { DiamondButton } from "@/components/ui/diamond-button";
import { SectionEyebrow } from "./section-eyebrow";

type BarKind = "baseline" | "adapted";

export type PreviewBar = {
  label: string;
  value: number;
  formatted: string;
  kind: BarKind;
};

type Props = {
  paperTitle: string;
  referenceF1: number | null;
  bars: PreviewBar[];
  delta: number | null;
  hasRuns: boolean;
  latestHash: string | null;
};

const KIND_FILL: Record<BarKind, string> = {
  baseline: "var(--color-dark-grey)",
  adapted: "var(--color-grey)",
};

const GHOST_BARS: PreviewBar[] = [
  { label: "Indonesian only", value: 0.62, formatted: "0.620", kind: "baseline" },
  {
    label: "Adaption-adapted",
    value: 0.71,
    formatted: "0.710",
    kind: "adapted",
  },
];

export function LivePreviewChart({
  paperTitle,
  referenceF1,
  bars,
  delta,
  hasRuns,
  latestHash,
}: Props) {
  const renderedBars = hasRuns ? bars : GHOST_BARS;
  const maxValue = Math.max(
    ...renderedBars.map((b) => b.value),
    referenceF1 ?? 0,
    1,
  );

  const ariaLabel = hasRuns
    ? `F1 comparison: ${bars
        .map((b) => `${b.label} ${b.formatted}`)
        .join(", ")}${
        referenceF1 != null ? `; reference ${referenceF1.toFixed(3)}` : ""
      }`
    : "Preview placeholder. No runs cached yet.";

  return (
    <section
      aria-labelledby="preview-heading"
      className="relative bg-black py-[14vh]"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
        className="mx-auto flex max-w-[58rem] flex-col gap-12 px-[var(--grid-edge)]"
      >
        <header className="flex flex-col items-center gap-5 text-center">
          <SectionEyebrow index="02">Live preview</SectionEyebrow>
          <h2
            id="preview-heading"
            className="c-heading-md text-grey c-italic-no-uppercase max-w-[26ch]"
          >
            <em className="c-italic-emphasis">{paperTitle}</em>
          </h2>
        </header>

        <div
          role="img"
          aria-label={ariaLabel}
          className={
            "relative flex flex-col gap-5 border border-dark-grey/60 bg-black p-8 " +
            (hasRuns ? "" : "opacity-100")
          }
        >
          {!hasRuns && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]"
            >
              <span className="c-body-sm uppercase tracking-[0.3em] text-grey/80">
                no runs cached yet
              </span>
            </span>
          )}

          <div
            className={hasRuns ? "" : "opacity-30 select-none"}
            aria-hidden={!hasRuns}
          >
            {renderedBars.map((bar, i) => (
              <BarRow
                key={`${bar.kind}-${bar.label}`}
                bar={bar}
                index={i}
                maxValue={maxValue}
              />
            ))}
          </div>

          {referenceF1 != null && hasRuns && (
            <div className="relative pt-2">
              <span className="c-small uppercase tracking-widest text-grey/70">
                Reference F1 &mdash; {referenceF1.toFixed(3)}
              </span>
              <span
                aria-hidden
                className="absolute top-0 h-px bg-linen/40"
                style={{
                  left: 0,
                  width: `${Math.min(
                    (referenceF1 / maxValue) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
          )}

          {hasRuns && (
            <footer className="mt-2 flex flex-wrap items-end justify-between gap-4 border-t border-dark-grey/40 pt-4">
              <div className="c-body-sm text-grey/80">
                &Delta; adapted &minus; baseline
                <span className="ml-2 c-heading-sm text-linen tabular-nums">
                  {delta != null ? formatDelta(delta) : "—"}
                </span>
              </div>
              {latestHash && (
                <span className="c-small uppercase tracking-widest text-grey/70">
                  test set{" "}
                  <em className="font-normal">{latestHash.slice(0, 12)}</em>
                </span>
              )}
            </footer>
          )}
        </div>

        {!hasRuns && (
          <p className="text-center c-body text-grey/70 max-w-[44ch] mx-auto -mt-6">
            Open the dashboard, unlock with the demo password, and trigger
            a baseline + adapted run to populate this preview.
          </p>
        )}

        <div className="flex justify-center">
          <DiamondButton href="/dashboard" variant="light">
            see full dashboard
          </DiamondButton>
        </div>
      </motion.div>
    </section>
  );
}

function BarRow({
  bar,
  index,
  maxValue,
}: {
  bar: PreviewBar;
  index: number;
  maxValue: number;
}) {
  const widthPct = Math.max(0, Math.min((bar.value / maxValue) * 100, 100));
  return (
    <div className="flex items-center gap-6 py-1.5">
      <span className="c-body-sm uppercase tracking-widest text-grey/80 min-w-[12ch]">
        {bar.label}
      </span>
      <div className="relative h-[34px] flex-1 overflow-hidden bg-[#1a1a1a]">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${widthPct}%` }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{
            duration: 1.1,
            delay: 0.15 + index * 0.18,
            ease: [0.19, 1, 0.22, 1],
          }}
          className="absolute inset-y-0 left-0"
          style={{ background: KIND_FILL[bar.kind] }}
        />
      </div>
      <span className="c-body-sm text-linen tabular-nums min-w-[6ch] text-right">
        {bar.formatted}
      </span>
    </div>
  );
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

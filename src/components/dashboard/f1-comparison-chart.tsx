"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ComparableBars } from "@/lib/charting";
import { formatMetric } from "@/lib/charting";

type F1ComparisonChartProps = {
  comparable: ComparableBars;
  referenceF1: number;
};

export function F1ComparisonChart({
  comparable,
  referenceF1,
}: F1ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (comparable.bars.length === 0) {
    return <ChartPlaceholder>Awaiting first result</ChartPlaceholder>;
  }

  const summary = comparable.bars
    .map((bar) => `${bar.label}: ${formatMetric(bar.metricValue)}`)
    .join(", ");

  return (
    <div className="grid gap-3">
      <div
        ref={containerRef}
        role="img"
        aria-label={`F1 comparison. ${summary}. Reference: ${formatMetric(referenceF1)}.`}
        className="h-80 min-h-80 min-w-0"
      >
        {chartWidth > 0 ? (
          <BarChart
            width={chartWidth}
            height={320}
            data={comparable.bars}
            margin={{ top: 18, right: 18, left: 0, bottom: 24 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--ds-light-grey)"
              strokeOpacity={0.3}
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: "var(--ds-light-grey)",
                fontSize: 12,
              }}
              interval={0}
            />
            <YAxis
              domain={[0, 1]}
              tick={{
                fill: "var(--ds-light-grey)",
                fontSize: 12,
              }}
            />
            <ChartTooltip
              cursor={{
                fill: "var(--ds-dark-grey)",
                fillOpacity: 0.06,
              }}
              formatter={(value) => [formatMetric(Number(value)), "F1"]}
            />
            <ReferenceLine
              y={referenceF1}
              stroke="var(--ds-aged-binding)"
              strokeDasharray="6 4"
              label={{
                value: "Reference",
                fill: "var(--ds-aged-binding)",
                fontSize: 12,
                position: "insideTopRight",
              }}
            />
            <Bar
              dataKey="metricValue"
              fill="var(--ds-dark-grey)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        ) : (
          <ChartPlaceholder>Preparing chart</ChartPlaceholder>
        )}
      </div>
      <dl className="sr-only">
        {comparable.bars.map((bar) => (
          <div key={bar.trainingSource}>
            <dt>{bar.label}</dt>
            <dd>{formatMetric(bar.metricValue)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ChartPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-80 min-h-80 items-center justify-center rounded-lg border border-dark-grey/15 bg-base-foreground c-body-sm text-light-grey">
      {children}
    </div>
  );
}

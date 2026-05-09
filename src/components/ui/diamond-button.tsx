"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const HEX_CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%)";
const RECT_CLIP =
  "polygon(0 0, 100% 0, 100% 50%, 100% 100%, 0 100%, 0 50%)";

type Variant = "primary" | "light" | "bordered";

type DiamondButtonProps = {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  // Primary — for use on light backgrounds (DESIGN.md §6.2 default)
  primary:
    "bg-black text-linen hover:bg-[#3a3a3a] hover:text-white active:bg-white active:text-black",
  // Light — for use on dark backgrounds (inverse)
  light:
    "bg-linen text-black hover:bg-white active:bg-white",
  bordered:
    "bg-transparent text-grey ring-1 ring-inset ring-dark-grey hover:bg-grey/10",
};

export function DiamondButton({
  href,
  onClick,
  type = "button",
  children,
  className,
  variant = "primary",
}: DiamondButtonProps) {
  const [active, setActive] = useState(false);

  const classes = cn(
    "relative inline-flex h-[var(--button-height)] min-w-[var(--button-min-width)]",
    "items-center justify-center px-7",
    "text-[length:var(--button-font-size)] font-sans tracking-wide uppercase",
    "transition-[clip-path,background-color,color] duration-300 ease-[var(--ease-out-quad)] motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black",
    "select-none cursor-pointer overflow-hidden",
    VARIANT_CLASSES[variant],
    className,
  );

  const style: React.CSSProperties = {
    clipPath: active ? RECT_CLIP : HEX_CLIP,
  };

  const handlers = {
    onMouseEnter: () => setActive(true),
    onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
    onClick,
  };

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full",
          "bg-current opacity-0 scale-75",
          "transition-[transform,opacity] duration-300 ease-[var(--ease-out-quad)] motion-reduce:transition-none",
          active && "scale-[1.6] opacity-25",
        )}
      />
      <span className="relative">{children}</span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full",
          "bg-current opacity-0 scale-75",
          "transition-[transform,opacity] duration-300 ease-[var(--ease-out-quad)] motion-reduce:transition-none",
          active && "scale-[1.6] opacity-25",
        )}
      />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} style={style} {...handlers}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} style={style} {...handlers}>
      {inner}
    </button>
  );
}

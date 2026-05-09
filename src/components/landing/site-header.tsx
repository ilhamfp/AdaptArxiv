"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
      className={
        "fixed inset-x-0 top-0 z-50 px-[var(--grid-edge)] " +
        "transition-[background-color,border-color] duration-[var(--transition-duration)] ease-[var(--ease-out-quad)] " +
        (scrolled
          ? "bg-black border-b border-dark-grey"
          : "bg-transparent border-b border-transparent")
      }
    >
      <nav aria-label="Primary" className="flex h-16 items-center justify-between py-4">
        <motion.span
          translate="no"
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="c-heading-xs text-grey"
        >
          AdaptArxiv
        </motion.span>
        <motion.div
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Link
            href="/dashboard"
            className="c-link uppercase tracking-widest text-grey hover:text-linen transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grey rounded-sm"
          >
            Dashboard
          </Link>
        </motion.div>
      </nav>
    </motion.header>
  );
}

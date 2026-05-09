import Link from "next/link";
import { Logo } from "@/components/logo";

export function DashboardAppHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-dark-grey/20 bg-dust/85 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-8">
      <Link
        href="/"
        aria-label="AdaptArxiv home"
        className="inline-flex items-center gap-2 text-foreground transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)] hover:text-black"
      >
        <Logo className="h-6 w-auto" />
        <span className="c-link uppercase tracking-[0.18em]">AdaptArxiv</span>
      </Link>
      <Link
        href="/"
        className="c-link uppercase tracking-[0.18em] text-foreground/65 transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)] hover:text-black"
      >
        Home
      </Link>
    </header>
  );
}

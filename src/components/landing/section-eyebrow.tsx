type Props = {
  index: string;
  children: React.ReactNode;
  className?: string;
};

export function SectionEyebrow({ index, children, className }: Props) {
  return (
    <div
      className={
        "flex items-center justify-center gap-3 text-grey/70 c-small uppercase tracking-[0.4em] " +
        (className ?? "")
      }
    >
      <span aria-hidden className="block h-px w-8 bg-grey/40" />
      <span>
        <span className="text-grey/55">§ {index}</span>
        {" — "}
        {children}
      </span>
      <span aria-hidden className="block h-px w-8 bg-grey/40" />
    </div>
  );
}

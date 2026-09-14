type Props = {
  code: string | null | undefined;
  label?: string | null;
  /** Larger monospace for roster headers. */
  prominent?: boolean;
};

export function PreEtsServiceCodeDisplay({ code, label, prominent = false }: Props) {
  const trimmed = code?.trim();
  if (!trimmed) {
    return <span className="text-brand-black/50">Service code not set</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span
        className={
          prominent
            ? "font-mono text-sm font-bold text-brand-black"
            : "font-mono text-sm font-semibold text-brand-black"
        }
      >
        {trimmed}
      </span>
      {label?.trim() ? (
        <span className="text-sm text-brand-black/65">({label.trim()})</span>
      ) : null}
    </span>
  );
}

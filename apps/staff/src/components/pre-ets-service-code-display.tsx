import {
  lookupPreEtsServiceCode,
  resolvePreEtsServiceLabel,
  type PreEtsServiceCodeRow,
} from "@wayfinder/supabase/pre-ets-settings";

type Props = {
  code: string | null | undefined;
  label?: string | null;
  /** When provided, code/topic are resolved against Pre-ETS settings (spacing/case tolerant). */
  serviceCodes?: PreEtsServiceCodeRow[];
  /** Larger monospace for roster headers. */
  prominent?: boolean;
};

export function PreEtsServiceCodeDisplay({
  code,
  label,
  serviceCodes,
  prominent = false,
}: Props) {
  const trimmed = code?.trim();
  if (!trimmed) {
    return <span className="text-brand-black/50">Service code not set</span>;
  }

  const catalogSettings =
    serviceCodes && serviceCodes.length > 0 ? { service_codes: serviceCodes } : null;
  const catalogRow = catalogSettings ? lookupPreEtsServiceCode(trimmed, catalogSettings) : null;
  const displayCode = catalogRow?.code ?? trimmed;
  const displayLabel = catalogSettings
    ? resolvePreEtsServiceLabel(displayCode, label, catalogSettings)
    : label?.trim() || null;
  const unknownInCatalog = Boolean(catalogSettings && !catalogRow);

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span
        className={
          prominent
            ? "font-mono text-sm font-bold text-brand-black"
            : "font-mono text-sm font-semibold text-brand-black"
        }
      >
        {displayCode}
      </span>
      {displayLabel ? (
        <span className="text-sm text-brand-black/65">({displayLabel})</span>
      ) : null}
      {unknownInCatalog ? (
        <span className="text-xs text-amber-800">(not in service code list)</span>
      ) : null}
    </span>
  );
}

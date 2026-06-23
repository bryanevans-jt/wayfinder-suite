import { buildJtReportsPrefillUrl, type JtReportPrefillType } from "@wayfinder/branding";

type Props = {
  clientName: string;
  esName?: string | null;
  report?: JtReportPrefillType;
  className?: string;
};

export function FormalReportLaunchLink({
  clientName,
  esName,
  report = "seMonthly",
  className = "",
}: Props) {
  const href = buildJtReportsPrefillUrl({ clientName, esName, report });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        "inline-flex rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-gold/20"
      }
    >
      Open formal reporting for this client
    </a>
  );
}

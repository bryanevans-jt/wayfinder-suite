export function formatClientAddress(row: {
  home_address_line1?: string | null;
  home_address_line2?: string | null;
  home_city?: string | null;
  home_state?: string | null;
  home_zip?: string | null;
}): string {
  const line1 = row.home_address_line1?.trim() ?? "";
  const line2 = row.home_address_line2?.trim() ?? "";
  const city = row.home_city?.trim() ?? "";
  const state = row.home_state?.trim() ?? "";
  const zip = row.home_zip?.trim() ?? "";

  const street = [line1, line2].filter(Boolean).join("\n");
  const cityLine = [city, state].filter(Boolean).join(", ");
  const cityZip = [cityLine, zip].filter(Boolean).join(cityLine && zip ? " " : "");

  return [street, cityZip].filter(Boolean).join("\n");
}

export type TnPrefillValues = {
  clientName: string;
  clientAddress: string;
  counselorName: string;
  employmentGoal: string;
  esName: string;
  jobDevelopment: string;
};

export function applyPrefillToFieldKey(
  fieldKey: string,
  prefillKey: string | undefined,
  values: Partial<TnPrefillValues>
): string | undefined {
  if (!prefillKey) return undefined;
  switch (prefillKey) {
    case "clientName":
      return values.clientName;
    case "clientAddress":
      return values.clientAddress;
    case "counselorName":
      return values.counselorName;
    case "employmentGoal":
      return values.employmentGoal;
    case "esName":
      return values.esName;
    case "jobDevelopment":
      return values.jobDevelopment;
    default:
      return undefined;
  }
}

export function resolveTnClientName(reportData: Record<string, unknown>): string {
  for (const key of ["clientName", "clientname", "jobSeekerName", "customerName"]) {
    const val = reportData[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "Customer";
}

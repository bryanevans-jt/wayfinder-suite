import type { PreEtsTemplatePlaceholder } from "./pre-ets-template-placeholders";

export const IJP_INVOICE_PLACEHOLDERS: PreEtsTemplatePlaceholder[] = [
  { token: "InvoiceDate", description: "Invoice compile date (MM/DD/YYYY)" },
  { token: "ProviderName", description: "Joshua Tree Service Group (from settings)" },
  { token: "RemitAddress", description: "Remit-to address (from settings)" },
  { token: "ProviderInvoiceNumber", description: "Provider invoice # (Accounts)" },
  { token: "AuthorizationNumber", description: "Client authorization #" },
  { token: "ClientName", description: "Client display name" },
  { token: "ServiceMonth", description: "e.g. March 2026" },
  { token: "IndividualMark", description: "☑ for Individual" },
  { token: "GroupMark", description: "☐ for Group" },
  { token: "TotalHours", description: "Sum of line hours" },
  { token: "TotalAmount", description: "Total dollars" },
  { token: "RateDollars", description: "Hourly rate from settings" },
  { token: "InstructorFacilitatorName", description: "Unique ES names on invoice (optional header)" },
  { token: "InvoiceLine", description: "Marker in table template row (duplicated per line)" },
  { token: "LineAuthorization", description: "Table: authorization #" },
  { token: "LineServiceCode", description: "Table: IJP" },
  { token: "LineDescription", description: "Table: activity timeline summary" },
  { token: "LineServiceDate", description: "Table: service date" },
  { token: "LineStartTime", description: "Table: start time" },
  { token: "LineEndTime", description: "Table: end time" },
  { token: "LineHours", description: "Table: billable hours" },
  { token: "LineAmount", description: "Table: line amount" },
  { token: "LineInstructor", description: "Table: ES for row" },
];

export const IJP_ATTESTATION_PLACEHOLDERS: PreEtsTemplatePlaceholder[] = [
  { token: "AttestationProviderName", description: "ES/TS or supervisor name" },
  { token: "ProviderInvoiceNumber", description: "Provider invoice #" },
  { token: "AuthorizationNumber", description: "Client authorization #" },
  { token: "AttestationDate", description: "Same as invoice date (both date lines)" },
  { token: "ParticipantSignature", description: "Replaced with signature image" },
];

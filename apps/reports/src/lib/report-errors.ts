import {
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_CONTACT_NAME,
  SUPPORT_CONTACT_MAILTO,
} from "@wayfinder/branding";

export { SUPPORT_CONTACT_EMAIL, SUPPORT_CONTACT_NAME, SUPPORT_CONTACT_MAILTO };

export function withReportSupportHint(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return `Something went wrong. Contact ${SUPPORT_CONTACT_NAME} at ${SUPPORT_CONTACT_EMAIL}.`;
  }
  if (trimmed.toLowerCase().includes(SUPPORT_CONTACT_EMAIL.toLowerCase())) {
    return trimmed;
  }
  return `${trimmed} Contact ${SUPPORT_CONTACT_NAME} at ${SUPPORT_CONTACT_EMAIL} if you need help.`;
}

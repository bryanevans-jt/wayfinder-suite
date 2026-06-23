import { SUPPORT_CONTACT_EMAIL, SUPPORT_CONTACT_MAILTO, SUPPORT_CONTACT_NAME } from "@/lib/report-errors";

type Props = {
  className?: string;
};

export function ReportSupportNote({ className = "" }: Props) {
  return (
    <p className={`text-sm text-gray-600 ${className}`.trim()}>
      Need help? Contact{" "}
      <a href={SUPPORT_CONTACT_MAILTO} className="font-medium text-green-700 hover:underline">
        {SUPPORT_CONTACT_NAME}
      </a>{" "}
      at {SUPPORT_CONTACT_EMAIL}.
    </p>
  );
}

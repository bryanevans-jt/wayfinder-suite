import { SUPPORT_CONTACT_EMAIL, SUPPORT_CONTACT_MAILTO, SUPPORT_CONTACT_NAME } from "@wayfinder/branding";

type Props = {
  className?: string;
};

export function StaffSupportNote({ className = "" }: Props) {
  return (
    <p className={`text-sm text-brand-black/70 ${className}`.trim()}>
      Questions or errors? Email{" "}
      <a
        href={SUPPORT_CONTACT_MAILTO}
        className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/80"
      >
        {SUPPORT_CONTACT_NAME}
      </a>{" "}
      at {SUPPORT_CONTACT_EMAIL}.
    </p>
  );
}

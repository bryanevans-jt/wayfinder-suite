import { STAFF_SUPPORT_EMAIL, STAFF_SUPPORT_MAILTO } from "@/lib/support-contact";

type Props = {
  className?: string;
};

export function StaffSupportNote({ className = "" }: Props) {
  return (
    <p className={`text-sm text-brand-black/70 ${className}`.trim()}>
      Questions or issues? Email{" "}
      <a
        href={STAFF_SUPPORT_MAILTO}
        className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/80"
      >
        {STAFF_SUPPORT_EMAIL}
      </a>
      .
    </p>
  );
}

type Props = {
  fullName: string;
  email: string | null;
};

/** Employment Specialist / Transition Specialist contact for the active client dashboard. */
export function ClientFieldSpecialistContact({ fullName, email }: Props) {
  return (
    <section
      className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      aria-labelledby="field-specialist-contact-heading"
    >
      <h2 id="field-specialist-contact-heading" className="text-lg font-semibold text-brand-green">
        Your Employment Specialist / Transition Specialist
      </h2>
      <p className="mt-2 text-sm text-brand-black/80">
        Contact your specialist to discuss your case, services, or schedule.
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="sr-only">Name</dt>
          <dd className="font-medium text-brand-black">{fullName}</dd>
        </div>
        {email ? (
          <div>
            <dt className="sr-only">Email</dt>
            <dd>
              <a
                href={`mailto:${email}`}
                className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/80"
              >
                {email}
              </a>
            </dd>
          </div>
        ) : (
          <p className="text-brand-black/60">Email will appear here once available.</p>
        )}
      </dl>
    </section>
  );
}

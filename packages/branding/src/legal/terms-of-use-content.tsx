import {
  CLIENT_APP_PRODUCT_NAME,
  CONFIDENTIALITY_NOTICE,
  LEGAL_ENTITY,
  STAFF_APP_PRODUCT_NAME,
} from "../constants";

export const TERMS_OF_USE_LAST_UPDATED = "July 10, 2026";

type Props = {
  /** Which app surface the user reached this page from. */
  app: "client" | "staff";
};

export function TermsOfUseContent({ app }: Props) {
  const productName =
    app === "staff" ? STAFF_APP_PRODUCT_NAME : CLIENT_APP_PRODUCT_NAME;

  return (
    <article className="prose-wayfinder space-y-6 text-sm leading-relaxed text-brand-black/90">
      <header className="space-y-2 border-b border-neutral-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
          {productName}
        </p>
        <h1 className="text-2xl font-semibold text-brand-black sm:text-3xl">Terms of Use</h1>
        <p className="text-brand-black/65">Last updated: {TERMS_OF_USE_LAST_UPDATED}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">1. Agreement</h2>
        <p>
          These Terms of Use (&quot;Terms&quot;) govern access to {productName}, operated by{" "}
          {LEGAL_ENTITY} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By signing in or
          using the application, you agree to these Terms. If you do not agree, do not use the
          service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">2. Authorized use only</h2>
        <p>
          Access is limited to individuals authorized by {LEGAL_ENTITY} — including clients,
          employment specialists, counselors, supervisors, and administrators with an active
          account. You must use your own credentials and must not share sign-in links, passkeys, or
          sessions with anyone else.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Access data you are not permitted to view under your assigned role</li>
          <li>Copy, scrape, export, or redistribute application content except as your job duties
            require and our policies allow</li>
          <li>Attempt to reverse engineer, probe, or circumvent security controls</li>
          <li>
            Clone, replicate, benchmark, or build a competing product using the service, its
            workflows, designs, or documentation
          </li>
          <li>Introduce malware, automated bots, or excessive load on the service</li>
          <li>Use the service for any unlawful purpose or in violation of participant privacy</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">4. Confidentiality</h2>
        <p>{CONFIDENTIALITY_NOTICE}</p>
        <p>
          Participant names, contact details, employment records, messages, and program data are
          sensitive. You must handle them in accordance with organizational policy and applicable
          law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">5. Intellectual property</h2>
        <p>
          The {productName} software, source code, user interface, branding, workflows, training
          materials, and documentation are owned by {LEGAL_ENTITY} and its licensors and are
          protected by copyright, trade secret, and other intellectual property laws. These Terms
          grant you a limited, revocable, non-exclusive license to use the service solely for
          authorized Joshua Tree program operations.
        </p>
        <p>
          You may not copy, modify, distribute, sublicense, resell, white-label, or create
          derivative works based on the service or any part of it without our prior written consent.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">6. Account suspension</h2>
        <p>
          We may suspend or deactivate accounts that violate these Terms, pose a security risk, or
          are no longer authorized. You must stop using the service when your role or employment
          ends.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">7. Disclaimers</h2>
        <p>
          The service is provided on an &quot;as is&quot; basis for program operations. We strive
          for reliability but do not guarantee uninterrupted access. Employment outcomes depend on
          many factors outside this application.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">8. Changes</h2>
        <p>
          We may update these Terms from time to time. Continued use after the &quot;Last
          updated&quot; date constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">9. Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of Georgia, without regard to conflict
          of law principles. Exclusive venue for disputes arising from these Terms or use of the
          service lies in the state or federal courts located in Georgia, unless applicable law
          requires otherwise.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">10. Contact</h2>
        <p>
          Questions about these Terms or acceptable use:{" "}
          <a
            href="mailto:bryan.evans@thejoshuatree.org"
            className="font-medium text-brand-green underline underline-offset-2"
          >
            bryan.evans@thejoshuatree.org
          </a>
          .
        </p>
      </section>
    </article>
  );
}

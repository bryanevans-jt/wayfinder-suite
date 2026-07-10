import {
  CLIENT_APP_PRODUCT_NAME,
  LEGAL_ENTITY,
  PRIVACY_POLICY_LAST_UPDATED,
  STAFF_APP_PRODUCT_NAME,
} from "../constants";

type Props = {
  /** Which app surface the user reached this page from. */
  app: "client" | "staff";
};

export function PrivacyPolicyContent({ app }: Props) {
  const productName =
    app === "staff" ? STAFF_APP_PRODUCT_NAME : CLIENT_APP_PRODUCT_NAME;

  return (
    <article className="prose-wayfinder space-y-6 text-sm leading-relaxed text-brand-black/90">
      <header className="space-y-2 border-b border-neutral-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
          {productName}
        </p>
        <h1 className="text-2xl font-semibold text-brand-black sm:text-3xl">Privacy Policy</h1>
        <p className="text-brand-black/65">Last updated: {PRIVACY_POLICY_LAST_UPDATED}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">1. Who we are</h2>
        <p>
          {LEGAL_ENTITY} (&quot;Joshua Tree,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates {productName} and related vocational rehabilitation program tools. This
          policy describes how we collect, use, and protect information when you use the
          application.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">2. Information we collect</h2>
        <p>Depending on your role and how you use the service, we may process:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account data</strong> — name, work or personal email, authentication
            identifiers, and role assignments
          </li>
          <li>
            <strong>Program and employment data</strong> — participant names, contact details,
            service stage, job applications, meetings, messages, time entries, and formal report
            submissions
          </li>
          <li>
            <strong>Usage and technical data</strong> — device/browser type, IP address, session
            logs, and error diagnostics needed to operate and secure the service
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">3. How we use information</h2>
        <p>We use information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide caseload management, messaging, reporting, and program operations</li>
          <li>Authenticate users and enforce role-based access controls</li>
          <li>Generate official vocational rehabilitation reports and compliance alerts</li>
          <li>Improve reliability, security, and support</li>
          <li>Meet legal, contractual, and funding-agency obligations</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">4. Sharing</h2>
        <p>
          We do not sell personal information. We share data only with service providers that help
          us operate the platform (for example, hosting, authentication, email delivery, and
          document generation), with authorized program staff and partners who need access for
          their duties, and when required by law or to protect participants and the organization.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">5. Retention and security</h2>
        <p>
          We retain information for as long as needed to deliver services, meet reporting
          requirements, and resolve disputes. We use administrative, technical, and organizational
          safeguards — including access controls and encryption in transit — appropriate to the
          sensitivity of vocational rehabilitation data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">6. Your choices</h2>
        <p>
          Participants may contact their Employment Specialist or Joshua Tree administrator to
          update contact information or ask questions about records in the program. Access to the
          application itself is limited to authorized users provisioned by Joshua Tree.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">7. Children</h2>
        <p>
          The service is intended for authorized vocational rehabilitation program participants
          and staff. If you believe a minor&apos;s information was submitted without appropriate
          authorization, contact us so we can review the account.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">8. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at
          the top of this page indicates the current version.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brand-black">9. Contact</h2>
        <p>
          Privacy questions:{" "}
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

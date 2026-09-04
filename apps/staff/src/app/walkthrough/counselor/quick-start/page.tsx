import {
  CONFIDENTIALITY_NOTICE,
  STAFF_APP_PRODUCT_NAME,
  WAYFINDER_LOGO_PATH,
} from "@wayfinder/branding";
import Image from "next/image";
import Link from "next/link";
import { DEMO_SHARE_PATH } from "../../lib/demo-copy";

export default function CounselorDemoQuickStartPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10" aria-labelledby="quick-start-heading">
      <Image
        src={WAYFINDER_LOGO_PATH}
        alt={STAFF_APP_PRODUCT_NAME}
        width={160}
        height={48}
        className="h-10 w-auto"
        priority
      />
      <h1 id="quick-start-heading" className="mt-6 text-2xl font-semibold text-brand-green">
        Counselor — Quick Start
      </h1>
      <p className="mt-2 text-sm text-brand-black/75">
        {STAFF_APP_PRODUCT_NAME} counselor portal — read-only view of your participants.
      </p>

      <section className="mt-8 space-y-4 text-sm text-brand-black/85">
        <h2 className="text-lg font-semibold text-brand-black">This demonstration</h2>
        <p>
          Share or project the demo sign-in page:{" "}
          <Link href={DEMO_SHARE_PATH} className="font-medium text-brand-green hover:underline">
            {DEMO_SHARE_PATH}
          </Link>
          . It does not send email or touch live data. Use{" "}
          <strong>Enter counselor demo</strong> to explore sample clients in Traditional Supported
          Employment, IJP, Workplace Readiness Training, and Job Coaching.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-brand-black">Real sign-in (after setup)</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Go to <strong>wayfinder-pro.thejoshuatree.org</strong>
          </li>
          <li>
            Use your <strong>official GVRA email</strong> — the agency address registered with
            Joshua Tree
          </li>
          <li>
            Tap <strong>Email me a magic link</strong> (or <strong>Sign in with passkey</strong>{" "}
            after your first visit)
          </li>
        </ol>

        <h2 className="pt-4 text-lg font-semibold text-brand-black">What You Can Do</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>My Clients</strong> — see activity for assigned participants
          </li>
          <li>
            <strong>Notifications</strong> — weekly summaries and hire celebrations (30/60/90 days)
          </li>
        </ul>

        <h2 className="pt-4 text-lg font-semibold text-brand-black">What You Cannot Do</h2>
        <p>
          You cannot edit client records or send messages here. Contact the participant&apos;s
          Employment Specialist if something looks wrong.
        </p>
      </section>

      <p className="mt-8 text-xs text-brand-black/60">{CONFIDENTIALITY_NOTICE}</p>

      <p className="mt-6">
        <Link
          href="/walkthrough/counselor"
          className="text-sm font-medium text-brand-green hover:underline"
        >
          Back to My Clients
        </Link>
      </p>
    </main>
  );
}

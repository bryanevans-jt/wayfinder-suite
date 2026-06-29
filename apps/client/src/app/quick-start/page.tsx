import {
  CLIENT_APP_PRODUCT_NAME,
  CONFIDENTIALITY_NOTICE,
  WAYFINDER_LOGO_PATH,
} from "@wayfinder/branding";
import Image from "next/image";
import Link from "next/link";

export default function ClientQuickStartPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <Image
        src={WAYFINDER_LOGO_PATH}
        alt={CLIENT_APP_PRODUCT_NAME}
        width={160}
        height={48}
        className="h-10 w-auto"
        priority
      />
      <h1 className="mt-6 text-2xl font-semibold text-brand-green">{CLIENT_APP_PRODUCT_NAME} — Quick start</h1>
      <p className="mt-2 text-sm text-brand-black/75">A one-page guide for participants.</p>

      <section className="mt-8 space-y-4 text-sm text-brand-black/85">
        <h2 className="text-lg font-semibold text-brand-black">Sign in</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Go to{" "}
            <strong>wayfinder.thejoshuatree.org</strong>
          </li>
          <li>Enter the email your Employment Specialist has on file</li>
          <li>
            Tap <strong>Email me a magic link</strong> and open the link in your email
          </li>
          <li>Optional: use <strong>Sign in with passkey</strong> after your first visit</li>
        </ol>

        <h2 className="pt-4 text-lg font-semibold text-brand-black">Your dashboard</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Success path</strong> — your program milestones
          </li>
          <li>
            <strong>Messages</strong> — contact your Employment Specialist
          </li>
          <li>
            <strong>Applications</strong> — jobs you are pursuing
          </li>
          <li>
            <strong>Meetings</strong> — upcoming appointments
          </li>
        </ul>

        <h2 className="pt-4 text-lg font-semibold text-brand-black">Tips</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            On your phone: <strong>Add to Home Screen</strong> for an app-like experience
          </li>
          <li>Reply to messages within a few days — your ES will respond</li>
        </ul>
      </section>

      <p className="mt-8 text-xs text-brand-black/60">{CONFIDENTIALITY_NOTICE}</p>

      <p className="mt-6">
        <Link href="/login" className="text-sm font-medium text-brand-green hover:underline">
          Go to sign in
        </Link>
        {" · "}
        <Link href="/dashboard" className="text-sm font-medium text-brand-green hover:underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}

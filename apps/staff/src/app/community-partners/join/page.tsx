import { CommunityPartnersJoinForm } from "@/components/community-partners-join-form";
import { STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import { COMMUNITY_PARTNERS_NETWORK_NAME } from "@/lib/employer-constants";

export const metadata = {
  title: `Join the ${COMMUNITY_PARTNERS_NETWORK_NAME} — ${STAFF_APP_PRODUCT_NAME}`,
  description: `Employers can request to join the Joshua Tree ${COMMUNITY_PARTNERS_NETWORK_NAME}.`,
};

export default function CommunityPartnersJoinPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-brand-black">
          Join the {COMMUNITY_PARTNERS_NETWORK_NAME}
        </h1>
        <p className="mt-3 text-brand-black/75">
          Partner with Joshua Tree Service Group to connect with job-ready candidates in your area.
          Fill out the form below and our team will review your request.
        </p>
      </header>

      <div className="mb-8 space-y-6 text-sm text-brand-black/80">
        <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-5">
          <h2 className="text-base font-semibold text-brand-black">What we&apos;re agreeing to</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-brand-black">Employers:</span> Joining does not
              obligate you to hire anyone. You&apos;re simply indicating that you&apos;re open to
              considering qualified candidates we refer when you have openings in their area of
              interest.
            </li>
            <li>
              <span className="font-medium text-brand-black">JTSG:</span> We are not obligated to
              refer candidates to every organization in the network. We will present candidates when
              we believe there&apos;s a good fit and when your business has (or may have) relevant
              opportunities.
            </li>
          </ul>
          <p className="mt-3">
            By submitting this form, you confirm that you understand and agree to this partnership in
            good faith, with no binding hiring or referral commitment on either side.
          </p>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-5">
          <h2 className="text-base font-semibold text-brand-black">How we use your information</h2>
          <p className="mt-3">
            Information you submit is used by Joshua Tree Service Group staff to contact you about
            the {COMMUNITY_PARTNERS_NETWORK_NAME} and relevant hiring opportunities. It is not sold.
            Access is limited to authorized JTSG team members involved in employer relations and
            workforce programs. We retain it only as long as needed for program operations, reporting,
            or legal requirements.
          </p>
        </section>
      </div>

      <CommunityPartnersJoinForm />
    </main>
  );
}

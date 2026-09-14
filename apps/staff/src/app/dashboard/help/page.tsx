import { requireAppSession } from "@/lib/app-session";
import { preEtsAccessAllowedForRole } from "@/lib/pre-ets-access";
import { WayfinderProHelp } from "@/components/wayfinder-pro-help";

export default async function StaffHelpPage() {
  const session = await requireAppSession();
  const showPreEtsNav = await preEtsAccessAllowedForRole(session.effectiveRole);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-brand-black">Help</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        A short guide to Wayfinder Pro for your role — where to click and what each area is for.
      </p>
      <WayfinderProHelp role={session.effectiveRole} showPreEtsNav={showPreEtsNav} />
    </main>
  );
}

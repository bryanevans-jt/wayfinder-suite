import { ExportsWorkspace } from "@/components/exports-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";

export default async function ExportsPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  const readOnly = session?.isPreviewing ?? false;

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Exports</h1>
      <p className="mt-2 max-w-2xl text-brand-black/75">
        Download CSV snapshots of your Wayfinder data for internal planning and record-keeping.
        This is separate from your organization&apos;s formal Reporting process.
      </p>
      <ExportsWorkspace role={role} readOnly={readOnly} />
    </main>
  );
}

import { PortalWorkspace } from "@/components/portal-workspace";
import { PtoSettingsPanel } from "@/components/pto-settings-panel";
import { WrtCurriculumPanel } from "@/components/wrt-curriculum-panel";
import { requirePortalPage } from "@/lib/portal-data";

export default async function AdminPortalPage() {
  await requirePortalPage("admin");

  return (
    <>
      <PortalWorkspace
        mode="admin"
        title="Admin"
        subtitle="Manage clients, team members, offices, and reports. Day-to-day work starts on the Clients tab."
      />
      <div className="px-6 pb-10">
        <PtoSettingsPanel />
        <WrtCurriculumPanel />
        <div className="mt-6">
          <a
            href="/dashboard/wrt"
            className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-brand-black hover:bg-amber-100"
          >
            Open WRT Facilitation Preview
          </a>
        </div>
      </div>
    </>
  );
}

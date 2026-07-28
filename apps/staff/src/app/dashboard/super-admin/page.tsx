import { PortalWorkspace } from "@/components/portal-workspace";
import { DemoTrainingWorkspace } from "@/components/demo-training-workspace";
import { PayrollSettingsPanel } from "@/components/payroll-settings-panel";
import { PtoSettingsPanel } from "@/components/pto-settings-panel";
import { WrtCurriculumPanel } from "@/components/wrt-curriculum-panel";
import { requirePortalPage } from "@/lib/portal-data";

export default async function SuperAdminPortalPage() {
  await requirePortalPage("super_admin");

  return (
    <>
      <PortalWorkspace
        mode="super_admin"
        title="Super Admin"
        subtitle="Full organization control. Clients is your home tab; advanced connections and error logs live under Settings."
      />
      <div className="px-6 pb-10">
        <DemoTrainingWorkspace />
        <PayrollSettingsPanel />
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

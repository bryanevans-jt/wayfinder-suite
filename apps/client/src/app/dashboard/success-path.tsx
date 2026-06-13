import { WAYFINDER_LOGO_PATH } from "@wayfinder/branding";
import {
  createServerClient,
  isSupportRole,
  loadClientSuccessPath,
  resolveDashboardClient,
} from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import Image from "next/image";
import { DesertTrail } from "./desert-trail";

type SuccessPathProps = {
  selectedClientId?: string;
};

export async function SuccessPath({ selectedClientId }: SuccessPathProps) {
  const session = await getAppSession();
  if (!session) {
    return null;
  }

  const supabase = await createServerClient();
  const readOnly = isSupportRole(session.effectiveRole);
  const ctx = await resolveDashboardClient(
    supabase,
    session.effectiveUserId,
    session.effectiveRole,
    selectedClientId
  );

  if (!ctx) {
    return (
      <section className="rounded-2xl border border-brand-black/15 bg-brand-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-green">Current Services</h2>
        <p className="mt-2 text-sm text-brand-black/75">
          {readOnly
            ? "No client assignments are linked to your support account yet."
            : "Your client profile is not set up yet. Once your Employment Specialist connects your account to a service path, milestones will show here."}
        </p>
      </section>
    );
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, user_id, current_service_id, current_stage_id")
    .eq("id", ctx.clientId)
    .maybeSingle();

  if (!clientRow) {
    return null;
  }

  if (!clientRow.current_service_id && !clientRow.current_stage_id) {
    return (
      <section className="rounded-2xl border border-brand-black/15 bg-brand-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-green">Current Services</h2>
        <p className="mt-2 text-sm text-brand-black/75">No active service is assigned yet.</p>
      </section>
    );
  }

  const path = await loadClientSuccessPath(supabase, {
    current_service_id: clientRow.current_service_id,
    current_stage_id: clientRow.current_stage_id,
  });

  if (!path || path.milestones.length === 0) {
    return (
      <section className="rounded-2xl border border-brand-black/15 bg-brand-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-green">Current Services</h2>
        <p className="mt-2 text-sm text-brand-black/75">
          Your service path is being set up. If this message persists, ask your Employment
          Specialist to confirm your service and stage are assigned.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center border-b border-neutral-200 pb-6">
        <Image
          src={WAYFINDER_LOGO_PATH}
          alt="Wayfinder"
          width={360}
          height={108}
          className="h-auto w-full max-w-[min(320px,85vw)] object-contain"
          priority
          sizes="(max-width: 640px) 85vw, 320px"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-green">Current Services</h2>
          <p className="mt-1 text-sm text-brand-black/70">{path.serviceName}</p>
          <p className="mt-3 text-base font-semibold text-brand-black">
            Current stage:{" "}
            <span className="text-brand-green">{path.currentStageTitle ?? "Not set"}</span>
          </p>
        </div>
        {readOnly ? (
          <span className="rounded-full border border-neutral-300 bg-brand-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-black">
            Natural Support · read-only
          </span>
        ) : null}
      </div>

      <div className="mt-6 bg-white pt-2">
        <DesertTrail
          milestones={path.milestones}
          currentStageId={path.currentStageId}
          readOnly={readOnly}
        />
      </div>
    </section>
  );
}

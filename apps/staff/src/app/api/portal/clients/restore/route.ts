import { jsonPortalError, assertPortalMutation } from "@/lib/portal-auth";
import { isTerminalStageTitle } from "@wayfinder/supabase/client-archive";
import { NextRequest } from "next/server";

/**
 * Restore a closed/dismissed/archived client to an active stage (clears archived_at via trigger).
 * Super admin / admin always; supervisor when they can mutate portal clients.
 */
export async function POST(request: NextRequest) {
  try {
    const { admin, role } = await assertPortalMutation("supervisor");
    const body = (await request.json()) as { clientId?: string; stageId?: string };
    const clientId = body.clientId?.trim();
    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, current_service_id, current_stage_id, archived_at")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr) throw new Error(clientErr.message);
    if (!client) {
      return Response.json({ error: "Client not found." }, { status: 404 });
    }

    let nextStageId = body.stageId?.trim() || null;

    if (!nextStageId) {
      const serviceId = client.current_service_id as string | null;
      if (!serviceId) {
        return Response.json(
          { error: "Client has no service; assign a service before restoring." },
          { status: 400 }
        );
      }
      const { data: milestones, error: mErr } = await admin
        .from("service_milestones")
        .select("id, title, order_index")
        .eq("service_id", serviceId)
        .order("order_index", { ascending: true });
      if (mErr) throw new Error(mErr.message);
      const active = (milestones ?? []).find((m) => !isTerminalStageTitle(String(m.title)));
      if (!active) {
        return Response.json(
          { error: "No active (non-closed) stage found for this service." },
          { status: 400 }
        );
      }
      nextStageId = String(active.id);
    } else {
      const { data: milestone, error: mErr } = await admin
        .from("service_milestones")
        .select("id, title")
        .eq("id", nextStageId)
        .maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!milestone) {
        return Response.json({ error: "Stage not found." }, { status: 404 });
      }
      if (isTerminalStageTitle(String(milestone.title))) {
        return Response.json(
          { error: "Choose an active stage, not Closed, Dismissed, or Services Interrupted." },
          { status: 400 }
        );
      }
    }

    const { error: updErr } = await admin
      .from("clients")
      .update({ current_stage_id: nextStageId })
      .eq("id", clientId);
    if (updErr) throw new Error(updErr.message);

    void role;
    return Response.json({ ok: true, current_stage_id: nextStageId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

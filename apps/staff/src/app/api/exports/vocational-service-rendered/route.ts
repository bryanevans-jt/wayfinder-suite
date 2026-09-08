import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { displayServiceTimes } from "@wayfinder/supabase/es-time-tracking";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadStaffNameById } from "@/lib/staff-names";
import {
  buildVocationalServiceRenderedPdf,
  vocationalServiceRenderedCsv,
  type VocationalServiceRenderedLine,
} from "@/lib/vocational-service-rendered-pdf";
import path from "node:path";
import { NextResponse } from "next/server";

function canExport(role: string | null | undefined): boolean {
  return (
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    isHrRole(role) ||
    role === "accountant"
  );
}

export async function GET(request: Request) {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canExport(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim();
  const episodeId = url.searchParams.get("episodeId")?.trim();
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  const esNameOverride = url.searchParams.get("esName")?.trim();
  const counselorOverride = url.searchParams.get("counselorName")?.trim();
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";

  if (!clientId || !episodeId || !from || !to) {
    return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: episode } = await admin
    .from("service_episodes")
    .select("id, client_id, service_id, authorization_number, services(name)")
    .eq("id", episodeId)
    .maybeSingle();

  if (!episode || episode.client_id !== clientId) {
    return NextResponse.json({ error: "Service episode not found." }, { status: 404 });
  }

  const { data: entries } = await admin
    .from("es_time_entries")
    .select(
      "service_date, duration_minutes, narrative, client_present, delivery_mode, service_start_at, service_end_at, es_user_id, activity_type_id, service_activity_types(name)"
    )
    .eq("service_episode_id", episodeId)
    .gte("service_date", from)
    .lte("service_date", to)
    .neq("status", "rejected")
    .order("service_date", { ascending: true })
    .order("service_start_at", { ascending: true });

  const { data: client } = await admin
    .from("clients")
    .select("counselor_id, full_name")
    .eq("id", clientId)
    .maybeSingle();

  const clientNames = await loadClientDisplayNameById(admin, [clientId]);
  const esIds = [...new Set((entries ?? []).map((e) => e.es_user_id as string))];
  const esNames = await loadStaffNameById(admin, esIds, "ES");

  let counselorName = counselorOverride ?? "—";
  if (!counselorOverride && client?.counselor_id) {
    const { data: counselor } = await admin
      .from("counselors")
      .select("full_name")
      .eq("id", client.counselor_id)
      .maybeSingle();
    counselorName = (counselor?.full_name as string) ?? counselorName;
  }

  const primaryEsId = esIds[0] ?? session.effectiveUserId;
  const esName = esNameOverride ?? esNames.get(primaryEsId) ?? "Employment Specialist";

  const services = episode.services as { name?: string } | { name?: string }[] | null;
  const svc = Array.isArray(services) ? services[0] : services;
  const serviceName = (svc?.name ?? "Service").replace(/\s*\(GA\)\s*$/i, "").trim();

  const lines: VocationalServiceRenderedLine[] = (entries ?? []).map((e) => {
    const types = e.service_activity_types as { name?: string } | { name?: string }[] | null;
    const t = Array.isArray(types) ? types[0] : types;
    const times = displayServiceTimes({
      service_start_at: e.service_start_at as string | null,
      service_end_at: e.service_end_at as string | null,
      duration_minutes: e.duration_minutes as number,
    });
    return {
      serviceDate: e.service_date as string,
      startTime: times.start,
      endTime: times.end,
      activityName: t?.name ?? "Activity",
      clientPresent: Boolean(e.client_present),
      deliveryMode: (e.delivery_mode as string | null) ?? null,
      narrative: (e.narrative as string | null) ?? "",
      hours: (Number(e.duration_minutes) || 0) / 60,
    };
  });

  const totalHours = lines.reduce((s, l) => s + l.hours, 0);

  const payload = {
    serviceName,
    clientName: clientNames.get(clientId) ?? "Client",
    esName,
    counselorName,
    periodStart: from,
    periodEnd: to,
    totalHours,
    lines,
    publicDir: path.join(process.cwd(), "public"),
  };

  if (format === "csv") {
    const csv = vocationalServiceRenderedCsv(payload);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vocational-service-rendered-${episode.authorization_number}-${from}-${to}.csv"`,
      },
    });
  }

  const pdf = await buildVocationalServiceRenderedPdf(payload);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vocational-service-rendered-${episode.authorization_number}-${from}-${to}.pdf"`,
    },
  });
}

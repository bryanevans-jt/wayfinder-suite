import { AuditPreviewWorkspace } from "@/components/audit-preview-workspace";
import { formatPortalDateTime } from "@/lib/portal-datetime";
import { requirePortalPage } from "@/lib/portal-data";
import { personDisplayName } from "@wayfinder/branding";
import { roleDisplayName } from "@wayfinder/supabase/roles";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { redirect } from "next/navigation";
import { getAppSession } from "@wayfinder/supabase/preview-server";

export default async function AuditPreviewPage() {
  await requirePortalPage("super_admin");

  const session = await getAppSession();
  if (session?.isPreviewing) {
    redirect("/dashboard");
  }

  let auditRows: {
    id: string;
    action: string;
    target_role: string;
    created_at: string;
    actor_name: string;
    target_name: string;
  }[] = [];

  try {
    const admin = createServiceRoleClient();
    const { data: logs } = await admin
      .from("preview_audit_logs")
      .select("id, action, target_role, created_at, actor_user_id, target_user_id")
      .order("created_at", { ascending: false })
      .limit(100);

    const userIds = [
      ...new Set(
        (logs ?? []).flatMap((l) => [l.actor_user_id as string, l.target_user_id as string])
      ),
    ];
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    auditRows = (logs ?? []).map((row) => ({
      id: row.id as string,
      action: row.action as string,
      target_role: row.target_role as string,
      created_at: row.created_at as string,
      actor_name: personDisplayName({
        id: row.actor_user_id as string,
        full_name: nameById.get(row.actor_user_id as string) ?? null,
      }),
      target_name: personDisplayName({
        id: row.target_user_id as string,
        full_name: nameById.get(row.target_user_id as string) ?? null,
      }),
    }));
  } catch {
    auditRows = [];
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Audit Preview</h1>
      <p className="mt-2 max-w-2xl text-brand-black/75">
        Preview another user&apos;s dashboard in read-only mode. Use this to verify layouts,
        navigation, and data visibility before or after go-live.
      </p>
      <AuditPreviewWorkspace />

      <section className="mt-10 max-w-4xl">
        <h2 className="text-lg font-semibold text-brand-black">Preview Audit Log</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Internal record of preview sessions (enter and exit). Visible to super admins only.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-brand-black/70">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Super Admin</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-brand-black/60">
                    No preview sessions logged yet.
                  </td>
                </tr>
              ) : (
                auditRows.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatPortalDateTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.action}</td>
                    <td className="px-3 py-2">{row.actor_name}</td>
                    <td className="px-3 py-2">{row.target_name}</td>
                    <td className="px-3 py-2">{roleDisplayName(row.target_role)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

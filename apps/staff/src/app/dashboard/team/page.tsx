import { TeamDirectoryWorkspace } from "@/components/team-directory-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isStaffRole } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function TeamDirectoryPage() {
  const session = await getAppSession();
  if (!session || !isStaffRole(session.effectiveRole)) {
    redirect("/login");
  }
  if (session.effectiveRole === "counselor") {
    redirect("/dashboard/counselor");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <TeamDirectoryWorkspace />
    </main>
  );
}

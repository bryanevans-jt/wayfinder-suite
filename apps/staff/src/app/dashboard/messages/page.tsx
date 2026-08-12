import { isEsRole, isSupervisorTierRole, staffHomePath } from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { StaffMessagesWorkspace } from "@/components/staff-messages-workspace";

export default async function MessagesPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole;
  const canAccess = isEsRole(role) || isSupervisorTierRole(role);
  if (!canAccess) {
    redirect(staffHomePath(role));
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Messages</h1>
      <p className="mt-2 max-w-xl text-brand-black/75">
        Each client has one conversation thread. Reply within about two business days. Supervisors can
        read threads and step in when a reply is late.
      </p>
      <div className="mt-8">
        <StaffMessagesWorkspace />
      </div>
    </main>
  );
}

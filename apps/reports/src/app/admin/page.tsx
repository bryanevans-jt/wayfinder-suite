import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminPortal } from '@/components/admin/AdminPortal';
import { canAccessReportAdmin, isReportSuperadmin } from '@/lib/report-access';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.endsWith('@thejoshuatree.org')) redirect('/login');

  const [isAdmin, isSuperadmin] = await Promise.all([
    canAccessReportAdmin(supabase, user.id),
    isReportSuperadmin(supabase, user.id),
  ]);

  if (!isAdmin) redirect('/');

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <AdminPortal
        userEmail={user.email!}
        isSuperadmin={isSuperadmin}
      />
    </div>
  );
}

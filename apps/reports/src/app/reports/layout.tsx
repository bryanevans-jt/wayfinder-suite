import { resolveReportingEsName } from '@/lib/es-display-name';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReportsAuthProvider } from './reports-auth-context';

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/reports');

  const email = user.email ?? '';
  if (!email.endsWith('@thejoshuatree.org')) {
    redirect('/login?error=org_only');
  }

  const displayName =
    resolveReportingEsName(null, user.user_metadata) || email;

  return (
    <ReportsAuthProvider user={{ email, displayName }}>
      {children}
    </ReportsAuthProvider>
  );
}

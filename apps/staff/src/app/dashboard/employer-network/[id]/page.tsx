import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function LegacyEmployerDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/community-partners/${id}`);
}

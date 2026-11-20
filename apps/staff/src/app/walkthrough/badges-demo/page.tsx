import { MyAchievementBadgesCard } from "@/components/my-achievement-badges-card";
import { mockStaffBadgesMinePayload } from "@wayfinder/supabase/staff-badges";

/** Public walkthrough page with mock badge data for screenshots — no live client data. */
export default function BadgesDemoPage() {
  return (
    <main className="mx-auto max-w-3xl bg-[#f7f7f5] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-brand-black">Clients</h1>
      <p className="mt-1 text-sm text-brand-black/70">
        Badge card preview (mock data — no client information).
      </p>
      <MyAchievementBadgesCard demoPayload={mockStaffBadgesMinePayload()} />
    </main>
  );
}

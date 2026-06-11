"use client";

import { createClient } from "@wayfinder/supabase/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function SignOutButton() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="rounded-lg border border-brand-black/20 bg-brand-white px-4 py-2 text-sm font-medium text-brand-black hover:bg-brand-black/[0.03] disabled:opacity-60"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}

"use client";

import { clientDisplayName } from "@wayfinder/branding";
import { useRouter, useSearchParams } from "next/navigation";

export type SupportClientOption = {
  id: string;
  label: string;
};

type Props = {
  clients: SupportClientOption[];
  selectedClientId?: string | null;
};

export function SupportClientPicker({ clients, selectedClientId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (clients.length <= 1) {
    return null;
  }

  const current =
    selectedClientId && clients.some((c) => c.id === selectedClientId)
      ? selectedClientId
      : clients[0]!.id;

  return (
    <section className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
      <label className="block text-sm font-medium text-brand-black">
        Which client are you viewing?
        <select
          value={current}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams.toString());
            next.set("client", e.target.value);
            router.push(`/dashboard?${next.toString()}`);
          }}
          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs text-brand-black/65">
        You are signed in as natural support. Pick the person you are helping today.
      </p>
    </section>
  );
}

/** Build display labels for support assignment rows. */
export function supportClientOptionsFromRows(
  rows: Array<{
    client_id: string;
    clients?: {
      contact_email?: string | null;
      profiles?: { full_name?: string | null } | null;
    } | null;
  }>
): SupportClientOption[] {
  return rows.map((row) => {
    const client = row.clients;
    const label = client
      ? clientDisplayName({
          full_name: client.profiles?.full_name ?? null,
          contact_email: client.contact_email ?? null,
          id: row.client_id,
        })
      : row.client_id;
    return { id: row.client_id, label };
  });
}

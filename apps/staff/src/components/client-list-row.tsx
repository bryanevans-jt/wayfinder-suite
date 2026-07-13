"use client";

import type { PortalBootstrap } from "@/lib/portal-data";
import { clientDisplayName } from "@wayfinder/branding";

type ClientRow = PortalBootstrap["clients"][number];

type Props = {
  client: ClientRow;
  busy: boolean;
  officeName: (id: string | null) => string;
  esLabel: (id: string | null) => string;
  onManage: () => void;
};

export function ClientListRow({ client, busy, officeName, esLabel, onManage }: Props) {
  const displayName = clientDisplayName(client);

  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50/50">
      <td className="px-3 py-3">
        <p className="font-medium text-brand-black">{displayName}</p>
        {client.contact_email ? (
          <p className="text-xs text-brand-black/60">{client.contact_email}</p>
        ) : null}
      </td>
      <td className="px-3 py-3">{officeName(client.office_id)}</td>
      <td className="px-3 py-3">
        {client.es_user_ids.length > 0
          ? client.es_user_ids.map((id) => esLabel(id)).join(", ")
          : "—"}
      </td>
      <td className="px-3 py-3">{client.service_name ?? "—"}</td>
      <td className="px-3 py-3">{client.stage_title ?? "—"}</td>
      <td className="px-3 py-3">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-brand-green/10 px-3 py-1.5 text-sm font-semibold text-brand-green hover:bg-brand-green/15 disabled:opacity-60"
          onClick={onManage}
        >
          Manage
        </button>
      </td>
    </tr>
  );
}

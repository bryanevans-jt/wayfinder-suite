"use client";

import Link from "next/link";
import type { PortalBootstrap } from "@/lib/portal-data";
import { clientDisplayName } from "@wayfinder/branding";
import {
  clientPipelineWhere,
  CLIENT_PIPELINE_WHERE_LABELS,
} from "@/lib/client-pipeline-where";

type ClientRow = PortalBootstrap["clients"][number];

type Props = {
  client: ClientRow;
  busy: boolean;
  officeName: (id: string | null) => string;
  esLabel: (id: string | null) => string;
  onManage: () => void;
  ijpSignatureMonthLabel?: string | null;
};

export function ClientListRow({
  client,
  busy,
  officeName,
  esLabel,
  onManage,
  ijpSignatureMonthLabel,
}: Props) {
  const displayName = clientDisplayName(client);
  const where = clientPipelineWhere(client);

  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50/50">
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onManage}
            className="text-left font-medium text-brand-green hover:underline disabled:opacity-60"
          >
            {displayName}
          </button>
          {ijpSignatureMonthLabel ? (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
              title={ijpSignatureMonthLabel}
            >
              Signature needed
            </span>
          ) : null}
        </div>
        {client.contact_email ? (
          <p className="text-xs text-brand-black/60">{client.contact_email}</p>
        ) : null}
      </td>
      <td className="px-3 py-3">{officeName(client.office_id)}</td>
      <td className="px-3 py-3">{client.counselor_name ?? "—"}</td>
      <td className="px-3 py-3">
        {client.es_user_ids.length > 0
          ? client.es_user_ids.map((id) => esLabel(id)).join(", ")
          : "—"}
      </td>
      <td className="px-3 py-3">{client.service_name ?? "—"}</td>
      <td className="px-3 py-3">{client.stage_title ?? "—"}</td>
      <td className="px-3 py-3">{CLIENT_PIPELINE_WHERE_LABELS[where]}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-brand-green/10 px-3 py-1.5 text-sm font-semibold text-brand-green hover:bg-brand-green/15 disabled:opacity-60"
            onClick={onManage}
          >
            Manage
          </button>
          {where === "closed" ? (
            <Link
              href={`/dashboard/referrals?priorClientId=${encodeURIComponent(client.id)}`}
              className="rounded-lg border border-brand-green/40 px-3 py-1.5 text-sm font-semibold text-brand-green hover:bg-brand-green/5"
            >
              New service referral
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

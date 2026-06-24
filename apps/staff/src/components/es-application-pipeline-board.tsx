"use client";

import {
  PIPELINE_BOARD_STATUSES,
  type PipelineBoardStatus,
} from "@wayfinder/branding";
import { friendlyClientError } from "@wayfinder/supabase/error-log";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateClientApplication } from "@/app/dashboard/clients/[id]/actions";

export type PipelineApplication = {
  id: string;
  clientId: string;
  clientName: string;
  companyName: string;
  status: string;
  updatedAt: string;
};

type Props = {
  applications: PipelineApplication[];
  readOnly?: boolean;
};

export function EsApplicationPipelineBoard({ applications, readOnly = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const active = applications.filter((a) =>
    (PIPELINE_BOARD_STATUSES as readonly string[]).includes(a.status)
  );

  if (active.length === 0) {
    return null;
  }

  function appsForColumn(status: PipelineBoardStatus) {
    return active.filter((a) => a.status === status);
  }

  function onMove(app: PipelineApplication, nextStatus: PipelineBoardStatus) {
    if (readOnly || app.status === nextStatus) return;
    setError(null);
    setMovingId(app.id);
    startTransition(async () => {
      try {
        await updateClientApplication(app.clientId, app.id, nextStatus, null);
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      } finally {
        setMovingId(null);
      }
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-brand-black">Application pipeline</h2>
      <p className="mt-1 text-sm text-brand-black/65">
        Active applications across your caseload. Tap a card to move it to the next stage.
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_BOARD_STATUSES.map((status) => (
          <div
            key={status}
            className="min-w-[200px] flex-1 rounded-lg border border-neutral-100 bg-neutral-50/80 p-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wide text-brand-black/55">
              {status}
              <span className="ml-1 font-normal text-brand-black/40">
                ({appsForColumn(status).length})
              </span>
            </h3>
            <ul className="mt-2 space-y-2">
              {appsForColumn(status).map((app) => (
                <li key={app.id}>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-brand-black">{app.companyName}</p>
                    <p className="mt-0.5 text-xs text-brand-black/60">
                      <Link
                        href={`/dashboard/clients/${app.clientId}`}
                        className="text-brand-green hover:underline"
                      >
                        {app.clientName}
                      </Link>
                    </p>
                    {!readOnly ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-brand-green">
                          {pending && movingId === app.id ? "Saving…" : "Move stage"}
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {PIPELINE_BOARD_STATUSES.filter((s) => s !== app.status).map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={pending}
                              onClick={() => onMove(app, s)}
                              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs hover:bg-brand-gold/10"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

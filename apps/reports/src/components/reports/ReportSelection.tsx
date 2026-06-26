'use client';

import { useEffect, useState } from 'react';
import { SignOutButton } from '@/components/SignOutButton';
import type { TagSchemaField } from '@/lib/tag-schema';
import { parseTagSchema } from '@/lib/tag-schema';

type ReportingState = 'GA' | 'TN';
type GaReportType = 'seMonthly' | 'vpr' | 'jtsgvmr' | 'evf' | 'jtsgtsvs';

type GaReport = {
  slug: GaReportType;
  name: string;
};

export type TnReportSelection = {
  id: string;
  slug: string;
  name: string;
  requiresSignature: boolean;
  templateKind: string;
  tagSchema: TagSchemaField[];
};

type TnProgram = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  reports: Array<{
    id: string;
    slug: string;
    name: string;
    requiresSignature?: boolean;
    templateKind?: string;
    tagSchema?: unknown;
  }>;
};

interface Props {
  user: { email: string; displayName: string };
  state: ReportingState;
  onSelectGa: (type: GaReportType) => void;
  onSelectTn: (report: TnReportSelection) => void;
  onBack: () => void;
}

export function ReportSelection({ user, state, onSelectGa, onSelectTn, onBack }: Props) {
  const [gaReports, setGaReports] = useState<GaReport[]>([]);
  const [programs, setPrograms] = useState<TnProgram[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wayfinder/report-catalog?state=${state}`)
      .then((res) => res.json())
      .then((data) => {
        setGaReports(data.gaReports ?? []);
        setPrograms(data.programs ?? []);
      })
      .finally(() => setLoading(false));
  }, [state]);

  const enabledTnReports = programs.flatMap((p) =>
    p.enabled
      ? p.reports.map((r) => ({
          ...r,
          programName: p.name,
          requiresSignature: Boolean(r.requiresSignature),
          templateKind: (r.templateKind as string) ?? 'google_doc',
          tagSchema: parseTagSchema(r.tagSchema),
        }))
      : []
  );

  function handleContinue() {
    if (!selected || state !== 'GA') return;
    onSelectGa(selected as GaReportType);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-700" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg mt-10">
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-green-600 mb-4">
          ← Change state
        </button>
        <h1 className="text-3xl font-bold mb-2 text-center text-green-800">
          {state === 'GA' ? 'Georgia reports' : 'Tennessee reports'}
        </h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          Welcome, {user.displayName}
        </p>

        {state === 'GA' ? (
          <>
            <label htmlFor="reportType" className="text-gray-700 font-semibold mb-2 block">
              Report type
            </label>
            <select
              id="reportType"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select a report...</option>
              {gaReports.map((report) => (
                <option key={report.slug} value={report.slug}>
                  {report.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!selected}
              className="w-full mt-4 py-3 px-4 bg-green-700 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 disabled:opacity-50"
            >
              Next
            </button>
          </>
        ) : enabledTnReports.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-gray-700">
            <p className="font-medium">No Tennessee reports are enabled yet.</p>
            <p className="mt-2">
              Programs are seeded in admin. Enable a program and add report templates in the{' '}
              <a href="/admin" className="font-medium text-green-700 hover:underline">
                reports admin portal
              </a>{' '}
              when ready.
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              {programs.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {!p.enabled ? ' (disabled)' : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="space-y-2">
            {enabledTnReports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() =>
                    onSelectTn({
                      id: report.id,
                      slug: report.slug,
                      name: report.name,
                      requiresSignature: report.requiresSignature,
                      templateKind: report.templateKind,
                      tagSchema: report.tagSchema,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm hover:border-green-300 hover:bg-green-50"
                >
                  <p className="font-medium">{report.name}</p>
                  <p className="text-xs text-gray-500">{report.programName}</p>
                  {report.requiresSignature ? (
                    <p className="text-xs text-green-700 mt-1">Signature required</p>
                  ) : null}
                  {report.templateKind === 'pdf_upload' ? (
                    <p className="text-xs text-blue-700 mt-1">Download, print, and upload completed form</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}

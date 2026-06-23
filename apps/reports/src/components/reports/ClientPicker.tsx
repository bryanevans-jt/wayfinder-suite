'use client';

import { useEffect, useState } from 'react';

type ReportingState = 'GA' | 'TN';

export type ClientSelection = {
  wayfinderClientId: string | null;
  clientName: string;
  adHoc: boolean;
  counselorName?: string;
  employmentGoal?: string;
};

interface Props {
  state: ReportingState;
  esName: string;
  initialClientId?: string | null;
  initialClientName?: string;
  onContinue: (selection: ClientSelection) => void;
  onBack?: () => void;
}

type SearchClient = {
  id: string;
  name: string;
  officeName: string | null;
  serviceName: string | null;
};

export function ClientPicker({
  state,
  esName,
  initialClientId,
  initialClientName = '',
  onContinue,
  onBack,
}: Props) {
  const [query, setQuery] = useState(initialClientName);
  const [results, setResults] = useState<SearchClient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialClientId ?? null);
  const [manualName, setManualName] = useState(initialClientId ? '' : initialClientName);
  const [adHoc, setAdHoc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notFoundWarning, setNotFoundWarning] = useState(false);

  useEffect(() => {
    if (adHoc || query.trim().length < 2) {
      setResults([]);
      setNotFoundWarning(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ state, q: query.trim() });
        const res = await fetch(`/api/wayfinder/clients?${params}`);
        const data = await res.json();
        setResults(data.clients ?? []);
        setNotFoundWarning((data.clients ?? []).length === 0);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, state, adHoc]);

  useEffect(() => {
    if (initialClientId && initialClientName) {
      setSelectedId(initialClientId);
      setQuery(initialClientName);
      setAdHoc(false);
    }
  }, [initialClientId, initialClientName]);

  function continueSelection() {
    if (adHoc) {
      const name = manualName.trim();
      if (!name) return;
      onContinue({ wayfinderClientId: null, clientName: name, adHoc: true });
      return;
    }

    const picked = results.find((r) => r.id === selectedId);
    if (!picked) return;
    onContinue({
      wayfinderClientId: picked.id,
      clientName: picked.name,
      adHoc: false,
    });
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl mt-10">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-green-600 mb-4">
            ← Back
          </button>
        ) : null}
        <h1 className="text-2xl font-bold mb-2 text-center text-green-800">Select client</h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          Search your Wayfinder caseload ({state} office). Use manual entry only when the client is
          not in Wayfinder.
        </p>

        <input
          type="text"
          value={esName}
          readOnly
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 mb-4"
          aria-label="Employment specialist name"
        />

        <label className="flex items-center gap-2 mb-4 text-sm">
          <input
            type="checkbox"
            checked={adHoc}
            onChange={(e) => {
              setAdHoc(e.target.checked);
              setSelectedId(null);
              setNotFoundWarning(false);
            }}
          />
          Client not in Wayfinder (manual entry — no recall from prior reports)
        </label>

        {adHoc ? (
          <>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Double-check spelling. Manual clients do not pull prior report data automatically.
            </div>
            <input
              type="text"
              placeholder="Client full name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            />
          </>
        ) : (
          <>
            <input
              type="search"
              placeholder="Search client name..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId(null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            />
            {loading ? <p className="text-sm text-gray-500 mt-2">Searching...</p> : null}
            {notFoundWarning ? (
              <p className="text-sm text-amber-700 mt-2">
                No matching client found — verify spelling or use manual entry above.
              </p>
            ) : null}
            <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {results.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(client.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-green-50 ${
                      selectedId === client.id ? 'bg-green-50 ring-1 ring-green-200' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-500">
                      {[client.officeName, client.serviceName].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={continueSelection}
          disabled={adHoc ? !manualName.trim() : !selectedId}
          className="w-full mt-6 py-3 px-4 bg-green-700 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

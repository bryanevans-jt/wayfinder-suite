'use client';

import { useEffect, useState } from 'react';
import { SignOutButton } from '@/components/SignOutButton';

type ReportingState = 'GA' | 'TN';

interface Props {
  user: { email: string; displayName: string };
  onSelect: (state: ReportingState) => void;
}

export function StateSelector({ user, onSelect }: Props) {
  const [states, setStates] = useState<ReportingState[]>([]);
  const [selected, setSelected] = useState<ReportingState | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    fetch('/api/wayfinder/states', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load states');
        const data = await res.json();
        setStates(data.states ?? []);
      })
      .catch((e) => {
        const message =
          (e as Error).name === 'AbortError'
            ? 'Loading states timed out. Please refresh or try again in a moment.'
            : (e as Error).message;
        setError(message);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

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
        <h1 className="text-3xl font-bold mb-4 text-center text-green-800">Formal reporting</h1>
        <p className="text-gray-600 mb-6 text-center">
          Welcome, {user.displayName}! Choose the state for this report based on the client&apos;s
          assigned office.
        </p>
        {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}
        {states.length === 0 ? (
          <p className="text-sm text-gray-600">
            No reporting states are available for your account yet. ES and supervisors need clients
            in a GA or TN office; admins see states with enabled report types in the admin portal.
          </p>
        ) : (
          <>
            <label htmlFor="reportState" className="text-gray-700 font-semibold mb-2 block">
              State
            </label>
            <select
              id="reportState"
              value={selected}
              onChange={(e) => setSelected(e.target.value as ReportingState | '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 mb-4"
            >
              <option value="">Select a state...</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state === 'GA' ? 'Georgia (GVRA)' : 'Tennessee (DHS VR)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => selected && onSelect(selected)}
              disabled={!selected}
              className="w-full py-3 px-4 bg-green-700 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 disabled:opacity-50"
            >
              Continue
            </button>
          </>
        )}
      </div>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}

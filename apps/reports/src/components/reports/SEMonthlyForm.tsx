'use client';

import { useState, useEffect, useRef } from 'react';

const RECALL_EXCLUDE = [
  'jobDevelopment',
  'month',
  'dateRangeCovers',
  'dateReportSubmitted',
  'hoursOfCoaching',
  'seSpecialistName',
  'jobSeekerName',
];

interface Props {
  clientName: string;
  esName: string;
  wayfinderClientId?: string | null;
  adHoc?: boolean;
  initialData: Record<string, unknown>;
  onReview: (data: Record<string, unknown>) => void;
  onBack?: () => void;
}

export function SEMonthlyForm({
  clientName,
  esName,
  wayfinderClientId,
  adHoc = false,
  initialData,
  onReview,
  onBack,
}: Props) {
  const [data, setData] = useState<Record<string, unknown>>({
    ...initialData,
    jobSeekerName: clientName,
    seSpecialistName: esName,
    seProviderName: 'Joshua Tree Service Group',
  });
  const [loading, setLoading] = useState(true);
  const [recallMessage, setRecallMessage] = useState('');
  const [reportMonth, setReportMonth] = useState(
    (initialData.month as string) || new Date().toISOString().slice(0, 7)
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function loadRecallAndPrefill() {
      if (!clientName) {
        setLoading(false);
        return;
      }

      try {
        if (!adHoc) {
          const recallParams = new URLSearchParams();
          if (wayfinderClientId) {
            recallParams.set('wayfinderClientId', wayfinderClientId);
          } else {
            recallParams.set('clientId', clientName.toLowerCase().replace(/\s/g, ''));
          }
          const recallRes = await fetch(`/api/reports/recall?${recallParams}`);
          if (recallRes.ok) {
            const recalled = await recallRes.json();
            if (recalled && Object.keys(recalled).length > 0) {
              const merged = { ...recalled };
              RECALL_EXCLUDE.forEach((k) => delete merged[k]);
              setData((prev) => ({
                ...merged,
                ...prev,
                seSpecialistName: esName,
                jobSeekerName: clientName,
              }));
              setRecallMessage('Previous report data loaded (except date, hours coached, and job development).');
            } else {
              setRecallMessage('No previous report found for this client.');
            }
          }

          if (wayfinderClientId) {
            const prefillRes = await fetch(
              `/api/wayfinder/prefill?clientId=${encodeURIComponent(wayfinderClientId)}&month=${encodeURIComponent(reportMonth)}`
            );
            if (prefillRes.ok) {
              const prefill = await prefillRes.json();
              setData((prev) => ({
                ...prev,
                counselorName: prefill.counselorName || prev.counselorName,
                employmentGoal: prefill.employmentGoal || prev.employmentGoal,
                jobDevelopment: prefill.jobDevelopment || prev.jobDevelopment,
              }));
              if (prefill.jobDevelopment) {
                setRecallMessage((msg) =>
                  msg ? `${msg} Job development pre-filled from Wayfinder contact logs.` : 'Job development pre-filled from Wayfinder contact logs.'
                );
              }
            }
          }
        } else {
          setRecallMessage('Manual client — no prior report recall.');
        }
      } catch {
        setRecallMessage('Could not load previous data.');
      } finally {
        setLoading(false);
      }
    }
    loadRecallAndPrefill();
  }, [clientName, wayfinderClientId, adHoc, reportMonth, esName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const obj: Record<string, unknown> = {};
    const modelValues: string[] = [];
    formData.forEach((value, key) => {
      if (key === 'model') {
        modelValues.push(value as string);
      } else {
        obj[key] = value;
      }
    });
    if (modelValues.length) obj.model = modelValues.join(', ');
    onReview(obj);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-700" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-3xl mt-10">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-green-600 mb-4">
            ← Back
          </button>
        ) : null}
        <h1 className="text-3xl font-bold mb-4 text-center text-green-800">SE Monthly Reports</h1>
        {recallMessage ? <p className="text-sm text-green-600 mb-4">{recallMessage}</p> : null}
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-gray-300 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Identified Supported Employment Model</h3>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              {['Traditional', 'IPS', 'Customized Supported Employment'].map((m) => (
                <label key={m} className="flex items-center">
                  <input type="checkbox" name="model" value={m} className="form-checkbox text-green-600 rounded-md" />
                  <span className="ml-2">{m}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Month</label>
            <input
              type="month"
              name="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Date Report Submitted</label>
            <input
              type="date"
              name="dateReportSubmitted"
              defaultValue={(data.dateReportSubmitted as string) || new Date().toISOString().slice(0, 10)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Job Seeker&apos;s Name</label>
            <input
              type="text"
              name="jobSeekerName"
              value={clientName}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Counselor&apos;s Name</label>
            <input
              type="text"
              name="counselorName"
              defaultValue={(data.counselorName as string) || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">SE Employment Specialist Name</label>
            <input
              type="text"
              name="seSpecialistName"
              value={(data.seSpecialistName as string) || esName}
              onChange={(e) =>
                setData((prev) => ({ ...prev, seSpecialistName: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">SE Provider Name</label>
            <input
              type="text"
              name="seProviderName"
              value="Joshua Tree Service Group"
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Job Seeker&apos;s Employment Goal</label>
            <input
              type="text"
              name="employmentGoal"
              defaultValue={(data.employmentGoal as string) || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Date Range Report Covers</label>
            <input
              type="text"
              name="dateRangeCovers"
              defaultValue={(data.dateRangeCovers as string) || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Hours of Job Coaching</label>
            <input
              type="text"
              name="hoursOfCoaching"
              defaultValue={(data.hoursOfCoaching as string) || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          {[
            { key: 'medicalConsiderations', label: 'Medical Considerations' },
            { key: 'behavioralHealthConsiderations', label: 'Behavioral Health Considerations' },
            { key: 'sensory', label: 'Sensory' },
            { key: 'assistiveTechnology', label: 'Assistive Technology/Accommodations...' },
            { key: 'releaseOfInformation', label: 'Release of Information/Self-Advocacy' },
            { key: 'jobDevelopment', label: 'Job Development' },
            { key: 'ongoingSupports', label: 'On-going Supports & follow-up' },
            { key: 'potentialBarriers', label: 'Potential Barriers' },
            { key: 'extendedServices', label: 'Extended Services' },
          ].map(({ key, label }) => (
            <div key={key} className="mb-6">
              <label className="block text-gray-700 font-semibold mb-1">{label}</label>
              <textarea
                name={key}
                rows={key === 'jobDevelopment' ? 8 : 4}
                defaultValue={(data[key] as string) || ''}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          ))}
          <button
            type="submit"
            className="w-full mt-6 py-3 px-4 bg-green-700 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300"
          >
            Review & Sign
          </button>
        </form>
      </div>
    </div>
  );
}

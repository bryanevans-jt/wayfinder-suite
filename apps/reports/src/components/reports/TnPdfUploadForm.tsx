'use client';

import { useEffect, useRef, useState } from 'react';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';

interface Props {
  reportName: string;
  reportTypeSlug: string;
  user: { email: string; displayName: string };
  esName: string;
  initialClientName?: string;
  wayfinderClientId?: string | null;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onBack?: () => void;
}

export function TnPdfUploadForm({
  reportName,
  reportTypeSlug,
  user,
  esName,
  initialClientName = '',
  wayfinderClientId = null,
  onSuccess,
  onError,
  onBack,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientName, setClientName] = useState(initialClientName);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  useEffect(() => {
    if (initialClientName) setClientName(initialClientName);
  }, [initialClientName]);

  useEffect(() => {
    setLoadingTemplate(true);
    fetch(`/api/reports/tn/upload?reportTypeSlug=${encodeURIComponent(reportTypeSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templateUrl) setTemplateUrl(data.templateUrl as string);
      })
      .catch(() => {})
      .finally(() => setLoadingTemplate(false));
  }, [reportTypeSlug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
    if (!ext || !validExts.includes(ext)) {
      onError('Please select a PDF, Word document, or Excel spreadsheet.');
      setSelectedFile(null);
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!clientName.trim()) {
      onError('Please enter the customer name.');
      return;
    }
    if (!selectedFile) {
      onError('Please attach the completed document.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('reportTypeSlug', reportTypeSlug);
      formData.append('employmentSpecialistName', esName || user.displayName);
      formData.append('clientName', clientName.trim());
      if (wayfinderClientId) formData.append('wayfinderClientId', wayfinderClientId);
      if (notes.trim()) formData.append('notes', notes.trim());
      formData.append('file', selectedFile);

      const res = await fetch('/api/reports/tn/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      onSuccess(
        data.message ||
          'Report submitted successfully! You will receive a confirmation email with your document attached.'
      );
    } catch (err) {
      onError(`An error occurred: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl mt-10">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-green-600 mb-4">
            ← Back
          </button>
        ) : null}
        <h1 className="text-2xl font-bold mb-2 text-center text-green-800">{reportName}</h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          Download the blank form, print and complete it, then return here to upload the finished document.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
            <p className="font-medium">How this works</p>
            <ol className="mt-2 list-decimal pl-5 space-y-1">
              <li>Download the blank PDF below.</li>
              <li>Print, fill out, and sign per DHS instructions.</li>
              <li>Scan or save as PDF, attach it here, and submit.</li>
            </ol>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Employment Specialist Name</label>
            <input
              type="text"
              value={esName || user.displayName}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Customer Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Step 1 — Download blank form</label>
            {loadingTemplate ? (
              <p className="text-sm text-gray-500">Loading template link...</p>
            ) : templateUrl ? (
              <a
                href={templateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download blank form (PDF)
              </a>
            ) : (
              <p className="text-sm text-amber-700">
                Blank PDF is not configured yet. Ask an admin to set the Blank PDF file ID for this report type.
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Step 2 — Attach completed document
            </label>
            <p className="text-sm text-gray-500 mb-2">
              PDF preferred. Word or Excel also accepted. One file per submission.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            {selectedFile ? (
              <p className="mt-2 text-sm text-green-600">Selected: {selectedFile.name}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Internal notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional note for your records — not printed on the DHS form"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedFile}
            className="w-full py-3 px-4 bg-green-700 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              'Submit completed form'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

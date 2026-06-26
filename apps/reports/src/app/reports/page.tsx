'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StateSelector } from '@/components/reports/StateSelector';
import { ReportSelection } from '@/components/reports/ReportSelection';
import { ClientPicker, type ClientSelection } from '@/components/reports/ClientPicker';
import { SEMonthlyForm } from '@/components/reports/SEMonthlyForm';
import { VPRForm } from '@/components/reports/VPRForm';
import { JTSGVMRForm } from '@/components/reports/JTSGVMRForm';
import { EVFForm } from '@/components/reports/EVFForm';
import { JTSGTSVSForm } from '@/components/reports/JTSGTSVSForm';
import { TnDynamicForm } from '@/components/reports/TnDynamicForm';
import { TnPdfUploadForm } from '@/components/reports/TnPdfUploadForm';
import { ReviewAndSign } from '@/components/reports/ReviewAndSign';
import { SubmissionStatus } from '@/components/reports/SubmissionStatus';
import { withReportSupportHint } from '@/lib/report-errors';
import { resolveReportingEsName } from '@/lib/es-display-name';
import type { TnReportSelection } from '@/components/reports/ReportSelection';
import { tagSchemaLabels, tagSchemaOrderedKeys } from '@/lib/tag-schema';

type Screen =
  | 'STATE_SELECTION'
  | 'REPORT_SELECTION'
  | 'CLIENT_PICKER'
  | 'REPORT_FORM'
  | 'VPR_FORM'
  | 'JTSG_VMR_FORM'
  | 'JTSG_TSVS_FORM'
  | 'EVF_FORM'
  | 'TN_FORM'
  | 'TN_PDF_UPLOAD'
  | 'TN_REVIEW_AND_SIGN'
  | 'REVIEW_AND_SIGN'
  | 'JTSG_VMR_REVIEW'
  | 'SUBMISSION_STATUS';

type ReportingState = 'GA' | 'TN';
type ReportType = 'seMonthly' | 'vpr' | 'jtsgvmr' | 'evf' | 'jtsgtsvs';

function ReportsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ email: string; displayName: string } | null>(null);
  const [screen, setScreen] = useState<Screen>('STATE_SELECTION');
  const [selectedState, setSelectedState] = useState<ReportingState | ''>('');
  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [esName, setEsName] = useState('');
  const [clientName, setClientName] = useState('');
  const [wayfinderClientId, setWayfinderClientId] = useState<string | null>(null);
  const [adHocClient, setAdHocClient] = useState(false);
  const [reportData, setReportData] = useState<Record<string, unknown>>({});
  const [typedEsName, setTypedEsName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [tnReport, setTnReport] = useState<TnReportSelection | null>(null);
  const [tnFieldLabels, setTnFieldLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadAuth() {
      const AUTH_TIMEOUT_MS = 15000;
      try {
        const authResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Auth check timed out')), AUTH_TIMEOUT_MS)
          ),
        ]);
        const {
          data: { user },
          error: userError,
        } = authResult;

        if (cancelled) return;

        if (userError || !user) {
          router.replace('/login?next=/reports');
          return;
        }

        const email = user.email || '';
        if (!email.endsWith('@thejoshuatree.org')) {
          router.replace('/login?error=org_only');
          return;
        }

        const resolvedEsName = resolveReportingEsName(null, user.user_metadata);

        setUser({
          email,
          displayName: resolvedEsName || email,
        });
        setEsName(resolvedEsName);
        setLoading(false);
      } catch (err) {
        console.error('Reports auth init failed:', err);
        if (!cancelled) {
          setAuthError(
            err instanceof Error && err.message === 'Auth check timed out'
              ? 'Sign-in is taking too long. Try refreshing, or sign out and use your passkey again.'
              : 'Could not verify your session. Try signing in again.'
          );
          setLoading(false);
        }
      }
    }

    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (loading || deepLinkHandled) return;

    const report = searchParams.get('report') as ReportType | null;
    const client = searchParams.get('client')?.trim() ?? '';
    const es = searchParams.get('es')?.trim();
    const clientId = searchParams.get('clientId')?.trim() ?? null;

    if (es) setEsName(es);
    if (client) setClientName(client);
    if (clientId) {
      setWayfinderClientId(clientId);
      setAdHocClient(false);
    }

    if (report && (report === 'seMonthly' || report === 'jtsgvmr')) {
      setSelectedState('GA');
      setReportType(report);
      if (client) {
        setScreen('CLIENT_PICKER');
      }
    } else if (report) {
      setSelectedState('GA');
      setReportType(report);
      if (report === 'vpr') setScreen('VPR_FORM');
      else if (report === 'evf') setScreen('EVF_FORM');
      else if (report === 'jtsgtsvs') {
        setScreen('JTSG_TSVS_FORM');
      }
    }

    setDeepLinkHandled(true);
  }, [loading, deepLinkHandled, searchParams]);

  function afterClientSelected(selection: ClientSelection) {
    setClientName(selection.clientName);
    setWayfinderClientId(selection.wayfinderClientId);
    setAdHocClient(selection.adHoc);

    if (selectedState === 'TN' && tnReport) {
      setReportData({});
      setScreen(tnReport.templateKind === 'pdf_upload' ? 'TN_PDF_UPLOAD' : 'TN_FORM');
      return;
    }

    if (reportType === 'seMonthly') {
      setReportData({
        jobSeekerName: selection.clientName,
        seSpecialistName: esName,
        seProviderName: 'Joshua Tree Service Group',
        counselorName: selection.counselorName ?? '',
        employmentGoal: selection.employmentGoal ?? '',
      });
      setScreen('REPORT_FORM');
    } else if (reportType === 'jtsgvmr') {
      setReportData({
        ClientName: selection.clientName,
        ESName: esName,
        EmploymentSpecialistName: esName,
      });
      setScreen('JTSG_VMR_FORM');
    }
  }

  async function submitTnReport(
    data: Record<string, unknown>,
    capturedSignature: string,
    typedNameValue: string
  ) {
    if (!tnReport) return;
    setSubmitError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/reports/tn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportTypeSlug: tnReport.slug,
          reportData: data,
          typedEsName: typedNameValue || typedEsName || esName,
          signatureData: capturedSignature || '',
          wayfinderClientId,
        }),
      });
      const payload = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      if (!res.ok) throw new Error(payload.error || 'Submission failed');
      setMessage('Report submitted! You will receive an email with the final PDF shortly.');
      setScreen('SUBMISSION_STATUS');
    } catch (e) {
      setSubmitError(withReportSupportHint((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  function afterTnFormContinue(data: Record<string, unknown>) {
    setReportData(data);
    if (tnReport?.requiresSignature) {
      setTypedEsName(esName);
      setScreen('TN_REVIEW_AND_SIGN');
      return;
    }
    void submitTnReport(data, '', esName);
  }

  function afterReportType(type: ReportType) {
    setReportType(type);
    if (type === 'seMonthly' || type === 'jtsgvmr') {
      setScreen('CLIENT_PICKER');
    } else if (type === 'vpr') {
      setScreen('VPR_FORM');
    } else if (type === 'evf') {
      setScreen('EVF_FORM');
    } else if (type === 'jtsgtsvs') {
      setScreen('JTSG_TSVS_FORM');
    }
  }

  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-lg">
          <p className="text-amber-950">{authError}</p>
          <Link
            href="/login?next=/reports"
            className="mt-6 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div id="message-container" className="fixed top-4 right-4 z-50" />
      <div className="p-4">
        <Link href="/" className="text-sm text-gray-500 hover:text-green-600 mb-4 inline-block">
          ← Back to Home
        </Link>
      </div>

      {screen === 'STATE_SELECTION' && (
        <StateSelector
          user={user}
          onSelect={(state) => {
            setSelectedState(state);
            setScreen('REPORT_SELECTION');
          }}
        />
      )}

      {screen === 'REPORT_SELECTION' && selectedState && (
        <ReportSelection
          user={user}
          state={selectedState}
          onSelectGa={afterReportType}
          onSelectTn={(report) => {
            setTnReport(report);
            setTnFieldLabels(tagSchemaLabels(report.tagSchema));
            setScreen('CLIENT_PICKER');
          }}
          onBack={() => {
            setSelectedState('');
            setReportType('');
            setTnReport(null);
            setScreen('STATE_SELECTION');
          }}
        />
      )}

      {screen === 'CLIENT_PICKER' && selectedState && (reportType || tnReport) && (
        <ClientPicker
          state={selectedState}
          esName={esName}
          initialClientId={wayfinderClientId}
          initialClientName={clientName}
          onContinue={afterClientSelected}
          onBack={() => setScreen('REPORT_SELECTION')}
        />
      )}

      {screen === 'TN_FORM' && tnReport && (
        <>
          {submitError ? (
            <div className="mx-4 mb-4 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg">
              <p className="font-semibold">Submission failed</p>
              <p className="text-sm mt-1">{submitError}</p>
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-700" />
            </div>
          ) : (
            <TnDynamicForm
              reportName={tnReport.name}
              tagSchema={tnReport.tagSchema}
              esName={esName}
              requiresSignature={tnReport.requiresSignature}
              wayfinderClientId={wayfinderClientId}
              adHoc={adHocClient}
              onContinue={afterTnFormContinue}
              onBack={() => setScreen('CLIENT_PICKER')}
            />
          )}
        </>
      )}

      {screen === 'TN_PDF_UPLOAD' && tnReport && user && (
        <TnPdfUploadForm
          reportName={tnReport.name}
          reportTypeSlug={tnReport.slug}
          user={user}
          esName={esName}
          initialClientName={clientName}
          wayfinderClientId={wayfinderClientId}
          onSuccess={(msg) => {
            setMessage(msg);
            setScreen('SUBMISSION_STATUS');
          }}
          onError={(msg) => setMessage(msg)}
          onBack={() => setScreen('CLIENT_PICKER')}
        />
      )}

      {screen === 'TN_REVIEW_AND_SIGN' && tnReport && (
        <>
          {submitError ? (
            <div className="mx-4 mb-4 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg">
              <p className="font-semibold">Submission failed</p>
              <p className="text-sm mt-1">{submitError}</p>
            </div>
          ) : null}
          <ReviewAndSign
            variant="tn"
            reportData={reportData}
            typedEsName={typedEsName}
            signatureData={signatureData}
            onSignatureChange={setSignatureData}
            onTypedNameChange={setTypedEsName}
            orderedKeys={tagSchemaOrderedKeys(tnReport.tagSchema)}
            fieldLabels={tnFieldLabels}
            typedNameLabel="Evaluator Typed Name"
            signatureLabel="CRP Signature"
            onSubmit={async (capturedSignature, typedNameValue) => {
              await submitTnReport(reportData, capturedSignature, typedNameValue);
            }}
            onBack={() => {
              setSubmitError(null);
              setScreen('TN_FORM');
            }}
          />
        </>
      )}

      {screen === 'REPORT_FORM' && (
        <SEMonthlyForm
          clientName={clientName}
          esName={esName}
          wayfinderClientId={wayfinderClientId}
          adHoc={adHocClient}
          initialData={reportData}
          onReview={(data) => {
            setReportData(data);
            setTypedEsName(data.seSpecialistName as string);
            setScreen('REVIEW_AND_SIGN');
          }}
          onBack={() => setScreen('CLIENT_PICKER')}
        />
      )}

      {screen === 'VPR_FORM' && (
        <VPRForm
          user={user}
          onSuccess={(msg) => {
            setMessage(msg);
            setScreen('SUBMISSION_STATUS');
          }}
          onError={(msg) => setMessage(msg)}
        />
      )}

      {screen === 'JTSG_VMR_FORM' && (
        <JTSGVMRForm
          initialData={reportData}
          onReview={(data) => {
            setReportData(data);
            setTypedEsName((data.EmploymentSpecialistName as string) || (data.ESName as string));
            setScreen('JTSG_VMR_REVIEW');
          }}
        />
      )}

      {screen === 'JTSG_TSVS_FORM' && (
        <JTSGTSVSForm
          user={user}
          esName={esName}
          initialClientName={clientName}
          wayfinderClientId={wayfinderClientId}
          onSuccess={(msg) => {
            setMessage(msg);
            setScreen('SUBMISSION_STATUS');
          }}
          onError={(msg) => setMessage(msg)}
        />
      )}

      {screen === 'EVF_FORM' && (
        <EVFForm
          user={user}
          onSuccess={(msg) => {
            setMessage(msg);
            setScreen('SUBMISSION_STATUS');
          }}
          onError={(msg) => setMessage(msg)}
        />
      )}

      {screen === 'REVIEW_AND_SIGN' && reportType === 'seMonthly' && (
        <>
          {submitError ? (
            <div className="mx-4 mb-4 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg">
              <p className="font-semibold">Submission failed</p>
              <p className="text-sm mt-1">{submitError}</p>
            </div>
          ) : null}
          <ReviewAndSign
            variant="seMonthly"
            reportData={reportData}
            typedEsName={typedEsName}
            signatureData={signatureData}
            onSignatureChange={setSignatureData}
            onTypedNameChange={setTypedEsName}
            onSubmit={async (capturedSignature, typedNameValue) => {
              setSubmitError(null);
              setLoading(true);
              try {
                const res = await fetch('/api/reports/se-monthly', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    reportData,
                    typedEsName: typedNameValue || typedEsName,
                    signatureData: capturedSignature,
                    wayfinderClientId,
                  }),
                });
                const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
                if (!res.ok) throw new Error(data.error || 'Submission failed');
                setMessage('Report submitted! You will receive an email with the final PDF shortly.');
                setScreen('SUBMISSION_STATUS');
              } catch (e) {
                setSubmitError(withReportSupportHint((e as Error).message));
              } finally {
                setLoading(false);
              }
            }}
            onBack={() => {
              setSubmitError(null);
              setScreen('REPORT_FORM');
            }}
          />
        </>
      )}

      {screen === 'JTSG_VMR_REVIEW' && reportType === 'jtsgvmr' && (
        <>
          {submitError ? (
            <div className="mx-4 mb-4 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg">
              <p className="font-semibold">Submission failed</p>
              <p className="text-sm mt-1">{submitError}</p>
            </div>
          ) : null}
          <ReviewAndSign
            variant="jtsgvmr"
            reportData={reportData}
            typedEsName={typedEsName}
            signatureData={signatureData}
            onSignatureChange={setSignatureData}
            onTypedNameChange={setTypedEsName}
            onSubmit={async (capturedSignature, typedNameValue) => {
              setSubmitError(null);
              setLoading(true);
              try {
                const res = await fetch('/api/reports/jtsg-vmr', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    reportData,
                    typedEsName: typedNameValue || typedEsName,
                    signatureData: capturedSignature,
                    wayfinderClientId,
                  }),
                });
                const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
                if (!res.ok) throw new Error(data.error || 'Submission failed');
                setMessage('Report submitted! You will receive an email with the final PDF shortly.');
                setScreen('SUBMISSION_STATUS');
              } catch (e) {
                setSubmitError(withReportSupportHint((e as Error).message));
              } finally {
                setLoading(false);
              }
            }}
            onBack={() => {
              setSubmitError(null);
              setScreen('JTSG_VMR_FORM');
            }}
          />
        </>
      )}

      {screen === 'SUBMISSION_STATUS' && (
        <SubmissionStatus
          message={message}
          onHome={() => router.push('/')}
          onSubmitAnother={() => {
            setScreen('STATE_SELECTION');
            setReportType('');
            setSelectedState('');
            setTnReport(null);
            setWayfinderClientId(null);
            setAdHocClient(false);
            setSubmitError(null);
          }}
        />
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-700" />
        </div>
      }
    >
      <ReportsWorkspace />
    </Suspense>
  );
}

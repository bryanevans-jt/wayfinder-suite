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
import { ReviewAndSign } from '@/components/reports/ReviewAndSign';
import { SubmissionStatus } from '@/components/reports/SubmissionStatus';
import { withReportSupportHint } from '@/lib/report-errors';
import { resolveReportingEsName } from '@/lib/es-display-name';

type Screen =
  | 'STATE_SELECTION'
  | 'REPORT_SELECTION'
  | 'CLIENT_PICKER'
  | 'REPORT_FORM'
  | 'VPR_FORM'
  | 'JTSG_VMR_FORM'
  | 'JTSG_TSVS_FORM'
  | 'EVF_FORM'
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const email = user.email || '';
      if (!email.endsWith('@thejoshuatree.org')) {
        router.push('/login?error=org_only');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      const resolvedEsName = resolveReportingEsName(profile, user.user_metadata);

      setUser({
        email,
        displayName: resolvedEsName || email,
      });
      setEsName(resolvedEsName);
      setLoading(false);
    });
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
          onBack={() => {
            setSelectedState('');
            setReportType('');
            setScreen('STATE_SELECTION');
          }}
        />
      )}

      {screen === 'CLIENT_PICKER' && selectedState && reportType && (
        <ClientPicker
          state={selectedState}
          esName={esName}
          initialClientId={wayfinderClientId}
          initialClientName={clientName}
          onContinue={afterClientSelected}
          onBack={() => setScreen('REPORT_SELECTION')}
        />
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

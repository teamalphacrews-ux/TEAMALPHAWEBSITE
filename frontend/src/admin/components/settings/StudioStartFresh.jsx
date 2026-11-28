import { useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { saasRequest, workspaceId } from '../../../saas/api';
import { RESET_CONFIRMATION } from '../../../utils/workspaceReset';
import StudioButton from '../common/StudioButton';
import { OperationsError, OperationsLoading, OperationsModal } from '../operations/OperationsUI';
import './studioStartFresh.css';

const resetPath = '/workspace/reset';

function resetRequest(options, controller, timeout) {
  const timer = window.setTimeout(() => controller.abort(), timeout);
  return saasRequest(resetPath, { ...options, signal: controller.signal }).finally(() => window.clearTimeout(timer));
}

function StudioResetReview({ token, studioId, studioName, onClose, onComplete }) {
  const formId = useId();
  const [attempt, setAttempt] = useState(0);
  const [review, setReview] = useState(null);
  const [submissionError, setSubmissionError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingReset = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    resetRequest({ expectedToken: token }, controller, 15000).then(status => {
      if (!active) return;
      if (status.workspaceId !== studioId || !Number.isSafeInteger(status.revision) || status.revision < 0 ||
        typeof status.requiresPassword !== 'boolean' || typeof status.eligible !== 'boolean') {
        throw new Error('The studio could not confirm reset readiness. Close this review and check your active studio.');
      }
      setReview({ status });
    }).catch(failure => {
      if (active) setReview({ error: controller.signal.aborted ? 'The studio took too long to respond. Try checking again.' : failure.message });
    });
    return () => { active = false; controller.abort(); };
  }, [attempt, studioId, token]);

  useEffect(() => () => {
    pendingReset.current?.abort();
    pendingReset.current = null;
  }, []);

  const status = review?.status;
  const canSubmit = status?.eligible === true && confirmation === RESET_CONFIRMATION &&
    (!status.requiresPassword || Boolean(password)) && !busy;

  const checkAgain = () => {
    setReview(null);
    setSubmissionError('');
    setAttempt(previous => previous + 1);
  };

  const submit = async event => {
    event.preventDefault();
    if (!canSubmit || pendingReset.current) return;
    const controller = new AbortController();
    pendingReset.current = controller;
    setBusy(true);
    setSubmissionError('');
    const body = { revision: status.revision, confirmation, ...(status.requiresPassword ? { password } : {}) };
    setPassword('');
    try {
      const result = await resetRequest({ method: 'POST', expectedToken: token, body }, controller, 60000);
      if (pendingReset.current !== controller || localStorage.getItem('token') !== token) return;
      if (result.success !== true || result.setupRequired !== true) throw new Error('The server did not confirm the reset.');
      onComplete();
    } catch (failure) {
      if (pendingReset.current !== controller) return;
      const uncertain = !failure.status || failure.status >= 500;
      if (uncertain || failure.code === 'WORKSPACE_RESET_STALE' || failure.code === 'WORKSPACE_RESET_REAUTH_REQUIRED') {
        setConfirmation('');
        setReview({ error: uncertain ? 'The reset could not be confirmed. Reload this page to check your studio before trying again.' : failure.message, reload: uncertain });
      } else {
        setSubmissionError(failure.message);
      }
    } finally {
      if (pendingReset.current === controller) {
        pendingReset.current = null;
        setBusy(false);
      }
    }
  };

  const name = status?.workspaceName || studioName || 'this studio';
  return <OperationsModal title="Reset studio data" description={`Permanently delete the data for ${name} and return to studio setup.`}
    onClose={onClose} busy={busy} footer={<>
      <StudioButton type="button" disabled={busy} onClick={onClose}>Cancel</StudioButton>
      <StudioButton type="submit" form={formId} variant="destructive" disabled={!canSubmit} loading={busy} loadingLabel="Deleting studio data">Delete studio data</StudioButton>
    </>}>
    <form id={formId} className="studio-start-fresh-form" onSubmit={submit}>
      <div className="studio-start-fresh-summary">
        <p>This clears studio settings, contacts, enquiries, projects, quotes, invoices, payment records, schedules, tasks, messages and recovery history. It also removes team access and disconnects integrations for this studio.</p>
        <p>Set up the studio again with your owner account and current plan. Manage external photos and copies in the service where they’re stored.</p>
      </div>
      {!review && <OperationsLoading label="Checking reset access…" />}
      {review?.error && <OperationsError onRetry={review.reload ? undefined : checkAgain}>{review.error}</OperationsError>}
      {review?.reload && <StudioButton type="button" onClick={() => window.location.reload()}>Reload studio</StudioButton>}
      {status?.eligible === false && <OperationsError onRetry={checkAgain}>{status.msg || 'Reset access is currently unavailable. Check your sign-in and try again.'}</OperationsError>}
      {status?.eligible && <>
        <label className="studio-field">Type <strong>{RESET_CONFIRMATION}</strong> to confirm
          <input className="studio-input" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={RESET_CONFIRMATION.length} required disabled={busy}
            value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        </label>
        {status.requiresPassword && <label className="studio-field">Current owner password
          <input className="studio-input" type="password" autoComplete="current-password" required disabled={busy}
            value={password} onChange={event => { setPassword(event.target.value); setSubmissionError(''); }} />
        </label>}
      </>}
      {submissionError && <OperationsError>{submissionError}</OperationsError>}
    </form>
  </OperationsModal>;
}

export default function StudioStartFresh({ disabled, onComplete }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const studioId = workspaceId(user.workspace);
  return <section className="studio-start-fresh" aria-labelledby="studio-start-fresh-title">
    <div><h3 id="studio-start-fresh-title">Start fresh</h3><p>Delete this studio’s records and set up the workspace again.</p></div>
    <StudioButton type="button" icon={Trash2} disabled={disabled || !token || !studioId} onClick={() => setOpen(true)}>Reset studio data</StudioButton>
    {open && <StudioResetReview key={studioId} token={token} studioId={studioId} studioName={user.workspace.name} onClose={() => setOpen(false)} onComplete={onComplete} />}
  </section>;
}

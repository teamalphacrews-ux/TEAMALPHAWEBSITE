import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Check, Download, LockKeyhole, RefreshCw, X } from 'lucide-react';
import useStudioDialog from '../studio/useStudioDialog';
import { canConfirmReset, RESET_CONFIRMATION, resetReadiness } from '../../../utils/workspaceReset';

const steps = ['Review data', 'Save backup', 'Confirm reset'];
const labels = { StudioConfig: 'Company settings', User: 'Other team accounts', StudioContact: 'Contacts', StudioProject: 'Projects', Lead: 'Enquiries', Quotation: 'Quotations', Invoice: 'Invoices', Task: 'Production tasks', Photographer: 'Crew' };

export default function WorkspaceResetDialog({ summary, preview, busy, error, onClose, onRefresh, onBackup, onDownload, onReset }) {
  const [step, setStep] = useState(0), [password, setPassword] = useState('');
  const [backupId, setBackupId] = useState(null), [downloaded, setDownloaded] = useState(false), [savedCopy, setSavedCopy] = useState(false);
  const [phrase, setPhrase] = useState(''), [acknowledged, setAcknowledged] = useState(false);
  const heading = useRef(null), body = useRef(null);
  const dialogRef = useStudioDialog(onClose, { canClose: !busy });
  const readiness = resetReadiness(summary, { preview });
  const allowed = canConfirmReset({ summary, preview, backupId, savedCopy, acknowledged, phrase, password, busy });
  useEffect(() => { heading.current?.focus({ preventScroll: true }); body.current?.scrollTo(0, 0); }, [step]);
  const backup = async () => {
    const success = backupId ? await onDownload(backupId) : await onBackup(password, setBackupId);
    if (success) setDownloaded(true);
  };
  return createPortal(<div className="studio-app studio-personal-workspace workspace-backup-overlay">
    <div ref={dialogRef} className="workspace-backup-dialog workspace-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-reset-title" aria-describedby="workspace-reset-description" aria-busy={busy}>
      <header><div><h2 id="workspace-reset-title">Reset studio data</h2><p id="workspace-reset-description">Review, back up, then confirm. Nothing is deleted during review.</p></div><button type="button" className="studio-icon-button" aria-label="Close reset review" disabled={busy} onClick={onClose}><X size={20} /></button></header>
      <ol className="workspace-reset-steps" aria-label="Reset progress">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-complete={step > index}><span aria-hidden="true">{step > index ? <Check size={14} /> : index + 1}</span>{label}</li>)}</ol>
      <div ref={body} className="workspace-backup-dialog-body">
        <h3 ref={heading} tabIndex={-1} className="workspace-reset-step-title">{steps[step]}</h3>
        {step === 0 && <>
          <div className="workspace-reset-consequences"><strong>This permanently deletes your studio records.</strong><p>Company settings, contacts, enquiries, projects, quotes, invoices, payments, crew, tasks, messages and other team accounts are removed. Existing client links stop working.</p><p>Your owner sign-in and recovery archives are kept. Photo and video originals in external services are kept.</p></div>
          <details className="workspace-reset-records"><summary>View affected records</summary><dl className="workspace-backup-counts">{Object.entries(summary?.counts || {}).map(([name, value]) => [name, name === 'User' ? Math.max(0, value - 1) : value]).filter(([, value]) => value > 0).map(([name, value]) => <div key={name}><dt>{labels[name] || name}</dt><dd>{value}</dd></div>)}</dl>{!summary && <p>Record counts are available after owner sign-in and a successful server check.</p>}</details>
        </>}
        {(step === 0 || step === 2) && <div className="workspace-reset-readiness" role="status" data-ready={readiness.ready}>
          {readiness.ready ? <Check size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}<div><strong>{readiness.title}</strong><p>{readiness.message}</p></div>
          {!preview && <button type="button" className="studio-button small" disabled={busy} onClick={onRefresh}><RefreshCw size={16} />Check again</button>}
        </div>}
        {step === 0 && summary?.blockers?.length > 0 && <details className="workspace-reset-records"><summary>Server details</summary><ul>{summary.blockers.map(message => <li key={message}>{message}</li>)}</ul></details>}
        {step === 1 && <>
          <p>Create an encrypted backup and save it outside Studio OS. Keep the original server recovery key safe; you need it to restore the file.</p>
          {!backupId && <label className="studio-field">Current owner password<input className="studio-input" type="password" autoComplete="current-password" disabled={busy || preview} value={password} onChange={event => setPassword(event.target.value)} /></label>}
          <button type="button" className="studio-button primary workspace-reset-backup-button" disabled={busy || preview || !summary?.keyConfigured || (!backupId && !password)} onClick={backup}>{backupId ? <Download size={17} /> : <Archive size={17} />}{busy ? 'Preparing backup…' : backupId ? 'Download backup again' : 'Create and download backup'}</button>
          {backupId && <p className="workspace-backup-callout" role="status">{downloaded ? 'Backup created. The file download or device save was started.' : 'Backup created on the server. Retry the download to save your copy.'}</p>}
          <p>On iPhone, save the file to Files → iCloud Drive. On a computer, keep it in your chosen backup folder or upload it to Google Drive.</p>
          <label className="workspace-backup-ack"><input type="checkbox" disabled={busy || !downloaded} checked={savedCopy} onChange={event => setSavedCopy(event.target.checked)} /><span>I have checked that my backup file is saved outside Studio OS.</span></label>
          {preview && <p className="workspace-backup-callout">Sign in with your saved studio owner account to create a backup. This preview cannot change data.</p>}
        </>}
        {step === 2 && <>
          <p className="workspace-backup-warning"><strong>Reset cannot be undone with a button.</strong> You must restore your encrypted backup to recover records. You will be signed out after a successful reset.</p>
          <label className="workspace-backup-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand that all studio records and other team accounts will be deleted.</span></label>
          <label className="studio-field">Type {RESET_CONFIRMATION}<input className="studio-input" autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} value={phrase} onChange={event => setPhrase(event.target.value)} /></label>
          <label className="studio-field">Current owner password<input className="studio-input" type="password" autoComplete="current-password" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
          <p>The server rechecks your owner password and readiness, then creates another safety archive before deletion. If a required step fails, the reset is cancelled.</p>
        </>}
        {error && <div className="studio-error" role="alert">{error}</div>}
      </div>
      <footer><button type="button" className="studio-button" disabled={busy} onClick={() => step ? setStep(step - 1) : onClose()}>{step ? 'Back' : 'Cancel'}</button>
        {step === 0 ? <button type="button" className="studio-button primary" disabled={busy} onClick={() => setStep(1)}>Continue to backup</button> : step === 1 ? <button type="button" className="studio-button primary" disabled={busy || !backupId || !savedCopy} onClick={() => setStep(2)}>Continue to confirmation</button> : <button type="button" className="studio-button danger" disabled={!allowed} onClick={() => onReset({ password, confirmation: phrase })}>{busy ? 'Please wait…' : 'Permanently reset studio data'}</button>}
      </footer>
    </div>
  </div>, document.body);
}

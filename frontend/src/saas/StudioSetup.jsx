import { cloneElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImagePlus, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { normalizeOverviewPreferences } from '../utils/overviewPreferences';
import StudioProductBrand from '../components/StudioProductBrand';
import API from '../utils/apiConfig';
import { confirmProfileImage, isStudioProfileImagePath, resolveProfileImage } from '../utils/studioProfileImage';
import { installStudioBrowserTheme } from '../utils/studioBrowserTheme';
import RestartPreviewLink from './RestartPreviewLink';
import { changedSetupFields } from './studioSetupAccess';
import { saasRequest } from './api';
import './studioSetup.css';

const steps = [
  { title: 'Studio profile', short: 'Profile', description: 'Choose the name and logo your clients will see.', keys: ['studioName', 'legalName', 'website', 'logoUrl'] },
  { title: 'Contact details', short: 'Contact', description: 'Add the contact details clients can use to reach your studio.', keys: ['email', 'phone', 'whatsappNumber', 'address', 'instagramUrl', 'facebookUrl'] },
  { title: 'Document defaults', short: 'Documents', description: 'Set the starting values for new quotes and invoices. You can change these later in Settings.', keys: ['quotationPrefix', 'invoicePrefix', 'quotationValidityDays', 'invoiceDueDays', 'gstin'] },
];
const fields = {
  studioName: { label: 'Studio name', required: true, maxLength: 120, autoComplete: 'organization' },
  legalName: { label: 'Legal business name', maxLength: 200, help: 'Use the registered name if it differs from your studio name.' },
  website: { label: 'Website', type: 'url', autoComplete: 'url', placeholder: 'https://yourstudio.com', maxLength: 500 },
  instagramUrl: { label: 'Instagram', type: 'url', maxLength: 2000, placeholder: 'https://www.instagram.com/yourstudio' },
  facebookUrl: { label: 'Facebook', type: 'url', maxLength: 2000, placeholder: 'https://www.facebook.com/yourstudio' },
  email: { label: 'Studio email', type: 'email', autoComplete: 'email', required: true, maxLength: 254 },
  phone: { label: 'Phone number', type: 'tel', autoComplete: 'tel', maxLength: 40 },
  whatsappNumber: { label: 'WhatsApp number', type: 'tel', maxLength: 30, help: 'Include your country code.' },
  address: { label: 'Studio address', multiline: true, autoComplete: 'street-address', maxLength: 1000 },
  quotationPrefix: { label: 'Quotation prefix', required: true, maxLength: 16 },
  invoicePrefix: { label: 'Invoice prefix', required: true, maxLength: 16 },
  quotationValidityDays: { label: 'Quote valid for', type: 'number', unit: 'days', min: 1, max: 365, required: true },
  invoiceDueDays: { label: 'Invoice due after', type: 'number', unit: 'days', min: 0, max: 730, required: true },
  gstin: { label: 'GSTIN', maxLength: 15, help: 'Add your 15-character tax ID if your studio is registered for GST.' },
};

function validateDetails(step, values) {
  const errors = {};
  for (const key of steps[step - 1].keys) {
    const field = fields[key];
    if (!field) continue;
    const value = String(values[key] ?? '').trim();
    if (field.required && !value) errors[key] = 'Enter a value for ' + field.label.toLowerCase() + '.';
    else if (!value) continue;
    else if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[key] = 'Enter an email address, such as hello@yourstudio.com.';
    else if (field.type === 'url') {
      const domains = { instagramUrl: ['instagram.com'], facebookUrl: ['facebook.com', 'fb.com'] }[key];
      const message = domains ? 'Use an HTTPS link to your ' + field.label + ' page.' : 'Enter a website address starting with https://.';
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || (domains && !domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)))) errors[key] = message;
      } catch { errors[key] = message; }
    } else if (key === 'whatsappNumber' && !/^[1-9]\d{6,14}$/.test(value.replace(/[\s()+-]/g, ''))) {
      errors[key] = 'Include the country code and enter 7 to 15 digits.';
    } else if (key.endsWith('Prefix') && !/^[A-Z0-9][A-Z0-9_-]{0,15}$/i.test(value)) {
      errors[key] = 'Start with a letter or number. Use up to 16 letters, numbers, hyphens or underscores.';
    } else if (field.type === 'number' && (!/^\d+$/.test(value) || Number(value) < field.min || Number(value) > field.max)) {
      errors[key] = 'Enter a whole number from ' + field.min + ' to ' + field.max + '.';
    } else if (key === 'gstin' && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(value)) {
      errors[key] = 'Enter a valid 15-character GSTIN or leave the field empty.';
    }
  }
  return errors;
}

function setupTheme(storageKey, media) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved?.theme) {
      const { theme } = normalizeOverviewPreferences(saved);
      if (theme !== 'system') return theme;
    } else if (document.documentElement.dataset.studioAppearance) {
      return document.documentElement.dataset.studioAppearance;
    }
  } catch { /* The device preference remains available with storage disabled. */ }
  return media.matches ? 'dark' : 'light';
}

export function StudioSetupFrame({ children, onSignOut, workspacePicker }) {
  const { user } = useAuth();
  const memberId = user?._id || user?.id || user?.email || 'current';
  const epoch = user?.workspaceDataVersion > 0 ? ':epoch-' + user.workspaceDataVersion : '';
  const storageKey = 'teamalpha-studio-preferences:' + memberId + epoch;
  const [theme, setTheme] = useState(() => setupTheme(storageKey, window.matchMedia('(prefers-color-scheme: dark)')));
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(setupTheme(storageKey, media));
    const syncCache = event => { if (event.key === null || event.key === storageKey) update(); };
    update();
    media.addEventListener('change', update);
    window.addEventListener('storage', syncCache);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', syncCache);
    };
  }, [storageKey]);
  useLayoutEffect(() => installStudioBrowserTheme(document, theme), [theme]);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Studio setup · Studio X OS';
    return () => { document.title = previous; };
  }, []);
  return <div className="studio-setup" data-studio-theme={theme}>
    <header className="studio-setup-header"><StudioProductBrand />
      <div className="studio-setup-account">{workspacePicker}
        <RestartPreviewLink className="studio-setup-signout" />
        {onSignOut && <button type="button" className="studio-setup-signout" onClick={onSignOut}><LogOut size={16} aria-hidden="true" />Sign out</button>}
      </div>
    </header>
    <main className="studio-setup-main">{children}</main>
  </div>;
}

function SetupField({ name, value, onChange, error }) {
  const { label, multiline, help, unit, ...attributes } = fields[name];
  const id = 'studio-setup-' + name;
  const describedBy = [help && id + '-hint', unit && id + '-unit', error && id + '-error'].filter(Boolean).join(' ') || undefined;
  const props = { ...attributes, id, name, value: value ?? '', 'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy, onChange: event => onChange(name, event.target.value) };
  return <div className="studio-setup-field">
    <label htmlFor={id}>{label}{!attributes.required && <small>Optional</small>}</label>
    {multiline ? <textarea {...props} rows={3} /> : <div className={unit ? 'studio-setup-with-unit' : undefined}>
      <input {...props} type={attributes.type || 'text'} inputMode={attributes.type === 'number' ? 'numeric' : undefined}
        autoCapitalize={['email', 'url'].includes(attributes.type) ? 'none' : undefined} />
      {unit && <span id={id + '-unit'}>{unit}</span>}
    </div>}
    {help && <small id={id + '-hint'}>{help}</small>}
    {error && <span className="studio-setup-error" id={id + '-error'}>{error}</span>}
  </div>;
}

function LogoField({ value, onChange, disabled, onBusyChange, sessionToken, validationError }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const controller = useRef(null);
  const fileInput = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const hasLogo = Boolean(value && value !== '/assets/studio-os-mark.svg');
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || controller.current) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image up to 2 MB.'); return;
    }
    if (!sessionToken || localStorage.getItem('token') !== sessionToken) {
      setError('Your active studio changed. Reload the page to continue.'); return;
    }
    const pending = new AbortController();
    controller.current = pending;
    setUploading(true); onBusyChange(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const { data } = await axios.post(API + '/api/studio/profile-images', body,
        { headers: { 'x-auth-token': sessionToken }, signal: pending.signal, timeout: 30000 });
      if (!isStudioProfileImagePath(data?.url)) throw new Error('The studio could not confirm your upload. Choose the file again.');
      await confirmProfileImage(resolveProfileImage(data.url, API), { signal: pending.signal });
      if (!pending.signal.aborted) onChange('logoUrl', data.url);
    } catch (failure) {
      if (!pending.signal.aborted) setError(failure.response?.data?.message || failure.message || 'The upload failed. Choose the file again.');
    } finally {
      if (!pending.signal.aborted) { controller.current = null; setUploading(false); onBusyChange(false); }
    }
  }
  return <div className="studio-setup-logo">
    <div className="studio-setup-logo-preview" aria-hidden="true">{hasLogo ? <img src={resolveProfileImage(value, API)} alt="" /> : <ImagePlus size={24} />}</div>
    <div><span className="studio-setup-label">Document logo <small>Optional</small></span>
      <small>Public studio image · JPEG, PNG or WebP up to 2 MB</small>
      <input type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
      <div className="studio-setup-logo-actions">
        <button type="button" id="studio-setup-logoUrl" aria-describedby={error || validationError ? 'studio-setup-logo-error' : undefined} disabled={disabled || uploading} onClick={() => fileInput.current?.click()}>{uploading ? 'Uploading logo…' : hasLogo ? 'Replace logo' : 'Upload logo'}</button>
        {hasLogo && <button type="button" disabled={disabled || uploading} onClick={() => { onChange('logoUrl', ''); setError(''); }}>Remove</button>}
      </div>
      {(error || validationError) && <span id="studio-setup-logo-error" role="alert" className="studio-setup-error">{error || validationError}</span>}
    </div>
  </div>;
}

export default function StudioSetup({ onComplete, onReturn, onSignOut, workspacePicker, sessionToken }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [needsReload, setNeedsReload] = useState(false);
  const [switchingStudio, setSwitchingStudio] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const request = useRef(null);
  const latestComplete = useRef(onComplete);
  const saved = useRef(null);
  const revision = useRef(0);
  const review = Boolean(onReturn);
  const busy = saving || uploading || switchingStudio;
  const dirty = Boolean(values && Object.keys(changedSetupFields(values, saved.current)).length);
  useEffect(() => {
    if (!dirty || switchingStudio) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    const warnOnBack = event => {
      if (event.navigationType === 'traverse' && event.destination.sameDocument && event.cancelable &&
          !window.confirm('Leave setup and discard unsaved edits? Your saved studio details will be kept.')) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    window.navigation?.addEventListener('navigate', warnOnBack);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.navigation?.removeEventListener('navigate', warnOnBack);
    };
  }, [dirty, switchingStudio]);
  const heading = useRef(null);
  latestComplete.current = onComplete;
  useEffect(() => {
    const controller = new AbortController();
    request.current = null;
    setError(''); setValues(null);
    async function load() {
      try {
        const result = await saasRequest('/setup', { expectedToken: sessionToken, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.workspace?.setupRequired === false && !(review && result.reviewActive)) { await latestComplete.current(result.workspace); return; }
        if (!result.canManage || !result.details || ![1, 2, 3].includes(result.step)) throw new Error('Your studio setup could not be opened. Check your access and try again.');
        saved.current = result.details; revision.current = result.revision ?? 0;
        setNeedsReload(false); setValues(result.details); setStep(result.step);
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    }
    load();
    return () => { controller.abort(); request.current?.abort(); };
  }, [retry, sessionToken, review]);
  function change(name, value) {
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined }));
    setError('');
  }
  function goToStep(next) {
    setStep(next); setErrors({}); setError('');
    requestAnimationFrame(() => heading.current?.focus());
  }
  function confirmDiscard(action) {
    return !request.current && !busy && (!dirty || window.confirm(action + ' and discard unsaved edits? Your saved studio details will be kept.'));
  }
  async function restart() {
    if (!confirmDiscard('Restart setup')) return;
    const controller = new AbortController();
    request.current = controller; setSaving(true); setError('');
    try {
      const result = await saasRequest('/setup/restart', { method: 'POST', body: {}, signal: controller.signal, expectedToken: sessionToken });
      if (controller.signal.aborted) return;
      if (!result.canManage || !result.details || result.step !== 1) throw new Error('Setup could not restart. Try again.');
      if (!review && result.workspace?.setupRequired === false) { await onComplete(result.workspace); return; }
      revision.current = result.revision;
      saved.current = result.details;
      setValues(result.details); setNeedsReload(false); setSocialOpen(false); goToStep(1);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || 'Could not restart setup. Try again.');
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false); }
    }
  }
  function showErrors(next, targetStep = step) {
    setStep(targetStep);
    if (next.instagramUrl || next.facebookUrl) setSocialOpen(true);
    setErrors(next);
    setError('Check the highlighted fields and try again.');
    const first = steps[targetStep - 1].keys.find(key => next[key]);
    requestAnimationFrame(() => document.getElementById('studio-setup-' + first)?.focus());
  }
  async function submit(event) {
    event.preventDefault();
    if (request.current || busy) return;
    const invalid = validateDetails(step, values);
    if (Object.keys(invalid).length) { showErrors(invalid); return; }
    const controller = new AbortController();
    request.current = controller; setSaving(true); setError('');
    try {
      const keys = steps[step - 1].keys;
      const submittedKeys = review ? Object.keys(changedSetupFields(values, saved.current, keys)) : keys;
      const details = Object.fromEntries(submittedKeys.map(key => [key,
        fields[key]?.type === 'number' ? Number(values[key]) : String(values[key] ?? '').trim()]));
      const finishing = step === steps.length;
      const result = await saasRequest(finishing ? '/setup/complete' : '/setup', {
        expectedToken: sessionToken, signal: controller.signal, method: finishing ? 'POST' : 'PATCH', body: { details, revision: revision.current, ...(!finishing && { step }) },
      });
      if (controller.signal.aborted) return;
      if (result.workspace?.setupRequired === false && !result.reviewActive) { await onComplete(result.workspace); return; }
      if (finishing || !result.details) throw new Error('The studio did not confirm this step. Please try again.');
      const otherEdits = changedSetupFields(values, saved.current, Object.keys(values).filter(key => !keys.includes(key)));
      saved.current = result.details; revision.current = result.revision ?? revision.current;
      setValues({ ...result.details, ...otherEdits });
      goToStep(step + 1);
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure.fieldErrors && Object.keys(failure.fieldErrors).length) {
        const failedStep = steps.findIndex(item => item.keys.some(key => failure.fieldErrors[key]));
        showErrors(failure.fieldErrors, failedStep === -1 ? step : failedStep + 1);
      } else {
        if (failure.status === 409) setNeedsReload(true);
        setError(failure.message || 'Could not save your setup. Check your connection and try again.');
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false); }
    }
  }
  const current = steps[step - 1];
  const field = name => <SetupField key={name} name={name} value={values[name]} error={errors[name]} onChange={change} />;
  const title = review ? 'Review your studio setup' : 'Set up your studio';
  const picker = workspacePicker && cloneElement(workspacePicker, {
    beforeSwitch: () => {
      if (!confirmDiscard('Switch studios')) return false;
      setSwitchingStudio(true);
      return true;
    },
    onSwitchError: () => setSwitchingStudio(false),
  });
  return <StudioSetupFrame onSignOut={onSignOut && (() => { if (confirmDiscard('Sign out')) onSignOut(); })} workspacePicker={picker}>
    {review && <button type="button" className="studio-setup-back studio-setup-return" disabled={busy}
      onClick={() => { if (confirmDiscard('Return to Settings')) onReturn(); }}><ArrowLeft size={16} aria-hidden="true" />Return to Settings</button>}
    {!values ? <section className="studio-setup-message" aria-busy={!error}><h1>{title}</h1>
      {error ? <><p role="alert">{error}</p><button type="button" className="studio-setup-secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></> : <p role="status">Loading studio details…</p>}
    </section> : <div className="studio-setup-layout">
      <aside className="studio-setup-overview">
        <h1>{title}</h1>
        <p>{review ? 'Review your saved details. Changes apply when you continue, and your team can keep working.' : 'Complete these three steps to open your workspace. Each step is saved when you continue.'}</p>
        <ol className="studio-setup-progress" aria-label="Setup progress">
          {steps.map((item, index) => <li key={item.title} aria-current={step === index + 1 ? 'step' : undefined} data-done={step > index + 1 || undefined}>
            <span className="studio-setup-step-number">{step > index + 1 ? <Check size={15} aria-label={'Step ' + (index + 1) + ' saved'} /> : index + 1}</span>
            <span>{item.short}</span></li>)}
        </ol>
        {step > 1 && <button type="button" className="studio-setup-back studio-setup-restart" disabled={busy} onClick={restart}>
          <RotateCcw size={15} aria-hidden="true" />Restart setup
        </button>}
      </aside>
      <form className="studio-setup-form" onSubmit={submit} noValidate aria-labelledby="studio-setup-title">
        <header><h2 id="studio-setup-title" ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.description}</p></header>
        <fieldset disabled={busy}>
          <legend className="studio-setup-sr">{current.title}</legend>
          {step === 1 && <>{field('studioName')}{field('legalName')}{field('website')}<LogoField value={values.logoUrl} validationError={errors.logoUrl} onChange={change} disabled={saving} onBusyChange={setUploading} sessionToken={sessionToken} /></>}
          {step === 2 && <>{field('email')}<div className="studio-setup-pair">{field('phone')}{field('whatsappNumber')}</div>{field('address')}
            <div className="studio-setup-disclosure">
              <button type="button" aria-expanded={socialOpen} aria-controls="studio-setup-social" onClick={() => setSocialOpen(value => !value)}>
                <span>Social links <small>Optional</small></span><ChevronDown size={17} aria-hidden="true" />
              </button>
              <div id="studio-setup-social" hidden={!socialOpen}>{field('instagramUrl')}{field('facebookUrl')}</div>
            </div></>}
          {step === 3 && <><div className="studio-setup-pair">{field('quotationPrefix')}{field('invoicePrefix')}</div><div className="studio-setup-pair">{field('quotationValidityDays')}{field('invoiceDueDays')}</div>{field('gstin')}</>}
        </fieldset>
        {error && <p className="studio-setup-error" role="alert">{error}</p>}
        {needsReload && <button type="button" className="studio-setup-secondary" disabled={busy} onClick={() => {
          if (confirmDiscard('Reload saved details')) setRetry(value => value + 1);
        }}>Reload saved details</button>}
        <footer>{step > 1 && <button type="button" className="studio-setup-back" disabled={busy} onClick={() => goToStep(step - 1)}><ArrowLeft size={16} aria-hidden="true" />Back</button>}
          <button type="submit" className="studio-setup-primary" disabled={busy}>
            {saving ? 'Saving…' : step !== 3 ? 'Save and continue' : review ? 'Save and return to Settings' : 'Finish setup and open workspace'}<ArrowRight size={17} aria-hidden="true" />
          </button>
        </footer>
      </form>
    </div>}
  </StudioSetupFrame>;
}

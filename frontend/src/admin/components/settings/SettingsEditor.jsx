import StudioButton from '../common/StudioButton';
import StudioSelect from '../common/StudioSelect';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Plus, Trash2, ExternalLink, Instagram, Facebook, MessageCircle, CalendarDays, UsersRound, Webhook, Mail } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { WorkspaceField, WorkspaceError } from '../operations/WorkspaceUI';
import { workspaceRequest, recordError } from '../operations/workspaceData';
import StudioAppIcon from '../common/StudioAppIcon';
import API from '../../../utils/apiConfig';
import { studioImageUrl, whatsappContactUrl } from '../../../utils/studioIdentity';
import { useAuth } from '../../../context/AuthContext';
import { SettingsGroup } from './SettingsDisclosures';

export function SettingsToggle({ label, description, value, onChange, disabled = false }) {
  const descriptionId = useId();
  return <label className={'settings-toggle studio-switch-control' + (disabled ? ' is-disabled' : '')}><span><strong>{label}</strong>{description && <small id={descriptionId}>{description}</small>}</span><span className="studio-switch-state" aria-hidden="true">{value ? 'On' : 'Off'}</span><input type="checkbox" role="switch" aria-label={label} aria-describedby={description ? descriptionId : undefined} checked={!!value} onChange={event => onChange(event.target.checked)} disabled={disabled} /><span className="settings-switch studio-switch-track" aria-hidden="true" /></label>;
}
function BrandPreview({ values }) {
  const accent = /^#[a-f\d]{6}$/i.test(values.colorTheme || '') ? values.colorTheme : '#34496f';
  const logo = /^(https:\/\/|\/assets\/|\/api\/studio\/profile-images\/)/i.test(values.logoUrl || '') ? values.logoUrl : '';
  const fonts = { modern: 'ui-sans-serif, system-ui, sans-serif', classic: 'Georgia, serif', editorial: 'Bodoni Moda, Georgia, serif' };
  return <aside className="settings-brand-preview" aria-label="Document brand preview" style={{ '--settings-preview-accent': accent }}>
    <div className="settings-brand-preview-label"><span>Live preview</span><small>New document style</small></div>
    <div className="settings-brand-preview-sheet">
      <div className="settings-brand-preview-identity"><img src={studioImageUrl(logo)} alt="Document logo" /><div><strong style={{ fontFamily: fonts[values.fontTheme] || fonts.modern }}>{values.studioName || 'Your studio'}</strong><p>{values.legalName || 'Photography & cinematography'}</p></div></div>
      <p className="settings-brand-preview-address">{values.address || 'Your studio address'}</p>
      <div className="settings-brand-preview-rule" />
      <h4 style={{ fontFamily: fonts[values.fontTheme] || fonts.modern }}>A story, beautifully told.</h4>
      <p>Your logo, typography and accent colour come together on new quotations and invoices.</p>
      <span className="settings-brand-preview-accent">Your signature colour <i aria-hidden="true" /></span>
    </div>
    <small>Style preview only. Existing documents keep their saved design.</small>
  </aside>;
}
const Help = ({ children }) => <p className="settings-help">{children}</p>;
const newId = () => 'tpl-' + Array.from(crypto.getRandomValues(new Uint8Array(10)), n => n.toString(16).padStart(2, '0')).join('');
function ReminderDays({ label, value, onChange }) {
  return <div className="settings-reminder-days"><strong>{label}</strong><div>{value.map((day, index) => <label key={index}>Day<input className="studio-input" type="number" min="1" max="365" value={day} aria-label={label + ' ' + (index + 1)} onChange={event => onChange(value.map((v, i) => i === index ? Number(event.target.value) : v))} /><button type="button" className="studio-icon-button" disabled={value.length <= 1} aria-label={'Remove ' + label + ' ' + (index + 1)} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={13} /></button></label>)}<button type="button" className="studio-button small" disabled={value.length >= 12} onClick={() => onChange([...value, Math.min(365, Math.max(...value) + 7)])}><Plus size={13} />Add day</button></div></div>;
}
function ProfilePhoto({ values, change }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false), [useAsLogo, setUseAsLogo] = useState(true);
  const upload = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { toast.error('Choose a JPEG, PNG or WebP image no larger than 2 MB.'); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.append('image', file);
      const result = await workspaceRequest('post', '/api/studio/profile-images', form);
      if (typeof result.url !== 'string' || !/^\/api\/studio\/profile-images\/[a-f\d]{24}$/i.test(result.url)) throw new Error('Photo upload is unavailable in this preview. Please use the connected Studio OS backend.');
      change('profilePhotoUrl', result.url); if (useAsLogo) change('logoUrl', result.url);
      toast.success('Photo uploaded. Save settings to apply it.');
    } catch (error) { toast.error(recordError(error)); }
    finally { setBusy(false); }
  };
  return <div className="settings-profile-photo"><img src={studioImageUrl(values.profilePhotoUrl || values.logoUrl)} alt="Studio profile" /><div><strong>Studio profile photo</strong><p>JPEG, PNG or WebP · up to 2 MB. Uploaded photos are public brand images.</p><div className="settings-inline-actions"><StudioButton type="button" size="sm" icon={Upload} loadingIcon={Upload} loading={busy} loadingLabel="Uploading studio photo" onClick={() => input.current?.click()}>Update photo</StudioButton>{values.profilePhotoUrl && <button type="button" className="studio-button small" onClick={() => change('profilePhotoUrl', '')}>Remove photo</button>}</div><label className="settings-check"><input type="checkbox" checked={useAsLogo} onChange={event => setUseAsLogo(event.target.checked)} />Use uploaded photo as the logo on new documents</label><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden /></div></div>;
}
function EmailStatus() {
  const { user } = useAuth();
  const preview = user?.isPreview === true;
  const [status, setStatus] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    axios.get(API + '/api/studio/email/status', { signal: controller.signal, headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(result => setStatus(result.data)).catch(failure => { if (!axios.isCancel(failure)) setError('Email connection status is unavailable.'); });
    return () => controller.abort();
  }, [preview]);
  const test = async () => {
    setBusy(true); setError('');
    try { const result = await workspaceRequest('post', '/api/studio/email/test', {}); if (typeof result?.message !== 'string') throw new Error('The mail service did not confirm this test.'); toast.success(result.message); }
    catch (failure) { setError(recordError(failure)); }
    finally { setBusy(false); }
  };
  return <><div className="settings-mail-status"><StudioAppIcon icon={Mail} tone="rose" size={38} /><div><strong>{preview ? 'Email delivery preview' : status ? status.configured ? 'Email delivery configured' : 'Email delivery needs setup' : error ? 'Email delivery unavailable' : 'Checking email delivery…'}</strong><p>{preview ? 'Connect your studio mail service in the live workspace to send a test.' : status?.sender || 'Uses your studio’s secure mail service.'}</p></div><StudioButton type="button" size="sm" icon={Mail} disabled={preview || !status?.configured} loading={busy} onClick={test} loadingLabel="Sending test email">Send test to my email</StudioButton></div><WorkspaceError error={error} /></>;
}
export default function SettingsEditor({ tab, values, change, changeNested }) {
  const field = (label, name, options = {}, group) => <WorkspaceField key={(group || '') + name} label={label} name={name} value={group ? values[group]?.[name] : values[name]} onChange={(key, value) => { const next = options.type === 'number' ? Number(value) : value; if (group) changeNested(group, key, next); else change(key, next); }} {...options} />;
  const fields = (items, group) => <div className="studio-form-grid">{items.map(([label, name, options]) => field(label, name, options || {}, group))}</div>;
  const toggle = (group, key, label, description) => <SettingsToggle key={key} label={label} description={description} value={values[group][key]} onChange={value => changeNested(group, key, value)} />;
  const billing = values.billingDefaults, milestones = billing.paymentMilestones || [];
  const templates = values.productionDefaults.templates || [];
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const templateList = useRef(null);
  useEffect(() => {
    const list = templateList.current;
    if (!list) return;
    const reveal = event => setSelectedTemplate(event.detail);
    list.addEventListener('studio-settings-reveal-template', reveal);
    return () => list.removeEventListener('studio-settings-reveal-template', reveal);
  }, [tab]);
  const activeTemplate = templates.find(template => template.id === selectedTemplate) || templates.find(template => template.id === values.productionDefaults.defaultTemplateId) || templates[0];
  const updateTemplate = (id, patch) => changeNested('productionDefaults', 'templates', templates.map(template => template.id === id ? { ...template, ...patch } : template));
  const updateStage = (template, index, patch) => updateTemplate(template.id, { stages: template.stages.map((stage, i) => i === index ? { ...stage, ...patch } : stage) });
  if (tab === 'profile') return <>
    <SettingsGroup defaultOpen title="Studio identity" description="The name and business details your clients recognise.">
      <ProfilePhoto values={values} change={change} />
      {fields([['Studio name', 'studioName', { required: true }], ['Legal business name', 'legalName'], ['GSTIN', 'gstin', { help: 'Optional. Your 15-character GST identification number.' }]])}
    </SettingsGroup>
    <SettingsGroup title="Contact details" description="Keep your studio’s primary contact information in one place.">
      {fields([['Contact email', 'email', { type: 'email' }], ['Contact phone', 'phone', { type: 'tel' }], ['Website', 'website', { type: 'url' }], ['Studio address', 'address', { type: 'textarea', wide: true }]])}
    </SettingsGroup>
    <SettingsGroup title="Social & business channels" description="Direct links clients can use to reach your studio.">
      {fields([['WhatsApp Business number', 'whatsappNumber', { type: 'tel', help: 'Include country code, for example +919876543210.' }], ['WhatsApp greeting', 'whatsappMessage', { help: 'Prefilled message for your WhatsApp contact link.' }], ['Instagram profile', 'instagramUrl', { type: 'url', help: 'Full https://www.instagram.com/… link.' }], ['Facebook page', 'facebookUrl', { type: 'url', help: 'Full https://www.facebook.com/… link.' }]])}
      <div className="settings-channel-links">{whatsappContactUrl(values.whatsappNumber, values.whatsappMessage) && <a href={whatsappContactUrl(values.whatsappNumber, values.whatsappMessage)} target="_blank" rel="noreferrer"><MessageCircle size={16} />Open WhatsApp<ExternalLink size={12} /></a>}{values.instagramUrl?.startsWith('https://') && <a href={values.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={16} />Instagram<ExternalLink size={12} /></a>}{values.facebookUrl?.startsWith('https://') && <a href={values.facebookUrl} target="_blank" rel="noreferrer"><Facebook size={16} />Facebook<ExternalLink size={12} /></a>}</div>
      <Help>These contact links open the relevant app or website. WhatsApp sharing stays manual; adding a number here does not connect or sync an inbox.</Help>
    </SettingsGroup>
  </>;
  if (tab === 'branding') return <div className="settings-brand-layout"><SettingsGroup defaultOpen title="Document identity" description="Set a consistent starting point for every new client document.">{fields([['Document logo URL', 'logoUrl', { help: 'Upload your studio photo in Studio profile or use a secure image URL.' }], ['Default cover image URL', 'coverImage', { help: 'A studio /assets/ image or an HTTPS URL.' }], ['Document accent colour', 'colorTheme', { type: 'color' }], ['Document typography', 'fontTheme', { options: [{ value: 'modern', label: 'Modern' }, { value: 'classic', label: 'Classic' }, { value: 'editorial', label: 'Editorial' }] }]])}<Help>Changes apply to new documents. You can still customise each quotation and invoice individually.</Help></SettingsGroup><BrandPreview values={values} /></div>;
  if (tab === 'billing') return <>
    <SettingsGroup defaultOpen title="Document references" description="Choose how new quotations and invoices are identified.">{fields([['Quotation prefix', 'quotationPrefix'], ['Invoice prefix', 'invoicePrefix'], ['Numbering style', 'numberingMode', { options: [{ value: 'reference', label: 'Unique reference' }, { value: 'sequence', label: 'Sequential number' }] }], ['Invoice due in (days)', 'invoiceDueDays', { type: 'number', min: billing.paymentScheduleEnabled ? 1 : 0, max: 730 }]], 'billingDefaults')}
    {toggle('billingDefaults', 'includeFinancialYear', 'Include financial year', 'Add the Indian financial year to new document references.')}<Help>References are generated when a document is created. Existing document numbers remain unchanged.</Help></SettingsGroup>
    <SettingsGroup title="Amounts & payment methods" description="Set your starting amounts and the payment details shown to clients.">{fields([['Default tax (%)', 'defaultTaxPercent', { type: 'number', min: 0, max: 100, step: '.01' }], ['Default discount type', 'defaultDiscountType', { options: [{ value: 'amount', label: 'Fixed amount (₹)' }, { value: 'percent', label: 'Percentage (%)' }] }], ['Default discount', 'defaultDiscountValue', { type: 'number', min: 0, max: billing.defaultDiscountType === 'percent' ? 100 : 100000000, step: '.01' }]], 'billingDefaults')}
    {fields([['Bank transfer details', 'bankDetails', { type: 'textarea', wide: true }], ['UPI ID', 'upiId'], ['Payment instructions', 'paymentInstructions', { type: 'textarea', wide: true }]])}</SettingsGroup>
    <SettingsGroup title="Default payment plan" description="Split new invoices into clear payment milestones.">{toggle('billingDefaults', 'paymentScheduleEnabled', 'Use a default payment plan', 'Create installments on new invoices using the milestones below.')}<Help>Due days are counted from issue date. Milestones must fit within the default invoice due date.</Help>
    <div className="settings-payment-plan">{milestones.map((row, index) => <div className="settings-milestone" key={index}>{[['Milestone', 'label', 'text'], ['Amount (%)', 'percent', 'number'], ['Due in days', 'offsetDays', 'number']].map(([label, key, type]) => <label className="studio-field" key={key}>{label}<input className="studio-input" type={type} min={key === 'percent' ? '.01' : '0'} max={key === 'percent' ? '100' : '730'} step={key === 'percent' ? '.01' : undefined} maxLength={100} value={row[key]} onChange={event => changeNested('billingDefaults', 'paymentMilestones', milestones.map((item, i) => i === index ? { ...item, [key]: type === 'number' ? Number(event.target.value) : event.target.value } : item))} /></label>)}<button type="button" className="studio-icon-button" aria-label={'Remove payment milestone ' + (index + 1)} disabled={milestones.length <= 1} onClick={() => changeNested('billingDefaults', 'paymentMilestones', milestones.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>)}</div>
    <div className="settings-inline-actions"><button type="button" className="studio-button small" disabled={milestones.length >= 8} onClick={() => changeNested('billingDefaults', 'paymentMilestones', [...milestones, { label: 'New milestone', percent: 0, offsetDays: billing.invoiceDueDays }])}><Plus size={14} />Add milestone</button><strong className={Math.abs(milestones.reduce((sum, row) => sum + Number(row.percent), 0) - 100) > .001 ? 'settings-invalid-total' : 'settings-valid-total'}>{milestones.reduce((sum, row) => sum + Number(row.percent), 0).toFixed(2)}% of 100%</strong></div></SettingsGroup>
  </>;
  if (tab === 'automation') return <>
    <SettingsGroup defaultOpen title="Quotation & invoice workflow" description="Choose what happens when a client accepts a quotation.">{fields([['Default quotation validity (days)', 'quotationValidityDays', { type: 'number', min: 0, max: 365, required: true }]])}
    {toggle('automation', 'autoCreateInvoice', 'Create an invoice when a quote is accepted', 'The invoice is created as a draft for your studio to review.')}
    <SettingsToggle label="Studio approval before invoice issue" description="Required. Payment schedules become visible after your studio issues the invoice." value onChange={() => {}} disabled /></SettingsGroup>
    <SettingsGroup title="Client reminders" description="Set the reminder schedule for new client documents.">{toggle('automation', 'quoteRemindersEnabled', 'Quotation reminders', 'Default for new quotations. Reminders stop after acceptance or expiry.')}<ReminderDays label="Quotation reminder days after sending" value={values.automation.quoteReminderDays} onChange={value => changeNested('automation', 'quoteReminderDays', value)} />
    {toggle('automation', 'invoiceRemindersEnabled', 'Payment reminders', 'Default for new issued invoices with an outstanding balance.')}<ReminderDays label="Invoice reminder days after due date" value={values.automation.invoiceReminderDays} onChange={value => changeNested('automation', 'invoiceReminderDays', value)} /><Help>Client email reminders require a configured studio mail service.</Help></SettingsGroup>
    <SettingsGroup title="Team notifications" description="Keep your team informed of changes that need attention.">{[['notifyQuoteAccepted', 'Quote accepted', 'Notify your team when a client accepts a quotation.'], ['notifyPaymentOverdue', 'Overdue payments', 'Flag issued invoices with outstanding balances.'], ['notifyAssignments', 'Crew assignments', 'Show new or changed event assignments.'], ['notifyDeliveryDue', 'Delivery deadlines', 'Flag pending production tasks due today or overdue.'], ['dailyDigestEnabled', 'Daily studio briefing', 'One in-app summary of enquiries, events and pending tasks.']].map(([key, label, description]) => toggle('automation', key, label, description))}
    {field('Daily briefing hour (IST)', 'dailyDigestHour', { type: 'number', min: 0, max: 23 }, 'automation')}</SettingsGroup>
  </>;
  if (tab === 'communication') return <>
    <SettingsGroup defaultOpen title="Outgoing email" description="Studio messages sent with quotations, invoices and reminders."><EmailStatus />{fields([['Sender display name', 'senderName'], ['Reply-to email', 'replyTo', { type: 'email' }]], 'communication')}<Help>Gmail mailbox sync is read-only and separate from outgoing email delivery. Save your changes before sending a test.</Help></SettingsGroup>
    <SettingsGroup title="Client messages" description="Give your quotation and invoice emails a consistent voice.">{fields([['Quotation email subject', 'quoteSubject'], ['Invoice email subject', 'invoiceSubject'], ['Quotation email message', 'quoteMessage', { type: 'textarea', wide: true }], ['Invoice email message', 'invoiceMessage', { type: 'textarea', wide: true }]], 'communication')}<Help>Leave a message blank to use the standard studio message.</Help></SettingsGroup>
    <SettingsGroup title="Support & delivery notes" description="Help clients understand your response times and deliverables.">{fields([['Support hours & response time', 'supportHours', { type: 'textarea', wide: true, help: 'Shown with client support.' }]], 'communication')}{fields([['Default quotation terms', 'quotationTerms', { type: 'textarea', wide: true }], ['Standard deliverables', 'defaultDeliverables', { type: 'textarea', wide: true }]])}</SettingsGroup>
  </>;
  if (tab === 'production') return <SettingsGroup defaultOpen title="Your delivery playbook" description="Reusable stages for photos, films and albums.">
    <Help>Save repeatable production checklists. Your default template is applied when a new enquiry is booked; existing projects are unchanged. Targets count from the event date, or from booking if no date is set.</Help>
    {field('Default production template', 'defaultTemplateId', { options: [{ value: '', label: 'Do not apply automatically' }, ...templates.map(template => ({ value: template.id, label: template.name || 'Untitled template' }))] }, 'productionDefaults')}
    {templates.length > 0 && <label className="studio-field settings-template-picker">Template to edit<StudioSelect title="Template to edit" className="studio-input" value={activeTemplate?.id || ''} onChange={event => setSelectedTemplate(event.target.value)}>{templates.map(template => <option key={template.id} value={template.id}>{template.name || 'Untitled template'} · {template.stages.length} tasks</option>)}</StudioSelect><small>Edit one template at a time. Your changes stay when you switch templates.</small></label>}
    <div ref={templateList}>{templates.map(template => <section className="settings-template" key={template.id} data-settings-template={template.id} hidden={template.id !== activeTemplate?.id}><div className="settings-template-heading"><label className="studio-field">Template name<input className="studio-input" value={template.name} maxLength={120} onChange={event => updateTemplate(template.id, { name: event.target.value })} /></label><button type="button" className="studio-icon-button" aria-label={'Remove template ' + template.name} onClick={() => { changeNested('productionDefaults', 'templates', templates.filter(item => item.id !== template.id)); if (values.productionDefaults.defaultTemplateId === template.id) changeNested('productionDefaults', 'defaultTemplateId', ''); }}><Trash2 size={16} /></button></div>
      {template.stages.map((stage, index) => <details className="settings-production-task" key={index} open={index === 0}><summary><span><strong>{stage.title || "Untitled task"}</strong><small>{stage.category} · {stage.dueDays} days after the event</small></span><span aria-hidden="true">+</span></summary><div className="settings-production-stage"><label className="studio-field">Task name<input className="studio-input" value={stage.title} maxLength={200} onChange={event => updateStage(template, index, { title: event.target.value })} /></label><label className="studio-field">Deliverable<StudioSelect title="Deliverable" className="studio-input" value={stage.category} onChange={event => updateStage(template, index, { category: event.target.value })}>{['Photos', 'Album', 'Traditional video', 'Cinematic video', 'Other'].map(value => <option key={value}>{value}</option>)}</StudioSelect></label><label className="studio-field">Target days<input className="studio-input" type="number" min="0" max="730" value={stage.dueDays} onChange={event => updateStage(template, index, { dueDays: Number(event.target.value) })} /></label><label className="settings-check"><input type="checkbox" checked={stage.clientVisible} onChange={event => updateStage(template, index, { clientVisible: event.target.checked })} />Client visible</label><button type="button" className="studio-icon-button" aria-label={'Remove stage ' + (index + 1) + ' from ' + template.name} disabled={template.stages.length <= 1} onClick={() => updateTemplate(template.id, { stages: template.stages.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div></details>)}
      <button type="button" className="studio-button small" disabled={template.stages.length >= 30} onClick={() => updateTemplate(template.id, { stages: [...template.stages, { title: 'New delivery task', category: 'Other', dueDays: 30, clientVisible: false }] })}><Plus size={14} />Add task</button>
    </section>)}</div>
    <button type="button" className="studio-button" disabled={templates.length >= 20} onClick={() => { const id = newId(); setSelectedTemplate(id); changeNested('productionDefaults', 'templates', [...templates, { id, name: 'New production template', stages: [{ title: 'Photo selection & editing', category: 'Photos', dueDays: 30, clientVisible: true }, { title: 'Album design', category: 'Album', dueDays: 60, clientVisible: true }, { title: 'Traditional video', category: 'Traditional video', dueDays: 45, clientVisible: true }, { title: 'Cinematic film', category: 'Cinematic video', dueDays: 60, clientVisible: true }] }]); }}><Plus size={15} />Add production template</button>
  </SettingsGroup>;
  if (tab === 'client') return <>
    <SettingsGroup defaultOpen title="Client dashboard" description="Choose what clients can see in newly created smart links.">{[['showCrew', 'Assigned crew', 'Show crew names and roles.'], ['showProgress', 'Production progress', 'Show editing stages and client-facing updates.'], ['showDeliverables', 'Deliverable links', 'Show approved photo, album and video links.'], ['showPayments', 'Invoice & payment schedule', 'Show issued invoices and their payment schedules.'], ['allowChat', 'Client support chat', 'Allow messages through the shared project link.']].map(([key, label, description]) => toggle('clientLinkDefaults', key, label, description))}</SettingsGroup>
    <SettingsGroup title="Link lifetime" description="Control how long a new shared client link remains accessible.">{field('Shared link expires after (days)', 'linkExpiryDays', { type: 'number', min: 0, max: 3650, help: '0 keeps a link open until revoked. Separate from the quote acceptance deadline.' }, 'clientLinkDefaults')}<Help>Defaults are saved with new client documents. Manage an existing link’s expiry or revoke it from that document’s sharing controls.</Help></SettingsGroup>
  </>;
  return <><div className="settings-connection-grid">{[
    ['/admin/email', 'Gmail & Email', 'Review Gmail setup and open your mailbox once connected.', Mail, 'rose'],
    ['/admin/whatsapp', 'WhatsApp Business', 'Open manual client sharing and your existing WhatsApp workspace.', MessageCircle, 'green'],
    ['/admin/calendar', 'Google Calendar', 'Manage your connection and sync studio events.', CalendarDays, 'blue'],
    ['/admin/integrations', 'Website enquiries', 'Review the enquiry webhook and Gmail connection.', Webhook, 'violet'],
    ['/admin/users', 'Team & access', 'Manage studio team accounts.', UsersRound, 'cyan'],
  ].map(([to, title, copy, icon, tone]) => <Link className="settings-connection" to={to} key={to}><StudioAppIcon icon={icon} tone={tone} size={38} /><h3>{title}</h3><p>{copy}</p><span>Open<ExternalLink size={13} /></span></Link>)}</div><Help>WhatsApp Business, Instagram and Facebook contact links are managed in Studio profile.</Help></>;
}

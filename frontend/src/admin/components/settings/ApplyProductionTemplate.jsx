import { useState } from 'react';
import { Workflow } from 'lucide-react';
import toast from 'react-hot-toast';
import { OperationsModal } from '../operations/OperationsUI';
import { WorkspaceError, WorkspaceField } from '../operations/WorkspaceUI';
import { workspaceRequest, recordError } from '../operations/workspaceData';
export default function ApplyProductionTemplate({ onApplied, initialProject = '' }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [leads, setLeads] = useState([]), [templates, setTemplates] = useState([]), [leadId, setLeadId] = useState(initialProject), [templateId, setTemplateId] = useState('');
  const show = async () => {
    setOpen(true); setLoading(true); setError('');
    try { const [projects, settings] = await Promise.all([workspaceRequest('get', '/api/leads'), workspaceRequest('get', '/api/studio/settings')]); setLeads(projects); setTemplates(settings.productionDefaults?.templates || []); setTemplateId(settings.productionDefaults?.defaultTemplateId || settings.productionDefaults?.templates?.[0]?.id || ''); }
    catch (failure) { setError(recordError(failure)); }
    finally { setLoading(false); }
  };
  const apply = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const result = await workspaceRequest('post', '/api/tasks/apply-template', { leadId, templateId }); setOpen(false); onApplied?.(); toast.success(`${result.template}: ${result.count} tasks ready. Existing template tasks are preserved.`); }
    catch (failure) { setError(recordError(failure)); }
    finally { setBusy(false); }
  };
  return <><button type="button" className="studio-button" onClick={show}><Workflow size={15} />Apply template</button>{open && <OperationsModal title="Apply production template" onClose={() => setOpen(false)} busy={busy} footer={<><button type="button" className="studio-button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="studio-button primary" form="apply-production-template" disabled={busy || loading || !templateId || !leadId}>{busy ? 'Applying…' : 'Apply template'}</button></>}><WorkspaceError error={error} /><form id="apply-production-template" onSubmit={apply} className="workspace-form">{loading ? <p>Loading your templates…</p> : <><WorkspaceField label="Project enquiry" name="leadId" value={leadId} onChange={(_, value) => setLeadId(value)} required options={[{ value: '', label: 'Choose a project' }, ...leads.map(lead => ({ value: lead._id, label: lead.name }))]} /><WorkspaceField label="Production template" name="templateId" value={templateId} onChange={(_, value) => setTemplateId(value)} required options={[{ value: '', label: templates.length ? 'Choose a template' : 'Add templates in Studio settings first' }, ...templates.map(template => ({ value: template.id, label: template.name }))]} /><p className="studio-muted">Adds missing tasks from this template. Existing tasks and progress remain unchanged.</p></>}</form></OperationsModal>}</>;
}

import { useAuth } from '../../../context/AuthContext';
import { hasModuleAccess } from '../../../utils/moduleAccess';
import StudioSelect from "../common/StudioSelect";
import StudioButton from '../common/StudioButton';
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { LEAD_STATUSES, PAYMENT_STATUSES, leadStatusLabel, dateInput, studioApi, studioAuth } from "./leadUtils";
import {useOfflineDraft,OfflineDraftStatus} from '../../../offline/OfflineDrafts';
import useStudioDialog from "./useStudioDialog";
import { canCollapseLeadDraft, leadDraftSummary } from './leadDraftPresentation';

const emptyLead = { name: "", email: "", phone: "", status: "New", eventType: "Wedding", eventDate: "", eventTime: "", eventLocation: "", followUpDate: "", remarks: "", notes: "", totalAmount: "", depositAmount: "", paymentStatus: "Unpaid", cloudLink: "", cloudPassword: "",  };

export default function StudioLeadForm({ initialData, onClose, onSaved }) {
  const { user } = useAuth();
  const finance = hasModuleAccess(user, 'finance'), galleries = hasModuleAccess(user, 'galleries');
  const [data, setData] = useState({ ...emptyLead, ...initialData, eventDate: dateInput(initialData?.eventDate), followUpDate: dateInput(initialData?.followUpDate) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const optionalFields = useRef(null);
  const dialogRef = useStudioDialog(onClose, { canClose: !saving });
  const editing = !!initialData?._id;
  const [changed,setChanged]=useState(false);
  const [passwordChanged,setPasswordChanged]=useState(false);
  const draft=useOfflineDraft({kind:'enquiry',value:data,dirty:changed,enabled:!editing,onRestore:value=>{setData({...emptyLead,...value});setChanged(true);}});
  const set = (field) => (event) => {setChanged(true);if(field==='cloudPassword')setPasswordChanged(true);setData((previous) => ({ ...previous, [field]: event.target.value }));};

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    if(draft.candidate){setError('Restore or discard your saved draft before submitting.');return;}
    if(!editing&&!navigator.onLine){if(await draft.saveNow())setError('Saved on this device. Reconnect and submit this enquiry.');else setError('Local storage is unavailable. Keep this page open.');return;}
    if (!data.name.trim() || !data.email.trim()) { setError("Please complete the required client details."); return; }
    if (finance && Number(data.depositAmount) > Number(data.totalAmount)) { if (optionalFields.current) optionalFields.current.open = true; setError("The deposit cannot be greater than the project value."); return; }
    inFlight.current = true;
    setSaving(true);
    setError("");
    const payload = { ...data, name: data.name.trim(), email: data.email.trim(), totalAmount: Number(data.totalAmount) || 0, depositAmount: Number(data.depositAmount) || 0, eventDate: data.eventDate || null, followUpDate: data.followUpDate || null };
    const writable = ['name','email','phone','status','eventType','eventDate','eventTime','eventLocation','followUpDate','remarks','notes', ...(finance ? ['totalAmount','depositAmount','paymentStatus'] : []), ...(galleries ? ['cloudLink','cloudPassword'] : [])];
    Object.keys(payload).forEach(key => { if (!writable.includes(key)) delete payload[key]; });
    if (editing && !passwordChanged) delete payload.cloudPassword;
    delete payload._id;
    delete payload.tasks;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;
    ["createAccount", "firstName", "lastName", "accountEmail", "password", "galleryTag"].forEach((key) => delete payload[key]);
    try {
      const requestOptions = { ...studioAuth(), timeout: 30000 };
      const response = editing
        ? await axios.patch(`${studioApi}/api/leads/${initialData._id}`, payload, requestOptions)
        : await axios.post(`${studioApi}/api/leads`, payload, requestOptions);
      if(!editing)await draft.clear().catch(()=>toast('Enquiry saved. Review local drafts before resubmitting.'));
      toast.success(editing ? "Enquiry updated" : "Enquiry created");
      onClose();
      onSaved(response.data);
    } catch (err) {
      if(!editing&&(!err.response||err.response.status>=500))await draft.markUncertain();
      setError(err.response?.data?.error || (err.code === 'ECONNABORTED'
        ? 'Saving timed out. Your details are still here. Check the enquiry list before submitting again.'
        : "We couldn’t confirm this enquiry was saved. Check the enquiry list before trying again."));
    } finally { setSaving(false); inFlight.current = false; }
  };

  return createPortal(
    <div className="studio-modal-overlay studio-crm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="studio-modal studio-crm-form" role="dialog" aria-modal="true" aria-labelledby="studio-lead-form-title">
        <header className="studio-modal-header">
          <div><h2 id="studio-lead-form-title">{editing ? "Edit enquiry" : "New enquiry"}</h2><p className="studio-muted">{editing ? "Update client, event and follow-up details." : "Start with the client and event. You can add the rest later."}</p></div>
          <button type="button" className="studio-icon-button" aria-label="Close enquiry form" onClick={onClose} disabled={saving}><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="studio-crm-form-body">{canCollapseLeadDraft(draft)?<details className="studio-lead-draft-disclosure"><summary>{leadDraftSummary(draft)}</summary><OfflineDraftStatus draft={draft}/></details>:<OfflineDraftStatus draft={draft}/>}
          {error && <div role="alert" className="studio-error">{error}</div>}
          <div className="studio-crm-form-section"><div className="studio-crm-form-section-heading"><h3>Client details</h3><small>* Required</small></div><div className="studio-form-grid">
            <label className="studio-field">Full name *<input data-autofocus required className="studio-input" value={data.name} onChange={set("name")} autoComplete="name" placeholder="Client or couple’s name" /></label>
            <label className="studio-field">Email address *<input required type="email" className="studio-input" value={data.email} onChange={set("email")} autoComplete="email" placeholder="name@example.com" /></label>
            <label className="studio-field">Phone number<input type="tel" className="studio-input" value={data.phone} onChange={set("phone")} autoComplete="tel" placeholder="+91" /></label>
            <label className="studio-field">Enquiry stage<StudioSelect title="Enquiry stage" className="studio-input" value={data.status} onChange={set("status")}>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{leadStatusLabel(status)}</option>)}</StudioSelect></label>
          </div></div>
          <div className="studio-crm-form-section"><h3>Event & follow-up</h3><div className="studio-form-grid">
            <label className="studio-field">Event type<input className="studio-input" list="studio-event-types" value={data.eventType} onChange={set("eventType")} placeholder="Wedding, engagement…" /><datalist id="studio-event-types"><option>Wedding</option><option>Engagement</option><option>Pre-wedding</option><option>Bespoke</option></datalist></label>
            <label className="studio-field">Event date<input type="date" className="studio-input" value={data.eventDate} onChange={set("eventDate")} /></label>
            <label className="studio-field">Event time<input className="studio-input" value={data.eventTime} onChange={set("eventTime")} placeholder="e.g. 10:00 AM" /></label>
            <label className="studio-field">Venue / location<input className="studio-input" value={data.eventLocation} onChange={set("eventLocation")} placeholder="Venue and city" /></label>
            <label className="studio-field">Next follow-up<input type="date" className="studio-input" value={data.followUpDate} onChange={set("followUpDate")} /></label>
          </div><label className="studio-field studio-crm-wide-field">Creative brief<textarea rows={3} className="studio-input" value={data.remarks} onChange={set("remarks")} placeholder="What are they looking for?" /></label></div>
          <details ref={optionalFields} className="studio-crm-optional-fields" open={editing || undefined}><summary><span><strong>Optional details</strong><small>{[finance && "Payment", galleries && "delivery", "internal notes"].filter(Boolean).join(", ")}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
          {(finance || galleries) && <div className="studio-crm-form-section"><h3>{finance && galleries ? "Payment & delivery" : finance ? "Payment details" : "Delivery details"}</h3><div className="studio-form-grid">
            {finance && <>
            <label className="studio-field">Project value (₹)<input type="number" min="0" className="studio-input" value={data.totalAmount} onChange={set("totalAmount")} /></label>
            <label className="studio-field">Deposit received (₹)<input type="number" min="0" className="studio-input" value={data.depositAmount} onChange={set("depositAmount")} /></label>
            <label className="studio-field">Payment status<StudioSelect title="Payment status" className="studio-input" value={data.paymentStatus} onChange={set("paymentStatus")}>{PAYMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</StudioSelect></label>
            </>}{galleries && <><label className="studio-field">Cloud folder link<input type="url" className="studio-input" value={data.cloudLink} onChange={set("cloudLink")} placeholder="https://" /></label>
            <label className="studio-field">Cloud folder password<input className="studio-input" value={data.cloudPassword} onChange={set("cloudPassword")} autoComplete="off" /></label></>}
          </div></div>}
          <div className="studio-crm-form-section"><label className="studio-field">Internal notes<textarea rows={3} className="studio-input" value={data.notes} onChange={set("notes")} placeholder="Visible to your studio team" /></label></div></details>
          <footer className="studio-modal-footer"><button type="button" className="studio-button" onClick={onClose} disabled={saving}>Cancel</button><StudioButton type="submit" variant="primary" loading={saving} loadingLabel="Saving enquiry">{editing ? "Save changes" : "Create enquiry"}</StudioButton></footer>
        </form>
      </section>
    </div>, document.body
  );
}

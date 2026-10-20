import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { LEAD_STATUSES, PAYMENT_STATUSES, dateInput, studioApi, studioAuth } from "./leadUtils";
import useStudioDialog from "./useStudioDialog";

const emptyLead = { name: "", email: "", phone: "", status: "New", eventType: "Wedding", eventDate: "", eventTime: "", eventLocation: "", followUpDate: "", remarks: "", notes: "", totalAmount: "", depositAmount: "", paymentStatus: "Unpaid", cloudLink: "", cloudPassword: "",  };

export default function StudioLeadForm({ initialData, onClose, onSaved }) {
  const [data, setData] = useState({ ...emptyLead, ...initialData, eventDate: dateInput(initialData?.eventDate), followUpDate: dateInput(initialData?.followUpDate) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const dialogRef = useStudioDialog(onClose, { canClose: !saving });
  const editing = !!initialData?._id;
  const set = (field) => (event) => setData((previous) => ({ ...previous, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!data.name.trim() || !data.email.trim()) { setError("Please complete the required client details."); return; }
    if (Number(data.depositAmount) > Number(data.totalAmount)) { setError("The deposit cannot be greater than the project value."); return; }
    inFlight.current = true;
    setSaving(true);
    setError("");
    const payload = { ...data, name: data.name.trim(), email: data.email.trim(), totalAmount: Number(data.totalAmount) || 0, depositAmount: Number(data.depositAmount) || 0, eventDate: data.eventDate || null, followUpDate: data.followUpDate || null };
    delete payload._id;
    delete payload.tasks;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;
    ["createAccount", "firstName", "lastName", "accountEmail", "password", "galleryTag"].forEach((key) => delete payload[key]);
    try {
      const response = editing
        ? await axios.patch(`${studioApi}/api/leads/${initialData._id}`, payload, studioAuth())
        : await axios.post(`${studioApi}/api/leads`, payload, studioAuth());
      onSaved(response.data);
      toast.success(editing ? "Enquiry updated" : "Enquiry created");
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "We couldn’t save this enquiry. Please try again.");
    } finally { setSaving(false); inFlight.current = false; }
  };

  return createPortal(
    <div className="studio-modal-overlay studio-crm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="studio-modal studio-crm-form" role="dialog" aria-modal="true" aria-labelledby="studio-lead-form-title">
        <header className="studio-modal-header">
          <div><span className="studio-eyebrow">CLIENT RELATIONSHIPS</span><h2 id="studio-lead-form-title">{editing ? "Edit enquiry" : "A new beginning"}</h2><p className="studio-muted">{editing ? "Keep the details that matter up to date." : "Capture the first details of a beautiful story."}</p></div>
          <button type="button" className="studio-icon-button" aria-label="Close enquiry form" onClick={onClose} disabled={saving}><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="studio-crm-form-body">
          {error && <div role="alert" className="studio-error">{error}</div>}
          <div className="studio-crm-form-section"><h3>Client details</h3><div className="studio-form-grid">
            <label className="studio-field">Full name<input data-autofocus required className="studio-input" value={data.name} onChange={set("name")} autoComplete="name" placeholder="Client or couple’s name" /></label>
            <label className="studio-field">Email address<input required type="email" className="studio-input" value={data.email} onChange={set("email")} autoComplete="email" placeholder="name@example.com" /></label>
            <label className="studio-field">Phone number<input type="tel" className="studio-input" value={data.phone} onChange={set("phone")} autoComplete="tel" placeholder="+91" /></label>
            <label className="studio-field">Enquiry stage<select className="studio-input" value={data.status} onChange={set("status")}>{LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          </div></div>
          <div className="studio-crm-form-section"><h3>The occasion</h3><div className="studio-form-grid">
            <label className="studio-field">Event type<input className="studio-input" list="studio-event-types" value={data.eventType} onChange={set("eventType")} placeholder="Wedding, engagement…" /><datalist id="studio-event-types"><option>Wedding</option><option>Engagement</option><option>Pre-wedding</option><option>Bespoke</option></datalist></label>
            <label className="studio-field">Event date<input type="date" className="studio-input" value={data.eventDate} onChange={set("eventDate")} /></label>
            <label className="studio-field">Event time<input className="studio-input" value={data.eventTime} onChange={set("eventTime")} placeholder="e.g. 10:00 AM" /></label>
            <label className="studio-field">Venue / location<input className="studio-input" value={data.eventLocation} onChange={set("eventLocation")} placeholder="Venue and city" /></label>
            <label className="studio-field">Next follow-up<input type="date" className="studio-input" value={data.followUpDate} onChange={set("followUpDate")} /></label>
          </div><label className="studio-field studio-crm-wide-field">Creative brief<textarea rows={3} className="studio-input" value={data.remarks} onChange={set("remarks")} placeholder="What are they looking for?" /></label></div>
          <div className="studio-crm-form-section"><h3>Payment & delivery</h3><div className="studio-form-grid">
            <label className="studio-field">Project value (₹)<input type="number" min="0" className="studio-input" value={data.totalAmount} onChange={set("totalAmount")} /></label>
            <label className="studio-field">Deposit received (₹)<input type="number" min="0" className="studio-input" value={data.depositAmount} onChange={set("depositAmount")} /></label>
            <label className="studio-field">Payment status<select className="studio-input" value={data.paymentStatus} onChange={set("paymentStatus")}>{PAYMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="studio-field">Cloud folder link<input type="url" className="studio-input" value={data.cloudLink} onChange={set("cloudLink")} placeholder="https://" /></label>
            <label className="studio-field">Cloud folder password<input className="studio-input" value={data.cloudPassword} onChange={set("cloudPassword")} autoComplete="off" /></label>
          </div></div>
          <div className="studio-crm-form-section"><label className="studio-field">Internal notes<textarea rows={3} className="studio-input" value={data.notes} onChange={set("notes")} placeholder="Visible to your studio team" /></label></div>
          <footer className="studio-modal-footer"><button type="button" className="studio-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="studio-button primary" disabled={saving}>{saving && <Loader2 className="studio-crm-spin" size={16} />}{saving ? "Saving…" : editing ? "Save changes" : "Create enquiry"}</button></footer>
        </form>
      </section>
    </div>, document.body
  );
}

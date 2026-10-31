import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import useStudioDialog from '../studio/useStudioDialog';

const API = import.meta.env.VITE_API_URL || '';
export default function AdminProfileModal({ profile, onClose, onSave }) {
  const [name, setName] = useState([profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const dialogRef = useStudioDialog(onClose, { canClose: !busy });
  const { logout } = useAuth();
  const save = async event => {
    event.preventDefault();
    if (savingRef.current || !name.trim()) return;
    savingRef.current = true; setBusy(true); setError('');
    try {
      const result = await axios.put(API + '/api/auth/profile', { name: name.trim() }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      onSave(result.data);
    } catch (err) { setError(err.response?.data?.msg || err.response?.data?.error || 'Could not update your profile. Please try again.'); }
    finally { savingRef.current = false; setBusy(false); }
  };
  return createPortal(<div className="studio-app studio-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="studio-profile-heading" ref={dialogRef} style={{ maxWidth: 460 }}><div className="studio-modal-header"><div><span className="studio-eyebrow">YOUR STUDIO IDENTITY</span><h2 id="studio-profile-heading">Your profile</h2></div><button className="studio-icon-button" onClick={onClose} disabled={busy} aria-label="Close profile"><X size={18} /></button></div><form onSubmit={save}>{error && <div className="studio-error" role="alert">{error}</div>}<label className="studio-field">Display name<input className="studio-input" value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100} required data-autofocus /></label><p className="studio-muted" style={{ marginTop: 20, fontSize: 11, display: 'flex', gap: 7, alignItems: 'center' }}><ShieldCheck size={15} />Studio administrator <span style={{ marginLeft: 'auto' }}>{profile?.email}</span></p><div className="studio-modal-footer"><button className="studio-button" type="button" onClick={logout}>Sign out</button><button className="studio-button primary" disabled={busy}><Save size={14} />{busy ? 'Saving…' : 'Save profile'}</button></div></form></section></div>, document.body);
}

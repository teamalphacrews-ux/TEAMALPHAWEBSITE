import StudioButton from '../common/StudioButton';
import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { OperationsError, OperationsModal } from "../operations/OperationsUI";
import { operationAPI, operationAuth, operationError } from "../operations/operationsUtils";
import "../../pages/studioOperations.css";

export default function ClientCollectionForm({ client, onClose, onSaved }) {
  const [name, setName] = useState(client?.name || "");
  const [password, setPassword] = useState("");
  const initialAccount = typeof client?.clientId === "object" ? client.clientId?._id || "" : client?.clientId || "";
  const [accountId, setAccountId] = useState(initialAccount);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [coverError, setCoverError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${operationAPI}/api/drive-gallery/users/clients`, { ...operationAuth(), signal: controller.signal }).then(response => {
      if (!Array.isArray(response.data)) throw new Error("Invalid client response");
      setAccounts(response.data);
    }).catch(error => {
      if (!axios.isCancel(error)) setAccountsError("Client accounts couldn't be loaded. You can save this gallery with its current account setting.");
    }).finally(() => { if (!controller.signal.aborted) setAccountsLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const selectCover = event => {
    const file = event.target.files?.[0];
    setCoverError("");
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) { setCoverError("Choose an image file for the gallery cover."); event.target.value = ""; return; }
    setCover(file); setPreview(URL.createObjectURL(file));
  };
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) { setSaveError("Enter the client's name."); return; }
    setSaving(true); setSaveError("");
    const data = new FormData();
    data.append("name", name.trim());
    if (password) data.append("password", password);
    if (accountId) data.append("clientId", accountId);
    if (cover) data.append("thumbnail", cover);
    try {
      const response = client ? await axios.patch(`${operationAPI}/api/drive-gallery/${client._id}`, data, operationAuth()) : await axios.post(`${operationAPI}/api/drive-gallery`, data, operationAuth());
      if (!response.data?._id) throw new Error("No saved collection returned");
      onSaved(response.data); toast.success(client ? "Client gallery updated." : "Client gallery created."); onClose();
    } catch (error) { setSaveError(operationError(error, "We couldn't save this client gallery. Please try again.")); }
    finally { setSaving(false); }
  };
  const coverUrl = preview || client?.thumbnail || "";
  return <OperationsModal title={client ? "Edit client gallery" : "Create client gallery"} description="Set up a thoughtful home for your client’s photographs and films." onClose={onClose} busy={saving} footer={<><button className="studio-button" disabled={saving} onClick={onClose}>Cancel</button><StudioButton variant="primary" form="client-collection-form" type="submit" loading={saving} loadingLabel="Saving client gallery">{client ? "Save changes" : "Create gallery"}</StudioButton></>}><form className="ops-form" id="client-collection-form" onSubmit={save}>
    {saveError && <OperationsError>{saveError}</OperationsError>}
    <label className="studio-field"><span>Client name <b>*</b></span><input className="studio-input" autoComplete="off" required maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Sachitha & Yogesh" disabled={saving} /></label>
    <label className="studio-field"><span>Link a client account</span><select className="studio-input" value={accountId} disabled={accountsLoading || !!accountsError || saving} onChange={event => setAccountId(event.target.value)}><option value="" disabled={!!initialAccount}>{accountsLoading ? "Loading client accounts…" : "No linked account"}</option>{initialAccount && !accounts.some(account => account._id === initialAccount) && <option value={initialAccount}>Current linked account</option>}{accounts.map(account => <option key={account._id} value={account._id}>{account.firstName} {account.lastName} ({account.email})</option>)}</select><small>{initialAccount ? "Choose another registered account to change this gallery’s client link." : "Link an account so the client can find this collection after signing in."}</small></label>
    {accountsError && <p className="ops-form-note">{accountsError}</p>}
    <label className="studio-field"><span>{client ? "New access password" : "Access password"}</span><input className="studio-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={saving} placeholder={client ? "Leave blank to keep the current password" : "Optional password for client access"} /><small>{client ? "Enter a new password only if you want to replace the current one." : "If set, clients will need this password to open their gallery."}</small></label>
    <div className="studio-field"><span>Cover image</span>{coverUrl ? <div className="ops-form-cover"><img src={coverUrl} alt="Gallery cover preview" />{preview && <button className="ops-icon-button" type="button" aria-label="Remove selected cover image" disabled={saving} onClick={() => { setCover(null); setPreview(""); const picker = document.getElementById("client-gallery-cover"); if (picker) picker.value = ""; }}><X size={15} /></button>}</div> : <div className="ops-cover-empty"><ImagePlus size={24} /><p>Add a photograph to make this gallery your client’s own.</p></div>}<label htmlFor="client-gallery-cover" className="ops-cover-picker"><span>{coverUrl ? "Choose a different cover" : "Choose a cover image"}</span><input id="client-gallery-cover" type="file" accept="image/*" onChange={selectCover} disabled={saving} /></label>{coverError && <p className="ops-cover-error" role="alert">{coverError}</p>}</div>
    {!client && <p className="ops-form-note">Create the client gallery first, then add their wedding, reception or other event collections.</p>}
  </form></OperationsModal>;
}

import StudioButton from '../components/common/StudioButton';
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Image as ImageIcon, Images, LockKeyhole, Pencil, Plus, Search, Trash2, UserRoundCheck } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import CreateGalleryModal from "../components/gallery/CreateGalleryModal";
import EditClientModal from "../components/gallery/EditClientModal";
import { OperationsError, OperationsLoading, OperationsModal } from "../components/operations/OperationsUI";
import { operationAPI, operationAuth, operationDate, operationError } from "../components/operations/operationsUtils";
import "./studioOperations.css";

function GalleryCover({ gallery }) {
  const [failed, setFailed] = useState(false);
  return <div className="ops-gallery-cover">{gallery.thumbnail && !failed ? <img src={gallery.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} /> : <div className="ops-gallery-placeholder"><Images size={32} strokeWidth={1.2} /><span>Cover image not added</span></div>}<span className="ops-gallery-cover-label"><ImageIcon size={12} /> Client collection</span></div>;
}

export default function SmartGallery() {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const fetchGalleries = useCallback(() => axios.get(`${operationAPI}/api/drive-gallery`, operationAuth()).then(response => {
    if (!Array.isArray(response.data)) throw new Error("Invalid gallery response");
    setGalleries(response.data); setLoadError("");
  }).catch(error => { setLoadError(operationError(error, "We couldn't load your client galleries.")); }).finally(() => setLoading(false)), []);
  useEffect(() => { fetchGalleries(); }, [fetchGalleries]);
  const retry = () => { setLoading(true); setLoadError(""); fetchGalleries(); };
  const filteredGalleries = useMemo(() => galleries.filter(gallery => {
    if (filter === "protected" && !gallery.passwordHash) return false;
    if (filter === "linked" && !gallery.clientId) return false;
    return gallery.name.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [galleries, query, filter, sort]);
  const deleteGallery = async () => {
    setDeletingBusy(true); setDeleteError("");
    try {
      await axios.delete(`${operationAPI}/api/drive-gallery/${deleting._id}`, operationAuth());
      setGalleries(current => current.filter(gallery => gallery._id !== deleting._id)); setDeleting(null); toast.success("Client gallery removed.");
    } catch (error) { setDeleteError(operationError(error, "We couldn't remove this gallery.")); }
    finally { setDeletingBusy(false); }
  };
  return <div className="studio-ops ops-galleries-page">
    <div className="studio-page-heading"><div><p className="studio-eyebrow">Client delivery</p><h1>Client galleries</h1><p className="studio-muted">A beautiful home for every story you deliver.</p></div><button className="studio-button primary" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> Create client gallery</button></div>
    <div className="ops-gallery-summary"><span><Images size={15} /><strong>{loading || loadError ? "—" : galleries.length}</strong> client galleries</span><span><LockKeyhole size={15} /><strong>{loading || loadError ? "—" : galleries.filter(gallery => gallery.passwordHash).length}</strong> password protected</span><span><UserRoundCheck size={15} /><strong>{loading || loadError ? "—" : galleries.filter(gallery => gallery.clientId).length}</strong> linked to client accounts</span></div>
    {loadError && <OperationsError onRetry={retry}>{loadError}</OperationsError>}
    <section className="studio-card ops-gallery-workspace"><div className="ops-section-heading"><div><h2 className="studio-section-title">All collections <span className="ops-count">{loading || loadError ? "—" : galleries.length}</span></h2><p className="studio-muted">Manage client access, covers and event collections.</p></div><Images size={19} className="ops-quiet-icon" /></div><div className="studio-toolbar ops-gallery-toolbar"><label className="studio-search ops-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search client galleries" aria-label="Search client galleries" /></label><select className="studio-input ops-select" aria-label="Filter galleries" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All galleries</option><option value="protected">Password protected</option><option value="linked">Linked accounts</option></select><select className="studio-input ops-select" aria-label="Sort galleries" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="name">Name A–Z</option></select></div>
    {loading ? <OperationsLoading label="Loading client galleries…" /> : loadError && !galleries.length ? <div className="studio-empty ops-empty"><Images size={30} /><h3>Galleries are unavailable</h3><p>Try again to reconnect to your client collections.</p></div> : filteredGalleries.length ? <div className="ops-gallery-grid">{filteredGalleries.map(gallery => <article className="ops-gallery-card" key={gallery._id}><Link to={`/admin/gallery/${gallery._id}`} aria-label={`Open ${gallery.name} gallery`}><GalleryCover key={gallery.thumbnail || gallery._id} gallery={gallery} /></Link><div className="ops-gallery-card-body"><div className="ops-gallery-title-row"><Link to={`/admin/gallery/${gallery._id}`}><h3>{gallery.name}</h3></Link><div className="ops-row-actions"><button className="ops-icon-button" aria-label={`Edit gallery: ${gallery.name}`} onClick={() => setEditingClient(gallery)}><Pencil size={14} /></button><button className="ops-icon-button" aria-label={`Delete gallery: ${gallery.name}`} onClick={() => { setDeleting(gallery); setDeleteError(""); }}><Trash2 size={14} /></button></div></div><p className="ops-gallery-date"><CalendarDays size={12} />{gallery.updatedAt ? "Updated" : "Created"} {operationDate(gallery.updatedAt || gallery.createdAt, { day: "numeric", month: "short", year: "numeric" })}</p><div className="ops-gallery-badges">{gallery.passwordHash && <span><LockKeyhole size={11} /> Password protected</span>}{gallery.clientId && <span><UserRoundCheck size={11} /> Account linked</span>}{!gallery.passwordHash && !gallery.clientId && <span>Client collection</span>}</div><Link className="ops-gallery-open" to={`/admin/gallery/${gallery._id}`}>Open collection <ArrowUpRight size={14} /></Link></div></article>)}</div> : <div className="studio-empty ops-empty"><Images size={32} /><h3>{galleries.length ? "No galleries match this view" : "Your next story belongs here"}</h3><p>{galleries.length ? "Try a different client name or filter." : "Create a client gallery, then add their wedding, reception and other event collections."}</p>{galleries.length ? <button className="studio-button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button> : <button className="studio-button primary" onClick={() => setIsCreateOpen(true)}><Plus size={15} /> Create your first gallery</button>}</div>}<div className="ops-table-footer"><span>{loading ? "Loading…" : `${filteredGalleries.length} of ${galleries.length} galleries`}</span><span>Made for the stories worth keeping</span></div></section>
    <CreateGalleryModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onGalleryCreated={gallery => { setGalleries(current => [gallery, ...current]); setLoadError(""); }} />
    <EditClientModal isOpen={!!editingClient} onClose={() => setEditingClient(null)} client={editingClient} onSuccess={fetchGalleries} />
    {deleting && <OperationsModal title="Remove this client gallery?" description="This permanently removes the gallery and all of its event collections." onClose={() => setDeleting(null)} busy={deletingBusy} footer={<><button className="studio-button" disabled={deletingBusy} onClick={() => setDeleting(null)}>Keep gallery</button><StudioButton type="button" variant="destructive" loading={deletingBusy} onClick={deleteGallery} loadingLabel="Removing gallery">Remove gallery</StudioButton></>}><p className="ops-delete-title">{deleting.name}</p>{deleteError && <OperationsError>{deleteError}</OperationsError>}</OperationsModal>}
  </div>;
}

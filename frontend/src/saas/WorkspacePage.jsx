import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Building2, Check, Copy, CreditCard, Layers3, MailPlus, RefreshCw, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { WorkspaceDialog, WorkspaceEmpty, WorkspaceError, WorkspaceHeader } from '../admin/components/operations/WorkspaceUI';
import { loadRazorpayCheckout, planPrice, roleLabel, saasRequest, safeDate, statusLabel, trialDaysLeft, workspaceId } from './api';
import { createWorkspacePreview } from './previewData';
import './saas.css';

const tabs = [{ id: 'overview', label: 'Studio workspace', icon: Building2 }, { id: 'team', label: 'Team & invitations', icon: UsersRound }, { id: 'subscription', label: 'Plan & subscription', icon: CreditCard }];
const memberName = member => [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
const emptyInvite = () => ({ email: '', role: 'staff' });

export default function WorkspacePage({ initialTab = 'overview' }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const previewMode = import.meta.env.DEV && user?.isPreview === true && !user?.workspace && params.get('preview') === 'saas';
  const [previewData] = useState(createWorkspacePreview);
  const [liveData, setData] = useState(null), [loading, setLoading] = useState(Boolean(user?.workspace)), [error, setError] = useState('');
  const [busy, setBusy] = useState(''), [dialog, setDialog] = useState(null), [inviteForm, setInviteForm] = useState(emptyInvite), [formError, setFormError] = useState(''), [invitationLink, setInvitationLink] = useState('');
  const mounted = useRef(true), checkout = useRef(null), actionLock = useRef(false);
  const currentTab = tabs.some(tab => tab.id === params.get('tab')) ? params.get('tab') : initialTab;
  const data = previewMode ? previewData : liveData;
  const activeWorkspace = previewMode ? previewData.workspace : user?.workspace;
  const load = useCallback(signal => {
    if (previewMode || !activeWorkspace) return;
    return saasRequest('/workspace', { signal }).then(result => {
      if (!result.workspace || !Array.isArray(result.members)) throw new Error('Your studio details could not be confirmed. Please retry.');
      if (!signal?.aborted && mounted.current) { setData(result); setError(''); }
    }).catch(failure => { if (failure.name !== 'AbortError' && mounted.current) setError(failure.message); })
      .finally(() => { if (!signal?.aborted && mounted.current) setLoading(false); });
  }, [activeWorkspace, previewMode]);
  useEffect(() => { mounted.current = true; const controller = new AbortController(); load(controller.signal); return () => { mounted.current = false; controller.abort(); checkout.current?.close?.(); }; }, [load]);
  const refresh = () => { if (previewMode) return; setLoading(true); load(); };
  const selectTab = tab => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', tab); return next; }, { replace: true });
  const navigateTabs = event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(tab => tab.id === currentTab);
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next.id);
    requestAnimationFrame(() => document.getElementById('saas-tab-' + next.id)?.focus());
  };
  const closeDialog = () => { if (!actionLock.current) { setDialog(null); setFormError(''); } };
  const openInvite = () => { setInviteForm(emptyInvite()); setFormError(''); setInvitationLink(''); setDialog({ type: 'invite' }); };

  const invite = async event => {
    event.preventDefault(); if (previewMode || actionLock.current || data?.role !== 'owner') return;
    actionLock.current = true; setBusy('invite'); setFormError('');
    try {
      const result = await saasRequest('/invitations', { method: 'POST', body: { email: inviteForm.email.trim().toLowerCase(), role: inviteForm.role } });
      if (typeof result.acceptUrl !== 'string' || !result.invitation) throw new Error('The invitation link could not be confirmed. Please refresh before retrying.');
      if (!mounted.current) return;
      setInvitationLink(result.acceptUrl); setDialog(null); setInviteForm(emptyInvite()); toast.success('Invitation link created'); await load();
    } catch (failure) { if (mounted.current) setFormError(failure.message); }
    finally { actionLock.current = false; if (mounted.current) setBusy(''); }
  };
  const changeAccess = async () => {
    if (previewMode || actionLock.current || data?.role !== 'owner' || !dialog) return;
    actionLock.current = true; setBusy('member'); setFormError('');
    try {
      if (dialog.type === 'revoke') await saasRequest('/invitations/' + encodeURIComponent(workspaceId(dialog.invitation)), { method: 'DELETE' });
      else await saasRequest('/members/' + encodeURIComponent(workspaceId(dialog.member)), { method: 'PATCH', body: { role: dialog.role } });
      if (!mounted.current) return;
      setDialog(null); toast.success(dialog.type === 'revoke' ? 'Invitation revoked' : dialog.role === 'removed' ? 'Studio access removed' : 'Member role updated'); await load();
    } catch (failure) { if (mounted.current) setFormError(failure.message); }
    finally { actionLock.current = false; if (mounted.current) setBusy(''); }
  };
  const copyInvitation = async () => {
    try { await navigator.clipboard.writeText(invitationLink); toast.success('Invitation link copied'); }
    catch { toast.error('Copy is unavailable. Select the link and copy it manually.'); }
  };
  const subscribe = async plan => {
    if (previewMode || actionLock.current || data?.role !== 'owner' || !data.billing?.configured || !plan.configured || !planPrice(plan)) return;
    actionLock.current = true; setBusy('checkout:' + plan.id); setError('');
    const finish = () => { actionLock.current = false; if (mounted.current) setBusy(''); };
    try {
      const Razorpay = await loadRazorpayCheckout();
      const subscription = await saasRequest('/billing/checkout', { method: 'POST', body: { planId: plan.id } });
      if (!subscription.keyId || !subscription.subscriptionId) throw new Error('Payment checkout could not be confirmed. Please retry.');
      if (!mounted.current) { finish(); return; }
      let verifying = false;
      const payment = new Razorpay({
        key: subscription.keyId, subscription_id: subscription.subscriptionId, name: subscription.studioName || 'Studio OS', description: plan.name + ' subscription',
        prefill: { name: memberName(user), email: user.email || '' }, theme: { color: '#272e23' },
        handler: async response => {
          verifying = true;
          try {
            const result = await saasRequest('/billing/verify', { method: 'POST', body: { razorpay_subscription_id: response.razorpay_subscription_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature } });
            if (result.status !== 'verified') throw new Error('The payment has not been confirmed yet. Refresh your subscription status shortly.');
            if (mounted.current) { toast.success('Payment verified; subscription status refreshed'); await load(); }
          } catch (failure) { if (mounted.current) setError(failure.message); }
          finally { checkout.current = null; finish(); }
        },
        modal: { ondismiss: () => { if (!verifying) { checkout.current = null; finish(); } } },
      });
      payment.on('payment.failed', response => { if (mounted.current) setError(response?.error?.description || 'Your payment was not completed. Please retry from the checkout.'); });
      checkout.current = payment; payment.open();
    } catch (failure) { if (mounted.current) setError(failure.message); finish(); }
  };

  if (!activeWorkspace) return <div className="saas-workspace-page"><WorkspaceHeader eyebrow="Studio OS for teams" title="Your studio, ready to grow." description="Manage separate studio workspaces, people and subscriptions in one place." /><section className="studio-card saas-legacy-state"><span className="saas-workspace-emblem"><Layers3 size={28} /></span><h2>Your current studio remains available.</h2><p>This account uses your existing Studio OS. New multi-studio accounts are available when SaaS registration is configured. Your existing clients and projects stay in your current studio.</p><div><Link className="studio-button primary" to="/admin">Open your overview<ArrowRight size={15} /></Link><Link className="studio-button" to="/signup">Create a separate studio<ArrowUpRight size={15} /></Link></div></section></div>;
  const workspace = data?.workspace;
  const owner = data?.role === 'owner';
  const members = data?.members || [], invitations = data?.invitations || [], plans = data?.plans || [];
  const plan = plans.find(item => item.id === workspace?.planId);
  const daysLeft = trialDaysLeft(workspace?.trialEndsAt);
  const isTrial = ['trialing', 'trial'].includes(workspace?.subscriptionStatus);
  const seatLimit = Number(data?.seats?.limit) || 0, seatsUsed = Number(data?.seats?.used) || 0;
  return <div className="saas-workspace-page">
    <WorkspaceHeader eyebrow="A place for your people" title="Studio workspace" description="Your studio, your team and the room to grow."><button type="button" className="studio-button" onClick={refresh} disabled={previewMode || loading || Boolean(busy)}><RefreshCw size={15} />Refresh</button></WorkspaceHeader>
    {previewMode && <aside className="saas-preview-notice" role="note"><ShieldCheck size={20} aria-hidden="true" /><div><strong>SaaS design preview</strong><p>Sample studio, team and trial data. Explore the tabs below. Accounts, invitations and payments are disabled.</p></div><Link className="studio-button small" to="/admin">Back to overview<ArrowRight size={14} /></Link></aside>}
    <WorkspaceError error={error} retry={refresh} />
    {loading && !data ? <WorkspaceEmpty loading /> : !workspace ? <WorkspaceEmpty title="Studio details are unavailable" description="Reconnect to load your workspace and team." /> : <>
      <section className="studio-card saas-workspace-hero"><span className="saas-workspace-emblem"><Building2 size={26} strokeWidth={1.5} /></span><div><span className="saas-kicker">YOUR CREATIVE HOME</span><h2>{workspace.name}</h2><p>{roleLabel(data.role)}<span aria-hidden="true"> · </span><span className="saas-workspace-slug">{workspace.slug}</span></p></div><span className={'saas-state ' + (isTrial ? 'is-trial' : '')}>{statusLabel(workspace.subscriptionStatus)}</span></section>
      <div className="saas-workspace-tabs" role="tablist" aria-label="Workspace management" onKeyDown={navigateTabs}>{tabs.map(tab => <button key={tab.id} id={'saas-tab-' + tab.id} role="tab" type="button" tabIndex={currentTab === tab.id ? 0 : -1} aria-selected={currentTab === tab.id} aria-controls={'saas-panel-' + tab.id} onClick={() => selectTab(tab.id)}><tab.icon size={16} />{tab.label}</button>)}</div>
      <section role="tabpanel" aria-labelledby={'saas-tab-' + currentTab} id={'saas-panel-' + currentTab} className="saas-tab-content">
        {currentTab === 'overview' && <>
          <div className="saas-summary-grid"><article className="studio-card saas-summary"><span>Your plan</span><strong>{plan?.name || workspace.planId || 'Not selected'}</strong><small>{statusLabel(workspace.subscriptionStatus)}</small></article><article className="studio-card saas-summary"><span>Studio seats</span><strong>{seatsUsed}<em> / {seatLimit || '—'}</em></strong><small>Seats in use</small></article><article className="studio-card saas-summary"><span>{isTrial ? 'Trial remaining' : 'Team members'}</span><strong>{isTrial && daysLeft !== null ? daysLeft : members.length}<em>{isTrial ? ' days' : ''}</em></strong><small>{isTrial ? 'Until ' + safeDate(workspace.trialEndsAt) : 'Working together in this studio'}</small></article></div>
          <div className="saas-overview-grid"><section className="studio-card saas-content-card"><span className="saas-section-icon"><UsersRound size={21} /></span><h3>Bring your people together.</h3><p>Invite the people behind your projects and give each person their own sign-in.</p><div className="saas-avatar-stack" aria-label={members.length + ' studio members'}>{members.slice(0, 5).map(member => <span key={workspaceId(member)} title={memberName(member)}>{(member.firstName?.[0] || member.email?.[0] || '?').toUpperCase()}</span>)}</div><button type="button" className="studio-button" onClick={() => selectTab('team')}>Manage studio team<ArrowRight size={15} /></button></section><section className="studio-card saas-content-card"><span className="saas-section-icon"><ShieldCheck size={21} /></span><h3>A workspace of your own.</h3><p>Your branding, clients, documents and connected tools belong to this studio. Switch studios from the sidebar to open a different workspace.</p><Link className="studio-button" to="/admin/settings">Open studio settings<ArrowRight size={15} /></Link></section></div>
        </>}
        {currentTab === 'team' && <>
          <section className="studio-card saas-content-card"><div className="saas-section-heading"><div><h3>Your studio team</h3><p>Individual access for every person in your studio.</p></div><button type="button" className="studio-button primary" onClick={openInvite} disabled={previewMode || !owner || Boolean(busy) || seatsUsed >= seatLimit}><MailPlus size={16} />Invite a member</button></div>
            {!owner && <p className="saas-help">Only the studio owner can invite people or change access.</p>}{owner && seatLimit > 0 && seatsUsed >= seatLimit && <p className="saas-help">All seats are in use. Review your team or choose a plan with more seats.</p>}
            <div className="saas-member-list">{members.map(member => {
              const self = workspaceId(member) === (previewMode ? 'saas-preview-owner' : String(user.id || user._id));
              const editable = owner && member.role !== 'owner' && !self;
              return <article className="saas-member" key={workspaceId(member)}><span className="saas-member-avatar" aria-hidden="true">{(member.firstName?.[0] || member.email?.[0] || '?').toUpperCase()}</span><div className="saas-member-identity"><strong>{memberName(member)}{self && <small>You</small>}</strong><span>{member.email}</span></div>{editable ? <select className="studio-input saas-member-role" aria-label={'Role for ' + memberName(member)} value={member.role} disabled={previewMode || Boolean(busy)} onChange={event => { setFormError(''); setDialog({ type: 'role', member, role: event.target.value }); }}><option value="admin">Administrator</option><option value="staff">Team member</option></select> : <span className="saas-member-role-label">{roleLabel(member.role)}</span>}{editable && <button type="button" className="studio-icon-button" aria-label={'Remove access for ' + memberName(member)} disabled={previewMode || Boolean(busy)} onClick={() => { setFormError(''); setDialog({ type: 'remove', member, role: 'removed' }); }}><Trash2 size={16} /></button>}</article>;
            })}</div>
          </section>
          {invitationLink && <section className="studio-card saas-created-invite" role="status"><div><Check size={19} /><h3>Your invitation is ready.</h3></div><p>Share this private link with the invited person. They’ll use their own Studio OS password to join. This link is only shown when the invitation is created.</p><label className="studio-field">Private invitation link<input readOnly className="studio-input" value={invitationLink} onFocus={event => event.target.select()} /></label><button className="studio-button" type="button" onClick={copyInvitation}><Copy size={15} />Copy invitation link</button></section>}
          <section className="studio-card saas-content-card"><div className="saas-section-heading"><div><h3>Pending invitations <span className="saas-count">{invitations.length}</span></h3><p>Invitations reserve access until they’re accepted, expire or are revoked.</p></div></div>{invitations.length ? <div className="saas-member-list">{invitations.map(invitation => <article className="saas-member saas-invitation" key={workspaceId(invitation)}><span className="saas-member-avatar" aria-hidden="true"><MailPlus size={17} /></span><div className="saas-member-identity"><strong>{invitation.email}</strong><span>Expires {safeDate(invitation.expiresAt)}</span></div><span className="saas-member-role-label">{roleLabel(invitation.role)}</span>{owner && <button type="button" className="studio-button small" disabled={previewMode || Boolean(busy)} onClick={() => { setFormError(''); setDialog({ type: 'revoke', invitation }); }}>Revoke</button>}</article>)}</div> : <div className="saas-empty"><MailPlus size={23} /><p>No invitations waiting.</p><small>Your team’s next chapter starts with an invitation.</small></div>}</section>
        </>}
        {currentTab === 'subscription' && <>
          <section className="studio-card saas-subscription-summary"><div><span className="saas-kicker">YOUR CURRENT SUBSCRIPTION</span><h3>{plan?.name || workspace.planId || 'No plan selected'}</h3><p>{isTrial ? `${daysLeft ?? '—'} days left in your trial · Ends ${safeDate(workspace.trialEndsAt)}` : statusLabel(workspace.subscriptionStatus)}</p></div><div><strong>{seatsUsed}<span> / {seatLimit || '—'} seats</span></strong><small>Manage your team as your studio grows.</small></div></section>
          <div className="saas-plan-heading"><h3>Room for every stage.</h3><p>Choose the capacity that fits your studio.</p></div>
          <div className="saas-plan-grid">{plans.map(item => {
            const price = planPrice(item), current = item.id === workspace.planId, available = !previewMode && owner && data.billing?.configured && item.configured && price;
            return <article className={'studio-card saas-plan' + (current ? ' is-current' : '')} key={item.id}><header><span className="saas-kicker">{item.name}</span>{current && <span className="saas-plan-current">Current plan</span>}</header><div className="saas-plan-price">{price ? <><strong>{price}</strong><span> / month</span></> : <strong className="saas-price-pending">Pricing coming soon</strong>}</div><p>Up to {item.seatLimit} studio seats</p><ul>{(Array.isArray(item.features) ? item.features : []).map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul><button type="button" className={'studio-button' + (current ? ' primary' : '')} disabled={!available || Boolean(busy) || current && workspace.subscriptionStatus === 'active'} onClick={() => subscribe(item)}>{busy === 'checkout:' + item.id ? 'Opening checkout…' : current && workspace.subscriptionStatus === 'active' ? 'Your current plan' : !price ? 'Pricing coming soon' : current && isTrial ? 'Activate this plan' : 'Choose ' + item.name}<ArrowRight size={14} /></button></article>;
          })}</div>
          {!data.billing?.configured && <p className="saas-help"><CreditCard size={16} />Paid subscriptions are not enabled yet. Your current status is shown above; no payment has been requested.</p>}{!owner && <p className="saas-help">The studio owner manages the subscription.</p>}<p className="saas-billing-note">Client invoices and payment schedules are managed separately in Finance and Settings → Billing & payments.</p>
        </>}
      </section>
    </>}
    {dialog?.type === 'invite' && <WorkspaceDialog title="Invite someone to your studio" busy={Boolean(busy)} error={formError} onClose={closeDialog} onSubmit={invite} submitLabel="Create invitation"><label className="studio-field">Email address<input type="email" className="studio-input" value={inviteForm.email} onChange={event => setInviteForm(previous => ({ ...previous, email: event.target.value }))} required maxLength={254} autoComplete="email" placeholder="person@yourstudio.com" /></label><label className="studio-field">Workspace role<select className="studio-input" value={inviteForm.role} onChange={event => setInviteForm(previous => ({ ...previous, role: event.target.value }))}><option value="staff">Team member</option><option value="admin">Administrator</option></select></label><p className="saas-help">You’ll receive a private invitation link to share. This does not send an email automatically. The invited person signs in with their own account.</p></WorkspaceDialog>}
    {dialog && dialog.type !== 'invite' && <WorkspaceDialog title={dialog.type === 'revoke' ? 'Revoke this invitation?' : dialog.role === 'removed' ? 'Remove studio access?' : 'Change workspace role?'} busy={Boolean(busy)} error={formError} onClose={closeDialog} footer={<><button type="button" className="studio-button" onClick={closeDialog} disabled={previewMode || Boolean(busy)}>Cancel</button><button type="button" className="studio-button primary" onClick={changeAccess} disabled={previewMode || Boolean(busy)}>{busy ? 'Updating…' : dialog.type === 'revoke' ? 'Revoke invitation' : dialog.role === 'removed' ? 'Remove access' : 'Change role'}</button></>}><p className="saas-help">{dialog.type === 'revoke' ? `${dialog.invitation.email} will no longer be able to use this invitation link.` : dialog.role === 'removed' ? `${memberName(dialog.member)} will lose access to this studio. Their project records remain in the studio.` : `${memberName(dialog.member)} will become a ${roleLabel(dialog.role).toLowerCase()} in this studio.`}</p></WorkspaceDialog>}
  </div>;
}

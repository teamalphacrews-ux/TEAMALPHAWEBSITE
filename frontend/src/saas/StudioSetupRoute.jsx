import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { openWorkspaceSession, saasRequest, workspaceId } from './api';
import { afterStudioSetup, canReviewStudioSetup, requiresStudioSetup } from './studioSetupAccess';
import { verifyStoredSession } from '../utils/authSession';
import API from '../utils/apiConfig';
import StudioSetup, { StudioSetupFrame } from './StudioSetup';

function SetupWorkspacePicker({ active, token, beforeSwitch, onSwitchError }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const activeId = workspaceId(active);
  useEffect(() => {
    const controller = new AbortController();
    saasRequest('/workspaces', { signal: controller.signal, expectedToken: token }).then(result => {
      if (!controller.signal.aborted) setWorkspaces(result.workspaces || []);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Studio list is unavailable.');
    });
    return () => controller.abort();
  }, [activeId, attempt, token]);

  const switchTo = async event => {
    const id = event.target.value;
    if (switching || !id || id === activeId || (beforeSwitch && !beforeSwitch())) return;
    setSwitching(true);
    setError('');
    try {
      const session = await saasRequest('/workspaces/' + encodeURIComponent(id) + '/switch', { method: 'POST', expectedToken: token });
      if (localStorage.getItem('token') !== token) return;
      await openWorkspaceSession(session);
    } catch (failure) {
      onSwitchError?.();
      setError(failure.message);
      setSwitching(false);
    }
  };
  if (workspaces.length < 2 && !error) return null;
  return <div>
    {workspaces.length > 1 && <select className="studio-setup-switch" aria-label="Switch studio" value={activeId} onChange={switchTo} disabled={switching}>
      {workspaces.map(studio => <option key={workspaceId(studio)} value={workspaceId(studio)}>{studio.name}</option>)}
    </select>}
    {error && <p role="status">{error} {workspaces.length < 2 && <button type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button>}</p>}
  </div>;
}

function WaitingForOwner({ name, onSignOut, workspacePicker }) {
  const { token, user, updateUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(null);
  const check = useCallback(async (announce = false) => {
    if (pending.current || document.visibilityState === 'hidden') return;
    const request = new AbortController();
    pending.current = request;
    setChecking(true);
    if (announce) setMessage('');
    try {
      const result = await verifyStoredSession({ token, user }, { api: API, fetcher: fetch, signal: request.signal });
      if (request.signal.aborted) return;
      if (result.status === 'expired') { window.location.reload(); return; }
      if (result.status !== 'valid') {
        if (announce) setMessage('Could not reach your studio. Check your connection and try again.');
      } else if (!requiresStudioSetup(result.user) || result.user.workspaceRole !== user.workspaceRole) {
        updateUser(result.user, token);
      } else if (announce) setMessage('Your studio owner is still setting up.');
    } catch (failure) {
      if (announce && !request.signal.aborted) setMessage(failure.message);
    } finally {
      if (!request.signal.aborted) setChecking(false);
      if (pending.current === request) pending.current = null;
    }
  }, [token, user, updateUser]);
  useEffect(() => {
    const whenVisible = () => { void check(); };
    const timer = window.setInterval(whenVisible, 30000);
    window.addEventListener('focus', whenVisible);
    document.addEventListener('visibilitychange', whenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', whenVisible);
      document.removeEventListener('visibilitychange', whenVisible);
      pending.current?.abort();
      pending.current = null;
    };
  }, [check]);
  return <StudioSetupFrame onSignOut={onSignOut} workspacePicker={workspacePicker}>
    <section className="studio-setup-message">
      <h1>Your studio is being set up</h1>
      <p>The owner of {name || 'your studio'} needs to finish the studio details. Your workspace will open here when it’s ready.</p>
      <button type="button" className="studio-setup-primary" disabled={checking} onClick={() => check(true)}>{checking ? 'Checking…' : 'Check again'}</button>
      {message && <p role="status">{message}</p>}
    </section>
  </StudioSetupFrame>;
}

export default function StudioSetupRoute() {
  const { user, token, updateUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const review = canReviewStudioSetup(user) && new URLSearchParams(location.search).get('restart') === '1';
  const returnToSettings = () => navigate('/admin/settings', { replace: true });
  const id = workspaceId(user.workspace);
  const finish = useCallback(workspace => {
    if (!id || workspaceId(workspace) !== id || workspace?.setupRequired !== false) return;
    updateUser({ workspace: { ...user.workspace, ...workspace } }, token);
    if (review) navigate('/admin/settings', { replace: true });
  }, [id, user.workspace, token, updateUser, review, navigate]);

  if (!requiresStudioSetup(user) && !review) return <Navigate to={afterStudioSetup(user, location.state?.returnTo)} replace />;
  const workspacePicker = <SetupWorkspacePicker active={user.workspace} token={token} />;
  if (user.workspaceRole !== 'owner') {
    return <WaitingForOwner name={user.workspace.name} onSignOut={logout} workspacePicker={workspacePicker} />;
  }
  return <StudioSetup onReturn={review ? returnToSettings : undefined} sessionToken={token} onComplete={finish} onSignOut={logout} workspacePicker={workspacePicker} />;
}

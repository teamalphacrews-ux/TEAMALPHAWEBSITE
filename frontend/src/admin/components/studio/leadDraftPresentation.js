// A warning or unresolved recovery state must remain in the form's main flow.
// Only routine online draft controls belong behind the compact disclosure.
export const canCollapseLeadDraft = draft => Boolean(draft.enabled && draft.ready && draft.online && !draft.candidate && !draft.error && ['idle', 'saving', 'local', 'synced'].includes(draft.status));

export const leadDraftSummary = draft => draft.status === 'saving' ? 'Saving local draft…' : draft.status === 'local' ? 'Draft saved on this device' : 'Local draft options';

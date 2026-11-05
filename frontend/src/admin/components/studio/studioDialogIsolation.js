const isolatedNodes = new WeakMap();
const lockedDocuments = new WeakMap();

/** Nested dialogs can unmount in either order; only the last one unlocks scrolling. */
export function lockDialogScroll(document) {
  let state = lockedDocuments.get(document);
  if (!state) {
    state = { count: 0, overflow: document.body.style.overflow };
    lockedDocuments.set(document, state);
    document.body.style.overflow = 'hidden';
  }
  state.count++;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (--state.count !== 0) return;
    document.body.style.overflow = state.overflow;
    lockedDocuments.delete(document);
  };
}

/** This helper is the sole owner of inert on a dialog's interactive background. */
export function isolateDialogBackground(dialog) {
  const document = dialog.ownerDocument;
  const HTMLElement = document.defaultView.HTMLElement;
  const nodes = [];
  let branch = dialog;
  while (branch && branch !== document.body) {
    const parent = branch.parentElement;
    if (!parent) break;
    for (const sibling of parent.children) {
      if (sibling === branch || !(sibling instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
      // A drawer backdrop is part of its dismissal UI, not disabled page content.
      if (dialog.id && sibling.getAttribute('data-studio-dismiss-for') === dialog.id) continue;
      let state = isolatedNodes.get(sibling);
      if (!state) {
        state = { count: 0, inert: sibling.inert, hidden: sibling.getAttribute('aria-hidden') };
        isolatedNodes.set(sibling, state);
      }
      state.count++;
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
      nodes.push(sibling);
    }
    branch = parent;
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const node of nodes) {
      const state = isolatedNodes.get(node);
      if (!state || --state.count !== 0) continue;
      node.inert = state.inert;
      if (state.hidden === null) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', state.hidden);
      isolatedNodes.delete(node);
    }
  };
}

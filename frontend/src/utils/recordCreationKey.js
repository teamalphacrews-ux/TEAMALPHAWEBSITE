export function newRecordCreationKey(crypto = globalThis.crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, "0")).join("");
}

export function enquiryDraftWithKey(draft) {
  const creationKey = typeof draft.creationKey === 'string' && /^[a-f0-9]{32}$/.test(draft.creationKey)
    ? draft.creationKey : newRecordCreationKey();
  return { ...draft, creationKey };
}

// The settings snapshot must not be saved while its new photo is still resolving.
// Releases belong to one operation so a cancelled upload cannot unlock a later one.
export function createSettingsActionGate() {
  let active = null;
  return {
    pending: kind => Boolean(active && (!kind || active.kind === kind)),
    begin(kind) {
      if (active) return null;
      const operation = { kind };
      active = operation;
      return () => { if (active === operation) active = null; };
    },
  };
}

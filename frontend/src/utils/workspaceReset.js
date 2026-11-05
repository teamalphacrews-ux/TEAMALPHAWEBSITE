export const RESET_CONFIRMATION = 'DELETE WORKSPACE DATA';

// Missing or partial status must never make a destructive action available.
export function resetReadiness(summary, { preview = false } = {}) {
  if (preview) return { ready: false, title: 'Preview only', message: 'Explore the steps here. Sign in with your saved studio owner account to back up or reset data.' };
  if (!summary) return { ready: false, title: 'Status not verified', message: 'Check the server status before continuing. No data has been changed.' };
  if (summary.keyConfigured !== true) return { ready: false, title: 'Backup setup required', message: 'Your server operator needs to configure the recovery key before a protected reset is available.' };
  if (summary.maintenanceBlocked === true) return { ready: false, title: 'Server maintenance needs attention', message: 'A previous operation did not finish safely. Your server operator must verify it has stopped and repair the maintenance lock. Owner access cannot clear this lock.' };
  if (summary.recoveryEnabled !== true) return { ready: false, title: 'Recovery verification pending', message: 'Your server operator must complete a backup and restore test on a separate test database, then enable reset. You can still save an encrypted backup.' };
  if (summary.resetBlocked !== false || summary.blockers?.length) return { ready: false, title: 'Server check required', message: 'The server has not cleared this workspace for reset. Review the server details or check again.' };
  return { ready: true, title: 'Ready for owner confirmation', message: 'A fresh safety archive must be created successfully by the server before any data is deleted.' };
}

export function canConfirmReset({ summary, preview, backupId, savedCopy, acknowledged, phrase, password, busy }) {
  return resetReadiness(summary, { preview }).ready && Boolean(backupId) && savedCopy === true && acknowledged === true && phrase === RESET_CONFIRMATION && Boolean(password?.trim()) && !busy;
}

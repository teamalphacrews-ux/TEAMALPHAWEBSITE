const { parseArgs } = require('node:util');
const mongoose = require('mongoose');

async function reconcileWorkspaceSeats(workspaceId, { apply = false } = {}) {
  if (!/^[a-f0-9]{24}$/i.test(String(workspaceId))) throw new Error('Supply one valid workspace ID.');
  const { Workspace, Membership, Invitation } = require('../saas/models');
  return mongoose.connection.transaction(async session => {
    const workspace = await Workspace.findOne({ _id: workspaceId, state: 'active' }).session(session);
    if (!workspace) throw new Error('The active workspace was not found.');
    const owner = await Membership.exists({ workspaceId, accountId: workspace.ownerAccountId, state: 'active', role: 'owner' }).session(session);
    if (!owner) throw new Error('Review the missing owner membership before reconciling seats.');
    const accepting = await Invitation.exists({ workspaceId, state: 'accepting' }).session(session);
    if (accepting) throw new Error('Finish or recover the in-flight invitation before reconciling seats.');
    const members = await Membership.countDocuments({ workspaceId, state: 'active' }).session(session);
    // Expired-by-date invitations still reserve a seat until the expiry job releases it.
    const pending = await Invitation.countDocuments({ workspaceId, state: 'pending' }).session(session);
    const expected = members + pending;
    const previous = workspace.seatsReserved;
    if (apply && previous !== expected) {
      workspace.seatsReserved = expected;
      await workspace.save({ session });
    }
    return { previous, expected, members, pending, applied: apply && previous !== expected };
  }, { readConcern: { level: 'snapshot' } });
}

async function main() {
  const { values } = parseArgs({ options: { workspace: { type: 'string' }, apply: { type: 'boolean' } } });
  if (!process.env.MONGO_URI || !/^[a-f0-9]{24}$/i.test(values.workspace || '')) {
    throw new Error('Supply MONGO_URI and --workspace=<id>. Add --apply to update the seat count.');
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
  try {
    const result = await reconcileWorkspaceSeats(values.workspace, { apply: values.apply });
    console.log(JSON.stringify(result));
    if (result.applied) {
      const check = await reconcileWorkspaceSeats(values.workspace);
      if (check.previous !== check.expected) throw new Error('The verification counts differ.');
    }
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  main().catch(() => {
    console.error('Seat reconciliation could not complete. Verify the workspace, owner membership, in-flight invitations and replica set connection.');
    process.exitCode = 1;
  });
}
module.exports = { reconcileWorkspaceSeats };

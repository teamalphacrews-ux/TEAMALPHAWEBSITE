const { parseArgs } = require("node:util");
const mongoose = require("mongoose");
const { installTenantModels } = require("../saas/tenantModels");
const { runInWorkspace } = require("../saas/tenantContext");

const objectId = value => /^[a-f0-9]{24}$/i.test(value || "");

async function main() {
  const { values } = parseArgs({ options: {
    workspace: { type: "string" },
    legacy: { type: "boolean" },
    after: { type: "string" },
    limit: { type: "string", default: "50" },
    apply: { type: "boolean" },
  } });
  const { workspace, legacy, after, apply } = values;
  const limit = Number(values.limit);
  if (!process.env.MONGO_URI || !apply || Boolean(workspace) === Boolean(legacy) ||
      (workspace && !objectId(workspace)) || (after && !objectId(after)) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) {
    console.error("Supply MONGO_URI explicitly and run with --apply, exactly one of --workspace=<id> or --legacy, and optionally --after=<projectId> --limit=50 (1–100).");
    process.exitCode = 1;
    return;
  }
  installTenantModels(mongoose);
  const archiveGate = require("../services/studioArchiveGate");
  archiveGate.installWriteFence(mongoose);
  const { Workspace } = require("../saas/models");
  const { reconcile } = require("../services/enquiryPipeline");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  try {
    const selected = workspace ? await Workspace.findOne({ _id: workspace, state: "active" }).lean() : null;
    if (workspace && (!selected || selected.databaseName !== `studio_${selected._id}`)) {
      console.error("The requested workspace is unavailable.");
      process.exitCode = 1;
      return;
    }
    const report = await runInWorkspace(selected, () => archiveGate.withShared(() => reconcile({ after, limit })));
    console.log(JSON.stringify(report));
    if (report.warnings.length) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error("The repair batch could not be completed. Retry with the same checkpoint.");
  process.exitCode = 1;
});

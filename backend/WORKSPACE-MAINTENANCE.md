# Workspace maintenance safety block

The archive gate persistently blocks reset, replace-restore and integration resume
if any shared reader lease expires before it is released. Normal shared work can
continue. Restarting the backend does not clear this block.

An expired lease does not prove that its process stopped: a partitioned or paused
process could still have submitted an old database command. Do not clear the flag
while an old process, request, worker or database transaction may still be running.

## Operator recovery

1. Stop traffic and stop every backend instance and worker for this personal
   installation, including any older deployment. Wait for all in-flight database
   writes and transactions to finish or abort.
2. Confirm the selected MongoDB database is the personal installation, not a
   separate database named studio_<workspace ID>. Make an independent database
   backup before any manual repair.
3. Inspect the singleton in the studioarchivestates collection. With all old
   processes stopped, an authorized database operator may run:

   db.studioarchivestates.updateOne(
     { _id: "legacy", uncertainReaders: true },
     {
       $set: { uncertainReaders: false, readers: [] },
       $unset: { maintenanceToken: 1, maintenanceUntil: 1 }
     }
   )

   Leave dataVersion and integrationsPaused unchanged. Do not change other
   collections or any SaaS registry/workspace database.
4. Start only the approved backend version. Confirm health and owner recovery
   status, then make a fresh encrypted archive before retrying maintenance.

There is intentionally no API to auto-clear uncertain readers. Owner password
verification, confirmation text and the mandatory safety snapshot remain required
after operator recovery.

import { useState } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import StudioButton from "../common/StudioButton";
import { OperationsModal } from "../operations/OperationsUI";
import { WorkspaceError } from "../operations/WorkspaceUI";
import { recordError, workspaceRequest } from "../operations/workspaceData";

const projectName = project => project.name || "Untitled project";

export function ProjectDeleteButton({ project, onDelete, iconOnly = true, disabled = false }) {
  return <StudioButton
    type="button"
    variant={iconOnly ? "icon" : "outline"}
    className="sx-project-delete"
    icon={Trash2}
    label={iconOnly ? `Delete project: ${projectName(project)}` : "Delete project"}
    aria-haspopup="dialog"
    disabled={disabled}
    onClick={() => onDelete(project)}
  />;
}

export default function ProjectDeleteDialog({ project, onClose, onDeleted }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function deleteProject() {
    setPending(true);
    setError("");
    try {
      await workspaceRequest("delete", `/api/studio-projects/${project._id}`);
    } catch (requestError) {
      setError(recordError(requestError));
      setPending(false);
      return;
    }
    toast.success("Project moved to the Recovery bin.");
    onDeleted();
  }

  return <OperationsModal
    title="Delete project?"
    description={`Move “${projectName(project)}” to Recovery?`}
    onClose={onClose}
    busy={pending}
    footer={<>
      <StudioButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</StudioButton>
      <StudioButton type="button" variant="destructive" loading={pending} loadingLabel="Deleting project" onClick={deleteProject}>Delete project</StudioButton>
    </>}
  >
    <p>The studio owner can restore this project from Settings → Data → Recovery bin. Archive projects with linked records or production work to keep their history.</p>
    <WorkspaceError error={error} />
  </OperationsModal>;
}

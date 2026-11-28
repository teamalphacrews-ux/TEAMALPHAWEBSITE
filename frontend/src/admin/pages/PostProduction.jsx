import WorkspaceMotionTitle from '../components/common/WorkspaceMotionTitle';
import { useWorkspaceModuleSearch } from '../components/common/WorkspaceModuleSearch';
import StudioButton from '../components/common/StudioButton';
import StudioSelect from '../components/common/StudioSelect';
import { useAuth } from '../../context/AuthContext';
import { hasModuleAccess } from '../../utils/moduleAccess';
import { canWriteWorkspaceModule } from '../../utils/workspaceActions';
import { newRecordCreationKey } from "../../utils/recordCreationKey.js";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownWideNarrow,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Columns3,
  List,
  UserRound,
  Film,
  Eye,
  FolderOpen,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  OperationsError,
  OperationsLoading,
  OperationsModal,
} from "../components/operations/OperationsUI";
import {
  dateInputValue,
  operationAPI,
  operationAuth,
  operationDate,
  operationError,
} from "../components/operations/operationsUtils";
import "./studioOperations.css";
import ApplyProductionTemplate from '../components/settings/ApplyProductionTemplate';
import './financeProductionRefinement.css';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../saas/release';
import './studioCommercialTasks.css';
import './studioRecordDesk.css';
import RecordViewSwitch from './RecordViewSwitch';
import { recordPositions, settleRecordPositions } from './recordTransitions';
import ScheduledWorkAction from '../components/operations/ScheduledWorkAction';
import { nextProductionTask } from '../components/operations/nextScheduledWork';

const getLeadId = (task) =>
  typeof task.lead === "object" ? task.lead?._id : task.lead;
const isOverdue = (task, today) =>
  task.status !== "completed" &&
  task.dueDate &&
  new Date(task.dueDate).getTime() < today;

const taskBoardLanes = [
  { id: 'planned', title: 'To do', stages: ['Not started'] },
  { id: 'working', title: 'In progress', stages: ['In progress', 'Editing'] },
  { id: 'review', title: 'Review', stages: ['In review', 'Awaiting your selection'] },
  { id: 'delivery', title: 'Delivery', stages: ['Ready', 'Uploaded to Drive', 'Delivered'] },
  { id: 'complete', title: 'Completed', stages: [] },
];
const taskLane = task => task.status === 'completed'
  ? 'complete'
  : taskBoardLanes.find(lane => lane.stages.includes(task.productionStage))?.id || 'planned';

function TaskActionButtons({ task, disabled, canDelete, onToggle, onEdit, onDelete }) {
  const completed = task.status === 'completed';
  return <div className="sx-task-actions" role="group" aria-label={'Actions for ' + task.title}>
    <StudioButton type="button" variant="icon" icon={completed ? RotateCcw : Check} data-task-action="complete"
      label={`${completed ? 'Reopen' : 'Complete'} task: ${task.title}`} disabled={disabled} onClick={() => onToggle(task)} />
    <StudioButton type="button" variant="icon" icon={Pencil}
      label={'Edit task: ' + task.title} disabled={disabled} onClick={() => onEdit(task)} />
    {canDelete && <StudioButton type="button" variant="destructive" icon={Trash2} iconOnly
      label={'Delete task: ' + task.title} disabled={disabled} onClick={() => onDelete(task)} />}
  </div>;
}

function CommercialTaskBoard({ tasks, getProject, crew, today, busyId, openEditor, toggleTask, requestDelete, canWrite, canDelete, moveTask }) {
  const boardId = useId();
  const [dragged, setDragged] = useState(null);
  const [dropLane, setDropLane] = useState(null);
  const [showEmptyStages, setShowEmptyStages] = useState(false);
  const finishDrag = () => { setDragged(null); setDropLane(null); };
  const lanes = taskBoardLanes.map(lane => ({
    ...lane,
    items: tasks.filter(task => taskLane(task) === lane.id),
  }));
  const emptyStages = lanes.filter(lane => !lane.items.length);
  return <div className="sx-task-board" role="region" aria-label="Production task board" tabIndex={0}
    data-show-empty={showEmptyStages || undefined} data-dragging={Boolean(dragged) || undefined}>
    {emptyStages.length > 0 && (
      <button type="button" className="sx-task-empty-stage-toggle" aria-expanded={showEmptyStages}
        aria-controls={emptyStages.map(lane => boardId + '-' + lane.id).join(' ')} onClick={() => setShowEmptyStages(show => !show)}>
        {showEmptyStages ? 'Hide empty stages' : 'Show empty stages'}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    )}
    {lanes.map(lane => {
      const { items } = lane;
      return <section className="sx-task-lane" id={boardId + '-' + lane.id} data-lane={lane.id} key={lane.id} aria-labelledby={'sx-task-lane-' + lane.id}
        data-empty={!items.length || undefined}
        data-drop-target={dropLane === lane.id || undefined}
        onDragOver={event => {
          if (!dragged || !canWrite || taskLane(dragged) === lane.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropLane(lane.id);
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropLane(null); }}
        onDrop={event => {
          if (!dragged || !canWrite) return;
          event.preventDefault();
          if (taskLane(dragged) !== lane.id) moveTask(dragged, lane);
          finishDrag();
        }}>
        <header className="sx-task-lane-header"><h3 id={'sx-task-lane-' + lane.id}><span aria-hidden="true" />{lane.title}</h3><span className="sx-task-lane-count">{items.length}<span className="ops-sr-only"> {items.length === 1 ? 'task' : 'tasks'}</span></span></header>
        <div className="sx-task-lane-items">
          {items.length ? items.map((task, index) => {
            const project = getProject(task);
            const done = task.status === 'completed';
            const late = isOverdue(task, today);
            const assignee = task.assignee?.name || crew.find(person => person._id === task.assignee)?.name;
            return <article className={'sx-task-card' + (done ? ' is-complete' : '')} key={task._id} aria-busy={busyId === task._id}
              data-record-key={task._id} data-dragging={dragged?._id === task._id || undefined} style={{ '--record-order': Math.min(index, 6) }}
              draggable={canWrite && !busyId} onDragStart={event => {
                if (!canWrite || busyId) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', task._id);
                setDragged(task);
              }} onDragEnd={finishDrag}>
              <header className="sx-task-card-heading">
                <button type="button" data-task-action="open" className="sx-task-card-title"
                  disabled={Boolean(busyId)} onClick={() => openEditor(task)}>{task.title}</button>
                <p className="sx-task-card-project"><span aria-hidden="true" />{project?.name || (getLeadId(task) ? 'Linked project' : 'Studio task')}</p>
              </header>
              <div className="sx-task-card-status">
                <span className={'sx-task-stage' + (done ? ' is-complete' : '')}>{done ? 'Completed' : task.productionStage || 'Not started'}</span>
                <span>{task.deliveryType || 'Other'}</span>
              </div>
              <div className="sx-task-card-meta">
                <span className={late ? 'is-overdue' : ''}>
                  <CalendarDays size={14} aria-hidden="true" />
                  <span>{late && 'Overdue · '}{task.dueDate ? operationDate(task.dueDate) : 'No due date'}</span>
                </span>
                <span>
                  {assignee ? <i className="record-assignee" aria-hidden="true">{assignee.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</i> : <UserRound size={14} aria-hidden="true" />}
                  <span>{assignee || (task.assignee ? 'Assigned crew' : 'Unassigned')}</span>
                </span>
                {task.clientVisible && <span><Eye size={14} aria-hidden="true" /><span>Client-visible update</span></span>}
              </div>
              {canWrite && <footer className="sx-task-card-actions">
                <TaskActionButtons task={task} disabled={Boolean(busyId)} canDelete={canDelete}
                  onToggle={toggleTask} onEdit={openEditor} onDelete={requestDelete} />
              </footer>}
            </article>;
          }) : <p className="sx-task-lane-empty">No tasks in this stage.</p>}
        </div>
      </section>;
    })}
  </div>;
}

export default function PostProduction() {
  const { user } = useAuth();
  const canWrite = !IS_COMMERCIAL_DEPLOYMENT || canWriteWorkspaceModule(user, 'production');
  const canDelete = canWrite && (!IS_COMMERCIAL_DEPLOYMENT || (user?.workspaceRole || user?.workspace?.role) !== 'staff');
  const canCrew = hasModuleAccess(user, 'crew');
  const canEnquiries = hasModuleAccess(user, 'enquiries');
  const [search, setSearch] = useSearchParams();
  const [crew, setCrew] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [crewError, setCrewError] = useState("");
  const [query, setQuery] = useState("");
  const useTopbarSearch = useWorkspaceModuleSearch({ label: 'Search tasks or projects', query, onChange: setQuery });
  const viewKey = 'studioxos-task-view:' + (user?._id || user?.id || 'current');
  const [taskView, setTaskView] = useState(() => {
    if (!IS_COMMERCIAL_DEPLOYMENT) return 'list';
    try { return localStorage.getItem(viewKey) === 'list' ? 'list' : 'board'; } catch { return 'board'; }
  });
  const chooseTaskView = next => {
    setTaskView(next);
    try { localStorage.setItem(viewKey, next); } catch { /* The selected view still works in this session. */ }
  };
  const [filter, setFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState(
    search.get("project") || "all",
  );
  const [sort, setSort] = useState("due");
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState({
    title: "",
    dueDate: "",
    lead: "",
    clientVisible: false,
    clientTitle: "",
    deliveryType: "Photos",
    productionStage: "Not started",
    clientUpdate: "",
    deliveryUrl: "",
    assignee: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [linkNotice, setLinkNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const workspace = useRef(null);
  const submittingTask = useRef(false);
  const previousTaskLayout = useRef(null);
  useLayoutEffect(() => {
    const previous = previousTaskLayout.current;
    if (busyId || !previous || !workspace.current) return;
    previousTaskLayout.current = null;
    const container = workspace.current.querySelector('.sx-task-board,.ops-table-scroll');
    if (container === previous.container) settleRecordPositions(container, previous.positions);
    if (!previous.focus || !document.hasFocus() || document.activeElement !== document.body) return;
    const entry = container?.querySelector('[data-record-key="' + CSS.escape(previous.id) + '"]');
    const control = entry?.querySelector('[data-task-action="' + previous.focus + '"]')
      || workspace.current.querySelector('.sx-task-view-switch [aria-pressed=true]');
    control?.focus({ preventScroll: true });
  }, [tasks, busyId]);
  const [deleting, setDeleting] = useState(null);
  const [today, setToday] = useState(() => new Date().setHours(0, 0, 0, 0));

  const fetchWorkspace = useCallback(() => {
    return Promise.allSettled([
      axios.get(`${operationAPI}/api/tasks`, operationAuth()),
      canEnquiries ? axios.get(`${operationAPI}/api/leads`, operationAuth()) : Promise.resolve({data:[]}),
      canCrew ? axios.get(`${operationAPI}/api/photographers`, operationAuth()) : Promise.resolve({data:[]}),
    ]).then(([taskResult, leadResult, crewResult]) => {
      if (
        taskResult.status === "fulfilled" &&
        Array.isArray(taskResult.value.data)
      ) {
        setTasks(taskResult.value.data);
        setLoadError("");
      }
      else
        setLoadError(
          operationError(
            taskResult.reason,
            "We couldn't load your production tasks.",
          ),
        );
      if (
        leadResult.status === "fulfilled" &&
        Array.isArray(leadResult.value.data)
      ) {
        setLeads(leadResult.value.data);
        setProjectError("");
      }
      else
        setProjectError(
          "Projects are unavailable. You can still manage tasks without a project.",
        );
      if (crewResult.status === "fulfilled" && Array.isArray(crewResult.value.data)) {
        setCrew(crewResult.value.data);
        setCrewError("");
      } else setCrewError("The crew roster is unavailable. Existing assignments are preserved; retry before changing the assigned person.");
      setLoading(false);
    });
  }, [canCrew, canEnquiries]);
  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);
  useEffect(() => {
    const timer = setInterval(
      () => setToday(new Date().setHours(0, 0, 0, 0)),
      60000,
    );
    return () => clearInterval(timer);
  }, []);
  const retryWorkspace = () => {
    setLoading(true);
    setLoadError("");
    setProjectError("");
    fetchWorkspace();
  };

  const leadMap = useMemo(
    () => new Map(leads.map((lead) => [lead._id, lead])),
    [leads],
  );
  const getProject = useCallback(
    (task) =>
      typeof task.lead === "object" && task.lead?.name
        ? task.lead
        : leadMap.get(getLeadId(task)),
    [leadMap],
  );
  const pending = tasks.filter((task) => task.status !== "completed");
  const completed = tasks.filter((task) => task.status === "completed");
  const overdue = pending.filter((task) => isOverdue(task, today));
  const dueSoon = pending.filter(
    (task) =>
      task.dueDate &&
      new Date(task.dueDate).getTime() >= today &&
      new Date(task.dueDate).getTime() < today + 7 * 86400000,
  );
  const nextTasks = [...pending]
    .filter((task) => task.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4);
  const completionRate = tasks.length
    ? Math.round((completed.length / tasks.length) * 100)
    : 0;
  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (filter === "pending" && task.status === "completed") return false;
          if (filter === "completed" && task.status !== "completed")
            return false;
          if (filter === "overdue" && !isOverdue(task, today)) return false;
          if (projectFilter === "unassigned" && getLeadId(task)) return false;
          if (
            projectFilter !== "all" &&
            projectFilter !== "unassigned" &&
            getLeadId(task) !== projectFilter
          )
            return false;
          return `${task.title} ${getProject(task)?.name || ""}`
            .toLowerCase()
            .includes(query.toLowerCase().trim());
        })
        .sort((a, b) => {
          if (sort === "newest")
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          if (a.status !== b.status) return a.status === "completed" ? 1 : -1;
          return (
            (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
            (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
          );
        }),
    [tasks, filter, projectFilter, query, sort, getProject, today],
  );

  const nextTask = IS_COMMERCIAL_DEPLOYMENT && !loading && !loadError ? nextProductionTask(filteredTasks) : null;
  const openEditor = (task = null, newLeadId = undefined) => {
    setEditing(task);
    setLinkNotice("");
    setForm({
      ...(task ? {} : { creationKey: newRecordCreationKey() }),
      title: task?.title || "",
      dueDate: dateInputValue(task?.dueDate),
      lead: getLeadId(task || {}) || (newLeadId ?? (!["all", "unassigned"].includes(projectFilter) ? projectFilter : "")),
      clientVisible: task?.clientVisible || false,
      clientTitle: task?.clientTitle || "",
      deliveryType: task?.deliveryType || "Photos",
      productionStage: task?.productionStage || "Not started",
      clientUpdate: task?.clientUpdate || "",
      deliveryUrl: task?.deliveryUrl || "",
      assignee: task?.assignee?._id || task?.assignee || "",
    });
    setFormError("");
  };
  const openedTask=useRef('');
  useEffect(()=>{
    const id=search.get('task');
    if(!id){openedTask.current='';return;}
    if(loading||openedTask.current===id)return;
    const task=tasks.find(row=>row._id===id);if(!task)return;let active=true;
    Promise.resolve().then(()=>{
      if(!active)return;
      openedTask.current=id;
      openEditor(task);
      if (IS_COMMERCIAL_DEPLOYMENT) setSearch(current => {
        const next = new URLSearchParams(current);
        next.delete('task');
        next.delete('new');
        return next;
      }, { replace: true });
    });
    return()=>{active=false;};
    // Open only the explicitly requested loaded task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[search,tasks,loading]);
  useEffect(() => {
    if (!IS_COMMERCIAL_DEPLOYMENT || !canWrite || loading || search.get('new') !== '1' || search.get('task')) return;
    const studioProject = search.get('studioProject');
    const lead = studioProject ? leads.find(item => (item.studioProjectId?._id || item.studioProjectId) === studioProject) : null;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      openEditor(null, studioProject ? lead?._id || '' : undefined);
      if (studioProject && !lead) {
        setLinkNotice('This project has no accessible linked enquiry. The new task will use the project selected below.');
      }
      setSearch(current => {
        const next = new URLSearchParams(current);
        next.delete('new');
        next.delete('studioProject');
        return next;
      }, { replace: true });
    });
    return () => { active = false; };
    // Consume the creation request once, after the linked project choices load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, loading, search, leads, setSearch]);
  const saveTask = async (event) => {
    event.preventDefault();
    if (submittingTask.current || saving || !canWrite) return;
    if (!form.title.trim()) {
      setFormError("Give this task a title.");
      return;
    }
    submittingTask.current = true;
    setSaving(true);
    setFormError("");
    try {
      const body = {
        ...form,
        title: form.title.trim(),
        dueDate: form.dueDate
          ? new Date(`${form.dueDate}T12:00:00`).toISOString()
          : null,
      };
      if (!canCrew) delete body.assignee;
      let response;
      if (editing) {
        response = await axios.patch(
          `${operationAPI}/api/tasks/${editing._id}`,
          body,
          operationAuth(),
        );
        if (!response.data?._id) throw new Error("The saved task was not returned.");
        setTasks((current) =>
          current.map((task) =>
            task._id === editing._id
              ? { ...task, ...response.data, lead: task.lead }
              : task,
          ),
        );
      } else {
        response = await axios.post(
          form.lead && !IS_COMMERCIAL_DEPLOYMENT
            ? `${operationAPI}/api/leads/${form.lead}/tasks`
            : `${operationAPI}/api/tasks`,
          { ...body, status: "pending" },
          operationAuth(),
        );
        if (!response.data?._id) throw new Error("The saved task was not returned.");
        setTasks((current) => [
          {
            ...response.data,
            lead: form.lead ? leadMap.get(form.lead) || form.lead : null,
          },
          ...current,
        ]);
      }
      setEditing(undefined);
      toast.success(editing ? "Task updated." : "Task added.");
    } catch (error) {
      setFormError(
        operationError(error, "We couldn't save this task. Please try again."),
      );
    } finally {
      submittingTask.current = false;
      setSaving(false);
    }
  };
  const updateTaskStage = async (task, changes, feedback) => {
    if (busyId || !canWrite) return;
    if (IS_COMMERCIAL_DEPLOYMENT) {
      const container = workspace.current?.querySelector('.sx-task-board,.ops-table-scroll');
      const active = document.activeElement;
      const focus = active?.closest('[data-record-key]')?.dataset.recordKey === task._id ? active.dataset.taskAction : null;
      previousTaskLayout.current = { container, positions: recordPositions(container), focus, id: task._id };
    }
    setBusyId(task._id);
    try {
      const response = await axios.patch(
        `${operationAPI}/api/tasks/${task._id}`,
        changes,
        operationAuth(),
      );
      if (response.data?._id !== task._id) throw new Error("The updated task was not returned.");
      setTasks((current) =>
        current.map((item) =>
          item._id === task._id
            ? { ...item, ...response.data, lead: item.lead }
            : item,
        ),
      );
      toast.success(feedback);
    } catch (error) {
      toast.error(operationError(error, "We couldn't update the task."));
    } finally {
      setBusyId("");
    }
  };
  const toggleTask = task => updateTaskStage(task,
    { status: task.status === 'completed' ? 'pending' : 'completed' },
    task.status === 'completed' ? 'Task reopened.' : 'Task completed.');
  const moveTask = (task, lane) => updateTaskStage(task,
    lane.id === 'complete' ? { status: 'completed' } : { productionStage: lane.stages[0] },
    'Task moved to ' + lane.title.toLowerCase() + '.');
  const requestDelete = task => {
    setDeleting(task);
    setFormError('');
  };
  const deleteTask = async () => {
    if (saving || !canDelete) return;
    setSaving(true);
    setFormError("");
    try {
      await axios.delete(
        `${operationAPI}/api/tasks/${deleting._id}`,
        operationAuth(),
      );
      setTasks((current) =>
        current.filter((task) => task._id !== deleting._id),
      );
      setDeleting(null);
      toast.success("Task deleted.");
    } catch (error) {
      setFormError(operationError(error, "We couldn't delete this task."));
    } finally {
      setSaving(false);
    }
  };

  const taskStages = [
    { id: "all", label: "All tasks", count: tasks.length },
    { id: "pending", label: "Pending", count: pending.length },
    { id: "completed", label: "Completed", count: completed.length },
    { id: "overdue", label: "Overdue", count: overdue.length },
  ];
  const phoneStatus = <div className="studio-phone-filter">
    <StudioSelect aria-label="Filter tasks by status" value={filter} onChange={event => setFilter(event.target.value)}>
      {taskStages.map(stage => <option key={stage.id} value={stage.id}>{stage.label} · {stage.count}</option>)}
    </StudioSelect>
  </div>;

  const viewSwitch = <RecordViewSwitch value={taskView} onChange={chooseTaskView} label="Task view"
    className="sx-task-view-switch" surfaceSelector=".sx-task-board,.ops-table-scroll"
    views={[{ id: 'board', label: 'Board', icon: Columns3 }, { id: 'list', label: 'List', icon: List }]} />;
  const statusFilters = <div className="studio-tabs ops-tabs" role="group" aria-label="Filter tasks">
    {taskStages.map((tab) => (
      <button
        key={tab.id}
        type="button"
        className={filter === tab.id ? "active" : ""}
        aria-pressed={filter === tab.id}
        onClick={() => setFilter(tab.id)}
      >
        {tab.label}
        <span>{tab.count}</span>
      </button>
    ))}
  </div>;

  return (
    <div ref={workspace} className={"studio-ops production-workspace-refined" + (IS_COMMERCIAL_DEPLOYMENT ? " sx-task-page" : "")} data-task-view={IS_COMMERCIAL_DEPLOYMENT ? taskView : undefined}>
      <div className="studio-page-heading">
        <div>

          <WorkspaceMotionTitle>{IS_COMMERCIAL_DEPLOYMENT ? 'Tasks' : 'Post-production'}</WorkspaceMotionTitle>
          <p className="studio-muted">
            {IS_COMMERCIAL_DEPLOYMENT && !loading && !loadError ? `${pending.length} open ${pending.length === 1 ? 'task' : 'tasks'} · ${dueSoon.length} due in the next 7 days` : 'Assign the next step, track deadlines and keep client updates clear.'}
          </p>
        </div>
        {canWrite && <div className="studio-heading-actions">{(canEnquiries || !IS_COMMERCIAL_DEPLOYMENT) && <ApplyProductionTemplate onApplied={fetchWorkspace} initialProject={projectFilter === 'all' || projectFilter === 'unassigned' ? '' : projectFilter} />}<button className="studio-button primary" onClick={() => openEditor()}>
          <Plus size={16} /> Add task
        </button></div>}
      </div>
      {!canWrite && search.get('new') === '1' && <p className="workspace-info" role="status">Your workspace access allows you to view tasks. Ask a studio administrator to create this task.</p>}
      {IS_COMMERCIAL_DEPLOYMENT ? null : <div className="studio-metric-grid ops-metrics">
        {[
          {
            label: "Pending tasks",
            value: pending.length,
            icon: Film,
            detail: "In your production queue",
            tone: "plum",
          },
          {
            label: "Due in 7 days",
            value: dueSoon.length,
            icon: CalendarDays,
            detail: "Your upcoming priorities",
            tone: "gold",
          },
          {
            label: "Overdue",
            value: overdue.length,
            icon: Clock3,
            detail: "Need a little attention",
            tone: "rose",
          },
          {
            label: "Completed",
            value: completed.length,
            icon: CheckCheck,
            detail: "Tasks brought to the finish",
            tone: "sage",
          },
        ].map((metric) => (
          <div className="studio-metric" key={metric.label}>
            <div className="ops-metric-top">
              <span>{metric.label}</span>
              <span className={`ops-metric-icon ${metric.tone}`}>
                <metric.icon size={18} />
              </span>
            </div>
            <strong>{loading || loadError ? "—" : metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>}
      {loadError && (
        <OperationsError onRetry={retryWorkspace}>{loadError}</OperationsError>
      )}
      {IS_COMMERCIAL_DEPLOYMENT && !loading && !loadError && search.has('task') && !tasks.some(task => task._id === search.get('task')) && (
        <OperationsError onRetry={retryWorkspace}>This task is no longer available in this workspace.</OperationsError>
      )}
      <div className="ops-workspace-grid">
        <section className="studio-card ops-task-workspace">
          {!useTopbarSearch && <div className="ops-section-heading">
            {!IS_COMMERCIAL_DEPLOYMENT && <div>
              <h2 className="studio-section-title">
                Task workspace{" "}
                <span className="ops-count">
                  {loading || loadError ? "—" : tasks.length}
                </span>
              </h2>
              <p className="studio-muted">
                Open a task to edit its brief, assignment or client update.
              </p>
            </div>}
            {IS_COMMERCIAL_DEPLOYMENT ? viewSwitch : <ListChecks size={19} className="ops-quiet-icon" />}
          </div>}
          <div className="ops-task-controls" data-topbar-search={useTopbarSearch || undefined}>
            {useTopbarSearch ? viewSwitch : phoneStatus}
            {!useTopbarSearch && statusFilters}
            <div className="studio-toolbar ops-task-toolbar">
              {useTopbarSearch && phoneStatus}
              {!useTopbarSearch && <label className="studio-search ops-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing
                      || !window.matchMedia('(pointer: coarse)').matches) return;
                    event.preventDefault();
                    event.currentTarget.blur();
                  }}
                  placeholder="Search tasks or projects"
                  aria-label="Search tasks or projects"
                />
              </label>}
              <label className="production-project-filter"><span className="ops-sr-only">Project</span>
                <StudioSelect
                  className="studio-input ops-select"
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  aria-label="Filter by project"
                >
                  <option value="all">All projects</option>
                  <option value="unassigned">Studio tasks</option>
                  {leads.map((lead) => (
                    <option value={lead._id} key={lead._id}>
                      {lead.name}
                    </option>
                  ))}
                </StudioSelect>
              </label>
              <label className="ops-sort">
                <ArrowDownWideNarrow size={15} />
                <StudioSelect
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  aria-label="Sort tasks"
                >
                  <option value="due">Due date</option>
                  <option value="newest">Newest first</option>
                </StudioSelect>
              </label>
            </div>
            {useTopbarSearch && statusFilters}
          </div>
          {(query || projectFilter !== "all" || filter !== "all") && <div className="production-filter-feedback"><span>Filtered task view</span><StudioButton variant="ghost" onClick={() => { setQuery(""); setProjectFilter("all"); setFilter("all"); }}>Clear filters</StudioButton></div>}
          {nextTask && <ScheduledWorkAction
            title={'Next task · ' + nextTask.title}
            detail={[
              getProject(nextTask)?.name || (getLeadId(nextTask) ? 'Linked project' : 'Studio task'),
              Number.isFinite(Date.parse(nextTask.dueDate))
                ? (isOverdue(nextTask, today) ? 'Overdue · ' : 'Due ') + operationDate(nextTask.dueDate)
                : 'No due date yet',
            ].join(' · ')}
            action={canWrite && !Number.isFinite(Date.parse(nextTask.dueDate)) ? 'Set due date' : 'Review task'}
            onOpen={() => openEditor(nextTask)}
            disabled={Boolean(busyId)}
          />}
          {loading ? (
            <OperationsLoading label="Loading production tasks…" />
          ) : loadError && !tasks.length ? (
            <div className="studio-empty ops-empty">
              <ListChecks size={32} />
              <h3>Tasks are unavailable</h3>
              <p>Try again to reconnect to your production workspace.</p>
            </div>
          ) : filteredTasks.length ? (
            IS_COMMERCIAL_DEPLOYMENT && taskView === 'board' ? <CommercialTaskBoard tasks={filteredTasks} getProject={getProject} crew={crew} today={today} busyId={busyId} openEditor={openEditor} toggleTask={toggleTask} canWrite={canWrite} canDelete={canDelete} moveTask={moveTask} requestDelete={requestDelete} /> : <div className="ops-table-scroll">
              <table role="table" aria-label="Production tasks" className="studio-table ops-task-table studio-phone-record-table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th role="columnheader" scope="col">Task & project</th>
                    <th role="columnheader" scope="col">Due date</th>
                    <th role="columnheader" scope="col">Status</th>
                    {(!IS_COMMERCIAL_DEPLOYMENT || canWrite) && <th role="columnheader" scope="col">
                      {IS_COMMERCIAL_DEPLOYMENT ? 'Actions' : <span className="ops-sr-only">Actions</span>}
                    </th>}
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {filteredTasks.map((task) => {
                    const project = getProject(task);
                    const late = isOverdue(task, today);
                    const done = task.status === "completed";
                    return (
                      <tr role="row"
                        key={task._id} data-record-key={task._id}
                        aria-busy={busyId === task._id}
                        className={done ? "ops-task-done" : ""}
                      >
                        <td role="cell" data-label="Task & project">
                          {IS_COMMERCIAL_DEPLOYMENT ? <div className="sx-task-list-identity">
                            <button type="button" data-task-action="open" className="ops-title-button"
                              disabled={Boolean(busyId)} onClick={() => openEditor(task)}>{task.title}</button>
                            <p className="ops-task-project">
                              <FolderOpen size={13} aria-hidden="true" />
                              <span>{project?.name || (getLeadId(task) ? 'Linked project' : 'Studio task')}{project?.eventType && ' · ' + project.eventType}</span>
                            </p>
                            {(task.assignee || task.clientVisible) && <div className="sx-task-list-details">
                              {task.assignee && <span><UserRound size={13} aria-hidden="true" />{task.assignee.name || crew.find(person => person._id === task.assignee)?.name || 'Assigned crew'}</span>}
                              {task.clientVisible && <span><Eye size={13} aria-hidden="true" />{task.deliveryType ? task.deliveryType + ' · Client-visible' : 'Client-visible update'}</span>}
                            </div>}
                          </div> : (
                            <div className="ops-task-title">
                              <button
                                data-task-action="complete" className={`ops-complete-button ${done ? "is-complete" : ""}`}
                                disabled={!!busyId || !canWrite}
                                onClick={() => toggleTask(task)}
                                aria-label={`${done ? "Reopen" : "Complete"} task: ${task.title}`}
                              >
                                {done ? (
                                  <CheckCircle2 size={20} />
                                ) : (
                                  <Circle size={20} />
                                )}
                              </button>
                              <div>
                                <button
                                  data-task-action="open" className="ops-title-button"
                                  disabled={!!busyId}
                                  onClick={() => openEditor(task)}
                                >
                                  {task.title}
                                </button>
                                <span className="ops-task-project">
                                  <FolderOpen size={12} />
                                  {project?.name ||
                                    (getLeadId(task)
                                      ? "Linked project"
                                      : "Studio task")}
                                  {project?.eventType && (
                                    <i> / {project.eventType}</i>
                                  )}
                                </span>
                                {task.clientVisible && (
                                  <span className="ops-published-update">
                                    {task.deliveryType} · {task.productionStage} ·
                                    Client-visible
                                  </span>
                                )}
                                {task.assignee && (
                                  <span className="ops-published-update">
                                    {task.assignee.name ||
                                      crew.find(
                                        (person) => person._id === task.assignee,
                                      )?.name ||
                                      "Assigned crew"}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td role="cell" data-label="Due date">
                          <span
                            className={`ops-due ${late ? "is-overdue" : ""}`}
                          >
                            {task.dueDate ? (
                              <>
                                <CalendarDays size={13} aria-hidden="true" />
                                <span>{IS_COMMERCIAL_DEPLOYMENT && late && 'Overdue · '}{operationDate(task.dueDate)}</span>
                              </>
                            ) : (
                              "No due date"
                            )}
                          </span>
                          {late && !IS_COMMERCIAL_DEPLOYMENT && (
                            <small className="ops-overdue-caption">
                              Overdue
                            </small>
                          )}
                        </td>
                        <td role="cell" data-label="Status">
                          {IS_COMMERCIAL_DEPLOYMENT ? (
                            <span className={'sx-task-stage' + (done ? ' is-complete' : '')}>{done ? 'Completed' : task.productionStage || 'Not started'}</span>
                          ) : (
                            <span className={`studio-badge ops-status ${done ? "completed" : "pending"}`}>
                              <span />
                              {done ? "Completed" : "Pending"}
                            </span>
                          )}
                        </td>
                        {(!IS_COMMERCIAL_DEPLOYMENT || canWrite) && <td role="cell" data-label="Actions">
                          {IS_COMMERCIAL_DEPLOYMENT ? canWrite && (
                            <TaskActionButtons task={task} disabled={Boolean(busyId)} canDelete={canDelete}
                              onToggle={toggleTask} onEdit={openEditor} onDelete={requestDelete} />
                          ) : (
                            <div className="ops-row-actions">
                              {canWrite && <button
                                className="ops-icon-button"
                                disabled={!!busyId}
                                aria-label={`Edit task: ${task.title}`}
                                onClick={() => openEditor(task)}
                              >
                                <Pencil size={15} />
                              </button>}
                              {canDelete && <button
                                className="ops-icon-button"
                                disabled={!!busyId}
                                aria-label={`Delete task: ${task.title}`}
                                onClick={() => requestDelete(task)}
                              >
                                <Trash2 size={15} />
                              </button>}
                            </div>
                          )}
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="studio-empty ops-empty">
              <ListChecks size={32} />
              <h3>
                {tasks.length
                  ? "No tasks match this view"
                  : "No production tasks yet"}
              </h3>
              <p>
                {tasks.length
                  ? "Try another search or filter to find your task."
                  : "Add editing, review and delivery tasks, or start with a workflow template."}
              </p>
              {tasks.length ? (
                <button
                  className="studio-button"
                  onClick={() => {
                    setFilter("all");
                    setProjectFilter("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                canWrite && <button className="studio-button" onClick={() => openEditor()}>
                  <Plus size={15} /> Add your first task
                </button>
              )}
            </div>
          )}
          <div className="ops-table-footer">
            <span>
              {loading
                ? "Loading…"
                : loadError
                  ? "Task data unavailable"
                  : `${filteredTasks.length} of ${tasks.length} tasks`}
            </span>
            <span>{IS_COMMERCIAL_DEPLOYMENT && taskView === 'board' ? 'Grouped by production stage' : 'Pending → Completed'}</span>
          </div>
        </section>
        <aside className="ops-rail">
          <section className="studio-card ops-focus-card">

            <h2>Delivery focus</h2>
            <p className="studio-muted">The closest deadlines in your queue.</p>
            <div className="ops-next-tasks">
              {loading ? (
                <OperationsLoading label="Loading deadlines…" />
              ) : loadError && !tasks.length ? (
                <div className="ops-rail-empty">
                  <CalendarDays size={25} />
                  <p>Deadlines unavailable.</p>
                  <small>Reconnect your tasks to see their due dates.</small>
                </div>
              ) : nextTasks.length ? (
                nextTasks.map((task) => (
                  <button
                    className="ops-next-task"
                    key={task._id}
                    onClick={() => openEditor(task)}
                  >
                    <span
                      className={`ops-date-block ${isOverdue(task, today) ? "is-overdue" : ""}`}
                    >
                      <small>
                        {operationDate(task.dueDate, { month: "short" })}
                      </small>
                      <strong>
                        {operationDate(task.dueDate, { day: "2-digit" })}
                      </strong>
                    </span>
                    <span>
                      <strong>{task.title}</strong>
                      <small>{getProject(task)?.name || "Studio task"}</small>
                      {isOverdue(task, today) && <em>Overdue</em>}
                    </span>
                  </button>
                ))
              ) : (
                <div className="ops-rail-empty">
                  <CalendarDays size={25} />
                  <p>{IS_COMMERCIAL_DEPLOYMENT && tasks.length > 0 && !pending.length ? 'All production tasks are complete.' : 'No upcoming deadlines.'}</p>
                  {(pending.length > 0 || !IS_COMMERCIAL_DEPLOYMENT) && <small>Add a due date to bring a task into focus.</small>}
                </div>
              )}
            </div>
          </section>
          <section className="ops-progress-card">
            <span className="ops-progress-icon">
              <Check size={19} />
            </span>

            <h3>
              {loading || loadError
                ? "Progress unavailable"
                : `${completionRate}% complete`}
            </h3>
            <p>
              {loadError
                ? "Reconnect your task workspace to see progress."
                : `${completed.length} of ${tasks.length} tasks delivered.`}
            </p>
            <div
              className="ops-progress-track"
              role="progressbar"
              aria-label="Task completion"
              aria-valuenow={completionRate}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${completionRate}%` }} />
            </div>
            <small>Good stories deserve a thoughtful finish.</small>
          </section>
        </aside>
      </div>
      {!canWrite && editing && (
        <OperationsModal title={editing.title} onClose={() => setEditing(undefined)}>
          <p>{getProject(editing)?.name || (getLeadId(editing) ? 'Linked project' : 'Studio task')}</p>
          <p>{editing.status === 'completed' ? 'Completed' : editing.productionStage || 'Not started'} · {editing.dueDate ? 'Due ' + operationDate(editing.dueDate) : 'No due date'}</p>
          {editing.clientUpdate && <p>{editing.clientUpdate}</p>}
        </OperationsModal>
      )}
      {canWrite && editing !== undefined && (
        <OperationsModal
          title={editing ? "Edit production task" : "Add production task"}
          description="Give the next step a name, a project and a little clarity."
          onClose={() => setEditing(undefined)}
          busy={saving}
          footer={
            <>
              <button
                className="studio-button"
                disabled={saving}
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>
              <StudioButton type="submit" variant="primary" form="production-task-form" loading={saving} loadingLabel="Saving production task">{editing ? "Save changes" : "Add task"}</StudioButton>
            </>
          }
        >
          <form
            id="production-task-form"
            onSubmit={saveTask}
            className="ops-form production-task-editor"
          >
            {formError && <OperationsError>{formError}</OperationsError>}
            {linkNotice && <p className="studio-muted">{linkNotice}</p>}
            <label className="studio-field">
              <span>
                Internal task title <b>*</b>
              </span>
              <input
                className="studio-input"
                required
                maxLength={200}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="e.g. Review the wedding film"
              />
            </label>
            <div className="studio-form-grid">
              <label className="studio-field">
                <span>Due date</span>
                <input
                  className="studio-input"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm({ ...form, dueDate: event.target.value })
                  }
                />
              </label>
              <label className="studio-field">
                <span>Project</span>
                <StudioSelect title="Project"
                  className="studio-input"
                  value={form.lead}
                  disabled={!!editing || !!projectError}
                  onChange={(event) =>
                    setForm({ ...form, lead: event.target.value })
                  }
                >
                  <option value="">Studio task</option>
                  {editing && form.lead && !leadMap.has(form.lead) && (
                    <option value={form.lead}>
                      {getProject(editing)?.name || "Linked project"}
                    </option>
                  )}
                  {leads.map((lead) => (
                    <option key={lead._id} value={lead._id}>
                      {lead.name}
                    </option>
                  ))}
                </StudioSelect>
              </label>
            </div>
            <div className="studio-form-grid">
              <label className="studio-field">
                <span>Deliverable</span>
                <StudioSelect title="Deliverable"
                  className="studio-input"
                  value={form.deliveryType}
                  onChange={(event) =>
                    setForm({ ...form, deliveryType: event.target.value })
                  }
                >
                  {[
                    "Photos",
                    "Album",
                    "Traditional video",
                    "Cinematic video",
                    "Other",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </StudioSelect>
              </label>
              <label className="studio-field">
                <span>Production stage</span>
                <StudioSelect title="Production stage"
                  className="studio-input"
                  value={form.productionStage}
                  onChange={(event) =>
                    setForm({ ...form, productionStage: event.target.value })
                  }
                >
                  {[
                    "Not started",
                    "In progress",
                    "Editing",
                    "In review",
                    "Awaiting your selection",
                    "Ready",
                    "Uploaded to Drive",
                    "Delivered",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </StudioSelect>
              </label>
            </div>
            <label className="studio-field">
              <span>Assigned crew member</span>
              <StudioSelect title="Assigned crew member"
                className="studio-input"
                value={form.assignee}
                disabled={!canCrew || !!crewError}
                onChange={(event) =>
                  setForm({ ...form, assignee: event.target.value })
                }
              >
                <option value="">Not assigned</option>
                {form.assignee && !crew.some(person => person._id === form.assignee) && <option value={form.assignee}>{editing?.assignee?.name || "Current assigned crew member"}</option>}
                {crew.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.name} · {person.specialty}
                  </option>
                ))}
              </StudioSelect>
            </label>
            {crewError && <OperationsError onRetry={fetchWorkspace}>{crewError}</OperationsError>}
            <label className="ops-client-visibility">
              <input
                type="checkbox"
                checked={form.clientVisible}
                onChange={(event) =>
                  setForm({ ...form, clientVisible: event.target.checked })
                }
              />
              <span>
                <strong>Publish update to client</strong>
                <small>
                  Share this deliverable's stage, assigned crew and update on
                  the client's project link after their invoice is issued.
                </small>
              </span>
            </label>
            {form.clientVisible && (
              <>
                <label className="studio-field">
                  <span>Client-facing title</span>
                  <input
                    className="studio-input"
                    maxLength={200}
                    value={form.clientTitle}
                    onChange={(event) =>
                      setForm({ ...form, clientTitle: event.target.value })
                    }
                    placeholder={form.deliveryType}
                  />
                </label>
                <label className="studio-field">
                  <span>Client update</span>
                  <textarea
                    className="studio-input"
                    rows={3}
                    maxLength={2000}
                    value={form.clientUpdate}
                    onChange={(event) =>
                      setForm({ ...form, clientUpdate: event.target.value })
                    }
                    placeholder="A clear update about the work in progress."
                  />
                </label>
                <label className="studio-field">
                  <span>Delivery or review link</span>
                  <input
                    type="url"
                    className="studio-input"
                    value={form.deliveryUrl}
                    onChange={(event) =>
                      setForm({ ...form, deliveryUrl: event.target.value })
                    }
                    placeholder="https://drive.google.com/…"
                  />
                  <small className="ops-form-note">
                    Visible when ready, uploaded, delivered or awaiting the
                    client's selection. Use a folder with the intended client
                    access.
                  </small>
                </label>
              </>
            )}
            {editing && (
              <p className="ops-form-note">
                The project link is fixed once a task is created.
              </p>
            )}
            {projectError && <p className="ops-form-note">{projectError}</p>}
          </form>
        </OperationsModal>
      )}
      {canDelete && deleting && (
        <OperationsModal
          title="Delete this task?"
          description="This removes the task from the active production workspace and its client update. Owners can restore eligible records in Settings → Backups & recovery."
          onClose={() => setDeleting(null)}
          busy={saving}
          footer={
            <>
              <button
                className="studio-button"
                disabled={saving}
                onClick={() => setDeleting(null)}
              >
                Keep task
              </button>
              <StudioButton type="button" variant="destructive" loading={saving} onClick={deleteTask} loadingLabel="Deleting production task">Delete task</StudioButton>
            </>
          }
        >
          <p className="ops-delete-title">{deleting.title}</p>
          {formError && <OperationsError>{formError}</OperationsError>}
        </OperationsModal>
      )}
    </div>
  );
}

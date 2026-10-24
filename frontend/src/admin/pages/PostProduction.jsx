import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownWideNarrow,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock3,
  Film,
  FolderOpen,
  ListChecks,
  Pencil,
  Plus,
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

const getLeadId = (task) =>
  typeof task.lead === "object" ? task.lead?._id : task.lead;
const isOverdue = (task, today) =>
  task.status !== "completed" &&
  task.dueDate &&
  new Date(task.dueDate).getTime() < today;

export default function PostProduction() {
  const [search] = useSearchParams();
  const [crew, setCrew] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [crewError, setCrewError] = useState("");
  const [query, setQuery] = useState("");
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
  const [busyId, setBusyId] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [today, setToday] = useState(() => new Date().setHours(0, 0, 0, 0));

  const fetchWorkspace = useCallback(() => {
    return Promise.allSettled([
      axios.get(`${operationAPI}/api/tasks`, operationAuth()),
      axios.get(`${operationAPI}/api/leads`, operationAuth()),
      axios.get(`${operationAPI}/api/photographers`, operationAuth()),
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
  }, []);
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

  const openEditor = (task = null) => {
    setEditing(task);
    setForm({
      title: task?.title || "",
      dueDate: dateInputValue(task?.dueDate),
      lead:
        getLeadId(task || {}) ||
        (!["all", "unassigned"].includes(projectFilter) ? projectFilter : ""),
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
  const saveTask = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim()) {
      setFormError("Give this task a title.");
      return;
    }
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
          form.lead
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
      setSaving(false);
    }
  };
  const toggleTask = async (task) => {
    if (busyId) return;
    setBusyId(task._id);
    try {
      const response = await axios.patch(
        `${operationAPI}/api/tasks/${task._id}`,
        { status: task.status === "completed" ? "pending" : "completed" },
        operationAuth(),
      );
      setTasks((current) =>
        current.map((item) =>
          item._id === task._id
            ? { ...item, ...response.data, lead: item.lead }
            : item,
        ),
      );
      toast.success(
        task.status === "completed" ? "Task reopened." : "Task completed.",
      );
    } catch (error) {
      toast.error(operationError(error, "We couldn't update the task."));
    } finally {
      setBusyId("");
    }
  };
  const deleteTask = async () => {
    if (saving) return;
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

  return (
    <div className="studio-ops">
      <div className="studio-page-heading">
        <div>
          <p className="studio-eyebrow">Production workspace</p>
          <h1>Post-production</h1>
          <p className="studio-muted">
            A clear path from the last frame to the final delivery.
          </p>
        </div>
        <div className="studio-heading-actions"><ApplyProductionTemplate onApplied={fetchWorkspace} initialProject={projectFilter === 'all' || projectFilter === 'unassigned' ? '' : projectFilter} /><button className="studio-button primary" onClick={() => openEditor()}>
          <Plus size={16} /> Add task
        </button></div>
      </div>
      <div className="studio-metric-grid ops-metrics">
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
      </div>
      {loadError && (
        <OperationsError onRetry={retryWorkspace}>{loadError}</OperationsError>
      )}
      <div className="ops-workspace-grid">
        <section className="studio-card ops-task-workspace">
          <div className="ops-section-heading">
            <div>
              <h2 className="studio-section-title">
                Task workspace{" "}
                <span className="ops-count">
                  {loading || loadError ? "—" : tasks.length}
                </span>
              </h2>
              <p className="studio-muted">
                The work that moves each story forward.
              </p>
            </div>
            <ListChecks size={19} className="ops-quiet-icon" />
          </div>
          <div className="studio-tabs ops-tabs" aria-label="Filter tasks">
            {[
              { id: "all", label: "All tasks", count: tasks.length },
              { id: "pending", label: "Pending", count: pending.length },
              { id: "completed", label: "Completed", count: completed.length },
              { id: "overdue", label: "Overdue", count: overdue.length },
            ].map((tab) => (
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
          </div>
          <div className="studio-toolbar ops-task-toolbar">
            <label className="studio-search ops-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks or projects"
                aria-label="Search tasks or projects"
              />
            </label>
            <select
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
            </select>
            <label className="ops-sort">
              <ArrowDownWideNarrow size={15} />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort tasks"
              >
                <option value="due">Due date</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>
          {loading ? (
            <OperationsLoading label="Loading production tasks…" />
          ) : loadError && !tasks.length ? (
            <div className="studio-empty ops-empty">
              <ListChecks size={32} />
              <h3>Tasks are unavailable</h3>
              <p>Try again to reconnect to your production workspace.</p>
            </div>
          ) : filteredTasks.length ? (
            <div className="ops-table-scroll">
              <table className="studio-table ops-task-table">
                <thead>
                  <tr>
                    <th scope="col">Task & project</th>
                    <th scope="col">Due date</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="ops-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const project = getProject(task);
                    const late = isOverdue(task, today);
                    const done = task.status === "completed";
                    return (
                      <tr
                        key={task._id}
                        className={done ? "ops-task-done" : ""}
                      >
                        <td>
                          <div className="ops-task-title">
                            <button
                              className={`ops-complete-button ${done ? "is-complete" : ""}`}
                              disabled={!!busyId}
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
                                className="ops-title-button"
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
                        </td>
                        <td>
                          <span
                            className={`ops-due ${late ? "is-overdue" : ""}`}
                          >
                            {task.dueDate ? (
                              <>
                                <CalendarDays size={13} />
                                {operationDate(task.dueDate)}
                              </>
                            ) : (
                              "No due date"
                            )}
                          </span>
                          {late && (
                            <small className="ops-overdue-caption">
                              Overdue
                            </small>
                          )}
                        </td>
                        <td>
                          <span
                            className={`studio-badge ops-status ${done ? "completed" : "pending"}`}
                          >
                            <span />
                            {done ? "Completed" : "Pending"}
                          </span>
                        </td>
                        <td>
                          <div className="ops-row-actions">
                            <button
                              className="ops-icon-button"
                              disabled={!!busyId}
                              aria-label={`Edit task: ${task.title}`}
                              onClick={() => openEditor(task)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="ops-icon-button"
                              disabled={!!busyId}
                              aria-label={`Delete task: ${task.title}`}
                              onClick={() => {
                                setDeleting(task);
                                setFormError("");
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
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
                  : "Make room for your next great delivery"}
              </h3>
              <p>
                {tasks.length
                  ? "Try another search or filter to find your task."
                  : "Add editing, review and delivery tasks to keep the whole studio on track."}
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
                <button className="studio-button" onClick={() => openEditor()}>
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
            <span>Pending → Completed</span>
          </div>
        </section>
        <aside className="ops-rail">
          <section className="studio-card ops-focus-card">
            <p className="studio-eyebrow">Keep the momentum</p>
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
                  <p>No upcoming deadlines.</p>
                  <small>Add a due date to bring a task into focus.</small>
                </div>
              )}
            </div>
          </section>
          <section className="ops-progress-card">
            <span className="ops-progress-icon">
              <Check size={19} />
            </span>
            <p className="studio-eyebrow">The bigger picture</p>
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
      {editing !== undefined && (
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
              <button
                className="studio-button primary"
                type="submit"
                form="production-task-form"
                disabled={saving}
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add task"}
              </button>
            </>
          }
        >
          <form
            id="production-task-form"
            onSubmit={saveTask}
            className="ops-form"
          >
            {formError && <OperationsError>{formError}</OperationsError>}
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
                <select
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
                </select>
              </label>
            </div>
            <div className="studio-form-grid">
              <label className="studio-field">
                <span>Deliverable</span>
                <select
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
                </select>
              </label>
              <label className="studio-field">
                <span>Production stage</span>
                <select
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
                </select>
              </label>
            </div>
            <label className="studio-field">
              <span>Assigned crew member</span>
              <select
                className="studio-input"
                value={form.assignee}
                disabled={!!crewError}
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
              </select>
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
      {deleting && (
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
              <button
                className="studio-button ops-danger-button"
                disabled={saving}
                onClick={deleteTask}
              >
                {saving ? "Deleting…" : "Delete task"}
              </button>
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

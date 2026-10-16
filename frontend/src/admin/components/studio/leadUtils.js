export const LEAD_STATUSES = ["New", "Follow-up", "Meeting", "Negotiation", "Converted", "Archived"];
export const PAYMENT_STATUSES = ["Unpaid", "Deposit Paid", "Paid"];
export const studioApi = import.meta.env?.VITE_API_URL || "";
export const studioAuth = () => ({ headers: { "x-auth-token": localStorage.getItem("token") } });
export const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
export const displayDate = (value, fallback = "Not scheduled") => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : fallback;
};
export const dateInput = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : "";
export const initials = (name = "") => name.match(/[\p{L}\p{M}\p{N}]+/gu)?.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
export const statusClass = (value) => ({ New: "new", "Follow-up": "followup", Meeting: "meeting", Negotiation: "negotiation", Converted: "success", Archived: "muted", Paid: "success", "Deposit Paid": "followup", Unpaid: "muted", Pending: "followup", Cancelled: "muted" }[value] || "muted");
export const populatedTasks = (lead) => (lead.tasks || []).filter((task) => task && typeof task === "object" && task._id);
export const paidAmount = (lead) => lead.paymentStatus === "Paid" ? Number(lead.totalAmount) || 0 : lead.paymentStatus === "Deposit Paid" ? Number(lead.depositAmount) || 0 : 0;
export const remainingAmount = (lead) => Math.max(0, (Number(lead.totalAmount) || 0) - paidAmount(lead));
// PATCH /leads returns task IDs; retain the populated objects used by the workspace.
export const mergeLead = (previous, next) => {
  const previousTasks = previous.tasks || [];
  const tasks = !Array.isArray(next.tasks) ? previousTasks : next.tasks.map((task) => typeof task === "object" ? task : previousTasks.find((item) => typeof item === "object" && item._id === task) || task);
  return { ...previous, ...next, tasks };
};
export const matchesLead = (lead, query) => [lead.name, lead.email, lead.phone, lead.eventLocation, lead.eventType, ...(lead.people || [])].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase()));

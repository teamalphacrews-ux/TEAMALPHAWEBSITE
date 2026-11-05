import { API_BASE_URL } from "../../../utils/apiConfig";

export const operationAPI = API_BASE_URL;
export function operationAuth() {
  const token = (localStorage.getItem("token") || "").replace(/^["']|["']$/g, "").trim();
  return token && token !== "null" && token !== "undefined" ? { headers: { "x-auth-token": token } } : {};
}
export function operationError(error, fallback) {
  return error?.response?.data?.error || error?.response?.data?.message || fallback;
}
export function operationDate(value, options = { day: "numeric", month: "short" }) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-IN", options) : "No date set";
}
export function dateInputValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

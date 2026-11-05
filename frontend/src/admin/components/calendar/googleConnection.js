export const GOOGLE_PREVIEW_MESSAGE = "Google Calendar connects from the live Studio OS using a saved administrator account. This sample preview cannot connect to Google.";

export function googleCalendarHandoff(result, apiBase, pageOrigin) {
  const invalid = () => new Error("Google Calendar could not be opened. Please try again or contact your studio administrator.");
  if (typeof result?.url !== "string" || result.url.length > 2048) throw invalid();
  let target, api, page;
  try {
    target = new URL(result.url);
    api = new URL(apiBase || pageOrigin, pageOrigin);
    page = new URL(pageOrigin);
  } catch { throw invalid(); }
  const loopback = url => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const local = loopback(target);
  const localProxy = local && loopback(api) && loopback(page);
  if ((!localProxy && target.origin !== api.origin) || target.pathname !== "/api/auth/google/begin" ||
      target.username || target.password || target.hash ||
      (target.protocol !== "https:" && !(target.protocol === "http:" && local)) ||
      [...target.searchParams.keys()].length !== 1 ||
      !/^[a-f0-9]{64}$/.test(target.searchParams.get("ticket") || "")) throw invalid();
  return target.href;
}

export function googleConnectionError(error) {
  const message = error?.response?.data?.msg || error?.response?.data?.message || error?.message;
  return typeof message === "string" ? message.slice(0, 300) : "Google Calendar could not connect. Please try again.";
}

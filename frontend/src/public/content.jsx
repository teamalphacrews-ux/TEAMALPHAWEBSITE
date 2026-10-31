import { createContext, useContext, useEffect, useState } from "react";
import { defaultSiteContent } from "./siteData";

const SiteContentContext = createContext({
  content: defaultSiteContent,
  loading: false,
});

export function SiteContentProvider({ children }) {
  const [state, setState] = useState({
    content: defaultSiteContent,
    loading: true,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/website/content", {
      signal: controller.signal,
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Website content unavailable");
        return response.json();
      })
      .then((content) => {
        if (content?.site && Array.isArray(content.stories) && content.sections)
          setState({ content, loading: false });
        else setState({ content: defaultSiteContent, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ content: defaultSiteContent, loading: false });
      });
    return () => controller.abort();
  }, []);
  return (
    <SiteContentContext.Provider value={state}>
      {children}
    </SiteContentContext.Provider>
  );
}

// This hook and the provider intentionally share one small public module.
// eslint-disable-next-line react-refresh/only-export-components
export function useSiteContent() {
  return useContext(SiteContentContext);
}

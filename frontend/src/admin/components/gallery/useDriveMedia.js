import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../utils/apiConfig";
import { fetchDriveBlob } from "./protectedDrive";

export default function useDriveMedia(fileId, thumbnail = false) {
  const key = `${fileId || ""}:${thumbnail}`;
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!fileId) return;
    const controller = new AbortController();
    let objectUrl;
    fetchDriveBlob({
      baseUrl: API_BASE_URL,
      fileId,
      thumbnail,
      token: localStorage.getItem("token"),
      signal: controller.signal,
    })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ key, url: objectUrl });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, error: error.message });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, thumbnail, key]);
  return result?.key === key ? result : {};
}

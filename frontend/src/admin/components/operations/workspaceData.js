import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { operationAPI, operationAuth, operationError } from "./operationsUtils";
export const workspaceRequest = async (method, path, data) =>
  (await axios({ method, url: operationAPI + path, data, ...operationAuth() }))
    .data;
export function useWorkspaceData(paths) {
  const key = paths.join("|");
  const [data, setData] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const sequence = useRef(0);
  const fetchData = useCallback(() => {
    const id = ++sequence.current;
    return Promise.all(
      key.split("|").map((path) => workspaceRequest("get", path)),
    )
      .then((result) => {
        if (id === sequence.current) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (id === sequence.current)
          setError(
            operationError(
              err,
              "Your workspace could not be loaded. Please try again.",
            ),
          );
      })
      .finally(() => {
        if (id === sequence.current) setLoading(false);
      });
  }, [key]);
  const reload = useCallback(() => {
    setLoading(true);
    return fetchData();
  }, [fetchData]);
  useEffect(() => {
    const guard = sequence;
    fetchData();
    return () => {
      guard.current++;
    };
  }, [fetchData]);
  return { data, loading, error, reload };
}
export const recordDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not scheduled";
export const rupees = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
export const recordError = (error) =>
  operationError(error, "Your changes could not be saved. Please try again.");

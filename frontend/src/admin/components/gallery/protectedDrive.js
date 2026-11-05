export function driveMediaPath(
  fileId,
  { thumbnail = false, download = false } = {},
) {
  if (typeof fileId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(fileId)) {
    throw new Error("Invalid studio media.");
  }
  const query = new URLSearchParams();
  if (thumbnail) query.set("thumbnail", "true");
  if (download) query.set("download", "true");
  return `/api/drive-gallery/proxy/${fileId}${query.size ? `?${query}` : ""}`;
}

export async function fetchDriveBlob({
  baseUrl = "",
  fileId,
  token,
  thumbnail = false,
  download = false,
  signal,
  fetchImpl = fetch,
}) {
  if (!token) throw new Error("Sign in to view studio media.");
  const response = await fetchImpl(
    `${baseUrl.replace(/\/$/, "")}${driveMediaPath(fileId, { thumbnail, download })}`,
    {
      headers: { "x-auth-token": token },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Sign in as a studio administrator to view this media."
        : "Studio media could not be loaded.",
    );
  return response.blob();
}

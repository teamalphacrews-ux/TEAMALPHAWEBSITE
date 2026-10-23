import test from "node:test";
import assert from "node:assert/strict";
import {
  driveMediaPath,
  fetchDriveBlob,
} from "../src/admin/components/gallery/protectedDrive.js";

test("private media requests carry credentials only in a header and forbid redirects and cache storage", async () => {
  const controller = new AbortController();
  let request;
  const result = await fetchDriveBlob({
    baseUrl: "https://api.example.test/",
    fileId: "studio_file-1",
    token: "synthetic-admin-token",
    thumbnail: true,
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response("private-photo", {
        headers: { "content-type": "image/jpeg" },
      });
    },
  });
  assert.equal(await result.text(), "private-photo");
  assert.equal(
    request.url,
    "https://api.example.test/api/drive-gallery/proxy/studio_file-1?thumbnail=true",
  );
  assert.equal(request.url.includes("synthetic-admin-token"), false);
  assert.deepEqual(request.options.headers, {
    "x-auth-token": "synthetic-admin-token",
  });
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.signal, controller.signal);
});

test("missing credentials, invalid media identifiers and authorization denial never fall back to public URLs", async () => {
  let requests = 0;
  const fetchImpl = async () => {
    requests++;
    return new Response("Denied", { status: 403 });
  };
  await assert.rejects(
    () => fetchDriveBlob({ fileId: "photo", fetchImpl }),
    /Sign in/,
  );
  for (const fileId of [
    "../photo",
    "photo?token=secret",
    "photo#fragment",
    "",
    null,
  ]) {
    assert.throws(() => driveMediaPath(fileId), /Invalid/);
  }
  assert.equal(requests, 0);
  await assert.rejects(
    () =>
      fetchDriveBlob({
        fileId: "photo",
        token: "synthetic",
        thumbnail: true,
        fetchImpl,
      }),
    /administrator/,
  );
  assert.equal(requests, 1);
  assert.equal(
    driveMediaPath("photo", { download: true }),
    "/api/drive-gallery/proxy/photo?download=true",
  );
});

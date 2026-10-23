const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("node:stream");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const adminUserId = "507f1f77bcf86cd79943fd01";
const clientUserId = "507f1f77bcf86cd79943fd02";
// Authorization uses the saved account role, independent of JWT role claims.
test.beforeEach((t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => id === adminUserId ? { _id: id, role: "admin" }
      : id === clientUserId ? { _id: id, role: "client" } : null,
  }));
});
const router = require("../routes/driveGalleryRoutes");
const Drive = require("../services/googleDriveService");
const GalleryEvent = require("../models/GalleryEvent");

process.env.JWT_SECRET = "synthetic-drive-authorization-test";
const tokenFor = (role) =>
  jwt.sign(
    { user: { id: role === "admin" ? adminUserId : clientUserId, role } },
    process.env.JWT_SECRET,
  );
function dispatch(method, url, token, headers = {}, body = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url, "http://test.invalid");
    const req = {
      method,
      url,
      body,
      query: Object.fromEntries(parsed.searchParams),
      headers: { ...headers, ...(token ? { "x-auth-token": token } : {}) },
      header(name) {
        return this.headers[name.toLowerCase()];
      },
    };
    const chunks = [];
    const res = new Writable({
      write(chunk, encoding, done) {
        chunks.push(Buffer.from(chunk));
        done();
      },
    });
    res.statusCode = 200;
    res.headers = {};
    res.set = (name, value) => {
      res.headers[name.toLowerCase()] = value;
      return res;
    };
    res.type = (value) => res.set("Content-Type", value);
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.writeHead = (code, values) => {
      res.statusCode = code;
      for (const [name, value] of Object.entries(values)) res.set(name, value);
      res.headersSent = true;
      return res;
    };
    res.json = (value) => {
      res.jsonBody = value;
      res.end();
    };
    res.send = (value) => res.end(value);
    res.on("finish", () =>
      resolve({
        status: res.statusCode,
        headers: res.headers,
        body: res.jsonBody ?? Buffer.concat(chunks).toString(),
      }),
    );
    res.on("error", reject);
    router.handle(req, res, (error) =>
      error ? reject(error) : res.status(404).end(),
    );
  });
}

test("all retired Drive gallery routes reject anonymous and client access before provider or persistence", async (t) => {
  t.mock.method(Drive, "getDriveClient", () => {
    throw Error("Unauthorized provider access");
  });
  t.mock.method(Drive, "getFolderContents", () => {
    throw Error("Unauthorized folder access");
  });
  t.mock.method(GalleryEvent, "find", () => {
    throw Error("Unauthorized database access");
  });
  const requests = [
    ["GET", "/"],
    ["GET", "/users/clients"],
    ["GET", "/foreign-client/events"],
    ["GET", "/files/foreign-event"],
    ["GET", "/event/foreign-event"],
    ["GET", "/proxy/private-file"],
    ["GET", "/proxy/private-file?token=ignored&thumbnail=true"],
    ["POST", "/verify/search"],
    ["POST", "/verify/foreign-client"],
    ["POST", "/"],
    ["POST", "/foreign-client/events"],
    ["PATCH", "/foreign-client"],
    ["PATCH", "/events/foreign-event"],
    ["DELETE", "/foreign-client"],
    ["DELETE", "/events/foreign-event"],
  ];
  for (const [method, url] of requests) {
    assert.equal(
      (await dispatch(method, url)).status,
      401,
      `${method} ${url}: anonymous`,
    );
    assert.equal(
      (await dispatch(method, url, tokenFor("client"))).status,
      403,
      `${method} ${url}: client`,
    );
  }
});

test("administrators retain event and media listing access", async (t) => {
  let filter, folder;
  t.mock.method(GalleryEvent, "find", (query) => {
    filter = query;
    return { sort: async () => [{ _id: "event" }] };
  });
  t.mock.method(GalleryEvent, "findById", async () => ({
    driveFolderId: "studio-folder",
  }));
  t.mock.method(Drive, "getFolderContents", async (id) => {
    folder = id;
    return [{ id: "photo" }];
  });
  assert.deepEqual(
    (await dispatch("GET", "/studio-client/events", tokenFor("admin"))).body,
    [{ _id: "event" }],
  );
  assert.deepEqual(filter, { clientId: "studio-client" });
  assert.deepEqual(
    (await dispatch("GET", "/files/studio-event", tokenFor("admin"))).body,
    [{ id: "photo" }],
  );
  assert.equal(folder, "studio-folder");
});

test("authenticated original and range streams are private and validate byte ranges", async (t) => {
  const calls = [];
  t.mock.method(Drive, "getDriveClient", () => ({
    files: {
      get: async (options) => {
        calls.push(options);
        return options.alt
          ? { data: Readable.from(["safe-media"]) }
          : {
              data: { name: 'photo".jpg', mimeType: "image/jpeg", size: "10" },
            };
      },
    },
  }));
  const original = await dispatch(
    "GET",
    "/proxy/studio-file?download=true",
    tokenFor("admin"),
  );
  assert.equal(original.status, 200);
  assert.equal(original.body, "safe-media");
  assert.equal(original.headers["cache-control"], "private, no-store");
  assert.equal(original.headers["x-content-type-options"], "nosniff");
  assert.match(
    original.headers["content-disposition"],
    /^attachment; filename\*=UTF-8''photo%22.jpg$/,
  );
  const range = await dispatch("GET", "/proxy/studio-file", tokenFor("admin"), {
    range: "bytes=0-9",
  });
  assert.equal(range.status, 206);
  assert.equal(range.headers["content-range"], "bytes 0-9/10");
  assert.equal(range.headers["cache-control"], "private, no-store");
  const count = calls.filter((call) => call.alt).length;
  for (const value of [
    "bytes=-5",
    "bytes=9-4",
    "bytes=0-10",
    "bytes=0-1,4-5",
    "invalid",
  ]) {
    assert.equal(
      (
        await dispatch("GET", "/proxy/studio-file", tokenFor("admin"), {
          range: value,
        })
      ).status,
      416,
    );
  }
  assert.equal(
    calls.filter((call) => call.alt).length,
    count,
    "invalid ranges never request provider media",
  );
});

test("thumbnail bytes are proxied without exposing provider URLs or accepting arbitrary hosts", async (t) => {
  let thumbnailLink =
    "https://lh3.googleusercontent.com/synthetic-preview=s220";
  let requests = 0;
  t.mock.method(Drive, "getDriveClient", () => ({
    files: {
      get: async () => ({
        data: {
          name: "photo.jpg",
          mimeType: "image/jpeg",
          size: "10",
          thumbnailLink,
        },
      }),
    },
  }));
  t.mock.method(global, "fetch", async (url, options) => {
    requests++;
    assert.equal(url.hostname, "lh3.googleusercontent.com");
    assert.match(url.href, /=s1000$/);
    assert.equal(options.redirect, "error");
    return new Response("thumbnail", {
      headers: { "content-type": "image/jpeg" },
    });
  });
  const result = await dispatch(
    "GET",
    "/proxy/studio-file?thumbnail=true",
    tokenFor("admin"),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body, "thumbnail");
  assert.equal(result.headers.location, undefined);
  assert.equal(result.headers["cache-control"], "private, no-store");
  thumbnailLink = "https://example.com/untrusted-preview";
  assert.equal(
    (
      await dispatch(
        "GET",
        "/proxy/studio-file?thumbnail=true",
        tokenFor("admin"),
      )
    ).status,
    502,
  );
  assert.equal(requests, 1);
});

test("malformed Drive file IDs are rejected before creating a provider client", async (t) => {
  t.mock.method(Drive, "getDriveClient", () => {
    throw Error("Must not create provider client");
  });
  assert.equal(
    (await dispatch("GET", "/proxy/invalid.id", tokenFor("admin"))).status,
    400,
  );
});

test("HEIC original downloads keep original bytes and missing thumbnails never download full videos", async (t) => {
  let file = {
    name: "photo.heic",
    mimeType: "image/heic",
    size: "4",
    thumbnailLink: "https://lh3.googleusercontent.com/preview=s220",
  };
  let mediaRequests = 0;
  t.mock.method(Drive, "getDriveClient", () => ({
    files: {
      get: async (options) => {
        if (options.alt) {
          mediaRequests++;
          return { data: Readable.from(["heic"]) };
        }
        return { data: file };
      },
    },
  }));
  t.mock.method(global, "fetch", async () => {
    throw Error("An original download must not request a thumbnail");
  });
  assert.equal(
    (
      await dispatch(
        "GET",
        "/proxy/studio-file?download=true",
        tokenFor("admin"),
      )
    ).body,
    "heic",
  );
  assert.equal(mediaRequests, 1);
  file = { name: "film.mp4", mimeType: "video/mp4", size: "1000000" };
  assert.equal(
    (
      await dispatch(
        "GET",
        "/proxy/studio-file?thumbnail=true",
        tokenFor("admin"),
      )
    ).status,
    404,
  );
  assert.equal(mediaRequests, 1);
});

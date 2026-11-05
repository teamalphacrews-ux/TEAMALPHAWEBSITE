const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { Readable } = require("node:stream");
const { google } = require("googleapis");

test("new Drive uploads preserve provider permissions and never grant public reader access", async (t) => {
  t.mock.property(process, "env", {
    ...process.env,
    GOOGLE_CLIENT_EMAIL: "synthetic-service@example.test",
    GOOGLE_PRIVATE_KEY: "synthetic-test-key",
  });
  const uploads = [];
  let permissions = 0;
  const drive = {
    files: {
      async create(options) {
        uploads.push(options);
        return {
          data: {
            id: "synthetic-file",
            name: "Wedding photograph.webp",
            mimeType: "image/webp",
          },
        };
      },
    },
    permissions: {
      async create() {
        permissions += 1;
        throw new Error("Public ACL changes are forbidden");
      },
    },
  };
  t.mock.method(google, "drive", () => drive);
  t.mock.method(fs, "createReadStream", () =>
    Readable.from("synthetic image bytes"),
  );
  const service = require("../services/googleDriveService");
  const result = await service.uploadFile(
    {
      originalname: "original.webp",
      mimetype: "image/webp",
      path: "synthetic-input",
    },
    "Wedding photograph.webp",
  );
  assert.equal(result.id, "synthetic-file");
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].resource.name, "Wedding photograph.webp");
  assert.equal(uploads[0].media.mimeType, "image/webp");
  assert.equal(uploads[0].resource.permissions, undefined);
  assert.equal(permissions, 0);
});

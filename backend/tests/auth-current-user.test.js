const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createAuth } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const id = "507f1f77bcf86cd799439011";
const env = { JWT_SECRET: "isolated-current-user-test-key" };
const signed = (role = "admin", userId = id, extra = {}) =>
  jwt.sign({ user: { id: userId, role, ...extra } }, env.JWT_SECRET, {
    expiresIn: "1h",
  });
function setup(current, extraEnv = {}) {
  const lookups = [];
  const User = {
    findById(userId) {
      lookups.push(userId);
      return {
        async select(projection) {
          assert.equal(projection, "_id role");
          if (current instanceof Error) throw current;
          return current;
        },
      };
    },
  };
  return { auth: createAuth({ User, env: { ...env, ...extraEnv } }), lookups };
}
async function request(
  auth,
  token,
  { admin = false, legacyHeader = false } = {},
) {
  const req = {
    headers: token && !legacyHeader ? { authorization: "Bearer " + token } : {},
    header: () => (legacyHeader ? token : undefined),
  };
  const result = { statusCode: 200, passed: false };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  await auth(req, res, () => {
    if (admin)
      requireAdmin(req, res, () => {
        result.passed = true;
      });
    else result.passed = true;
  });
  return { ...result, user: req.user };
}

test("removed saved administrators cannot use previously valid REST tokens", async () => {
  const f = setup(null);
  const result = await request(f.auth, signed(), { admin: true });
  assert.equal(result.statusCode, 401);
  assert.equal(result.passed, false);
  assert.equal(result.user, undefined);
  assert.deepEqual(f.lookups, [id]);
});

test("demoted administrators use their current role and lose studio-wide access", async () => {
  const f = setup({ _id: id, role: "client" });
  const result = await request(f.auth, signed("admin"), { admin: true });
  assert.equal(result.statusCode, 403);
  assert.equal(result.passed, false);
  assert.deepEqual(result.user, { id, role: "client" });
  assert.equal((await request(f.auth, signed("admin"))).passed, true);
});

test("valid saved admins and clients retain their current permissions and no extra token claims", async () => {
  const admin = setup({ _id: id, role: "admin" });
  const allowed = await request(
    admin.auth,
    signed("admin", id, { privateClaim: "ignore" }),
    { admin: true },
  );
  assert.equal(allowed.passed, true);
  assert.deepEqual(allowed.user, { id, role: "admin" });
  assert.equal(
    (await request(admin.auth, signed(), { admin: true, legacyHeader: true }))
      .passed,
    true,
  );
  const client = setup({ _id: id, role: "client" });
  assert.equal((await request(client.auth, signed("client"))).passed, true);
  assert.equal(
    (await request(client.auth, signed("client"), { admin: true })).statusCode,
    403,
  );
});

test("the database role is authoritative after a legitimate role change", async () => {
  const f = setup({ _id: id, role: "admin" });
  const result = await request(f.auth, signed("client"), { admin: true });
  assert.equal(result.passed, true);
  assert.equal(result.user.role, "admin");
});

test("database errors fail closed without exposing driver diagnostics", async () => {
  const f = setup(new Error("private database diagnostic"));
  const result = await request(f.auth, signed(), { admin: true });
  assert.equal(result.statusCode, 503);
  assert.equal(result.passed, false);
  assert.equal(result.user, undefined);
  assert.ok(
    !JSON.stringify(result.body).includes("private database diagnostic"),
  );
});

test("invalid, missing and expired credentials never query the database", async () => {
  const f = setup({ _id: id, role: "admin" });
  for (const token of [
    undefined,
    "invalid",
    signed("admin", "bad-user-id"),
    jwt.sign({ user: { id, role: "admin" } }, env.JWT_SECRET, {
      expiresIn: -1,
    }),
  ]) {
    const result = await request(f.auth, token);
    assert.equal(result.statusCode, 401);
    assert.equal(result.passed, false);
  }
  assert.equal(f.lookups.length, 0);
});

test("bootstrap administrator access requires both configured credentials and an admin token", async () => {
  const virtual = signed("admin", "hardcoded-admin-id");
  for (const config of [
    {},
    { ADMIN_EMAIL: "bootstrap@example.test" },
    { ADMIN_PASSWORD: "synthetic-bootstrap-value" },
    { ADMIN_EMAIL: " ", ADMIN_PASSWORD: "synthetic-bootstrap-value" },
  ]) {
    const f = setup(null, config);
    assert.equal(
      (await request(f.auth, virtual, { admin: true })).statusCode,
      401,
    );
    assert.equal(f.lookups.length, 0);
  }
  const configured = setup(new Error("must not query database"), {
    ADMIN_EMAIL: "bootstrap@example.test",
    ADMIN_PASSWORD: "synthetic-bootstrap-value",
  });
  assert.equal(
    (await request(configured.auth, virtual, { admin: true })).passed,
    true,
  );
  assert.equal(
    (
      await request(configured.auth, signed("client", "hardcoded-admin-id"), {
        admin: true,
      })
    ).statusCode,
    401,
  );
  assert.equal(configured.lookups.length, 0);
});

const jwt = require("jsonwebtoken");

function createAuth({
  User = require("../models/User"),
  env = process.env,
} = {}) {
  return async function auth(req, res, next) {
    let token = req.header("x-auth-token");
    const authorization = req.headers?.authorization;
    if (
      !token &&
      typeof authorization === "string" &&
      authorization.startsWith("Bearer ")
    ) {
      token = authorization.slice(7).trim();
    }
    if (!token)
      return res.status(401).json({ msg: "No token, authorization denied" });

    let identity;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (
        !decoded.user ||
        typeof decoded.user.id !== "string" ||
        typeof decoded.user.role !== "string"
      ) {
        return res.status(401).json({ msg: "Token is not valid" });
      }
      identity = decoded.user;
    } catch {
      return res.status(401).json({ msg: "Token is not valid" });
    }

    // Keep the explicit deployment bootstrap available without inventing a
    // database account. Removing either configured credential disables it.
    if (identity.id === "hardcoded-admin-id") {
      if (
        identity.role !== "admin" ||
        typeof env.ADMIN_EMAIL !== "string" ||
        !env.ADMIN_EMAIL.trim() ||
        typeof env.ADMIN_PASSWORD !== "string" ||
        !env.ADMIN_PASSWORD.trim()
      ) {
        return res.status(401).json({ msg: "Token is not valid" });
      }
      req.user = { id: identity.id, role: "admin" };
      return next();
    }

    if (!/^[a-f\d]{24}$/i.test(identity.id))
      return res.status(401).json({ msg: "Token is not valid" });
    let current;
    try {
      current = await User.findById(identity.id).select("_id role");
    } catch {
      return res
        .status(503)
        .json({
          msg: "Authentication is temporarily unavailable. Please try again.",
        });
    }
    if (!current || typeof current.role !== "string" || !current.role) {
      return res.status(401).json({ msg: "Token is not valid" });
    }
    // A valid signature proves who signed in, not that an old role or a
    // deleted account should retain access for the token's entire lifetime.
    req.user = { id: String(current._id), role: current.role };
    return next();
  };
}

module.exports = createAuth();
module.exports.createAuth = createAuth;

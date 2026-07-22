import { publicError } from "./utils.js";

export function requireAdmin(req, _res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return next(publicError("ADMIN_API_TOKEN is not configured", 500));
  }

  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : req.get("x-admin-token");

  if (token !== expected) {
    return next(publicError("Unauthorized", 401));
  }

  return next();
}

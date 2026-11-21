const ROLES = Object.freeze({
  OWNER: "OWNER",
  LEARNER: "LEARNER",
  PARENT: "PARENT",
  TEACHER: "TEACHER",
  SCHOOL_ADMIN: "SCHOOL_ADMIN",
  SPONSOR_ADMIN: "SPONSOR_ADMIN",
  PLATFORM_ADMIN: "PLATFORM_ADMIN"
});

function hasRole(user, allowed) {
  return Boolean(user && allowed.includes(user.role));
}

function assertRole(user, allowed) {
  if (!hasRole(user, allowed)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { ROLES, hasRole, assertRole };

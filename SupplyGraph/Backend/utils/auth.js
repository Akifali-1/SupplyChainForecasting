const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", details: "Authentication required" });
  }
  next();
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized", details: "User session not found" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden", details: "Insufficient privileges for this action" });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };

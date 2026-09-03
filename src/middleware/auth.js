const jwt = require("jsonwebtoken");
const { User, Role } = require("../models");
const config = require("../config/config");

const isSuperAdminRole = (slug) =>
  slug === "super-admin" || slug === "superadmin";

// Authenticate admin users
exports.authenticateAdmin = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied, no token provided",
    });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin privileges required",
      });
    }

    const admin = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
      include: [{ model: Role, as: "role" }],
    });

    if (!admin || admin.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive admin",
      });
    }

    // Attach user info to request
    req.userId = admin.id;
    req.user = admin;
    req.userType = "admin";
    req.adminRole = admin.role?.slug || null;

    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Alias for authenticateAdmin (for backward compatibility)
exports.authenticateToken = exports.authenticateAdmin;

// Optional authentication (for public endpoints that might need user info)
exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type === "admin") {
      const admin = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
        include: [{ model: Role, as: "role" }],
      });

      if (admin && admin.status !== "inactive") {
        req.userId = admin.id;
        req.user = admin;
        req.userType = "admin";
        req.adminRole = admin.role?.slug || null;
      }
    }

    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};

// Check if admin has superadmin role
exports.requireSuperAdmin = (req, res, next) => {
  if (req.userType !== "admin" || !isSuperAdminRole(req.adminRole)) {
    return res.status(403).json({
      success: false,
      message: "Access denied, super-admin privileges required",
    });
  }
  next();
};

module.exports = exports;

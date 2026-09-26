const jwt = require("jsonwebtoken");
const { User } = require("../models");
const config = require("../config/config");

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
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin privileges required",
      });
    }

    const admin = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid admin",
      });
    }

    req.userId = admin.id;
    req.user = admin;
    req.userType = "admin";

    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
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
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type === "admin") {
      const admin = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });

      if (admin) {
        req.userId = admin.id;
        req.user = admin;
        req.userType = "admin";
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = exports;

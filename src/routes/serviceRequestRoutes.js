const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/serviceRequestController");
const { authenticateAdmin } = require("../middleware/auth");
const {
  publicSubmitLimiter,
  publicLookupLimiter,
} = require("../middleware/publicRateLimit");

// Public (no token)
router.post("/", publicSubmitLimiter, ctrl.create);
router.get("/track/:reference", publicLookupLimiter, ctrl.track);

// Admin
router.get("/", authenticateAdmin, ctrl.list);
router.get("/:id", authenticateAdmin, ctrl.getById);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;

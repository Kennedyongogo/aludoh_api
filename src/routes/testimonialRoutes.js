const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/testimonialController");
const { authenticateAdmin } = require("../middleware/auth");
const { publicSubmitLimiter } = require("../middleware/publicRateLimit");

// Public (no token)
router.get("/", ctrl.list);
router.post("/submit", publicSubmitLimiter, ctrl.submit);

// Admin
router.get("/admin", authenticateAdmin, ctrl.adminList);
router.get("/admin/options", authenticateAdmin, ctrl.options);
router.get("/admin/:id", authenticateAdmin, ctrl.adminGet);
router.post("/", authenticateAdmin, ctrl.create);
router.put("/reorder", authenticateAdmin, ctrl.reorder);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;

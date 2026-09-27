const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/certificateController");
const { authenticateAdmin } = require("../middleware/auth");
const { publicLookupLimiter } = require("../middleware/publicRateLimit");

// Public (no token)
router.get("/verify/:number", publicLookupLimiter, ctrl.verify);

// Admin
router.get("/admin", authenticateAdmin, ctrl.adminList);
router.get("/admin/:id", authenticateAdmin, ctrl.adminGet);
router.post("/", authenticateAdmin, ctrl.create);
router.post("/issue-session", authenticateAdmin, ctrl.issueForSession);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;

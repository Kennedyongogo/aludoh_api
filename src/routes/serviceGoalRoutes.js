const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/serviceGoalController");
const { authenticateAdmin } = require("../middleware/auth");

// Admin
router.get("/admin", authenticateAdmin, ctrl.adminList);
router.post("/", authenticateAdmin, ctrl.create);
router.put("/reorder", authenticateAdmin, ctrl.reorder);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

// Public
router.get("/", ctrl.list);

module.exports = router;

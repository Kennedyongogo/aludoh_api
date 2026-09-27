const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/articleController");
const { authenticateAdmin } = require("../middleware/auth");

// Admin (declared before /:slug so "admin" is never read as a slug)
router.get("/admin", authenticateAdmin, ctrl.adminList);
router.get("/admin/options", authenticateAdmin, ctrl.options);
router.get("/admin/:id", authenticateAdmin, ctrl.adminGet);
router.post("/", authenticateAdmin, ctrl.create);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

// Public
router.get("/", ctrl.list);
router.get("/:slug", ctrl.getBySlug);

module.exports = router;

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/roleController");
const {
  authenticateAdmin,
  requireSuperAdmin,
} = require("../middleware/auth");

router.get("/", authenticateAdmin, ctrl.list);
router.get("/:id", authenticateAdmin, ctrl.getById);
router.post("/", authenticateAdmin, requireSuperAdmin, ctrl.create);
router.put("/:id", authenticateAdmin, requireSuperAdmin, ctrl.update);
router.put(
  "/:id/permissions",
  authenticateAdmin,
  requireSuperAdmin,
  ctrl.setPermissions
);
router.delete("/:id", authenticateAdmin, requireSuperAdmin, ctrl.remove);

module.exports = router;

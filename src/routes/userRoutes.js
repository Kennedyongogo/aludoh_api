const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userController");
const { authenticateAdmin } = require("../middleware/auth");

router.post("/setup", ctrl.setup);
router.post("/login", ctrl.login);

router.get("/", authenticateAdmin, ctrl.list);
router.get("/:id", authenticateAdmin, ctrl.getById);
router.post("/", authenticateAdmin, ctrl.create);
router.put("/:id", authenticateAdmin, ctrl.update);
router.put("/:id/password", authenticateAdmin, ctrl.changePassword);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/serviceRequestController");
const { authenticateAdmin } = require("../middleware/auth");

router.get("/", authenticateAdmin, ctrl.list);
router.get("/:id", authenticateAdmin, ctrl.getById);
router.post("/", ctrl.create);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;

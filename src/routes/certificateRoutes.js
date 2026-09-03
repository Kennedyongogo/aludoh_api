const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/certificateController");
const { authenticateAdmin } = require("../middleware/auth");

router.get("/verify/:certificate_number", ctrl.verify);
router.get("/", authenticateAdmin, ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", authenticateAdmin, ctrl.create);
router.put("/:id", authenticateAdmin, ctrl.update);
router.delete("/:id", authenticateAdmin, ctrl.remove);

module.exports = router;
